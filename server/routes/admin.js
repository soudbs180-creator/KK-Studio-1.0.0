// server/routes/admin.js
// 职责：承接现有前端 /api/admin/* 调用，并在服务端执行实时数据库权限校验。

const express = require('express');
const crypto = require('crypto');
const { z } = require('zod');
const { getPool } = require('../lib/db');
const { verifyJWT, signJWT } = require('../lib/jwt');
const credits = require('../lib/credits');
const { getStrictProviderContract } = require('../lib/dispatcher/strictProviderContracts');
const { matchProviderProfile } = require('../lib/dispatcher/providerProfiles');

const router = express.Router();
const INITIAL_ADMIN_EMAIL = process.env.ADMIN_INITIAL_EMAIL || 'admin@example.com';

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

function sanitizeApiKeyEntries(raw) {
  return normalizeApiKeyEntries(raw).map((entry) => ({
    fingerprint: entry.fingerprint,
    preview: entry.preview || '',
  }));
}

function mapCreditModelRow(row) {
  return {
    recordId: row.id,
    modelId: row.model_id,
    displayName: row.display_name,
    description: row.description || '',
    endpointType: row.endpoint_type || 'openai',
    requestProfileId: row.request_profile_id || undefined,
    routeStrategy: row.route_strategy || undefined,
    creditCost: Number(row.credit_cost || 1),
    priority: Number(row.priority || 0),
    weight: Number(row.weight || 0),
    isActive: row.is_active !== false,
    callCount: Number(row.call_count || 0),
    maxCallsLimit: row.max_calls_limit === null ? null : Number(row.max_calls_limit || 0),
    color: row.color || undefined,
    colorSecondary: row.color_secondary || undefined,
    textColor: row.text_color === 'black' ? 'black' : 'white',
    advancedEnabled: Boolean(row.advanced_enabled),
    mixWithSameModel: Boolean(row.mix_with_same_model),
    qualityPricing: row.quality_pricing || undefined,
  };
}

function groupCreditModelRows(rows, includeSecrets = false) {
  const grouped = new Map();
  rows.forEach((row) => {
    const providerId = row.provider_id;
    if (!grouped.has(providerId)) {
      const apiKeyEntries = sanitizeApiKeyEntries(row.api_keys);
      grouped.set(providerId, {
        providerId,
        providerName: row.provider_name,
        baseUrl: row.base_url,
        providerKind: row.provider_kind || 'relay',
        apiKeyCount: apiKeyEntries.length,
        ...(includeSecrets ? { apiKeyEntries, apiKeyPreviews: apiKeyEntries.map((entry) => entry.preview) } : {}),
        models: [],
      });
    }
    grouped.get(providerId).models.push(mapCreditModelRow(row));
  });
  return Array.from(grouped.values());
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

function userAuth() {
  return async (req, res, next) => {
    const userId = verifyJWT(req.headers.authorization);
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized.' });
    }

    if (!process.env.DATABASE_URL || process.env.KKAI_LOCAL_ONLY === 'true') {
      req.userId = userId;
      res.setHeader('X-Refresh-Token', signJWT({ userId }));
      return next();
    }

    try {
      const pool = getPool();
      const result = await pool.query('SELECT id FROM public.users WHERE id = $1', [userId]);
      if (result.rows.length === 0) {
        return res.status(401).json({ error: 'User not found.' });
      }

      req.userId = userId;
      res.setHeader('X-Refresh-Token', signJWT({ userId }));
      return next();
    } catch (err) {
      return next(err);
    }
  };
}

const userListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().max(255).optional().default(''),
});

