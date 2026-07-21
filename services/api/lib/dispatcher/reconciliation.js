/**
 * @file reconciliation.js
 * @module services/api/lib/dispatcher/reconciliation
 * @description 后端计费 Saga 事务二阶段收尾（Reconciliation）守护进程。
 *              定时扫描超时悬空的扣减积分请求，执行自动对账补偿，确保分布式账务最终一致性。
 * @author KK-Studio Team
 */

const { getPool } = require('../db');
const credits = require('../credits');

let timerId = null;

function shouldSkipReconciliationDaemon() {
  return process.env.NODE_ENV === 'test'
    || process.env.KKAI_LOCAL_ONLY === 'true'
    || !String(process.env.DATABASE_URL || '').trim();
}

/**
 * 执行超时挂起任务的自动补偿对账与退费
 */
async function reconcilePendingJobs() {
  const pool = getPool();

  try {
    // 物理清理超过 2 个月的充值和交易记录
    try {
      await pool.query("DELETE FROM public.recharge_submissions WHERE created_at < NOW() - INTERVAL '2 months'");
      await pool.query("DELETE FROM public.credit_transactions WHERE created_at < NOW() - INTERVAL '2 months'");
      console.log('[Reconciliation] 成功物理清理 2 个月前的历史充值与交易数据');
    } catch (cleanupErr) {
      console.error('[Reconciliation] 物理清理 2 个月前的历史数据失败:', cleanupErr);
    }

    // 简体中文：扫描状态为 'pending_deducted' 且更新时间已过去 2 分钟以上的超期悬空任务单
    const { rows } = await pool.query(
      `SELECT id, user_id, operation_key, required_credits 
       FROM public.billing_jobs 
       WHERE status = 'pending_deducted' 
         AND updated_at < NOW() - INTERVAL '2 minutes'
       LIMIT 50`
    );

    if (rows.length === 0) {
      return;
    }

    console.log(`[Reconciliation] 发现 ${rows.length} 个悬空扣费任务，开始自动执行 Saga 退款补偿...`);

    for (const job of rows) {
      const { id: jobId, user_id: userId, operation_key: operationKey, required_credits: requiredCredits } = job;
      const creditsAmount = Number(requiredCredits);

      console.log(`[Reconciliation] 正在为任务 ${jobId} 执行自动补偿退款. 用户: ${userId} | 积分: ${creditsAmount}`);

      let refundSuccess = false;
      try {
        // 简体中文：执行原子退款
        await credits.refundCredits(userId, creditsAmount, operationKey, 0);
        refundSuccess = true;
      } catch (refundErr) {
        console.error(`[P0 FATAL] Saga 自动补偿退款失败! 任务 ID: ${jobId}, 用户 ID: ${userId}, 错误: ${refundErr.message}`);
      }

      if (refundSuccess) {
        // 更新为 refunded
        await pool.query(
          "UPDATE public.billing_jobs SET status = 'refunded', updated_at = NOW() WHERE id = $1",
          [jobId]
        );
        console.log(`[Reconciliation] 任务 ${jobId} 已安全回滚并标记为 refunded`);
      } else {
        // 失败，标记为 failed 并等待人工审查
        await pool.query(
          "UPDATE public.billing_jobs SET status = 'failed', updated_at = NOW() WHERE id = $1",
          [jobId]
        );
      }
    }
  } catch (err) {
    console.error('[Reconciliation Error] 定时对账失败:', err);
  }
}

/**
 * 启动收尾对账守护进程
 * @param {number} intervalMs 轮询间隔，默认 60000ms (60秒)
 */
function startReconciliationDaemon(intervalMs = 60000) {
  if (timerId !== null) {
    return;
  }

  if (shouldSkipReconciliationDaemon()) {
    console.log('[Reconciliation] Local-only, test, or missing DATABASE_URL runtime; skipping scheduled reconciliation daemon.');
    return;
  }

  console.log(`[Reconciliation] Saga 收尾守护进程已启动，轮询间隔: ${intervalMs}ms`);

  // 启动后延迟 10s 首次执行，避免与服务初始化抢占 CPU
  setTimeout(() => {
    reconcilePendingJobs().catch(() => {});
  }, 10000);

  timerId = setInterval(() => {
    reconcilePendingJobs().catch(() => {});
  }, intervalMs);
}

/**
 * 停止守护进程
 */
function stopReconciliationDaemon() {
  if (timerId !== null) {
    clearInterval(timerId);
    timerId = null;
    console.log('[Reconciliation] Saga 收尾守护进程已停止');
  }
}

module.exports = {
  startReconciliationDaemon,
  stopReconciliationDaemon,
  reconcilePendingJobs, // 导出以便于测试执行
  shouldSkipReconciliationDaemon
};
