/**
 * @file user-api-payload-router.js
 * @module server/routes
 * @description 用户 API 配置保存入口增强层。它在 legacy user.js 之前接管用户 API payload 保存，
 *              自动用 Provider Probe 补齐 endpointType / requestProfileId / protocolFamily / models。
 *              这样前端无需让用户选择专业接口类型，用户只填 Base URL 与 Key 即可。
 */

const fs = require('fs');
const path = require('path');
const express = require('express');
const { verifyJWT, signJWT } = require('../lib/jwt');
const { probeProvider } = require('../lib/dispatcher/providerProbe');

const router = express.Router();
const LOCAL_STORAGE_PATH = path.resolve(__dirname, '../../.kk-local/local-user-apis.json');
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

function createEmptyLocalStorage() {
  return {
    version: 2,
    profiles: {},
  };
}

function createEmptyProfileState(version = 2) {
  return {
    version,
    slots: [],
    providers: [],
    entries: [],
  };
}

function normalizeProfileState(value) {
  const source = isObjectRecord(value) ? value : {};
  return {
    version: Number.parseInt(source.version, 10) || 2,
    slots: Array.isArray(source.slots) ? source.slots : [],
    providers: Array.isArray(source.providers) ? source.providers : [],
    entries: Array.isArray(source.entries) ? source.entries : [],
  };
}

function hasLegacyProfilePayload(data) {
  return Array.isArray(data.slots) || Array.isArray(data.providers) || Array.isArray(data.entries);
}

function ensureLocalStorage() {
  const dir = path.dirname(LOCAL_STORAGE_PATH);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  if (!fs.existsSync(LOCAL_STORAGE_PATH)) {
    fs.writeFileSync(LOCAL_STORAGE_PATH, JSON.stringify(createEmptyLocalStorage(), null, 2), 'utf8');
  }
}

function readLocalStorage() {
  ensureLocalStorage();
  try {
    const raw = fs.readFileSync(LOCAL_STORAGE_PATH, 'utf8');
    const parsed = JSON.parse(raw);
    return isObjectRecord(parsed) ? parsed : createEmptyLocalStorage();
  } catch {
    return createEmptyLocalStorage();
  }
}

function writeLocalStorage(data) {
  ensureLocalStorage();
  fs.writeFileSync(LOCAL_STORAGE_PATH, JSON.stringify(data, null, 2), 'utf8');
}

function readProfileState(data, userId) {
  if (!isObjectRecord(data.profiles)) {
    data.profiles = {};
  }

  const profiles = data.profiles;
  if (isObjectRecord(profiles[userId])) {
    return normalizeProfileState(profiles[userId]);
  }

  const shouldMigrateLegacyPayload = Object.keys(profiles).length === 0 && hasLegacyProfilePayload(data);
  const nextProfile = shouldMigrateLegacyPayload
    ? normalizeProfileState(data)
    : createEmptyProfileState(Number.parseInt(data.version, 10) || 2);

  profiles[userId] = nextProfile;
  delete data.slots;
  delete data.providers;
  delete data.entries;
  return nextProfile;
}

function writeProfileState(data, userId, profileState) {
  if (!isObjectRecord(data.profiles)) {
    data.profiles = {};
  }

  data.version = 2;
  data.profiles[userId] = normalizeProfileState(profileState);
  delete data.slots;
  delete data.providers;
  delete data.entries;
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
  const allowLocalTempUser = process.env.KKAI_LOCAL_ONLY === 'true' || process.env.NODE_ENV !== 'production';
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

  const enrichedProviders = [];
  for (const provider of providers) {
    enrichedProviders.push(await enrichApiRecord(provider, 'user'));
  }

  const enrichedSlots = [];
  for (const slot of slots) {
    enrichedSlots.push(await enrichApiRecord(slot, 'user'));
  }

  const enrichedEntries = [];
  for (const entry of entries) {
    enrichedEntries.push(await enrichApiRecord(entry, 'user'));
  }

  return {
    version: Number.parseInt(profileState.version, 10) || 2,
    slots: enrichedSlots,
    providers: enrichedProviders,
    entries: enrichedEntries,
  };
}

router.put(['/v1/profile/key-manager', '/v1/profile/key-manager-state'], requireProfileAuth, async (req, res) => {
  const nextData = {
    version: req.body.version || 2,
    slots: req.body.slots || [],
    providers: req.body.providers || [],
    entries: req.body.entries || [],
  };

  const data = readLocalStorage();
  const enriched = await enrichProfileState(nextData);
  writeProfileState(data, req.profileUserId, enriched);
  writeLocalStorage(data);

  return res.json(okEnvelope(enriched, req));
});

router.put(['/v1/profile/user-apis', '/v1/profile/user-apis/payload'], requireProfileAuth, async (req, res) => {
  const nextData = {
    version: req.body.version || 2,
    slots: req.body.slots || [],
    providers: req.body.providers || [],
    entries: req.body.entries || [],
  };

  const data = readLocalStorage();
  const enriched = await enrichProfileState(nextData);
  writeProfileState(data, req.profileUserId, enriched);
  writeLocalStorage(data);

  return res.json(okEnvelope(enriched, req));
});

router.post('/v1/profile/user-apis', requireProfileAuth, async (req, res) => {
  const data = readLocalStorage();
  const profileState = readProfileState(data, req.profileUserId);
  const nextData = {
    ...profileState,
    entries: req.body.entries || [],
  };

  const enriched = await enrichProfileState(nextData);
  writeProfileState(data, req.profileUserId, enriched);
  writeLocalStorage(data);

  return res.json(okEnvelope({ entries: enriched.entries }, req));
});

module.exports = router;
