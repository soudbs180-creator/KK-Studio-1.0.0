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
let lastCleanupAt = 0;

// 悬空判定阈值。阈值必须显著大于最坏在途时长，否则守护会把仍在途的请求提前退款，
// 请求随后成功就形成“免费生成 + 假退款”。最坏在途时长的推导：
//   - 异步媒体 Provider 轮询上限（services/api/lib/dispatcher/adapters/wuyin/suchuangProvider.js
//     的 _submitAndPoll）：图像 90 次 × 5s = 7.5 分钟，视频 180 次 × 5s = 15 分钟；
//   - dispatcher 会按渠道 × Key 串行 failover，上述耗时会成倍放大；
//   - 同步 chat 单次超时 60s、最多 3 次重试，量级远小于媒体轮询。
// 取 60 分钟，对视频轮询上限留 4 倍余量。代价是崩溃后的自动退款最长延迟 60 分钟，
// 但请求线程自身的 catch 分支才是主退款路径，守护只兜底进程崩溃这一小概率场景。
const STALE_JOB_INTERVAL = '60 minutes';

// draft 状态表示任务单已建但从未扣款（余额不足或崩溃于扣款前），无资金风险，
// 仅做卫生清理避免表内永久堆积。
const STALE_DRAFT_INTERVAL = '1 day';

// 历史充值/交易流水的物理清理为低频维护动作，限制为每 24 小时至多一次，
// 避免每轮对账都执行 DELETE 扫全表并过早销毁审计数据。
const CLEANUP_MIN_INTERVAL_MS = 24 * 60 * 60 * 1000;

function shouldSkipReconciliationDaemon() {
  return process.env.NODE_ENV === 'test'
    || process.env.KKAI_LOCAL_ONLY === 'true'
    || !String(process.env.DATABASE_URL || '').trim();
}

/**
 * 低频物理清理超过 2 个月的充值和交易记录（每 24 小时至多执行一次）
 */
async function cleanupExpiredAuditRows(pool) {
  const now = Date.now();
  if (now - lastCleanupAt < CLEANUP_MIN_INTERVAL_MS) {
    return;
  }
  lastCleanupAt = now;

  try {
    await pool.query("DELETE FROM public.recharge_submissions WHERE created_at < NOW() - INTERVAL '2 months'");
    await pool.query("DELETE FROM public.credit_transactions WHERE created_at < NOW() - INTERVAL '2 months'");
    console.log('[Reconciliation] 成功物理清理 2 个月前的历史充值与交易数据');
  } catch (cleanupErr) {
    console.error('[Reconciliation] 物理清理 2 个月前的历史数据失败:', cleanupErr);
  }
}

/**
 * 执行超时挂起任务的自动补偿对账与退费
 */
async function reconcilePendingJobs() {
  const pool = getPool();

  try {
    await cleanupExpiredAuditRows(pool);

    // 卫生清理：超期 draft 从未扣款，直接标记 failed，不产生退款。
    await pool.query(
      `UPDATE public.billing_jobs SET status = 'failed', updated_at = NOW()
       WHERE status = 'draft' AND updated_at < NOW() - INTERVAL '${STALE_DRAFT_INTERVAL}'`
    );

    // 扫描悬空扣费任务：已扣款（pending_deducted）但超过阈值仍未结算/退款，
    // 视为请求线程已崩溃或挂起，执行 Saga 补偿退款。
    const { rows } = await pool.query(
      `SELECT id, user_id, operation_key, required_credits
       FROM public.billing_jobs
       WHERE status = 'pending_deducted'
         AND updated_at < NOW() - INTERVAL '${STALE_JOB_INTERVAL}'
       LIMIT 50`
    );

    if (rows.length === 0) {
      return;
    }

    console.log(`[Reconciliation] 发现 ${rows.length} 个悬空扣费任务，开始自动执行 Saga 退款补偿...`);

    for (const job of rows) {
      const { id: jobId, user_id: userId, operation_key: operationKey, required_credits: requiredCredits } = job;
      const creditsAmount = Number(requiredCredits);

      try {
        // refundCredits 在同一事务内：原子抢占任务单（仅 pending_deducted 可退）
        // → 加回积分 → 写审计日志 → 置 refunded。抢占失败返回 null，说明请求
        // 线程或其他实例已并发结算，天然幂等，多实例部署不会双重退款。
        const refundResult = await credits.refundCredits(userId, creditsAmount, operationKey, 0, { billingJobId: jobId });
        if (refundResult === null) {
          console.log(`[Reconciliation] 任务 ${jobId} 已被并发结算，跳过补偿`);
        } else {
          console.log(`[Reconciliation] 任务 ${jobId} 已安全回滚并标记为 refunded. 用户: ${userId} | 积分: ${creditsAmount}`);
        }
      } catch (refundErr) {
        console.error(`[P0 FATAL] Saga 自动补偿退款失败! 任务 ID: ${jobId}, 用户 ID: ${userId}, 错误: ${refundErr.message}`);
        // 标记 failed 进入人工审查队列，避免持续失败的任务每轮空转重试。
        // 标记本身失败也必须吞掉，否则单个坏任务会中断整批补偿。
        try {
          await pool.query(
            "UPDATE public.billing_jobs SET status = 'failed', updated_at = NOW() WHERE id = $1 AND status = 'pending_deducted'",
            [jobId]
          );
        } catch (markErr) {
          console.error(`[Reconciliation] 标记任务 ${jobId} 为 failed 失败:`, markErr);
        }
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
