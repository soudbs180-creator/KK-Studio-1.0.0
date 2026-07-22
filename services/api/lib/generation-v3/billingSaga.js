// services/api/lib/generation-v3/billingSaga.js
// 中文注释：Phase 1 计费 Saga。Job 创建时预扣、Item 成功时结算、失败时退款。
//          所有资金操作写入 ledger_entries，不再使用 credit_logs 作为 ledger。

const { getPool } = require('../db');
const credits = require('../credits');
const { generationV3Metrics } = require('./generationMetrics');

/**
 * 创建预扣记录并实际扣减用户积分。
 * @param {Object} params
 * @param {string} params.userId
 * @param {string} params.quoteId
 * @param {string} params.jobId
 * @param {string} [params.itemId]
 * @param {number} params.amount
 * @param {string} params.mediaType
 * @param {import('pg').PoolClient} params.client
 * @returns {Promise<string>} ledgerId
 */
async function reserveCredits({ userId, quoteId, jobId, itemId, amount, mediaType, client }) {
  if (amount <= 0) return null;

  const operationKey = operationKeyFromMediaType(mediaType);
  const ledgerRes = await client.query(
    `INSERT INTO public.ledger_entries
       (user_id, quote_id, job_id, item_id, type, amount, currency, status, metadata_json)
     VALUES ($1, $2, $3, $4, 'reserve', $5, 'credits', 'pending', $6)
     RETURNING ledger_id`,
    [userId, quoteId, jobId, itemId || null, amount, JSON.stringify({ reason: 'job-reserve' })]
  );
  const ledgerId = ledgerRes.rows[0].ledger_id;

  try {
    const balanceAfter = await credits.deductCredits(userId, amount, operationKey);
    await client.query(
      `UPDATE public.ledger_entries
          SET status = 'committed', updated_at = NOW()
        WHERE ledger_id = $1`,
      [ledgerId]
    );
    generationV3Metrics.recordEvent('reserveCommitted');
    return { ledgerId, balanceAfter };
  } catch (err) {
    generationV3Metrics.recordEvent('reserveFailed');
    await client.query(
      `UPDATE public.ledger_entries
          SET status = 'failed', updated_at = NOW(), metadata_json = metadata_json || $2
        WHERE ledger_id = $1`,
      [ledgerId, JSON.stringify({ error: err.message })]
    );
    throw err;
  }
}

/**
 * 将预扣转换为实际扣费（结算）。
 * @param {Object} params
 * @param {string} params.ledgerId
 * @param {string} params.itemId
 * @param {import('pg').PoolClient} params.client
 */
async function chargeFromReservation({ ledgerId, itemId, client }) {
  try {
    const result = await client.query(
      `UPDATE public.ledger_entries
          SET type = 'charge', item_id = $2, status = 'committed', updated_at = NOW(),
              metadata_json = metadata_json || $3
        WHERE ledger_id = $1 AND type = 'reserve' AND status = 'committed'
        RETURNING ledger_id`,
      [ledgerId, itemId, JSON.stringify({ reason: 'item-charge' })]
    );
    const eventName = result.rows.length === 1 ? 'chargeCommitted' : 'chargeNoop';
    generationV3Metrics.recordEvent(eventName);
    return result.rows.length === 1;
  } catch (err) {
    generationV3Metrics.recordEvent('chargeFailed');
    throw err;
  }
}

/**
 * 按 Item 退款。
 * @param {Object} params
 * @param {string} params.userId
 * @param {string} params.ledgerId
 * @param {number} params.amount
 * @param {string} params.itemId
 * @param {string} params.mediaType
 * @param {string} params.reason
 * @param {import('pg').PoolClient} params.client
 */
async function refundItem({ userId, ledgerId, amount, itemId, mediaType, reason, client }) {
  if (amount <= 0) return null;

  const operationKey = operationKeyFromMediaType(mediaType);
  const refundRes = await client.query(
    `INSERT INTO public.ledger_entries
       (user_id, item_id, type, amount, currency, status, metadata_json)
     VALUES ($1, $2, 'refund', $3, 'credits', 'pending', $4)
     RETURNING ledger_id`,
    [userId, itemId, amount, JSON.stringify({ reason, originalLedgerId: ledgerId })]
  );
  const refundLedgerId = refundRes.rows[0].ledger_id;

  try {
    const balanceAfter = await credits.refundCredits(userId, amount, operationKey, 0);
    await client.query(
      `UPDATE public.ledger_entries
          SET status = 'committed', updated_at = NOW()
        WHERE ledger_id = $1`,
      [refundLedgerId]
    );
    generationV3Metrics.recordEvent('refundCommitted');
    return { ledgerId: refundLedgerId, balanceAfter };
  } catch (err) {
    generationV3Metrics.recordEvent('refundFailed');
    await client.query(
      `UPDATE public.ledger_entries
          SET status = 'failed', updated_at = NOW(), metadata_json = metadata_json || $2
        WHERE ledger_id = $1`,
      [refundLedgerId, JSON.stringify({ error: err.message })]
    );
    throw err;
  }
}

function operationKeyFromMediaType(mediaType) {
  if (!mediaType || typeof mediaType !== 'string') {
    throw new Error('mediaType is required to derive operation_key for billing');
  }
  const normalized = String(mediaType).toLowerCase();
  if (!['image', 'video', 'audio', 'ppt', 'browser'].includes(normalized)) {
    throw new Error(`Unsupported mediaType for billing: ${mediaType}`);
  }
  return `${normalized}_generation`;
}

module.exports = {
  reserveCredits,
  chargeFromReservation,
  refundItem,
};
