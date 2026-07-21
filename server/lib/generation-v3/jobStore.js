// server/lib/generation-v3/jobStore.js
// 中文注释：GenerationJob v3 持久化存储。支持创建、读取、状态更新、Provider task id 与 Asset 落盘。

const crypto = require('crypto');
const { getPool } = require('../db');
const {
  GenerationJobDtoV3Schema,
  GenerationJobItemV3Schema,
} = require('@kk/shared');

const DEFAULT_MAX_RETRIES = 3;

/**
 * 创建 Job 与 Items。
 * @param {Object} params
 * @param {import('@kk/shared').GenerationQuoteDto} params.quote
 * @param {string} params.userId
 * @param {Object} [params.payload]
 * @param {string[]} [params.canvasNodeIds]
 * @param {import('pg').PoolClient} [params.client]
 * @returns {Promise<import('@kk/shared').GenerationJobDto>}
 */
async function createJob({ quote, userId, payload, canvasNodeIds, client }) {
  const poolOrClient = client || getPool();
  const jobId = crypto.randomUUID();
  const now = new Date().toISOString();
  const status = 'quoted';

  await poolOrClient.query(
    `INSERT INTO public.generation_jobs
       (job_id, user_id, workspace_id, task_type, provider, status, schema_version,
        quote_id, channel, model_code, capability_version, anonymous_key_slot_id,
        total_cost_credits, total_cost_provider_quota, payload_json, created_at, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, 3, $7, $8, $9, $10, $11, $12, $13, $14, $15, $15)`,
    [
      jobId,
      userId,
      'default',
      quote.mediaType,
      quote.routeSnapshot.providerId,
      status,
      quote.quoteId,
      quote.channel,
      quote.model,
      quote.routeSnapshot.capabilityVersion,
      null,
      quote.cost.credits ?? null,
      quote.cost.providerQuota ?? null,
      JSON.stringify(payload || {}),
      now,
    ]
  );

  const items = [];
  for (let i = 0; i < quote.count; i += 1) {
    const itemId = crypto.randomUUID();
    const canvasNodeId = canvasNodeIds?.[i] || null;
    await poolOrClient.query(
      `INSERT INTO public.generation_job_items
         (item_id, job_id, sequence, status, payload_json, canvas_node_id, created_at, updated_at)
       VALUES ($1, $2, $3, 'pending', $4, $5, $6, $6)`,
      [itemId, jobId, i, JSON.stringify({ ...(payload || {}), prompt: payload?.prompt || '', mediaType: quote.mediaType }), canvasNodeId, now]
    );
    items.push({
      itemId,
      sequence: i,
      status: 'pending',
      reconciliation: 'pending',
    });
  }

  return GenerationJobDtoV3Schema.parse({
    jobId,
    quoteId: quote.quoteId,
    channel: quote.channel,
    provider: quote.routeSnapshot.providerId,
    model: quote.model,
    capabilityVersion: quote.routeSnapshot.capabilityVersion,
    status,
    items,
    createdAt: now,
    updatedAt: now,
    ownerId: userId,
    retryCount: 0,
    maxRetries: DEFAULT_MAX_RETRIES,
  });
}

/**
 * 读取 Job。
 * @param {string} jobId
 * @param {string} userId
 * @param {Object} [options]
 * @param {import('pg').PoolClient} [options.client]
 * @returns {Promise<import('@kk/shared').GenerationJobDto|null>}
 */
async function getJob(jobId, userId, options = {}) {
  const poolOrClient = options.client || getPool();
  const jobRes = await poolOrClient.query(
    `SELECT * FROM public.generation_jobs WHERE job_id = $1 AND user_id = $2`,
    [jobId, userId]
  );
  if (jobRes.rows.length === 0) return null;
  const jobRow = jobRes.rows[0];

  const itemsRes = await poolOrClient.query(
    `SELECT * FROM public.generation_job_items WHERE job_id = $1 ORDER BY sequence`,
    [jobId]
  );

  const items = itemsRes.rows.map((row) => GenerationJobItemV3Schema.parse({
    itemId: row.item_id,
    sequence: row.sequence,
    status: row.status,
    providerTaskId: row.provider_task_id || undefined,
    reconciliation: row.reconciliation_status,
    assetId: row.asset_id || undefined,
    assetRecordId: row.output_json?.assetRecordId || undefined,
    assetUrl: row.output_json?.assetUrl || undefined,
    assetMetadata: row.output_json || undefined,
    canvasNodeId: row.canvas_node_id || undefined,
    errorCode: row.error_code || undefined,
    errorMessage: row.error_message || undefined,
    payload: row.payload_json,
  }));

  return GenerationJobDtoV3Schema.parse({
    jobId: jobRow.job_id,
    quoteId: jobRow.quote_id,
    channel: jobRow.channel,
    provider: jobRow.provider,
    model: jobRow.model_code,
    anonymousKeySlotId: jobRow.anonymous_key_slot_id || undefined,
    capabilityVersion: jobRow.capability_version,
    status: jobRow.status,
    items,
    createdAt: new Date(jobRow.created_at).toISOString(),
    updatedAt: new Date(jobRow.updated_at).toISOString(),
    ownerId: jobRow.user_id,
    retryCount: 0,
    maxRetries: DEFAULT_MAX_RETRIES,
  });
}

/**
 * 更新 Item 状态。
 * @param {Object} params
 * @param {string} params.itemId
 * @param {string} params.status
 * @param {Object} [params.updates]
 * @param {string} [params.updates.providerTaskId]
 * @param {string} [params.updates.assetId]
 * @param {Object} [params.updates.output]
 * @param {string} [params.updates.errorCode]
 * @param {string} [params.updates.errorMessage]
 * @param {import('pg').PoolClient} [params.client]
 */
async function updateItemStatus({ itemId, status, updates = {}, client }) {
  const poolOrClient = client || getPool();
  const fields = ['status = $2', 'updated_at = NOW()'];
  const values = [itemId, status];
  let idx = 3;

  if (updates.providerTaskId !== undefined) {
    fields.push(`provider_task_id = $${idx++}`);
    values.push(updates.providerTaskId);
  }
  if (updates.assetId !== undefined) {
    fields.push(`asset_id = $${idx++}`);
    values.push(updates.assetId);
  }
  if (updates.output !== undefined) {
    fields.push(`output_json = $${idx++}::jsonb`);
    values.push(JSON.stringify(updates.output));
  }
  if (updates.errorCode !== undefined) {
    fields.push(`error_code = $${idx++}`);
    values.push(updates.errorCode);
  }
  if (updates.errorMessage !== undefined) {
    fields.push(`error_message = $${idx++}`);
    values.push(updates.errorMessage);
  }

  await poolOrClient.query(
    `UPDATE public.generation_job_items SET ${fields.join(', ')} WHERE item_id = $1`,
    values
  );
}

/**
 * 更新 Job 状态。
 * @param {Object} params
 * @param {string} params.jobId
 * @param {string} params.status
 * @param {import('pg').PoolClient} [params.client]
 */
async function updateJobStatus({ jobId, status, client }) {
  const poolOrClient = client || getPool();
  await poolOrClient.query(
    `UPDATE public.generation_jobs SET status = $2, updated_at = NOW() WHERE job_id = $1`,
    [jobId, status]
  );
}

module.exports = {
  createJob,
  getJob,
  updateItemStatus,
  updateJobStatus,
};