router.get('/admin/users', adminAuth(2), async (req, res) => {
  if (!process.env.DATABASE_URL || process.env.KKAI_LOCAL_ONLY === 'true') {
    const mockUsers = [
      {
        id: 'mock-user-admin',
        email: INITIAL_ADMIN_EMAIL,
        credits: 999999,
        adminLevel: 1,
        createdAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
      },
      {
        id: 'mock-user-subadmin',
        email: 'subadmin@kkai.plus',
        credits: 50000,
        adminLevel: 2,
        createdAt: new Date(Date.now() - 20 * 24 * 60 * 60 * 1000).toISOString(),
      },
      {
        id: 'mock-user-vip',
        email: 'vip-customer@example.com',
        credits: 12500,
        adminLevel: 0,
        createdAt: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString(),
      },
      {
        id: 'mock-user-standard',
        email: 'user-standard@example.com',
        credits: 1800,
        adminLevel: 0,
        createdAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
      },
      {
        id: 'mock-user-newbie',
        email: 'new-user@gmail.com',
        credits: 100,
        adminLevel: 0,
        createdAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
      }
    ];

    const search = String(req.query.search || '').trim().toLowerCase();
    const page = Math.max(1, Number(req.query.page || 1));
    const limit = Math.max(1, Number(req.query.limit || 8));

    let filtered = mockUsers;
    if (search) {
      filtered = mockUsers.filter(
        u => u.email.toLowerCase().includes(search) || u.id.toLowerCase().includes(search)
      );
    }

    const start = (page - 1) * limit;
    const paginated = filtered.slice(start, start + limit);

    return res.json({
      users: paginated,
      total: filtered.length,
      page,
      limit,
    });
  }
  const parsed = userListQuerySchema.safeParse(req.query);
  if (!parsed.success) {
    return res.status(400).json({ error: 'Invalid query.' });
  }

  const { page, limit, search } = parsed.data;
  const offset = (page - 1) * limit;
  const pool = getPool();
  const searchText = `%${search.trim()}%`;
  const params = search.trim() ? [searchText, limit, offset] : [limit, offset];
  const whereSql = search.trim() ? 'WHERE email ILIKE $1 OR id ILIKE $1' : '';
  const limitIndex = search.trim() ? 2 : 1;
  const offsetIndex = search.trim() ? 3 : 2;

  const usersResult = await pool.query(
    `SELECT id, email, credits, COALESCE(admin_level, 0) AS admin_level, created_at
     FROM public.users
     ${whereSql}
     ORDER BY created_at DESC
     LIMIT $${limitIndex} OFFSET $${offsetIndex}`,
    params
  );
  const totalResult = await pool.query(
    `SELECT COUNT(*) AS total FROM public.users ${whereSql}`,
    search.trim() ? [searchText] : []
  );

  return res.json({
    users: usersResult.rows.map((user) => ({
      id: user.id,
      email: user.email,
      credits: Number(user.credits),
      adminLevel: Number(user.admin_level || 0),
      createdAt: user.created_at,
    })),
    total: Number(totalResult.rows[0]?.total || 0),
    page,
    limit,
  });
});

const rechargeSchema = z.object({
  amount: z.coerce.number().int().min(1).max(100000),
  note: z.string().max(255).optional().default(''),
});

router.post('/admin/users/:id/recharge', adminAuth(2), async (req, res) => {
  const parsed = rechargeSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: 'Invalid recharge payload.' });
  }

  const pool = getPool();
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const newBalance = await credits.addCredits(
      client,
      req.params.id,
      parsed.data.amount,
      'admin_recharge',
      parsed.data.note || 'admin_recharge',
      req.adminUserId
    );
    await client.query('COMMIT');
    return res.json({ success: true, newBalance });
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
});

const adjustSchema = z.object({
  delta: z.coerce.number().int().min(-100000).max(100000).refine((value) => value !== 0),
  note: z.string().min(1).max(255),
});

router.patch('/admin/users/:id/credits', adminAuth(2), async (req, res) => {
  const parsed = adjustSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: 'Invalid credit adjustment payload.' });
  }

  const newBalance = await credits.adjustCreditsByAdmin(
    req.adminUserId,
    req.params.id,
    parsed.data.delta,
    parsed.data.note
  );
  return res.json({ success: true, newBalance });
});

router.get('/admin/api-config', adminAuth(2), async (_req, res) => {
  if (!process.env.DATABASE_URL || process.env.KKAI_LOCAL_ONLY === 'true') {
    return res.json({ config: [] });
  }
  const pool = getPool();
  const result = await pool.query(
    'SELECT operation_key, operation_name, cost, is_active FROM public.api_cost_config ORDER BY operation_key ASC'
  );

  return res.json({
    config: result.rows.map((item) => ({
      operation_key: item.operation_key,
      operation_name: item.operation_name,
      cost: Number(item.cost),
      is_active: Boolean(item.is_active),
    })),
  });
});

