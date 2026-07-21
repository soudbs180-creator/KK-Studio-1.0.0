/**
 * @file user-api-payload-router.js
 * @module server/routes
 * @description 用户 API 配置保存入口增强层。它在 legacy user.js 之前接管用户 API payload 保存，
 *              自动用 Provider Probe 补齐 endpointType / requestProfileId / protocolFamily / models。
 *              这样前端无需让用户选择专业接口类型，用户只填 Base URL 与 Key 即可。
 */

const express = require('express');
const { verifyJWT, signJWT } = require('../lib/jwt');
const { probeProvider } = require('../lib/dispatcher/providerProbe');
const {
  readLocalStorage,
  writeLocalStorage,
  readProfileState,
  writeProfileState,
} = require('../lib/dispatcher/localUserRouteStore');

const router = express.Router();
const TEMP_USER_ID_HEADER = 'x-kk-temp-user-id';
const READONLY_SECRET_PLACEHOLDER = 'sk-readonly-0000';

function buildMeta(req) {
  return {
    requestId: req.headers['x-request-id'] || `req-${Date.now()}`,
    timestamp: new Date().toISOString(),
  };
}

function okEnvelope(data, req) {
  return {
    success: true,
    data,
    meta: buildMeta(req),
  };
}

function isObjectRecord(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function resolveProfileUserId(req) {
  const verifiedUserId = verifyJWT(req.headers.authorization);
  if (verifiedUserId) {
    return {
      userId: verifiedUserId,
      refreshToken: signJWT({ userId: verifiedUserId }),
    };
  }

  const tempUserId = String(req.headers[TEMP_USER_ID_HEADER] || '').trim();
  const allowLocalTempUser = process.env.KKAI_LOCAL_ONLY === 'true';
  if (allowLocalTempUser && /^temp-[a-zA-Z0-9_.-]{4,128}$/.test(tempUserId)) {
    return {
      userId: tempUserId,
      refreshToken: null,
    };
  }

  return null;
}

function requireProfileAuth(req, res, next) {
  const authState = resolveProfileUserId(req);
  if (!authState) {
    return res.status(401).json({
      success: false,
      error: {
        code: 'UNAUTHORIZED',
        message: 'Authentication is required for profile user API storage.',
      },
      meta: buildMeta(req),
    });
  }

  req.profileUserId = authState.userId;
  if (authState.refreshToken) {
    res.setHeader('X-Refresh-Token', authState.refreshToken);
  }
  return next();
}

function isReadonlySecret(value) {
  const normalized = String(value || '').trim();
  return !normalized
    || normalized === READONLY_SECRET_PLACEHOLDER
    || normalized.startsWith('__kk_redacted__:')
    || normalized.includes('...')
    || normalized.includes('••');
}

function normalizeModelsFromProbe(result, fallbackModels) {
  const probed = Array.isArray(result?.models)
    ? result.models.map((model) => String(model?.id || model || '').trim()).filter(Boolean)
    : [];
  const fallback = Array.isArray(fallbackModels)
    ? fallbackModels.map((model) => String(model || '').trim()).filter(Boolean)
    : [];
  return Array.from(new Set([...probed, ...fallback]));
}

function normalizeEntryForResponse(entry) {
  const now = Date.now();
  const record = isObjectRecord(entry) ? entry : {};
  return {
    id: String(record.id || '').trim(),
    key: String(record.key || ''),
    name: String(record.name || record.provider || 'Custom Key').trim(),
    provider: String(record.provider || 'Custom').trim(),
    type: ['official', 'proxy', 'third-party'].includes(record.type) ? record.type : 'third-party',
    format: ['gemini', 'openai', 'auto', 'claude'].includes(record.format) ? record.format : 'auto',
    baseUrl: String(record.baseUrl || record.base_url || '').trim() || undefined,
    supportedModels: Array.isArray(record.supportedModels) ? record.supportedModels.map((model) => String(model || '').trim()).filter(Boolean) : [],
    disabled: Boolean(record.disabled),
    createdAt: Number(record.createdAt || record.created_at || now),
    updatedAt: Number(record.updatedAt || record.updated_at || now),
    status: ['valid', 'invalid', 'rate_limited', 'unknown'].includes(record.status) ? record.status : 'unknown',
    failCount: Number(record.failCount || record.fail_count || 0),
    successCount: Number(record.successCount || record.success_count || 0),
    totalCost: Number(record.totalCost || record.total_cost || 0),
    budgetLimit: Number.isFinite(Number(record.budgetLimit ?? record.budget_limit)) ? Number(record.budgetLimit ?? record.budget_limit) : -1,
    tokenLimit: Number.isFinite(Number(record.tokenLimit ?? record.token_limit)) ? Number(record.tokenLimit ?? record.token_limit) : -1,
    usedTokens: Number(record.usedTokens || record.used_tokens || 0),
    lastUsed: record.lastUsed == null && record.last_used == null ? null : Number(record.lastUsed ?? record.last_used),
    lastError: record.lastError == null && record.last_error == null ? null : String(record.lastError ?? record.last_error),
    endpointType: record.endpointType || record.adapterId,
    adapterId: record.adapterId || record.endpointType,
    requestProfileId: record.requestProfileId,
    protocolFamily: record.protocolFamily,
    routeStrategy: record.routeStrategy,
    aiRouterProbe: record.aiRouterProbe,
  };
}

async function enrichApiRecord(record, ownerKind) {
  if (!isObjectRecord(record)) {
    return record;
  }

  const baseUrl = String(record.baseUrl || record.base_url || '').trim();
  const apiKey = String(record.apiKey || record.key || '').trim();
  const name = String(record.name || record.provider || '').trim();
  const modelHint = Array.isArray(record.models) && record.models.length > 0
    ? String(record.models[0] || '').trim()
    : Array.isArray(record.supportedModels) && record.supportedModels.length > 0
      ? String(record.supportedModels[0] || '').trim()
      : '';

  if (!baseUrl || isReadonlySecret(apiKey)) {
    return record;
  }

  try {
    const probe = await probeProvider({
      ownerKind,
      providerName: name,
      providerHint: String(record.provider || record.id || name || '').trim(),
      providerKind: 'relay',
      baseUrl,
      apiKey,
      modelId: modelHint,
      endpointType: String(record.endpointType || record.adapterId || record.format || 'auto').trim(),
      requestProfileId: String(record.requestProfileId || record.profileId || '').trim(),
    });

    const models = normalizeModelsFromProbe(probe, record.models || record.supportedModels || []);
    const enriched = {
      ...record,
      baseUrl: probe.normalizedBaseUrl || baseUrl,
      endpointType: probe.adapterId || record.endpointType || record.adapterId,
      adapterId: probe.adapterId || record.adapterId || record.endpointType,
      requestProfileId: probe.requestProfileId || record.requestProfileId,
      protocolFamily: probe.protocolFamily || record.protocolFamily,
      routeStrategy: record.routeStrategy || 'priority-failover',
      aiRouterProbe: {
        ok: Boolean(probe.ok),
        confidence: probe.confidence,
        warnings: probe.warnings || [],
        diagnostics: probe.diagnostics || [],
        updatedAt: new Date().toISOString(),
      },
      updatedAt: Date.now(),
    };

    if ('models' in record || !('supportedModels' in record)) {
      enriched.models = models;
    }
    if ('supportedModels' in record) {
      enriched.supportedModels = models;
    }

    return enriched;
  } catch (error) {
    console.warn('[user-api-payload-router] Provider probe failed during save. Preserving original record.', {
      name,
      baseUrl,
      error: error && error.message || error,
    });
    return {
      ...record,
      aiRouterProbe: {
        ok: false,
        error: error && error.message || 'Provider probe failed.',
        updatedAt: new Date().toISOString(),
      },
    };
  }
}

async function enrichProfileState(profileState) {
  const providers = Array.isArray(profileState.providers) ? profileState.providers : [];
  const slots = Array.isArray(profileState.slots) ? profileState.slots : [];
  const entries = Array.isArray(profileState.entries) ? profileState.entries : [];

  // 🚀 性能优化：并行探测所有 provider/slot/entry，替代原先的逐个串行调用
  const [enrichedProviders, enrichedSlots, enrichedEntries] = await Promise.all([
    Promise.all(providers.map((provider) => enrichApiRecord(provider, 'user'))),
    Promise.all(slots.map((slot) => enrichApiRecord(slot, 'user'))),
    Promise.all(entries.map((entry) => enrichApiRecord(entry, 'user'))),
  ]);

  return {
    version: Number.parseInt(profileState.version, 10) || 2,
    slots: enrichedSlots,
    providers: enrichedProviders,
    entries: enrichedEntries,
  };
}

function readPayloadFromRequest(req) {
  return {
    version: req.body.version || 2,
    slots: req.body.slots || [],
    providers: req.body.providers || [],
    entries: req.body.entries || [],
  };
}

async function saveEnrichedProfile(req, profileState) {
  const data = await readLocalStorage(req.profileUserId);
  writeProfileState(data, req.profileUserId, profileState);
  await writeLocalStorage(data);
}

router.put(['/v1/profile/key-manager', '/v1/profile/key-manager-state'], requireProfileAuth, async (req, res) => {
  const enriched = await enrichProfileState(readPayloadFromRequest(req));
  await saveEnrichedProfile(req, enriched);
  return res.json(okEnvelope(enriched, req));
});

router.put('/v1/profile/user-apis/payload', requireProfileAuth, async (req, res) => {
  const enriched = await enrichProfileState(readPayloadFromRequest(req));
  await saveEnrichedProfile(req, enriched);
  return res.json(okEnvelope(enriched, req));
});

router.put('/v1/profile/user-apis', requireProfileAuth, async (req, res) => {
  const data = await readLocalStorage(req.profileUserId);
  const profileState = readProfileState(data, req.profileUserId);
  const nextData = {
    ...profileState,
    entries: req.body.entries || [],
  };

  const enriched = await enrichProfileState(nextData);
  writeProfileState(data, req.profileUserId, enriched);
  await writeLocalStorage(data);

  return res.json(okEnvelope({ entries: enriched.entries.map(normalizeEntryForResponse) }, req));
});

router.post('/v1/profile/user-apis', requireProfileAuth, async (req, res) => {
  const data = await readLocalStorage(req.profileUserId);
  const profileState = readProfileState(data, req.profileUserId);
  const nextData = {
    ...profileState,
    entries: req.body.entries || [],
  };

  const enriched = await enrichProfileState(nextData);
  writeProfileState(data, req.profileUserId, enriched);
  await writeLocalStorage(data);

  return res.json(okEnvelope({ entries: enriched.entries.map(normalizeEntryForResponse) }, req));
});

module.exports = router;
