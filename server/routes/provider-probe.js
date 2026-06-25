/**
 * @file provider-probe.js
 * @module server/routes
 * @description 通用供应商探测路由。管理员系统渠道和用户自带 Key 共用同一套协议探测、模型发现和适配器推荐逻辑；
 *              管理员系统渠道只是在真实请求前后额外包积分计费与审计，不改变底层请求协议。
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

function sendError(res, status, code, message, details) {
  return res.status(status).json({
    success: false,
    error: message,
    code,
    ...(details ? { details } : {})
  });
}

function userAuth() {
  return async (req, res, next) => {
    const userId = verifyJWT(req.headers.authorization);
    if (!userId) {
      return sendError(res, 401, 'UNAUTHORIZED', 'Unauthorized.');
    }

    try {
      const pool = getPool();
      const result = await pool.query(
        'SELECT id, COALESCE(admin_level, 0) AS admin_level FROM public.users WHERE id = $1',
        [userId]
      );

      if (result.rows.length === 0) {
        return sendError(res, 401, 'USER_NOT_FOUND', 'User not found.');
      }

      req.userId = userId;
      req.adminLevel = Number(result.rows[0].admin_level || 0);
      res.setHeader('X-Refresh-Token', signJWT({ userId }));
      return next();
    } catch (err) {
      return next(err);
    }
  };
}

function adminAuth(requiredLevel) {
  return async (req, res, next) => {
    return userAuth()(req, res, () => {
      const adminLevel = Number(req.adminLevel || 0);
      const allowed = requiredLevel === 1 ? adminLevel === 1 : adminLevel === 1 || adminLevel === 2;
      if (!allowed) {
        return sendError(res, 403, 'FORBIDDEN', 'Admin permission required.');
      }
      req.adminUserId = req.userId;
      return next();
    });
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

async function handleProbe(req, res, ownerKind) {
  const parsed = probeProviderSchema.safeParse(req.body);
  if (!parsed.success) {
    return sendError(
      res,
      400,
      'INVALID_PAYLOAD',
      'Invalid provider probe payload.',
      parsed.error.issues
    );
  }

  try {
    const result = await probeProvider({
      ...parsed.data,
      ownerKind,
    });
    return res.json(okEnvelope({
      ...result,
      ownerKind,
      billingMode: ownerKind === 'admin' ? 'system-credit-before-request' : 'user-owned-api-no-system-credit',
    }, req));
  } catch (err) {
    return sendError(
      res,
      err.statusCode || 500,
      err.code || 'PROVIDER_PROBE_FAILED',
      err.message || 'Provider probe failed.'
    );
  }
}

// 管理员系统渠道：与用户渠道共用探测逻辑，保存后真实请求会额外走积分预扣/退款/审计。
router.post('/v1/admin/provider-probe', adminAuth(2), async (req, res) => {
  return handleProbe(req, res, 'admin');
});

// 用户自带 Key：与管理员渠道共用探测逻辑，但真实请求不走系统积分扣费。
router.post('/v1/profile/provider-probe', userAuth(), async (req, res) => {
  return handleProbe(req, res, 'user');
});

module.exports = router;