const apiConfigSchema = z.object({
  operation_key: z.string().min(1).max(100),
  cost: z.coerce.number().int().min(0).max(10000),
});

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

async function readCreditModelRows(whereSql = '', params = []) {
  const pool = getPool();
  const result = await pool.query(
    `SELECT id, provider_id, provider_name, base_url, api_keys, model_id, display_name, description,
            endpoint_type, request_profile_id, route_strategy, credit_cost, priority, weight,
            is_active, call_count, max_calls_limit, color, color_secondary, text_color,
            advanced_enabled, mix_with_same_model, quality_pricing, provider_kind
       FROM public.admin_credit_models
       ${whereSql}
      ORDER BY provider_name ASC, priority DESC, model_id ASC`,
    params
  );
  return result.rows;
}

router.get('/v1/model-catalog/active', async (req, res) => {
  if (!process.env.DATABASE_URL || process.env.KKAI_LOCAL_ONLY === 'true') {
    return res.json(okEnvelope({ items: [] }, req));
  }
  const rows = await readCreditModelRows('WHERE is_active = true AND COALESCE(visibility, $1) = $1', ['public']);
  return res.json(okEnvelope({ items: groupCreditModelRows(rows, false) }, req));
});

router.get('/v1/model-catalog/active-credit-models', async (req, res) => {
  if (!process.env.DATABASE_URL || process.env.KKAI_LOCAL_ONLY === 'true') {
    return res.json(okEnvelope({ items: [] }, req));
  }
  const rows = await readCreditModelRows('WHERE is_active = true AND COALESCE(visibility, $1) = $1', ['public']);
  return res.json(okEnvelope({ items: groupCreditModelRows(rows, false) }, req));
});

router.get('/v1/admin/credit-providers', adminAuth(2), async (req, res) => {
  if (!process.env.DATABASE_URL || process.env.KKAI_LOCAL_ONLY === 'true') {
    return res.json(okEnvelope({ items: [] }, req));
  }
  const rows = await readCreditModelRows();
  return res.json(okEnvelope({ items: groupCreditModelRows(rows, true) }, req));
});





const pricingCacheSchema = z.object({
  pricing: z.array(z.record(z.string(), z.any())).default([]),
});

async function readPricingCache(providerId) {
  const pool = getPool();
  const result = await pool.query(
    'SELECT provider_id, pricing_json, cached_at FROM public.provider_pricing_cache WHERE provider_id = $1',
    [providerId]
  );
  const row = result.rows[0];
  return {
    providerId,
    pricing: row?.pricing_json || [],
    cachedAt: row?.cached_at || null,
  };
}

router.get('/v1/admin/credit-providers/:providerId/pricing-cache', adminAuth(2), async (req, res) => {
  if (!process.env.DATABASE_URL || process.env.KKAI_LOCAL_ONLY === 'true') {
    return res.json(okEnvelope({ providerId: req.params.providerId, pricing: [], cachedAt: null }, req));
  }
  return res.json(okEnvelope(await readPricingCache(req.params.providerId), req));
});

router.put('/v1/admin/credit-providers/:providerId/pricing-cache', adminAuth(2), async (req, res) => {
  const parsed = pricingCacheSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: 'Invalid pricing cache payload.' });
  }

  if (!process.env.DATABASE_URL || process.env.KKAI_LOCAL_ONLY === 'true') {
    return res.json(okEnvelope({
      providerId: req.params.providerId,
      pricing: parsed.data.pricing,
      cachedAt: new Date().toISOString(),
      localOnly: true,
    }, req));
  }

  const pool = getPool();
  const result = await pool.query(
    `INSERT INTO public.provider_pricing_cache (provider_id, pricing_json, cached_at)
     VALUES ($1, $2::jsonb, NOW())
     ON CONFLICT (provider_id) DO UPDATE SET
       pricing_json = EXCLUDED.pricing_json,
       cached_at = NOW()
     RETURNING provider_id, pricing_json, cached_at`,
    [req.params.providerId, JSON.stringify(parsed.data.pricing)]
  );

  return res.json(okEnvelope({
    providerId: result.rows[0].provider_id,
    pricing: result.rows[0].pricing_json || [],
    cachedAt: result.rows[0].cached_at || null,
  }, req));
});

