// server/lib/generation/generationBillingSaga.js
// 中文注释：图像生成积分预扣、结算与退款管理 Saga

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

    // 2. 预扣除积分
    currentCredits = await credits.deductCredits(userId, requiredCredits, operationKey);
    creditsDeducted = true;

    try {
      // 3. 执行核心生成任务
      const result = await executeGenerateFn(input);

      // 4. 补充积分结算后的计费状态元数据
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
          balanceAfterRefund = await credits.refundCredits(userId, requiredCredits, operationKey, currentCredits);
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
