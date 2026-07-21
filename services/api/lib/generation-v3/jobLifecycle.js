// services/api/lib/generation-v3/jobLifecycle.js
// 中文注释：GenerationJob v3 生命周期协调器：创建、预扣、提交 Provider、轮询、结算/退款。

const crypto = require('crypto');
const { getPool } = require('../db');
const { createJob, getJob, updateItemStatus, updateJobStatus } = require('./jobStore');
const { getActiveQuote, getQuote, consumeQuote } = require('./quoteEngine');
const { selectRoute } = require('./routeEngine');
const { reserveCredits, chargeFromReservation, refundItem } = require('./billingSaga');
const { resolveExecutionConnectionAuth } = require('../capability-graph/generationConnectionResolver');
const { recordDerivedAssetLineage } = require('../capability-graph/assetLineageStore');

/** The submit path reuses the quote snapshot and refuses silent adapter upgrades. */
async function resolveFrozenProviderRoute(userId, quote, options = {}) {
  const snapshot = quote.routeSnapshot || {};
  const connectionRoute = snapshot.connectionId ? snapshot : undefined;
  const routeSelector = options.selectRoute || selectRoute;
  const route = routeSelector({
    mediaType: quote.mediaType,
    model: quote.model,
    channel: quote.channel,
    options: { connectionRoute },
  });
  if (connectionRoute) {
    const adapterVersion = route.adapter?.adapterVersion || route.adapterVersion;
    if (adapterVersion !== snapshot.adapterVersion) {
      const error = new Error('Provider adapter changed after the quote. Request a new quote.');
      error.code = 'CONNECTION_ROUTE_STALE';
      error.statusCode = 409;
      throw error;
    }
  }
  const resolveAuth = options.resolveExecutionConnectionAuth || resolveExecutionConnectionAuth;
  const auth = await resolveAuth(userId, snapshot, options.connectionDependencies);
  return { route, auth };
}

/**
 * 创建 Job（不执行）。
 * @param {string} userId
 * @param {Object} rawRequest
 * @returns {Promise<import('@kk/shared').GenerationJobDto>}
 */
