// server/lib/generation-v3/quoteEngine.js
// 中文注释：GenerationQuote 创建引擎。冻结通道、Provider 快照、价格版本与过期时间。

const crypto = require('crypto');
const { getPool } = require('../db');
const credits = require('../credits');
const { selectRoute, buildRouteSnapshot } = require('./routeEngine');
const {
  CreateQuoteRequestSchema,
  GenerationQuoteDtoSchema,
} = require('@kk/shared');

const QUOTE_TTL_SECONDS = 300;

function generatePriceVersion() {
  return `pv-${Date.now().toString(36)}-${crypto.randomBytes(4).toString('hex')}`;
}

/**
 * 根据 mediaType/model/channel 计算价格。
 * Phase 1 使用简化定价；后续接入 api_cost_config 与 provider quota 表。
 * @param {Object} params
 * @param {string} params.mediaType
 * @param {string} params.model
 * @param {string} params.channel
 * @param {number} params.count
 * @param {import('pg').Pool|import('pg').PoolClient} [params.client]
 * @returns {{ credits?: number, providerQuota?: number }}
 */
async function computeCost({ mediaType, model, channel, count, client }) {
  const poolOrClient = client || getPool();

  if (channel === 'platform-credits') {
    const operationKey = mediaType === 'image' && model.includes('edit') ? 'image_edit' : `${mediaType}_generation`;
    const costPerUnit = await credits.getOperationCost(poolOrClient, operationKey);
    return { credits: costPerUnit * count };
  }

  if (channel === 'byok' || channel === 'cloud-key') {
    // BYOK / 云端 Key 消耗用户 Provider 配额，平台不扣积分
    return { providerQuota: count };
  }

  if (channel === 'web-membership') {
    return { providerQuota: count };
  }

  // setup-required 无价格
  return {};
}

/**
 * 创建报价。
 * @param {string} userId
 * @param {Object} rawRequest
 * @returns {Promise<import('@kk/shared').GenerationQuoteDto>}
 */
async function createQuote(userId, rawRequest) {
  const request = CreateQuoteRequestSchema.parse(rawRequest);

  // 默认通道：未指定时按是否有可用用户 Key Slot 推导；Phase 1 默认平台积分
  const channel = request.preferredChannel || 'platform-credits';

  const route = selectRoute({
    mediaType: request.mediaType,
    model: request.model,
    channel,
    providerHint: request.providerHint,
  });

  const cost = await computeCost({
    mediaType: request.mediaType,
    model: request.model,
    channel,
    count: request.count,
  });

  // 平台积分通道检查余额
  if (channel === 'platform-credits' && typeof cost.credits === 'number') {
    const balance = await credits.getUserCredits(userId);
    if (balance < cost.credits) {
      const err = new Error('Insufficient credits for quote.');
      err.code = 'INSUFFICIENT_CREDITS';
      err.statusCode = 402;
      err.currentCredits = balance;
      err.requiredCredits = cost.credits;
      throw err;
    }
  }

  const quoteId = crypto.randomUUID();
  const now = new Date();
  const expiresAt = new Date(now.getTime() + QUOTE_TTL_SECONDS * 1000);
  const priceVersion = generatePriceVersion();
  const routeSnapshot = buildRouteSnapshot({
    providerId: route.providerId,
    model: request.model,
    adapterId: route.adapterId,
    capabilityVersion: route.capabilityVersion,
  });

  const pool = getPool();
  await pool.query(
    `INSERT INTO public.generation_quotes
       (quote_id, user_id, media_type, model, count, channel, cost_credits, cost_provider_quota,
        price_version, route_snapshot_json, expires_at, created_at, updated_at, status)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $12, 'active')`,
    [
      quoteId,
      userId,
      request.mediaType,
      request.model,
      request.count,
      channel,
      cost.credits ?? null,
      cost.providerQuota ?? null,
      priceVersion,
      JSON.stringify(routeSnapshot),
      expiresAt.toISOString(),
      now.toISOString(),
    ]
  );

  const quote = {
    quoteId,
    mediaType: request.mediaType,
    model: request.model,
    count: request.count,
    routeSnapshot,
    channel,
    cost: {
      credits: cost.credits,
      providerQuota: cost.providerQuota,
      priceVersion,
    },
    expiresAt: expiresAt.toISOString(),
    createdAt: now.toISOString(),
    ownerId: userId,
  };

  return GenerationQuoteDtoSchema.parse(quote);
}

