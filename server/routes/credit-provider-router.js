/**
 * @file credit-provider-router.js
 * @module server/routes
 * @description AI Router 管理员供应商保存路由。它覆盖旧 admin credit-providers PUT 入口，
 *              确保探测得到的 requestProfileId / routeStrategy / endpointType 能完整落库。
 *              注意：这里不实现独立请求协议，真实请求仍交给通用 Dispatcher/Adapter；管理员只多一层积分计费。
 *              文档未核对完整的 provider 不允许保存为可执行计费模型。
 */

const crypto = require('crypto');
const express = require('express');
const { z } = require('zod');
const { getPool } = require('../lib/db');
const { verifyJWT, signJWT } = require('../lib/jwt');
const { getStrictProviderContract } = require('../lib/dispatcher/strictProviderContracts');
const { matchProviderProfile } = require('../lib/dispatcher/providerProfiles');

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

function keyFingerprint(value) {
  return crypto.createHash('sha256').update(String(value || '')).digest('hex');
}

function keyPreview(value) {
  const normalized = String(value || '').trim();
  if (normalized.length <= 8) return normalized ? '********' : '';
  return `${normalized.slice(0, 4)}...${normalized.slice(-4)}`;
}

function normalizeApiKeyEntries(raw) {
  const entries = Array.isArray(raw) ? raw : [];
  return entries
    .map((entry) => {
      if (typeof entry === 'string') {
        return {
          value: entry,
          fingerprint: keyFingerprint(entry),
          preview: keyPreview(entry),
        };
      }

      if (!entry || typeof entry !== 'object') return null;
      const value = String(entry.value || entry.apiKey || entry.key || '').trim();
      const fingerprint = String(entry.fingerprint || (value ? keyFingerprint(value) : '')).trim();
      if (!fingerprint) return null;
      return {
        ...entry,
        value,
        fingerprint,
        preview: String(entry.preview || keyPreview(value)).trim(),
      };
    })
    .filter(Boolean);
}

