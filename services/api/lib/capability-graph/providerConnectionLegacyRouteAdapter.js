const cryptoUtil = require('../../utils/crypto');
const { withUserScopedClient } = require('./providerConnectionStore');
const { providerConnectionDualReadMetrics } = require('./providerConnectionDualReadMetrics');

const GOOGLE_LEGACY_ROUTE_ID = 'google-1017-1';
const CONNECTION_ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const ENDPOINT_TYPE_BY_PROTOCOL = {
  'claude-native': 'anthropic_messages',
  'gemini-native': 'google_gemini_generate_content',
  'google-official': 'google_gemini_generate_content',
  'openai-compatible': 'auto',
};

function isProviderConnectionLegacyDualReadEnabled(env = process.env) {
  return String(env.PROVIDER_CONNECTION_LEGACY_DUAL_READ_ENABLED || '').trim().toLowerCase() === 'true';
}

function normalizeLegacyRouteId(routeId) {
  let normalized = String(routeId || '').trim().toLowerCase();
  try {
    normalized = decodeURIComponent(normalized);
  } catch {
    return normalized;
  }
  if (normalized.startsWith('slot_key_')) return normalized.slice('slot_key_'.length);
  if (normalized.startsWith('slot_')) return normalized.slice('slot_'.length);
  if (normalized.startsWith('provider_')) return normalized.slice('provider_'.length);
  return normalized;
}

function groupCandidateRows(rows) {
  const candidates = new Map();
  for (const row of rows) {
    const current = candidates.get(row.connectionId) || { ...row, models: [], requestProfiles: [] };
    if (row.modelId && !current.models.includes(row.modelId)) current.models.push(row.modelId);
    if (row.requestProfile && !current.requestProfiles.includes(row.requestProfile)) {
      current.requestProfiles.push(row.requestProfile);
    }
    candidates.set(row.connectionId, current);
  }
  return Array.from(candidates.values());
}

function selectCandidate(candidates, routeId) {
  const normalizedRouteId = normalizeLegacyRouteId(routeId);
  if (!normalizedRouteId) return null;
  const exact = candidates.find(({ connectionId }) => String(connectionId).toLowerCase() === normalizedRouteId);
  if (exact) return exact;
  if (normalizedRouteId !== GOOGLE_LEGACY_ROUTE_ID) return null;
  const googleCandidates = candidates.filter(({ providerId }) => providerId === 'google');
  return googleCandidates.length === 1 ? googleCandidates[0] : null;
}

async function readSelectedConnection(userId, routeId, pool) {
  try {
    const record = await withUserScopedClient(userId, async (client) => {
      const candidateResult = await client.query(
        `SELECT pc.connection_id AS "connectionId", pc.provider_id AS "providerId",
                pc.display_name AS "displayName", pc.protocol_profile AS "protocolProfile",
                pc.endpoint_url AS endpoint, cb.model_id AS "modelId",
                cb.request_profile AS "requestProfile"
         FROM public.provider_connections pc
         JOIN public.capability_bindings cb
           ON cb.user_id = pc.user_id AND cb.connection_id = pc.connection_id
         WHERE pc.user_id = $1 AND pc.status = 'available'
           AND cb.status = 'active' AND pc.revoked_at IS NULL`,
        [userId],
      );
      const selected = selectCandidate(groupCandidateRows(candidateResult.rows), routeId);
      if (!selected) return null;
      const secretResult = await client.query(
        `SELECT pc.secret_ref AS "secretRef"
         FROM public.provider_connections pc
         WHERE pc.user_id = $1 AND pc.connection_id = $2
           AND pc.status = 'available' AND pc.revoked_at IS NULL
           AND EXISTS (
             SELECT 1 FROM public.capability_bindings cb
             WHERE cb.user_id = pc.user_id AND cb.connection_id = pc.connection_id
               AND cb.status = 'active'
           )
         LIMIT 1`,
        [userId, selected.connectionId],
      );
      return secretResult.rows[0] ? { ...selected, secretRef: secretResult.rows[0].secretRef } : null;
    }, pool);
    return record
      ? { outcome: 'selected', record }
      : { outcome: 'fallbackNoMatch', record: null };
  } catch {
    return { outcome: 'fallbackStorageUnavailable', record: null };
  }
}

function decryptSelectedSecret(record, decrypt) {
  try {
    return decrypt(record.secretRef);
  } catch {
    const error = new Error('The selected Provider Connection credential cannot be decrypted.');
    error.code = 'CONNECTION_SECRET_UNAVAILABLE';
    error.statusCode = 500;
    throw error;
  }
}

function projectLegacyRoute(record, apiKey) {
  return {
    id: record.connectionId,
    legacyIds: record.providerId === 'google' ? [GOOGLE_LEGACY_ROUTE_ID] : [],
    name: record.displayName,
    baseUrl: record.endpoint || '',
    apiKey,
    models: record.models,
    format: record.protocolProfile === 'google-official' ? 'gemini' : 'auto',
    endpointType: ENDPOINT_TYPE_BY_PROTOCOL[record.protocolProfile] || 'auto',
    requestProfileId: record.requestProfiles.length === 1
      ? record.requestProfiles[0]
      : record.protocolProfile,
  };
}

/** Migration-only adapter: new owner Connection wins, while unavailable storage preserves legacy reads. */
async function resolveProviderConnectionLegacyRoute(userId, routeId, overrides = {}) {
  const env = overrides.env || process.env;
  if (!isProviderConnectionLegacyDualReadEnabled(env) || !userId || !routeId) return null;
  const metrics = overrides.metrics || providerConnectionDualReadMetrics;
  const normalizedRouteId = normalizeLegacyRouteId(routeId);
  const supportsNewLookup = normalizedRouteId === GOOGLE_LEGACY_ROUTE_ID
    || CONNECTION_ID_PATTERN.test(normalizedRouteId);
  if (!supportsNewLookup) {
    metrics.recordOutcome('fallbackUnsupportedRoute');
    return null;
  }
  const selection = await readSelectedConnection(userId, normalizedRouteId, overrides.pool);
  if (!selection.record) {
    metrics.recordOutcome(selection.outcome);
    return null;
  }
  let apiKey;
  try {
    apiKey = decryptSelectedSecret(selection.record, overrides.decrypt || cryptoUtil.decrypt);
  } catch (error) {
    metrics.recordOutcome('blockedSecretUnavailable');
    throw error;
  }
  const route = projectLegacyRoute(selection.record, apiKey);
  metrics.recordOutcome('selected');
  return route;
}

module.exports = {
  isProviderConnectionLegacyDualReadEnabled,
  resolveProviderConnectionLegacyRoute,
};
