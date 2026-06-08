/**
 * @file provider-probe.js
 * @module server/routes
 * @description 管理员供应商探测路由。用于在保存第三方/官方 API 前自动识别协议、模型列表和推荐适配器，
 *              避免用户手动理解 endpoint_type、request_profile 等专业字段。
 */

const express = require('express');
const { z } = require('zod');
const { verifyJWT, signJWT } = require('../lib/jwt');
const { getPool } = require('../lib/db');
const { probeProvider } = require('../lib/dispatcher/providerProbe');

const router = express.Router();

function okEnvelope(data, req) {
  return {
    success: true,
    data,
    meta: {
      requestId: req.headers['x-request-id'] || `req-${Date.now()}`,
      timestamp: new Date().toISOString(),
    },
  };
}

function adminAuth(requiredLevel) {
  return async (req, res, next) => {
    const userId = verifyJWT(req.headers.authorization);
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized.' });
    }

    try {
      const pool = getPool();
      const result = await pool.query(
        'SELECT COALESCE(admin_level, 0) AS admin_level FROM public.users WHERE id = $1',
        [userId]
      );

      if (result.rows.length === 0) {
        return res.status(401).json({ error: 'User not found.' });
      }

      const adminLevel = Number(result.rows[0].admin_level || 0);
      const allowed = requiredLevel === 1 ? adminLevel === 1 : adminLevel === 1 || adminLevel === 2;
      if (!allowed) {
        return res.status(403).json({ error: 'Admin permission required.' });
      }

      req.adminUserId = userId;
      req.adminLevel = adminLevel;
      res.setHeader('X-Refresh-Token', signJWT({ userId }));
      return next();
    } catch (err) {
      return next(err);
    }
  };
}

const probeProviderSchema = z.object({
  providerName: z.string().max(160).optional().default(''),
  providerHint: z.string().max(160).optional().default(''),
  providerKind: z.enum(['official', 'relay']).optional().default('relay'),
  baseUrl: z.string().min(1).max(2048),
  apiKey: z.string().min(1).max(4096),
  modelId: z.string().max(255).optional().default(''),
  endpointType: z.string().max(80).optional().default('auto'),
  requestProfileId: z.string().max(120).optional().default(''),
});

router.post('/v1/admin/provider-probe', adminAuth(2), async (req, res) => {
  const parsed = probeProviderSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({
      error: 'Invalid provider probe payload.',
      details: parsed.error.issues,
    });
  }

  try {
    const result = await probeProvider(parsed.data);
    return res.json(okEnvelope(result, req));
  } catch (err) {
    return res.status(err.statusCode || 500).json({
      error: err.message || 'Provider probe failed.',
      code: err.code || 'PROVIDER_PROBE_FAILED',
    });
  }
});

module.exports = router;