async function createJobFromQuote(userId, rawRequest) {
  const { CreateJobRequestSchema } = require('@kk/shared');
  const request = CreateJobRequestSchema.parse(rawRequest);

  const pool = getPool();
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const quote = await getActiveQuote(userId, request.quoteId, { client });
    const job = await createJob({
      quote,
      userId,
      payload: request.payload,
      canvasNodeIds: request.canvasNodeIds,
      client,
    });

    // 按 Item 预扣积分，防止部分成功/失败时重复扣费或重复退款
    if (quote.channel === 'platform-credits' && typeof quote.cost.credits === 'number') {
      const totalAmount = quote.cost.credits;
      const count = Math.max(1, job.items.length);
      const baseAmount = Math.floor(totalAmount / count);
      let remainder = totalAmount - baseAmount * count;

      for (const item of job.items) {
        const amount = baseAmount + (remainder > 0 ? 1 : 0);
        remainder -= 1;
        if (amount > 0) {
          const reservation = await reserveCredits({
            userId,
            quoteId: quote.quoteId,
            jobId: job.jobId,
            itemId: item.itemId,
            amount,
            mediaType: quote.mediaType,
            client,
          });
          await client.query(
            `UPDATE public.generation_job_items SET reservation_id = $2 WHERE item_id = $1`,
            [item.itemId, reservation.ledgerId]
          );
        }
      }
    }

    await consumeQuote(quote.quoteId, client);
    await updateJobStatus({ jobId: job.jobId, status: 'reserved', client });

    await client.query('COMMIT');
    return getJob(job.jobId, userId);
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

/**
 * 提交 Job 到 Provider。
 * @param {string} userId
 * @param {string} jobId
 * @returns {Promise<import('@kk/shared').GenerationJobDto>}
 */
async function submitJob(userId, jobId) {
  const pool = getPool();
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const job = await getJob(jobId, userId, { client });
    if (!job) {
      const err = new Error('Job not found.');
      err.code = 'JOB_NOT_FOUND';
      err.statusCode = 404;
      throw err;
    }

    if (!['quoted', 'reserved'].includes(job.status)) {
      const err = new Error(`Job cannot be submitted from status ${job.status}.`);
      err.code = 'INVALID_JOB_STATUS';
      err.statusCode = 409;
      throw err;
    }

    const quote = await getQuote(userId, job.quoteId, { client });
    const { route, auth } = await resolveFrozenProviderRoute(userId, quote);

    await updateJobStatus({ jobId, status: 'submitted', client });

    for (const item of job.items) {
      const submitInput = {
        requestId: `${jobId}:${item.itemId}`,
        modelId: quote.model,
        prompt: item.payload?.prompt || '',
        aspectRatio: quote.routeSnapshot?.aspectRatio,
        size: quote.routeSnapshot?.size,
        payload: item.payload,
        auth,
      };

      try {
        const result = await route.adapter.submit(submitInput);

        if (result.status === 'success' && result.urls?.length) {
          await updateItemStatus({
            itemId: item.itemId,
            status: 'submitted',
            updates: { providerTaskId: result.providerTaskId },
            client,
          });
          await completeItem(userId, item.itemId, result.urls[0], { client });
        } else if (result.status === 'pending' || result.status === 'running') {
          await updateItemStatus({
            itemId: item.itemId,
            status: 'submitted',
            updates: { providerTaskId: result.providerTaskId },
            client,
          });
        } else if (result.status === 'failed') {
          await failItem(userId, item.itemId, result.errorMessage || 'Provider submit failed', { client });
        }
      } catch (err) {
        await failItem(userId, item.itemId, err.message, { client, errorCode: err.code || 'PROVIDER_SUBMIT_ERROR' });
      }
    }

    await recalcJobStatus(jobId, { client });
    await client.query('COMMIT');
    return getJob(jobId, userId);
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

function buildGeneratedAssetOutput(item, assetUrl) {
  return {
    assetRecordId: crypto.randomUUID(),
    assetUrl,
    mediaType: item.payload_json?.mediaType || 'image',
    source: 'provider',
    createdAt: new Date().toISOString(),
  };
}

async function completeItem(userId, itemId, assetUrl, { client }) {
  const itemRes = await client.query(
    `SELECT * FROM public.generation_job_items WHERE item_id = $1`,
    [itemId]
  );
  if (itemRes.rows.length === 0) return;
  const item = itemRes.rows[0];

  // 已完成 item 永不重复提交或扣费
  if (item.status === 'completed') {
    return;
  }

  // asset_id remains the URL during dual-read compatibility; output_json carries stable identity.
  const output = buildGeneratedAssetOutput(item, assetUrl);

  await updateItemStatus({
    itemId,
    status: 'completed',
    updates: { assetId: assetUrl, output },
    client,
  });
  await recordDerivedAssetLineage(
    userId,
    output.assetRecordId,
    item.payload_json?.referenceAssetIds,
    { itemId, mediaType: output.mediaType },
    client,
  );

  // 结算：将预扣转为实际扣费
  if (item.reservation_id) {
    await chargeFromReservation({ ledgerId: item.reservation_id, itemId, client });
    await client.query(
      `UPDATE public.generation_job_items SET ledger_id = $2 WHERE item_id = $1`,
      [itemId, item.reservation_id]
    );
  }
}

async function failItem(userId, itemId, errorMessage, { client, errorCode }) {
  const itemRes = await client.query(
    `SELECT ji.*, j.quote_id, j.channel, j.model_code, jq.media_type, jq.cost_credits,
            (SELECT amount FROM public.ledger_entries WHERE ledger_id = ji.reservation_id AND type = 'reserve') AS reserved_amount
       FROM public.generation_job_items ji
       JOIN public.generation_jobs j ON j.job_id = ji.job_id
       LEFT JOIN public.generation_quotes jq ON jq.quote_id = j.quote_id
      WHERE ji.item_id = $1 AND j.user_id = $2`,
    [itemId, userId]
  );
  if (itemRes.rows.length === 0) return;
  const item = itemRes.rows[0];

  // 防止重复退款/重复失败标记
  if (item.status === 'failed' || item.status === 'cancelled') {
    return;
  }

  await updateItemStatus({
    itemId,
    status: 'failed',
    updates: { errorCode: errorCode || 'PROVIDER_ERROR', errorMessage },
    client,
  });

  // 失败退款：退还该 item 实际预扣的金额
  if (item.channel === 'platform-credits' && item.reservation_id && item.reserved_amount > 0) {
    await refundItem({
      userId,
      ledgerId: item.reservation_id,
      amount: Number(item.reserved_amount),
      itemId,
      mediaType: item.media_type || 'image',
      reason: 'item-failed-refund',
      client,
    });
  }
}

async function recalcJobStatus(jobId, { client }) {
  const itemsRes = await client.query(
    `SELECT status FROM public.generation_job_items WHERE job_id = $1`,
    [jobId]
  );
  const statuses = itemsRes.rows.map((r) => r.status);

  let newStatus = 'running';
  if (statuses.every((s) => s === 'completed')) {
    newStatus = 'completed';
  } else if (statuses.every((s) => s === 'failed' || s === 'cancelled')) {
    newStatus = 'failed';
  } else if (statuses.some((s) => s === 'running' || s === 'submitted')) {
    newStatus = 'running';
  } else if (statuses.some((s) => s === 'completed') && statuses.some((s) => s === 'failed')) {
    newStatus = 'completed';
  }

  await updateJobStatus({ jobId, status: newStatus, client });
}

module.exports = {
  createJobFromQuote,
  submitJob,
  resolveFrozenProviderRoute,
  completeItem,
  failItem,
  recalcJobStatus,
};
