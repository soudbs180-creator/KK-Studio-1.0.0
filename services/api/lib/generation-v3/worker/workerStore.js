const crypto = require('crypto');
const { getPool } = require('../../db');
const { getJob, updateJobStatus } = require('../jobStore');
const { cancelItem, completeItem, failItem, recalcJobStatus } = require('../jobLifecycle');
const { assertImageProviderSliceAdmission } = require('../imageProviderSliceAdmission');

const CLAIM_SQL = `
  WITH candidate AS (
    SELECT lease.lease_id
      FROM public.generation_image_worker_leases lease
      JOIN public.generation_job_items item ON item.item_id = lease.item_id
      JOIN public.generation_jobs job ON job.job_id = lease.job_id
     WHERE item.status NOT IN ('completed', 'failed', 'cancelled')
       AND job.task_type = 'image'
       AND (
         (lease.status IN ('queued', 'polling') AND lease.next_attempt_at <= NOW())
         OR (lease.status = 'leased' AND lease.lease_expires_at <= NOW())
       )
       AND (
         job.status IN ('submitted', 'running')
         OR job.status = 'cancelled'
       )
     ORDER BY lease.next_attempt_at, lease.created_at
     FOR UPDATE SKIP LOCKED
     LIMIT 1
  )
  UPDATE public.generation_image_worker_leases lease
     SET status = 'leased', worker_id = $1, lease_token = $2,
         attempt_count = lease.attempt_count + 1,
         lease_expires_at = NOW() + ($3::bigint * INTERVAL '1 millisecond'),
         heartbeat_at = NOW(), updated_at = NOW()
    FROM candidate,
         public.generation_job_items item,
         public.generation_jobs job
   WHERE lease.lease_id = candidate.lease_id
     AND item.item_id = lease.item_id
     AND job.job_id = lease.job_id
  RETURNING lease.attempt_count, lease.failure_count, lease.created_at AS enqueued_at,
            lease.item_id, lease.job_id, lease.lease_token,
            item.payload_json, item.provider_task_id, job.quote_id, job.user_id`;

const LOCK_CLAIM_SQL = `
  SELECT lease.status AS lease_status, item.status AS item_status
    FROM public.generation_image_worker_leases lease
    JOIN public.generation_job_items item ON item.item_id = lease.item_id
   WHERE lease.item_id = $1 AND lease.lease_token = $2 AND lease.status = 'leased'
   FOR UPDATE`;

const REQUEUE_SQL = `
  WITH valid AS (
    UPDATE public.generation_image_worker_leases
       SET status = 'polling', worker_id = NULL, lease_token = NULL,
           lease_expires_at = NULL, next_attempt_at = NOW() + ($3::bigint * INTERVAL '1 millisecond'),
           failure_count = failure_count + CASE WHEN $4::text IS NULL THEN 0 ELSE 1 END,
           last_error_code = $4, last_error_message = $5, updated_at = NOW()
     WHERE item_id = $1 AND lease_token = $2 AND status = 'leased'
     RETURNING item_id, job_id
  )
  UPDATE public.generation_job_items item
     SET status = 'running', updated_at = NOW()
    FROM valid
   WHERE item.item_id = valid.item_id
  RETURNING valid.job_id`;

function mapClaim(row) {
  return {
    attemptCount: row.attempt_count,
    enqueuedAt: new Date(row.enqueued_at).toISOString(),
    failureCount: row.failure_count,
    itemId: row.item_id,
    jobId: row.job_id,
    leaseToken: row.lease_token,
    payload: row.payload_json || {},
    providerTaskId: row.provider_task_id || undefined,
    quoteId: row.quote_id,
    userId: row.user_id,
  };
}

function createJobError(code, message, statusCode) {
  const error = new Error(message);
  error.code = code;
  error.statusCode = statusCode;
  return error;
}