/**
 * 读取并校验报价是否有效。
 * @param {string} userId
 * @param {string} quoteId
 * @param {Object} [options]
 * @param {import('pg').PoolClient} [options.client]
 * @returns {Promise<import('@kk/shared').GenerationQuoteDto>}
 */
async function getActiveQuote(userId, quoteId, options = {}) {
  const client = options.client || getPool();
  const result = await client.query(
    `SELECT * FROM public.generation_quotes
      WHERE quote_id = $1 AND user_id = $2`,
    [quoteId, userId]
  );

  if (result.rows.length === 0) {
    const err = new Error('Quote not found.');
    err.code = 'QUOTE_NOT_FOUND';
    err.statusCode = 404;
    throw err;
  }

  const row = result.rows[0];
  if (row.status !== 'active') {
    const err = new Error(`Quote is ${row.status}.`);
    err.code = 'QUOTE_EXPIRED';
    err.statusCode = 410;
    throw err;
  }

  if (new Date(row.expires_at) < new Date()) {
    await client.query(
      `UPDATE public.generation_quotes SET status = 'expired', updated_at = NOW() WHERE quote_id = $1`,
      [quoteId]
    );
    const err = new Error('Quote expired.');
    err.code = 'QUOTE_EXPIRED';
    err.statusCode = 410;
    throw err;
  }

  return GenerationQuoteDtoSchema.parse({
    quoteId: row.quote_id,
    mediaType: row.media_type,
    model: row.model,
    count: row.count,
    routeSnapshot: row.route_snapshot_json,
    channel: row.channel,
    cost: {
      credits: row.cost_credits ?? undefined,
      providerQuota: row.cost_provider_quota ?? undefined,
      priceVersion: row.price_version,
    },
    expiresAt: new Date(row.expires_at).toISOString(),
    createdAt: new Date(row.created_at).toISOString(),
    ownerId: row.user_id,
  });
}

/**
 * 将报价标记为已消费。
 * @param {string} quoteId
 * @param {import('pg').PoolClient} [client]
 */
async function consumeQuote(quoteId, client) {
  const poolOrClient = client || getPool();
  await poolOrClient.query(
    `UPDATE public.generation_quotes
        SET status = 'consumed', updated_at = NOW()
      WHERE quote_id = $1`,
    [quoteId]
  );
}

/**
 * 读取报价（不强制 active，用于 Job 提交阶段读取已消费报价）。
 * @param {string} userId
 * @param {string} quoteId
 * @param {Object} [options]
 * @param {import('pg').PoolClient} [options.client]
 * @returns {Promise<import('@kk/shared').GenerationQuoteDto>}
 */
async function getQuote(userId, quoteId, options = {}) {
  const client = options.client || getPool();
  const result = await client.query(
    `SELECT * FROM public.generation_quotes
      WHERE quote_id = $1 AND user_id = $2`,
    [quoteId, userId]
  );

  if (result.rows.length === 0) {
    const err = new Error('Quote not found.');
    err.code = 'QUOTE_NOT_FOUND';
    err.statusCode = 404;
    throw err;
  }

  const row = result.rows[0];

  if (new Date(row.expires_at) < new Date()) {
    await client.query(
      `UPDATE public.generation_quotes SET status = 'expired', updated_at = NOW() WHERE quote_id = $1`,
      [quoteId]
    );
    const err = new Error('Quote expired.');
    err.code = 'QUOTE_EXPIRED';
    err.statusCode = 410;
    throw err;
  }

  return GenerationQuoteDtoSchema.parse({
    quoteId: row.quote_id,
    mediaType: row.media_type,
    model: row.model,
    count: row.count,
    routeSnapshot: row.route_snapshot_json,
    channel: row.channel,
    cost: {
      credits: row.cost_credits ?? undefined,
      providerQuota: row.cost_provider_quota ?? undefined,
      priceVersion: row.price_version,
    },
    expiresAt: new Date(row.expires_at).toISOString(),
    createdAt: new Date(row.created_at).toISOString(),
    ownerId: row.user_id,
  });
}

module.exports = {
  createQuote,
  getActiveQuote,
  getQuote,
  consumeQuote,
  QUOTE_TTL_SECONDS,
};
