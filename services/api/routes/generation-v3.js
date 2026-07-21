/**
 * @file generation-v3.js
 * @module services/api/routes
 * @description Phase 1 生成控制面路由：报价 / Job 创建 / 提交 / 查询 / 控制。
 *              与旧版 /api/v1/generate 并行，不破坏现有接口。
 */

const express = require('express');
const { verifyJWT } = require('../lib/jwt');
const generationV3 = require('../lib/generation-v3');
const envelope = require('../lib/generation/generationResponseEnvelope');
const { JobControlRequestSchema } = require('@kk/shared');

const router = express.Router();

function requireAuth(req, res, next) {
  const userId = verifyJWT(req.headers.authorization);
  if (!userId) {
    return res.status(401).json(envelope.wrapError({
      code: 'UNAUTHORIZED',
      message: 'Unauthorized.',
      statusCode: 401,
    }));
  }
  req.userId = userId;
  next();
}

function sendError(res, status, code, message, meta = {}) {
  return res.status(status).json(envelope.wrapError({ code, message, statusCode: status }, meta));
}

// POST /api/v1/generation/quotes
router.post('/v1/generation/quotes', requireAuth, async (req, res) => {
  try {
    const quote = await generationV3.createQuote(req.userId, req.body);
    return res.status(201).json(envelope.wrapSuccess(quote, { quoteId: quote.quoteId }));
  } catch (err) {
    console.error('[generation-v3/quotes]', err);
    if (err.code === 'INSUFFICIENT_CREDITS') {
      return sendError(res, 402, err.code, err.message, { currentCredits: err.currentCredits, requiredCredits: err.requiredCredits });
    }
    if (err.code === 'SETUP_REQUIRED') {
      return sendError(res, 403, err.code, err.message);
    }
    if (err.name === 'ZodError') {
      return sendError(res, 400, 'INVALID_INPUT', err.message);
    }
    return sendError(res, err.statusCode || 500, err.code || 'INTERNAL_ERROR', err.message);
  }
});

// POST /api/v1/generation/jobs
router.post('/v1/generation/jobs', requireAuth, async (req, res) => {
  try {
    const job = await generationV3.createJobFromQuote(req.userId, req.body);
    return res.status(201).json(envelope.wrapSuccess(job, { jobId: job.jobId }));
  } catch (err) {
    console.error('[generation-v3/jobs]', err);
    if (err.code === 'INSUFFICIENT_CREDITS') {
      return sendError(res, 402, err.code, err.message);
    }
    if (err.code === 'QUOTE_EXPIRED' || err.code === 'QUOTE_NOT_FOUND') {
      return sendError(res, err.statusCode || 410, err.code, err.message);
    }
    if (err.name === 'ZodError') {
      return sendError(res, 400, 'INVALID_INPUT', err.message);
    }
    return sendError(res, err.statusCode || 500, err.code || 'INTERNAL_ERROR', err.message);
  }
});

// POST /api/v1/generation/jobs/:jobId/submit
router.post('/v1/generation/jobs/:jobId/submit', requireAuth, async (req, res) => {
  try {
    const job = await generationV3.submitJob(req.userId, req.params.jobId);
    return res.json(envelope.wrapSuccess(job, { jobId: job.jobId }));
  } catch (err) {
    console.error('[generation-v3/jobs/submit]', err);
    if (err.name === 'ZodError') {
      return sendError(res, 400, 'INVALID_INPUT', err.message);
    }
    return sendError(res, err.statusCode || 500, err.code || 'INTERNAL_ERROR', err.message);
  }
});

// GET /api/v1/generation/jobs/:jobId
router.get('/v1/generation/jobs/:jobId', requireAuth, async (req, res) => {
  try {
    const job = await generationV3.getJob(req.params.jobId, req.userId);
    if (!job) {
      return sendError(res, 404, 'JOB_NOT_FOUND', 'Job not found.');
    }
    return res.json(envelope.wrapSuccess(job, { jobId: job.jobId }));
  } catch (err) {
    console.error('[generation-v3/jobs/get]', err);
    return sendError(res, err.statusCode || 500, err.code || 'INTERNAL_ERROR', err.message);
  }
});

// POST /api/v1/generation/jobs/:jobId/control
router.post('/v1/generation/jobs/:jobId/control', requireAuth, async (req, res) => {
  try {
    const request = JobControlRequestSchema.parse({ jobId: req.params.jobId, action: req.body?.action });
    const { getPool } = require('../lib/db');
    const { updateJobStatus } = require('../lib/generation-v3/jobStore');

    const pool = getPool();
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const jobCheck = await client.query(
        `SELECT status FROM public.generation_jobs WHERE job_id = $1 AND user_id = $2`,
        [request.jobId, req.userId]
      );
      if (jobCheck.rows.length === 0) {
        await client.query('ROLLBACK');
        return sendError(res, 404, 'JOB_NOT_FOUND', 'Job not found.');
      }

      const currentStatus = jobCheck.rows[0].status;
      let newStatus = currentStatus;
      if (request.action === 'pause' && currentStatus === 'running') {
        newStatus = 'paused';
      } else if (request.action === 'resume' && currentStatus === 'paused') {
        newStatus = 'running';
      } else if (request.action === 'cancel' && !['completed', 'failed', 'cancelled'].includes(currentStatus)) {
        newStatus = 'cancelled';
      }

      await updateJobStatus({ jobId: request.jobId, status: newStatus, client });
      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }

    const job = await generationV3.getJob(request.jobId, req.userId);
    return res.json(envelope.wrapSuccess(job, { jobId: job.jobId }));
  } catch (err) {
    console.error('[generation-v3/jobs/control]', err);
    if (err.name === 'ZodError') {
      return sendError(res, 400, 'INVALID_INPUT', err.message);
    }
    return sendError(res, err.statusCode || 500, err.code || 'INTERNAL_ERROR', err.message);
  }
});

module.exports = router;
