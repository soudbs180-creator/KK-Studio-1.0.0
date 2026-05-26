// server/lib/credits.js
// 职责：统一管理所有用户积分及变动日志操作，禁止在路由中直接编写积分增删的 SQL。
// 遵守规范：通过数据库事务与 credits >= amount 锁条件约束，保障并发情况下的原子性，防止负分和超卖。所有注释均为中文。

const { getPool } = require('./db');

/**
 * 从数据库动态获取指定 AI 操作对应的积分消耗量
 * @param {object} clientOrPool - pg 客户端连接（支持传入事务中的 client 或是全局 Pool）
 * @param {string} operationKey - 操作 key（'image_generation' | 'image_edit'）
 * @returns {Promise<number>} 操作消耗积分数
 */
async function getOperationCost(clientOrPool, operationKey) {
  try {
    const result = await clientOrPool.query(
      "SELECT cost FROM public.api_cost_config WHERE operation_key = $1 AND is_active = true",
      [operationKey]
    );
    if (result.rows.length > 0) {
      return parseInt(result.rows[0].cost, 10);
    }
  } catch (err) {
    // 降级容灾：若本地尚未创建该表，不阻断交易，降级使用默认定价
    console.warn(`[积分配置] 无法从数据库读取操作 "${operationKey}" 的配置（可能表不存在），将使用本地默认定价。`, err.message);
  }

  // 默认：编辑图 15 分，普通生成图 10 分
  return operationKey === 'image_edit' ? 15 : 10;
}

/**
 * 记录积分变动流水到 credit_logs 审计表中
 * @param {object} clientOrPool - pg 客户端连接（支持事务 client）
 * @param {string} userId - 用户 ID
 * @param {number} delta - 变动额度（负代表扣减，正代表增加）
 * @param {string} reason - 变动原因标识（如 'ai_deduct', 'ai_refund', 'stripe_webhook'）
 * @param {string} operationKey - 操作类型或外部关联标识
 * @param {number} balanceAfter - 变动后的用户最新余额
 */
async function writeCreditLog(clientOrPool, userId, delta, reason, operationKey, balanceAfter) {
  try {
    await clientOrPool.query(
      "INSERT INTO public.credit_logs (user_id, delta, reason, operation_key, balance_after) VALUES ($1, $2, $3, $4, $5)",
      [userId, delta, reason, operationKey, balanceAfter]
    );
  } catch (err) {
    // 降级容灾：若流水日志表尚未创建，仅输出控制台警告，不阻断主链路交易
    console.warn(`[积分日志] 写入审计日志失败（可能表不存在）: 用户 ${userId}, 变动 ${delta}, 原因 ${reason}。`, err.message);
  }
}

/**
 * 查询指定用户的当前剩余积分余额（用户不存在则返回 -1）
 * @param {string} userId - 用户 ID
 * @returns {Promise<number>} 用户当前剩余积分，不存在返回 -1
 */
async function getUserCredits(userId) {
  const pool = getPool();
  const result = await pool.query(
    "SELECT credits FROM public.users WHERE id = $1",
    [userId]
  );
  if (result.rows.length === 0) {
    return -1;
  }
  return parseInt(result.rows[0].credits, 10);
}

/**
 * 原子扣减用户积分（调用 AI 接口之前执行）
 * 使用 WHERE credits >= $1 保证扣减的原子性与完整性，决不扣为负数。
 * 内部自包事务与流水审计日志。
 * @param {string} userId - 用户 ID
 * @param {number} amount - 需要扣减的积分额度
 * @param {string} operationKey - 操作类型键
 * @returns {Promise<number>} 扣减后的用户剩余余额
 */
async function deductCredits(userId, amount, operationKey) {
  const pool = getPool();
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // 原子扣减，credits >= amount 作为更新的前置行级锁条件
    const updateRes = await client.query(
      "UPDATE public.users SET credits = credits - $1, updated_at = NOW() WHERE id = $2 AND credits >= $1 RETURNING credits",
      [amount, userId]
    );

    if (updateRes.rows.length === 0) {
      await client.query('ROLLBACK');
      throw new Error("积分不足，原子扣减失败");
    }

    const remaining = parseInt(updateRes.rows[0].credits, 10);

    // 记录扣除流水
    await writeCreditLog(client, userId, -amount, "ai_deduct", operationKey, remaining);

    await client.query('COMMIT');
    return remaining;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

/**
 * 退还用户积分（当 AI 接口调用失败时回退）
 * 内部包事务与流水审计日志。
 * @param {string} userId - 用户 ID
 * @param {number} amount - 退回的额度
 * @param {string} operationKey - 操作类型键
 * @param {number} originalBalance - 扣减前（或扣减失败时）的暂存余额，用作降级流水底数
 * @returns {Promise<number>} 退回后的用户最新余额
 */
async function refundCredits(userId, amount, operationKey, originalBalance) {
  const pool = getPool();
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const updateRes = await client.query(
      "UPDATE public.users SET credits = credits + $1, updated_at = NOW() WHERE id = $2 RETURNING credits",
      [amount, userId]
    );

    const remaining = updateRes.rows.length > 0
      ? parseInt(updateRes.rows[0].credits, 10)
      : originalBalance + amount;

    // 记录退回流水
    await writeCreditLog(client, userId, amount, "ai_refund", operationKey, remaining);

    await client.query('COMMIT');
    return remaining;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

/**
 * Stripe Webhook 回调支付成功后给用户充值积分
 * 内部使用数据库连接池事务以及行级锁，确保多实例下处理 Stripe 回调的安全幂等与原子写入。
 * @param {object} client - 从订单模块传下来的带事务连接对象 client，保证和订单状态修改是同一个事务
 * @param {string} userId - 充值目标用户 ID
 * @param {number} amount - 充值获得的积分额度
 * @param {string} reason - 充值事由（如 'stripe_webhook'）
 * @param {string} referenceId - 关联支付流水会话 ID（stripe_session_id）
 * @returns {Promise<number>} 充值后的用户最新余额
 */
async function addCredits(client, userId, amount, reason, referenceId) {
  const updateRes = await client.query(
    "UPDATE public.users SET credits = COALESCE(credits, 0) + $1, updated_at = NOW() WHERE id = $2 RETURNING credits",
    [amount, userId]
  );

  if (updateRes.rows.length === 0) {
    throw new Error(`找不到用户 ID 为 ${userId} 的结算账户`);
  }

  const remaining = parseInt(updateRes.rows[0].credits, 10);

  // 记录充值审计日志
  await writeCreditLog(client, userId, amount, reason, referenceId, remaining);
  return remaining;
}

module.exports = {
  getOperationCost,
  getUserCredits,
  deductCredits,
  refundCredits,
  addCredits,
};
