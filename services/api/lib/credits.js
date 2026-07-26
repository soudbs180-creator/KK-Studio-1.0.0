/**
 * @file credits.js
 * @module services/api/lib
 * @description 积分系统核心业务逻辑库。实现原子扣减防负数锁、退款、充值、管理员积分调整，以及 credit_logs 审计日志的记录。
 */

const { getPool } = require('./db');

const INSUFFICIENT_CREDITS_CODE = 'INSUFFICIENT_CREDITS';

function createInsufficientCreditsError(message = '积分不足，原子扣减失败') {
  const error = new Error(message);
  error.code = INSUFFICIENT_CREDITS_CODE;
  error.statusCode = 402;
  return error;
}

function isInsufficientCreditsError(error) {
  return Boolean(error) && error.code === INSUFFICIENT_CREDITS_CODE;
}

async function getOperationCost(clientOrPool, operationKey) {
  const result = await clientOrPool.query(
    'SELECT cost FROM public.api_cost_config WHERE operation_key = $1 AND is_active = true',
    [operationKey]
  );

  if (result.rows.length === 0) {
    throw new Error(`未配置可用的积分定价: ${operationKey}`);
  }

  const cost = Number.parseInt(result.rows[0].cost, 10);
  if (!Number.isInteger(cost) || cost < 0) {
    throw new Error(`积分定价非法: ${operationKey}`);
  }

  return cost;
}

async function writeCreditLog(clientOrPool, userId, delta, reason, operationKey, balanceAfter, actorId = null) {
  await clientOrPool.query(
    'INSERT INTO public.credit_logs (user_id, delta, reason, operation_key, balance_after, actor_id) VALUES ($1, $2, $3, $4, $5, $6)',
    [userId, delta, reason, operationKey, balanceAfter, actorId]
  );
}

async function getUserCredits(userId) {
  const pool = getPool();
  const result = await pool.query(
    'SELECT credits FROM public.users WHERE id = $1',
    [userId]
  );
  if (result.rows.length === 0) {
    return -1;
  }
  return Number.parseInt(result.rows[0].credits, 10);
}

function assertPositiveCreditAmount(amount, context) {
  const normalizedAmount = Number(amount);
  if (!Number.isSafeInteger(normalizedAmount) || normalizedAmount <= 0) {
    throw new Error(`${context} 的积分数量必须是正整数`);
  }
  return normalizedAmount;
}

async function deductCredits(userId, amount, operationKey, options = {}) {
  const pool = getPool();
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const updateRes = await client.query(
      'UPDATE public.users SET credits = credits - $1, updated_at = NOW() WHERE id = $2 AND credits >= $1 RETURNING credits',
      [amount, userId]
    );

    if (updateRes.rows.length === 0) {
      throw createInsufficientCreditsError();
    }

    const remaining = Number.parseInt(updateRes.rows[0].credits, 10);
    await writeCreditLog(client, userId, -amount, 'ai_deduct', operationKey, remaining, userId);

    // Saga 步骤一：扣款与任务单状态必须同事务提交，否则进程崩溃会留下
    // “积分已扣但任务单停留在 draft”的孤儿账单，对账守护将无法发现它。
    if (options.billingJobId) {
      await client.query(
        "UPDATE public.billing_jobs SET status = 'pending_deducted', updated_at = NOW() WHERE id = $1",
        [options.billingJobId]
      );
    }

    await client.query('COMMIT');
    return remaining;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

async function refundCredits(userId, amount, operationKey, originalBalance, options = {}) {
  const pool = getPool();
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Saga 补偿：带 billingJobId 时先原子抢占任务单（仅 pending_deducted 可退），
    // 抢占失败说明请求线程与对账守护（或多实例）已并发结算，跳过以防双重退款。
    if (options.billingJobId) {
      const claimRes = await client.query(
        "UPDATE public.billing_jobs SET status = 'refunded', updated_at = NOW() WHERE id = $1 AND status = 'pending_deducted' RETURNING id",
        [options.billingJobId]
      );
      if (claimRes.rows.length === 0) {
        await client.query('ROLLBACK');
        return null;
      }
    }

    const updateRes = await client.query(
      'UPDATE public.users SET credits = credits + $1, updated_at = NOW() WHERE id = $2 RETURNING credits',
      [amount, userId]
    );

    const remaining = updateRes.rows.length > 0
      ? Number.parseInt(updateRes.rows[0].credits, 10)
      : originalBalance + amount;

    await writeCreditLog(client, userId, amount, 'ai_refund', operationKey, remaining, userId);

    await client.query('COMMIT');
    return remaining;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

async function addCredits(client, userId, amount, reason, referenceId, actorId = null) {
  const normalizedAmount = assertPositiveCreditAmount(amount, '积分入账');
  const updateRes = await client.query(
    'UPDATE public.users SET credits = COALESCE(credits, 0) + $1, updated_at = NOW() WHERE id = $2 RETURNING credits',
    [normalizedAmount, userId]
  );

  if (updateRes.rows.length === 0) {
    throw new Error(`找不到用户 ID 为 ${userId} 的结算账户`);
  }

  const remaining = Number.parseInt(updateRes.rows[0].credits, 10);
  await writeCreditLog(client, userId, normalizedAmount, reason, referenceId, remaining, actorId);
  return remaining;
}

async function adjustCreditsByAdmin(adminUserId, userId, delta, note) {
  const pool = getPool();
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const updateRes = await client.query(
      'UPDATE public.users SET credits = GREATEST(0, credits + $1), updated_at = NOW() WHERE id = $2 RETURNING credits',
      [delta, userId]
    );

    if (updateRes.rows.length === 0) {
      throw new Error('目标用户不存在');
    }

    const remaining = Number.parseInt(updateRes.rows[0].credits, 10);
    await writeCreditLog(client, userId, delta, 'admin_adjust', note || 'admin_adjust', remaining, adminUserId);

    await client.query('COMMIT');
    return remaining;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}
async function recordTokenUsage(userId, tokensUsed, actionId, costUsd = 0) {
  const pool = getPool();
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // 1. 查询该用户是否存在 token_accounts，如不存在则在当前事务中自动开户
    let accountRes = await client.query(
      'SELECT id FROM billing_token.token_accounts WHERE user_id = $1',
      [userId]
    );

    let userAccountId;
    if (accountRes.rows.length === 0) {
      const insertRes = await client.query(
        'INSERT INTO billing_token.token_accounts (user_id) VALUES ($1) RETURNING id',
        [userId]
      );
      userAccountId = insertRes.rows[0].id;
    } else {
      userAccountId = accountRes.rows[0].id;
    }

    // 2. 插入 token_usage 记录
    await client.query(
      'INSERT INTO billing_token.token_usage (user_account_id, action_id, tokens_used, cost_usd) VALUES ($1, $2, $3, $4)',
      [userAccountId, actionId, tokensUsed, costUsd]
    );

    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

module.exports = {
  INSUFFICIENT_CREDITS_CODE,
  getOperationCost,
  getUserCredits,
  deductCredits,
  refundCredits,
  addCredits,
  adjustCreditsByAdmin,
  recordTokenUsage,
  isInsufficientCreditsError,
};