function adminAuth(requiredLevel) {
  return async (req, res, next) => {
    const userId = verifyJWT(req.headers.authorization);
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized.' });
    }

    if (!process.env.DATABASE_URL || process.env.KKAI_LOCAL_ONLY === 'true') {
      req.adminUserId = userId;
      req.adminLevel = 1;
      res.setHeader('X-Refresh-Token', signJWT({ userId }));
      return next();
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

const qualityPricingSchema = z.record(z.string(), z.object({
  enabled: z.coerce.boolean().default(true),
  creditCost: z.coerce.number().min(0).max(100000),
}));

const routeStrategySchema = z.enum(['priority-failover', 'weighted-random', 'parallel-race']).default('priority-failover');

const saveCreditProviderSchema = z.object({
  providerName: z.string().min(1).max(160),
  baseUrl: z.string().min(1).max(2048),
  providerKind: z.enum(['official', 'relay']).default('relay'),
  apiKeys: z.array(z.string().min(1).max(4096)).default([]),
  retainApiKeyFingerprints: z.array(z.string().min(1).max(256)).optional().default([]),
  models: z.array(z.object({
    modelId: z.string().min(1).max(255),
    displayName: z.string().min(1).max(255),
    description: z.string().max(2000).optional().default(''),
    endpointType: z.string().min(1).max(120).default('openai_chat_completions'),
    requestProfileId: z.string().max(160).optional().default(''),
    routeStrategy: routeStrategySchema.optional().default('priority-failover'),
    creditCost: z.coerce.number().int().min(0).max(100000),
    advancedEnabled: z.coerce.boolean().default(false),
    mixWithSameModel: z.coerce.boolean().default(false),
    qualityPricing: qualityPricingSchema.default({}),
    priority: z.coerce.number().int().min(-100000).max(100000).default(0),
    weight: z.coerce.number().int().min(0).max(100000).default(1),
    isActive: z.coerce.boolean().default(true),
    color: z.string().max(80).optional().default('#3B82F6'),
    colorSecondary: z.string().max(80).nullable().optional(),
    textColor: z.enum(['white', 'black']).default('white'),
    maxCallsLimit: z.coerce.number().int().min(0).max(100000000).nullable().optional(),
    autoPauseOnLimit: z.coerce.boolean().optional().default(false),
  })).min(1).max(500),
});

function normalizeModelRouteFields(model) {
  const endpointType = String(model.endpointType || 'openai_chat_completions').trim();
  const requestProfileId = String(model.requestProfileId || '').trim();
  return {
    endpointType,
    requestProfileId: requestProfileId || null,
    routeStrategy: model.routeStrategy || 'priority-failover',
  };
}

function resolveProfileForModel(providerPayload, model) {
  const explicitProfileId = String(model.requestProfileId || '').trim();
  if (explicitProfileId) {
    return explicitProfileId;
  }

  const matched = matchProviderProfile({
    baseUrl: providerPayload.baseUrl,
    providerName: providerPayload.providerName,
    providerHint: providerPayload.providerName,
    providerKind: providerPayload.providerKind,
    endpointType: model.endpointType,
  });
  return matched?.id || '';
}

function validateExecutableProviderModels(payload) {
  const violations = [];
  payload.models.forEach((model) => {
    const profileId = resolveProfileForModel(payload, model);
    const contract = getStrictProviderContract(profileId);
    const endpointType = String(model.endpointType || '').trim();
    const isDocsPending = endpointType === 'docs_pending_adapter'
      || profileId === '12ai-docs-pending'
      || Boolean(contract?.requiresDocsVerification)
      || Object.keys(contract?.supportedTasks || {}).length === 0 && contract?.allowGenericFallback === false;

    if (isDocsPending && model.isActive !== false) {
      violations.push({
        modelId: model.modelId,
        displayName: model.displayName,
        profileId,
        endpointType,
        docs: contract?.docs || [],
      });
    }
  });

  return violations;
}

router.put('/v1/admin/credit-providers/:providerId', adminAuth(2), async (req, res) => {
  const parsed = saveCreditProviderSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({
      error: 'Invalid credit provider payload.',
      details: parsed.error.issues,
    });
  }

  const docsPendingViolations = validateExecutableProviderModels(parsed.data);
  if (docsPendingViolations.length > 0) {
    return res.status(400).json({
      error: 'Provider documentation is not verified for executable routing.',
      code: 'DOCS_PENDING_PROVIDER_NOT_EXECUTABLE',
      message: '文档未核对完整的预设不能保存为启用的管理员计费模型。请先补充官方 endpoint、鉴权、请求体和响应结构，或将模型设为 inactive。',
      violations: docsPendingViolations,
    });
  }

  const providerId = String(req.params.providerId || '').trim();
  if (!providerId) {
    return res.status(400).json({ error: 'Provider id is required.' });
  }

  if (!process.env.DATABASE_URL || process.env.KKAI_LOCAL_ONLY === 'true') {
    return res.json(okEnvelope({
      providerId,
      providerName: parsed.data.providerName,
      apiKeyCount: parsed.data.apiKeys.length,
      modelCount: parsed.data.models.length,
      saved: true,
      localOnly: true,
    }, req));
  }

  const pool = getPool();
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const existing = await client.query(
      'SELECT api_keys FROM public.admin_credit_models WHERE provider_id = $1 LIMIT 1',
      [providerId]
    );
    const existingKeys = normalizeApiKeyEntries(existing.rows[0]?.api_keys);
    const retainFingerprints = new Set(parsed.data.retainApiKeyFingerprints || []);
    const retainedKeys = existingKeys.filter((entry) => retainFingerprints.has(entry.fingerprint));
    const newKeys = parsed.data.apiKeys.map((value) => ({
      value,
      fingerprint: keyFingerprint(value),
      preview: keyPreview(value),
    }));
    const keyMap = new Map();
    [...retainedKeys, ...newKeys].forEach((entry) => keyMap.set(entry.fingerprint, entry));
    const apiKeys = Array.from(keyMap.values());

    const modelIds = parsed.data.models.map((model) => model.modelId);
    await client.query(
      'DELETE FROM public.admin_credit_models WHERE provider_id = $1 AND NOT (model_id = ANY($2::text[]))',
      [providerId, modelIds]
    );

    for (const model of parsed.data.models) {
      const routeFields = normalizeModelRouteFields(model);
      await client.query(
        `INSERT INTO public.admin_credit_models (
          provider_id, provider_name, base_url, api_keys, model_id, display_name, description,
          endpoint_type, request_profile_id, route_strategy, credit_cost, priority, weight, is_active,
          max_calls_limit, color, color_secondary, text_color, advanced_enabled, mix_with_same_model,
          quality_pricing, auto_pause_on_limit, provider_kind, updated_at
        ) VALUES (
          $1, $2, $3, $4::jsonb, $5, $6, $7, $8, $9, $10, $11, $12,
          $13, $14, $15, $16, $17, $18, $19, $20, $21::jsonb, $22, $23, NOW()
        )
        ON CONFLICT (provider_id, model_id) DO UPDATE SET
          provider_name = EXCLUDED.provider_name,
          base_url = EXCLUDED.base_url,
          api_keys = EXCLUDED.api_keys,
          display_name = EXCLUDED.display_name,
          description = EXCLUDED.description,
          endpoint_type = EXCLUDED.endpoint_type,
          request_profile_id = EXCLUDED.request_profile_id,
          route_strategy = EXCLUDED.route_strategy,
          credit_cost = EXCLUDED.credit_cost,
          priority = EXCLUDED.priority,
          weight = EXCLUDED.weight,
          is_active = EXCLUDED.is_active,
          max_calls_limit = EXCLUDED.max_calls_limit,
          color = EXCLUDED.color,
          color_secondary = EXCLUDED.color_secondary,
          text_color = EXCLUDED.text_color,
          advanced_enabled = EXCLUDED.advanced_enabled,
          mix_with_same_model = EXCLUDED.mix_with_same_model,
          quality_pricing = EXCLUDED.quality_pricing,
          auto_pause_on_limit = EXCLUDED.auto_pause_on_limit,
          provider_kind = EXCLUDED.provider_kind,
          updated_at = NOW()`,
        [
          providerId,
          parsed.data.providerName,
          parsed.data.baseUrl,
          JSON.stringify(apiKeys),
          model.modelId,
          model.displayName,
          model.description || '',
          routeFields.endpointType,
          routeFields.requestProfileId,
          routeFields.routeStrategy,
          model.creditCost,
          model.priority,
          model.weight || 1,
          model.isActive,
          model.maxCallsLimit ?? null,
          model.color || '#3B82F6',
          model.colorSecondary || null,
          model.textColor,
          model.advancedEnabled,
          model.mixWithSameModel,
          JSON.stringify(model.qualityPricing || {}),
          model.autoPauseOnLimit,
          parsed.data.providerKind || 'relay',
        ]
      );
    }

    await client.query('COMMIT');
    return res.json(okEnvelope({
      providerId,
      providerName: parsed.data.providerName,
      apiKeyCount: apiKeys.length,
      modelCount: parsed.data.models.length,
      saved: true,
      routeEngine: 'unified-ai-router',
    }, req));
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
});

module.exports = router;
