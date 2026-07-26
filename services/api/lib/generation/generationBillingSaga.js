// services/api/lib/generation/generationBillingSaga.js
// 中文注释：图像生成积分预扣、结算与退款管理 Saga

const crypto = require('crypto');
const credits = require('../credits');
const { getPool } = require('../db');

class GenerationBillingSaga {
  /**
   * 执行带有积分生命周期控制的生成事务
   * @param {string} userId 用户ID
   * @param {string} operationKey 操作标识 ('image_generation' 或 'image_edit')
   * @param {Object} input 标准生成入参
   * @param {Function} executeGenerateFn 底层生成逻辑，接受 input 并返回 StandardImageGenerationResult
   */
  async execute(userId, operationKey, input, executeGenerateFn) {
    const pool = getPool();
    let requiredCredits = 0;
    let currentCredits = 0;
    let creditsDeducted = false;

    // 1. 获取本次操作所需额度并检查余额
    requiredCredits = await credits.getOperationCost(pool, operationKey);
    const availableCredits = await credits.getUserCredits(userId);
    
    if (availableCredits < 0) {
      const err = new Error('User not found.');
      err.code = 'USER_NOT_FOUND';
      err.statusCode = 401;
      throw err;
    }

    if (availableCredits < requiredCredits) {
      const err = new Error('Insufficient credits.');
      err.code = 'INSUFFICIENT_CREDITS';
      err.statusCode = 402;
      err.currentCredits = availableCredits;
      err.requiredCredits = requiredCredits;
      throw err;
    }

    // 2. 建立持久化任务单。图像生成要等待 Provider 长耗时返回，若此期间进程崩溃/重启，
    //    没有任务单就没有任何线索可供对账守护发现，用户积分会被空扣且永远无法自动退回。
    //    以 requestId 作主键，重复提交不再重复扣费（计费端点的重放保护）。
    const billingJobId = String(input?.requestId || '').trim() || crypto.randomUUID();
    const jobClaim = await pool.query(
      `INSERT INTO public.billing_jobs (id, user_id, operation_key, required_credits, status)
       VALUES ($1, $2, $3, $4, 'draft')
       ON CONFLICT (id) DO NOTHING
       RETURNING id`,
      [billingJobId, userId, operationKey, requiredCredits]
    );

    if (jobClaim.rowCount === 0) {
      const err = new Error('Duplicate requestId for a billed generation. No credits were charged.');
      err.code = 'DUPLICATE_REQUEST';
      err.statusCode = 409;
      err.requestId = billingJobId;
      throw err;
    }

    // 3. 预扣除积分。扣款与任务单置为 pending_deducted 在同一事务内提交。
    currentCredits = await credits.deductCredits(userId, requiredCredits, operationKey, { billingJobId });
    creditsDeducted = true;

    try {
      // 4. 执行核心生成任务
      const result = await executeGenerateFn(input);

      // 5. 结算：仅允许 pending_deducted → completed。抢占失败说明对账守护已在超时
      //    窗口后退款，此时服务已交付但积分被退，必须告警人工复核。
      const settleRes = await pool.query(
        "UPDATE public.billing_jobs SET status = 'completed', updated_at = NOW() WHERE id = $1 AND status = 'pending_deducted'",
        [billingJobId]
      );
      if (settleRes.rowCount === 0) {
        console.error('[P0 ALERT] 生成任务结算冲突：任务已被对账守护提前退款，但生成最终成功', {
          jobId: billingJobId,
          userId,
          cost: requiredCredits,
        });
      }

      // 6. 补充积分结算后的计费状态元数据
      result.billing = {
        deducted: true,
        balanceAfter: currentCredits,
        refundApplied: false
      };

      return result;
    } catch (generateErr) {
      console.error('[Billing Saga] Core generation failed. Triggering refund...', generateErr);
      
      // 5. 异常回滚：发起积分退款
      let refundFailed = false;
      let balanceAfterRefund = currentCredits;
      
      if (creditsDeducted) {
        try {
          // 退款与任务单置为 refunded 同事务提交，并以 pending_deducted 原子抢占；
          // 返回 null 表示对账守护已并发退款，跳过以防双重退款。
          const refundResult = await credits.refundCredits(userId, requiredCredits, operationKey, currentCredits, { billingJobId });
          if (refundResult === null) {
            console.warn(`[Billing Saga] 任务 ${billingJobId} 已由对账守护并发退款，跳过重复补偿`);
            balanceAfterRefund = await credits.getUserCredits(userId);
          } else {
            balanceAfterRefund = refundResult;
          }
        } catch (refundErr) {
          refundFailed = true;
          // P0 级别严重告警，必须人工介入
          console.error('[P0 ALERT] 积分退款失败，需人工介入', {
            userId,
            cost: requiredCredits,
            originalError: generateErr.message,
            refundError: refundErr.message,
            timestamp: new Date().toISOString(),
            requestId: input.requestId,
          });
        }
      }

      if (refundFailed) {
        // 标记为 failed 进入人工审查队列，避免对账守护每轮空转重试同一笔坏账。
        // 标记本身失败不得掩盖原始退款失败告警。
        try {
          await pool.query(
            "UPDATE public.billing_jobs SET status = 'failed', updated_at = NOW() WHERE id = $1 AND status = 'pending_deducted'",
            [billingJobId]
          );
        } catch (markErr) {
          console.error(`[Billing Saga] 标记任务 ${billingJobId} 为 failed 失败:`, markErr);
        }

        const err = new Error('Image generation or edit failed. Credit refund failed and requires manual intervention.');
        err.code = 'REFUND_FAILED';
        err.statusCode = 500;
        err.requestId = input.requestId;
        throw err;
      }

      // 组装并重新抛出带有退款明细的异常
      const err = new Error(generateErr.message || 'Image generation or edit failed. Credits refunded.');
      err.code = generateErr.code || 'AI_GENERATION_FAILED';
      err.statusCode = generateErr.statusCode || 500;
      err.requestId = input.requestId;
      err.billing = {
        deducted: true,
        balanceAfter: balanceAfterRefund,
        refundApplied: true
      };
      
      throw err;
    }
  }
}

module.exports = new GenerationBillingSaga();