router.delete('/v1/admin/credit-providers/:providerId', adminAuth(2), async (req, res) => {
  const providerId = String(req.params.providerId || '').trim();
  if (!providerId) {
    return res.status(400).json({ error: 'Provider id is required.' });
  }

  if (!process.env.DATABASE_URL || process.env.KKAI_LOCAL_ONLY === 'true') {
    return res.json(okEnvelope({ providerId, deleted: true, localOnly: true }, req));
  }

  const pool = getPool();
  await pool.query('DELETE FROM public.admin_credit_models WHERE provider_id = $1', [providerId]);
  return res.json(okEnvelope({ providerId, deleted: true }, req));
});

router.get('/v1/provider-pricing-cache', async (req, res) => {
  const providerId = String(req.query.baseUrl || '').trim();
  if (!providerId) {
    return res.status(400).json({ error: 'baseUrl is required.' });
  }
  if (!process.env.DATABASE_URL || process.env.KKAI_LOCAL_ONLY === 'true') {
    return res.json(okEnvelope({ providerId, pricing: [], cachedAt: null }, req));
  }
  return res.json(okEnvelope(await readPricingCache(providerId), req));
});

router.put('/v1/provider-pricing-cache', userAuth(), async (req, res) => {
  const providerId = String(req.query.baseUrl || '').trim();
  if (!providerId) {
    return res.status(400).json({ error: 'baseUrl is required.' });
  }

  const parsed = pricingCacheSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: 'Invalid pricing cache payload.' });
  }

  if (!process.env.DATABASE_URL || process.env.KKAI_LOCAL_ONLY === 'true') {
    return res.json(okEnvelope({
      providerId,
      pricing: parsed.data.pricing,
      cachedAt: new Date().toISOString(),
      localOnly: true,
    }, req));
  }

  const pool = getPool();
  const result = await pool.query(
    `INSERT INTO public.provider_pricing_cache (provider_id, pricing_json, cached_at)
     VALUES ($1, $2::jsonb, NOW())
     ON CONFLICT (provider_id) DO UPDATE SET
       pricing_json = EXCLUDED.pricing_json,
       cached_at = NOW()
     RETURNING provider_id, pricing_json, cached_at`,
    [providerId, JSON.stringify(parsed.data.pricing)]
  );

  return res.json(okEnvelope({
    providerId: result.rows[0].provider_id,
    pricing: result.rows[0].pricing_json || [],
    cachedAt: result.rows[0].cached_at || null,
  }, req));
});

router.patch('/admin/api-config', adminAuth(2), async (req, res) => {
  const parsed = apiConfigSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: 'Invalid API config payload.' });
  }

  const pool = getPool();
  const result = await pool.query(
    `UPDATE public.api_cost_config
     SET cost = $1, updated_at = NOW()
     WHERE operation_key = $2 AND is_active = true
     RETURNING operation_key, operation_name, cost, is_active`,
    [parsed.data.cost, parsed.data.operation_key]
  );

  if (result.rows.length === 0) {
    return res.status(404).json({ error: 'API config not found.' });
  }

  return res.json({ success: true, config: result.rows[0] });
});

const adminLevelSchema = z.object({
  admin_level: z.union([z.literal(0), z.literal(2)]),
});

router.patch('/admin/users/:id/admin-level', adminAuth(1), async (req, res) => {
  const parsed = adminLevelSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: 'Only admin level 0 or 2 can be set through API.' });
  }

  if (req.params.id === req.adminUserId) {
    return res.status(400).json({ error: 'Cannot modify your own admin level.' });
  }

  const pool = getPool();
  const existing = await pool.query(
    'SELECT COALESCE(admin_level, 0) AS admin_level FROM public.users WHERE id = $1',
    [req.params.id]
  );
  if (existing.rows.length === 0) {
    return res.status(404).json({ error: 'User not found.' });
  }
  if (Number(existing.rows[0].admin_level || 0) === 1) {
    return res.status(403).json({ error: 'Super admin cannot be changed through API.' });
  }

  const result = await pool.query(
    'UPDATE public.users SET admin_level = $1, updated_at = NOW() WHERE id = $2 RETURNING id, email, admin_level',
    [parsed.data.admin_level, req.params.id]
  );

  return res.json({
    success: true,
    user: {
      id: result.rows[0].id,
      email: result.rows[0].email,
      adminLevel: Number(result.rows[0].admin_level),
    },
  });
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

