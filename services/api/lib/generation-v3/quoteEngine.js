// services/api/lib/generation-v3/quoteEngine.js
// 中文注释：GenerationQuote 创建引擎。冻结通道、Provider 快照、价格版本与过期时间。

const crypto = require('crypto');
const { getPool } = require('../db');
const credits = require('../credits');
const { selectRoute, buildRouteSnapshot } = require('./routeEngine');
const { resolveQuoteConnectionRoute } = require('../capability-graph/generationConnectionResolver');
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
async function resolveQuoteRoute(userId, request, options) {
  const resolveConnection = options.resolveQuoteConnectionRoute || resolveQuoteConnectionRoute;
  const connectionRoute = await resolveConnection(userId, request, options.connectionDependencies);
  const channel = connectionRoute?.channel || request.preferredChannel || 'platform-credits';
  const route = selectRoute({
    mediaType: request.mediaType,
    model: request.model,
    channel,
    providerHint: request.providerHint,
    options: { connectionRoute },
  });
  return { channel, connectionRoute, route };
}

async function assertSufficientBalance(userId, channel, cost, creditsApi) {
  if (channel !== 'platform-credits' || typeof cost.credits !== 'number') return;
  const balance = await creditsApi.getUserCredits(userId);
  if (balance >= cost.credits) return;
  const error = new Error('Insufficient credits for quote.');
  error.code = 'INSUFFICIENT_CREDITS';
  error.statusCode = 402;
  error.currentCredits = balance;
  error.requiredCredits = cost.credits;
  throw error;
}

function buildQuote(userId, request, routeContext, cost) {
  const now = new Date();
  const connectionRoute = routeContext.connectionRoute || {};
  return {
    quoteId: crypto.randomUUID(),
    mediaType: request.mediaType,
    model: request.model,
    count: request.count,
    routeSnapshot: buildRouteSnapshot({
      ...connectionRoute,
      providerId: routeContext.route.providerId,
      model: request.model,
      adapterId: routeContext.route.adapterId,
      capabilityVersion: routeContext.route.capabilityVersion,
      baseUrl: connectionRoute.endpoint,
      channel: routeContext.channel,
    }),
    channel: routeContext.channel,
    cost: { ...cost, priceVersion: generatePriceVersion() },
    expiresAt: new Date(now.getTime() + QUOTE_TTL_SECONDS * 1000).toISOString(),
    createdAt: now.toISOString(),
    ownerId: userId,
  };
}

async function persistQuote(pool, quote) {
  await pool.query(
    `INSERT INTO public.generation_quotes
       (quote_id, user_id, media_type, model, count, channel, cost_credits, cost_provider_quota,
        price_version, route_snapshot_json, expires_at, created_at, updated_at, status)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $12, 'active')`,
    [
      quote.quoteId,
      quote.ownerId,
      quote.mediaType,
      quote.model,
      quote.count,
      quote.channel,
      quote.cost.credits ?? null,
      quote.cost.providerQuota ?? null,
      quote.cost.priceVersion,
      JSON.stringify(quote.routeSnapshot),
      quote.expiresAt,
      quote.createdAt,
    ]
  );
}

/** Creates a quote whose Provider route can be reproduced without client-side reselection. */
async function createQuote(userId, rawRequest, options = {}) {
  const request = CreateQuoteRequestSchema.parse(rawRequest);
  const routeContext = await resolveQuoteRoute(userId, request, options);
  const pool = options.pool || getPool();
  const cost = await computeCost({
    mediaType: request.mediaType,
    model: request.model,
    channel: routeContext.channel,
    count: request.count,
    client: pool,
  });
  await assertSufficientBalance(userId, routeContext.channel, cost, options.credits || credits);
  const quote = buildQuote(userId, request, routeContext, cost);
  await persistQuote(pool, quote);
  return GenerationQuoteDtoSchema.parse(quote);
}

function createQuoteNotFoundError() {
  const err = new Error('Quote not found.');
  err.code = 'QUOTE_NOT_FOUND';
  err.statusCode = 404;
  return err;
}

function createQuoteExpiredError() {
  const err = new Error('Quote expired.');
  err.code = 'QUOTE_EXPIRED';
  err.statusCode = 410;
  return err;
}

function parseQuoteRow(row) {
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

async function fetchQuoteRow(client, userId, quoteId, { requireActive = false } = {}) {
  const result = await client.query(
    `SELECT * FROM public.generation_quotes
      WHERE quote_id = $1 AND user_id = $2`,
    [quoteId, userId]
  );

  if (result.rows.length === 0) {
    throw createQuoteNotFoundError();
  }

  const row = result.rows[0];

  if (requireActive && row.status !== 'active') {
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
    throw createQuoteExpiredError();
  }

  return parseQuoteRow(row);
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
  return fetchQuoteRow(client, userId, quoteId, { requireActive: true });
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
  return fetchQuoteRow(client, userId, quoteId);
}

module.exports = {
  createQuote,
  getActiveQuote,
  getQuote,
  consumeQuote,
  QUOTE_TTL_SECONDS,
};
