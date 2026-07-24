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
const FORMAT_BY_PROTOCOL = {
  'claude-native': 'claude',
  'gemini-native': 'gemini',
  'google-official': 'gemini',
  'openai-compatible': 'auto',
};

/** Canonical provider legacy route prefix → provider_id 映射。
 *  来自 @kk/shared CANONICAL_PROVIDER_CATALOG 的 16 个提供商。
 *  用户自定义 Key Manager entry（UUID 格式）走 exact match，不在此映射中。 */
const CANONICAL_PROVIDER_PREFIX_TO_ID = new Map([
  ['google-1017-1', 'google'],
  ['openai', 'openai'],
  ['anthropic', 'anthropic'],
  ['deepseek', 'deepseek'],
  ['volcengine', 'volcengine'],
  ['aliyun', 'aliyun'],
  ['tencent', 'tencent'],
  ['siliconflow', 'siliconflow'],
  ['openrouter', 'openrouter'],
  ['apimart', 'apimart'],
  ['gpt-best', 'gpt-best'],
  ['wuyin', 'wuyinkeji'],
  ['12ai', '12ai'],
  ['flow2api', 'flow2api'],
  ['custom', 'custom'],
  ['systemproxy', 'systemproxy'],
]);

/** 反向映射：provider_id → 主要 legacy route 前缀（用于 projectLegacyRoute） */
const PROVIDER_ID_TO_LEGACY_PREFIX = new Map();
for (const [prefix, providerId] of CANONICAL_PROVIDER_PREFIX_TO_ID) {
  // 保留第一个（主前缀），跳过 google-1017-1 全量别名和 UUID/系统级 provider
  const NO_LEGACY_PREFIX = new Set(['custom', 'systemproxy']);
  if (!PROVIDER_ID_TO_LEGACY_PREFIX.has(providerId) && !prefix.includes('-1017-') && !NO_LEGACY_PREFIX.has(providerId)) {
    PROVIDER_ID_TO_LEGACY_PREFIX.set(providerId, prefix);
  }
}
// google 的特殊别名
PROVIDER_ID_TO_LEGACY_PREFIX.set('google', 'google-1017-1');

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

function resolveProviderIdFromLegacyRoute(normalizedRouteId) {
  if (!normalizedRouteId) return null;
  // 精确 UUID 匹配不需要 provider 映射（由 exact match 处理）
  if (CONNECTION_ID_PATTERN.test(normalizedRouteId)) return null;
  // 全量字符串匹配（如 google-1017-1）
  if (CANONICAL_PROVIDER_PREFIX_TO_ID.has(normalizedRouteId)) {
    return CANONICAL_PROVIDER_PREFIX_TO_ID.get(normalizedRouteId);
  }
  // 前缀匹配（如 openai-xxx, deepseek-xxx）— 要求前缀后是边界（'-' 或结束）
  for (const [prefix, providerId] of CANONICAL_PROVIDER_PREFIX_TO_ID) {
    if (prefix.includes('-1017-')) continue; // 跳过 google 特殊别名，它在全量匹配中已处理
    if (normalizedRouteId.startsWith(prefix)) {
      const suffix = normalizedRouteId.slice(prefix.length);
      if (suffix === '' || suffix.startsWith('-')) return providerId;
    }
  }
  return null;
}

function supportsNewLookup(normalizedRouteId) {
  if (!normalizedRouteId) return false;
  if (CONNECTION_ID_PATTERN.test(normalizedRouteId)) return true;
  if (CANONICAL_PROVIDER_PREFIX_TO_ID.has(normalizedRouteId)) return true;
  for (const prefix of CANONICAL_PROVIDER_PREFIX_TO_ID.keys()) {
    if (prefix.includes('-1017-')) continue;
    if (normalizedRouteId.startsWith(prefix)) {
      const suffix = normalizedRouteId.slice(prefix.length);
      if (suffix === '' || suffix.startsWith('-')) return true;
    }
  }
  return false;
}

function selectCandidate(candidates, routeId) {
  const normalizedRouteId = normalizeLegacyRouteId(routeId);
  if (!normalizedRouteId) return null;

  // 1. 精确 UUID 匹配
  const exact = candidates.find(({ connectionId }) => String(connectionId).toLowerCase() === normalizedRouteId);
  if (exact) return exact;

  // 2. Provider 级别匹配：查找该 provider 的所有 connection
  const providerId = resolveProviderIdFromLegacyRoute(normalizedRouteId);
  if (!providerId) return null;

  const providerCandidates = candidates.filter(({ providerId: pid }) => pid === providerId);
  if (providerCandidates.length === 0) return null;

  // 3. 单一 connection → 直接返回
  if (providerCandidates.length === 1) return providerCandidates[0];

  // 4. 多个 connection → 选 verified_at 最新的，记录歧义 warning
  const sorted = providerCandidates
    .map((c) => ({ ...c, _verifiedAt: c.verifiedAt ? new Date(c.verifiedAt).getTime() : 0 }))
    .sort((a, b) => b._verifiedAt - a._verifiedAt);

  console.warn('[providerConnectionLegacyRouteAdapter] Multiple connections for provider', {
    providerId, routeId: normalizedRouteId, count: sorted.length,
    selected: sorted[0].connectionId,
  });

  return sorted[0];
}

async function readSelectedConnection(userId, routeId, pool) {
  try {
    const record = await withUserScopedClient(userId, async (client) => {
      const candidateResult = await client.query(
        `SELECT pc.connection_id AS "connectionId", pc.provider_id AS "providerId",
                pc.display_name AS "displayName", pc.protocol_profile AS "protocolProfile",
                pc.endpoint_url AS endpoint, pc.verified_at AS "verifiedAt",
                cb.model_id AS "modelId", cb.request_profile AS "requestProfile"
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
  const legacyPrefix = PROVIDER_ID_TO_LEGACY_PREFIX.get(record.providerId);
  return {
    id: record.connectionId,
    legacyIds: legacyPrefix ? [legacyPrefix] : [],
    name: record.displayName,
    baseUrl: record.endpoint || '',
    apiKey,
    models: record.models,
    format: FORMAT_BY_PROTOCOL[record.protocolProfile] || 'auto',
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
  if (!supportsNewLookup(normalizedRouteId)) {
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
  // 导出以便单元测试
  CANONICAL_PROVIDER_PREFIX_TO_ID,
  PROVIDER_ID_TO_LEGACY_PREFIX,
  resolveProviderIdFromLegacyRoute,
  selectCandidate,
  supportsNewLookup,
  projectLegacyRoute,
  normalizeLegacyRouteId,
  groupCandidateRows,
  decryptSelectedSecret,
};