async function withTransaction(operation) {
  const client = await getPool().connect();
  try {
    await client.query('BEGIN');
    const result = await operation(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

async function enqueueImageJob(jobId, userId) {
  const wasEnqueued = await withTransaction(async (client) => {
    const result = await client.query(
      `SELECT job.task_type, job.status, quote.route_snapshot_json
         FROM public.generation_jobs job
         JOIN public.generation_quotes quote ON quote.quote_id = job.quote_id
        WHERE job.job_id = $1 AND job.user_id = $2 FOR UPDATE`,
      [jobId, userId],
    );
    if (result.rows.length === 0) throw createJobError('JOB_NOT_FOUND', 'Job not found.', 404);
    const row = result.rows[0];
    if (row.task_type !== 'image') return false;
    if (!['quoted', 'reserved'].includes(row.status)) {
      throw createJobError('INVALID_JOB_STATUS', `Job cannot be submitted from status ${row.status}.`, 409);
    }
    assertImageProviderSliceAdmission(userId, row.route_snapshot_json);
    await client.query(
      `INSERT INTO public.generation_image_worker_leases (item_id, job_id)
       SELECT item_id, job_id FROM public.generation_job_items WHERE job_id = $1
       ON CONFLICT (item_id) DO NOTHING`,
      [jobId],
    );
    await updateJobStatus({ jobId, status: 'submitted', client });
    return true;
  });
  return wasEnqueued ? getJob(jobId, userId) : null;
}

async function claimNext({ workerId, leaseMs }) {
  const leaseToken = crypto.randomUUID();
  const result = await withTransaction((client) => client.query(
    CLAIM_SQL,
    [workerId, leaseToken, leaseMs],
  ));
  return result.rows[0] ? mapClaim(result.rows[0]) : null;
}

async function heartbeat(claim, leaseMs) {
  const result = await getPool().query(
    `UPDATE public.generation_image_worker_leases
        SET heartbeat_at = NOW(), lease_expires_at = NOW() + ($3::bigint * INTERVAL '1 millisecond'), updated_at = NOW()
      WHERE item_id = $1 AND lease_token = $2 AND status = 'leased'
      RETURNING item_id`,
    [claim.itemId, claim.leaseToken, leaseMs],
  );
  return result.rows.length === 1;
}

async function isCancellationRequested(claim) {
  const result = await getPool().query(
    `SELECT lease.cancel_requested_at, job.status AS job_status
       FROM public.generation_image_worker_leases lease
       JOIN public.generation_jobs job ON job.job_id = lease.job_id
      WHERE lease.item_id = $1 AND lease.lease_token = $2`,
    [claim.itemId, claim.leaseToken],
  );
  const row = result.rows[0];
  return Boolean(row && (row.cancel_requested_at || row.job_status === 'cancelled'));
}

async function recordSubmission(claim, providerTaskId) {
  const result = await getPool().query(
    `UPDATE public.generation_job_items item
        SET provider_task_id = $3, status = 'submitted', updated_at = NOW()
      WHERE item.item_id = $1
        AND item.provider_task_id IS NULL
        AND EXISTS (SELECT 1 FROM public.generation_image_worker_leases lease
          WHERE lease.item_id = item.item_id AND lease.lease_token = $2 AND lease.status = 'leased')
      RETURNING item.item_id`,
    [claim.itemId, claim.leaseToken, providerTaskId],
  );
  return result.rows.length === 1;
}

async function requeue(claim, options) {
  const result = await withTransaction(async (client) => {
    const requeued = await client.query(REQUEUE_SQL, [
      claim.itemId,
      claim.leaseToken,
      options.delayMs,
      options.errorCode || null,
      options.errorMessage || null,
    ]);
    if (requeued.rows[0]) {
      await client.query(
        `UPDATE public.generation_jobs SET status = 'running', updated_at = NOW()
          WHERE job_id = $1 AND status IN ('submitted', 'running')`,
        [requeued.rows[0].job_id],
      );
    }
    return requeued;
  });
  return result.rows.length === 1;
}

async function lockClaim(client, claim) {
  const result = await client.query(LOCK_CLAIM_SQL, [claim.itemId, claim.leaseToken]);
  return result.rows[0] || null;
}

async function markTerminal(client, claim, status, error = {}) {
  await client.query(
    `UPDATE public.generation_image_worker_leases
        SET status = $3, worker_id = NULL, lease_token = NULL, lease_expires_at = NULL,
            last_error_code = $4, last_error_message = $5, updated_at = NOW()
      WHERE item_id = $1 AND lease_token = $2`,
    [claim.itemId, claim.leaseToken, status, error.errorCode || null, error.errorMessage || null],
  );
}

async function complete(claim, assetUrl) {
  return withTransaction(async (client) => {
    if (!await lockClaim(client, claim)) return false;
    await completeItem(claim.userId, claim.itemId, assetUrl, { client });
    await markTerminal(client, claim, 'completed');
    await recalcJobStatus(claim.jobId, { client });
    return true;
  });
}

async function fail(claim, options) {
  return withTransaction(async (client) => {
    if (!await lockClaim(client, claim)) return false;
    await failItem(claim.userId, claim.itemId, options.errorMessage, {
      client,
      errorCode: options.errorCode,
    });
    await markTerminal(client, claim, options.terminalStatus || 'failed', options);
    await recalcJobStatus(claim.jobId, { client });
    return true;
  });
}

async function cancel(claim) {
  return withTransaction(async (client) => {
    if (!await lockClaim(client, claim)) return false;
    await cancelItem(claim.userId, claim.itemId, { client });
    await markTerminal(client, claim, 'cancelled');
    await updateJobStatus({ jobId: claim.jobId, status: 'cancelled', client });
    return true;
  });
}

async function requestJobCancellation(jobId, userId, options = {}) {
  const client = options.client || getPool();
  const result = await client.query(
    `UPDATE public.generation_image_worker_leases lease
        SET cancel_requested_at = NOW(), next_attempt_at = NOW(), updated_at = NOW()
      WHERE lease.job_id = $1
        AND lease.status NOT IN ('completed', 'failed', 'cancelled', 'timed_out')
        AND EXISTS (SELECT 1 FROM public.generation_jobs job
          WHERE job.job_id = lease.job_id AND job.user_id = $2)
      RETURNING lease.item_id`,
    [jobId, userId],
  );
  return result.rows.length;
}

function createPostgresWorkerStore() {
  return {
    cancel,
    claimNext,
    complete,
    fail,
    heartbeat,
    isCancellationRequested,
    recordSubmission,
    requeue,
  };
}

module.exports = {
  createPostgresWorkerStore,
  enqueueImageJob,
  requestJobCancellation,
};
