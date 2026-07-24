import assert from 'node:assert/strict';
import test from 'node:test';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const adapter = require('../../services/api/lib/capability-graph/providerConnectionLegacyRouteAdapter.js');

const {
  CANONICAL_PROVIDER_PREFIX_TO_ID,
  PROVIDER_ID_TO_LEGACY_PREFIX,
  resolveProviderIdFromLegacyRoute,
  selectCandidate,
  supportsNewLookup,
  projectLegacyRoute,
  normalizeLegacyRouteId,
  groupCandidateRows,
  decryptSelectedSecret,
} = adapter;

// 测试 canonical provider 映射函数（纯函数，不需要数据库）
test('16 canonical providers mapped in CANONICAL_PROVIDER_PREFIX_TO_ID', () => {
  assert.equal(CANONICAL_PROVIDER_PREFIX_TO_ID.size, 16,
    'Expected 16 canonical provider prefixes');

  const expectedProviders = [
    'google', 'openai', 'anthropic', 'deepseek', 'volcengine',
    'aliyun', 'tencent', 'siliconflow', 'openrouter', 'apimart',
    'gpt-best', 'wuyinkeji', '12ai', 'flow2api', 'custom', 'systemproxy',
  ];

  const mappedIds = new Set(CANONICAL_PROVIDER_PREFIX_TO_ID.values());
  for (const providerId of expectedProviders) {
    assert.ok(mappedIds.has(providerId),
      `Provider ${providerId} should be in CANONICAL_PROVIDER_PREFIX_TO_ID`);
  }
});

test('normalizeLegacyRouteId strips prefixes', () => {
  assert.equal(normalizeLegacyRouteId('slot_key_openai-key'), 'openai-key');
  assert.equal(normalizeLegacyRouteId('slot_openai-key'), 'openai-key');
  assert.equal(normalizeLegacyRouteId('provider_openai'), 'openai');
  assert.equal(normalizeLegacyRouteId('openai-key'), 'openai-key');
  assert.equal(normalizeLegacyRouteId('GOOGLE-1017-1'), 'google-1017-1');
  assert.equal(normalizeLegacyRouteId(''), '');
});

test('resolveProviderIdFromLegacyRoute — exact match', () => {
  assert.equal(resolveProviderIdFromLegacyRoute('google-1017-1'), 'google');
  assert.equal(resolveProviderIdFromLegacyRoute('openai'), 'openai');
  assert.equal(resolveProviderIdFromLegacyRoute('anthropic'), 'anthropic');
  assert.equal(resolveProviderIdFromLegacyRoute('deepseek'), 'deepseek');
  assert.equal(resolveProviderIdFromLegacyRoute('aliyun'), 'aliyun');
  assert.equal(resolveProviderIdFromLegacyRoute('tencent'), 'tencent');
  assert.equal(resolveProviderIdFromLegacyRoute('wuyin'), 'wuyinkeji');
  assert.equal(resolveProviderIdFromLegacyRoute('gpt-best'), 'gpt-best');
});

test('resolveProviderIdFromLegacyRoute — prefix match', () => {
  assert.equal(resolveProviderIdFromLegacyRoute('openai-official'), 'openai');
  assert.equal(resolveProviderIdFromLegacyRoute('openai-my-custom'), 'openai');
  assert.equal(resolveProviderIdFromLegacyRoute('deepseek-r1'), 'deepseek');
  assert.equal(resolveProviderIdFromLegacyRoute('aliyun-qwen'), 'aliyun');
  assert.equal(resolveProviderIdFromLegacyRoute('siliconflow-free'), 'siliconflow');
  assert.equal(resolveProviderIdFromLegacyRoute('wuyin-suchuang'), 'wuyinkeji');
});

test('resolveProviderIdFromLegacyRoute — exact UUID returns null (handled by exact match)', () => {
  assert.equal(resolveProviderIdFromLegacyRoute('a1b2c3d4-e5f6-4789-abcd-ef0123456789'), null);
  assert.equal(resolveProviderIdFromLegacyRoute('00000000-1111-5222-8333-444444444444'), null);
});

test('resolveProviderIdFromLegacyRoute — prefix boundary enforcement', () => {
  // 'wuyin' 前缀不应匹配 'wuyinkeji-...'（缺少 '-' 边界）
  assert.equal(resolveProviderIdFromLegacyRoute('wuyinkeji-google-omni-1015-1'), null);
  // 'openai' 前缀不应匹配 'openaikey'（缺少 '-' 边界）
  assert.equal(resolveProviderIdFromLegacyRoute('openaikey'), null);
  // 但 'openai-' 后缀应匹配
  assert.equal(resolveProviderIdFromLegacyRoute('openai-official'), 'openai');
  assert.equal(resolveProviderIdFromLegacyRoute('openai-v3'), 'openai');
  // 'wuyin-' 后缀应匹配
  assert.equal(resolveProviderIdFromLegacyRoute('wuyin-suchuang'), 'wuyinkeji');
});

test('supportsNewLookup — respects prefix boundary', () => {
  assert.equal(supportsNewLookup('wuyinkeji-google-omni-1015-1'), false);
  assert.equal(supportsNewLookup('openaikey'), false);
  assert.ok(supportsNewLookup('openai-official'));
  assert.ok(supportsNewLookup('wuyin-suchuang'));
});

test('supportsNewLookup — all canonical providers', () => {
  assert.ok(supportsNewLookup('google-1017-1'));
  assert.ok(supportsNewLookup('openai'));
  assert.ok(supportsNewLookup('openai-custom-key'));
  assert.ok(supportsNewLookup('anthropic'));
  assert.ok(supportsNewLookup('deepseek'));
  assert.ok(supportsNewLookup('deepseek-v3'));
  assert.ok(supportsNewLookup('volcengine'));
  assert.ok(supportsNewLookup('aliyun'));
  assert.ok(supportsNewLookup('tencent'));
  assert.ok(supportsNewLookup('siliconflow'));
  assert.ok(supportsNewLookup('openrouter'));
  assert.ok(supportsNewLookup('apimart'));
  assert.ok(supportsNewLookup('gpt-best'));
  assert.ok(supportsNewLookup('wuyin'));
  assert.ok(supportsNewLookup('wuyin-suchuang'));
  assert.ok(supportsNewLookup('12ai'));
  assert.ok(supportsNewLookup('flow2api'));
  assert.ok(supportsNewLookup('a1b2c3d4-e5f6-4789-abcd-ef0123456789')); // UUID
});

test('supportsNewLookup — unknown routes return false', () => {
  assert.equal(supportsNewLookup('unknown'), false);
  assert.equal(supportsNewLookup(''), false);
  assert.equal(supportsNewLookup('xyz-abc-123'), false);
});

test('selectCandidate — exact UUID match', () => {
  const rows = [
    { connectionId: 'a1b2c3d4-e5f6-4789-abcd-ef0123456789', providerId: 'google',
      displayName: 'G1', protocolProfile: 'google-official', endpoint: 'https://g.com',
      modelId: 'gemini-2.5', requestProfile: 'default', verifiedAt: null },
  ];
  const candidates = groupCandidateRows(rows);
  const result = selectCandidate(candidates, 'a1b2c3d4-e5f6-4789-abcd-ef0123456789');
  assert.ok(result);
  assert.equal(result.connectionId, 'a1b2c3d4-e5f6-4789-abcd-ef0123456789');
});

test('selectCandidate — provider-level match (single connection)', () => {
  const rows = [
    { connectionId: 'uuid-1', providerId: 'openai', displayName: 'O1',
      protocolProfile: 'openai-compatible', endpoint: 'https://api.openai.com/v1',
      modelId: 'gpt-4o', requestProfile: 'default', verifiedAt: '2026-01-01T00:00:00Z' },
  ];
  const candidates = groupCandidateRows(rows);
  const result = selectCandidate(candidates, 'openai-key');
  assert.ok(result);
  assert.equal(result.providerId, 'openai');
});

test('selectCandidate — provider-level match (multiple connections, picks latest verified)', () => {
  const rows = [
    { connectionId: 'older', providerId: 'anthropic', displayName: 'A1',
      protocolProfile: 'claude-native', endpoint: 'https://api.anthropic.com',
      modelId: 'claude-3', requestProfile: 'default', verifiedAt: '2025-01-01T00:00:00Z' },
    { connectionId: 'newer', providerId: 'anthropic', displayName: 'A2',
      protocolProfile: 'claude-native', endpoint: 'https://api.anthropic.com',
      modelId: 'claude-4', requestProfile: 'default', verifiedAt: '2026-06-01T00:00:00Z' },
  ];
  const candidates = groupCandidateRows(rows);
  const result = selectCandidate(candidates, 'anthropic');
  assert.ok(result);
  assert.equal(result.connectionId, 'newer', 'Should pick newer verified connection');
});

test('selectCandidate — unknown route returns null', () => {
  const rows = [
    { connectionId: 'uuid-1', providerId: 'openai', displayName: 'O1',
      protocolProfile: 'openai-compatible', endpoint: 'https://api.openai.com',
      modelId: 'gpt-4o', requestProfile: 'default', verifiedAt: null },
  ];
  const candidates = groupCandidateRows(rows);
  const result = selectCandidate(candidates, 'unknown-provider');
  assert.equal(result, null);
});

test('projectLegacyRoute — dynamic legacyIds from provider mapping', () => {
  // Google
  const googleRoute = projectLegacyRoute({
    connectionId: 'uuid-g', providerId: 'google', displayName: 'Google',
    protocolProfile: 'google-official', endpoint: 'https://g.com',
    models: ['gemini-2.5'], requestProfiles: ['default'],
  }, 'sk-google-key');
  assert.deepEqual(googleRoute.legacyIds, ['google-1017-1']);
  assert.equal(googleRoute.format, 'gemini');
  assert.equal(googleRoute.endpointType, 'google_gemini_generate_content');

  // OpenAI
  const openaiRoute = projectLegacyRoute({
    connectionId: 'uuid-o', providerId: 'openai', displayName: 'OpenAI',
    protocolProfile: 'openai-compatible', endpoint: 'https://api.openai.com/v1',
    models: ['gpt-4o'], requestProfiles: ['default'],
  }, 'sk-openai-key');
  assert.deepEqual(openaiRoute.legacyIds, ['openai']);
  assert.equal(openaiRoute.format, 'auto');
  assert.equal(openaiRoute.endpointType, 'auto');

  // Anthropic
  const claudeRoute = projectLegacyRoute({
    connectionId: 'uuid-a', providerId: 'anthropic', displayName: 'Claude',
    protocolProfile: 'claude-native', endpoint: 'https://api.anthropic.com',
    models: ['claude-4'], requestProfiles: ['default'],
  }, 'sk-anthropic-key');
  assert.deepEqual(claudeRoute.legacyIds, ['anthropic']);
  assert.equal(claudeRoute.format, 'claude');
  assert.equal(claudeRoute.endpointType, 'anthropic_messages');

  // Custom (no legacyId)
  const customRoute = projectLegacyRoute({
    connectionId: 'uuid-c', providerId: 'custom', displayName: 'My Proxy',
    protocolProfile: 'openai-compatible', endpoint: 'https://myproxy.com',
    models: ['custom-model'], requestProfiles: ['default'],
  }, 'sk-custom');
  assert.deepEqual(customRoute.legacyIds, []);
  assert.equal(customRoute.format, 'auto');
});

test('PROVIDER_ID_TO_LEGACY_PREFIX has reverse mappings for all route-able providers', () => {
  // UUID-based 和系统级 provider（custom、systemproxy）没有 legacy 路由前缀
  const ROUTE_ABLE_PROVIDERS = new Set([
    'google', 'openai', 'anthropic', 'deepseek', 'volcengine',
    'aliyun', 'tencent', 'siliconflow', 'openrouter', 'apimart',
    'gpt-best', 'wuyinkeji', '12ai', 'flow2api',
  ]);
  const excludedFromLegacy = new Set(['custom', 'systemproxy']);

  /** @type {string[]} */
  const allProviderIds = [...CANONICAL_PROVIDER_PREFIX_TO_ID.values()];
  for (const providerId of allProviderIds) {
    if (excludedFromLegacy.has(providerId)) {
      assert.equal(PROVIDER_ID_TO_LEGACY_PREFIX.has(providerId), false,
        `Provider ${providerId} should NOT be in PROVIDER_ID_TO_LEGACY_PREFIX`);
    } else {
      assert.ok(PROVIDER_ID_TO_LEGACY_PREFIX.has(providerId),
        `Provider ${providerId} should be in PROVIDER_ID_TO_LEGACY_PREFIX`);
      assert.ok(ROUTE_ABLE_PROVIDERS.has(providerId),
        `Provider ${providerId} should be in ROUTE_ABLE_PROVIDERS`);
    }
  }
});

test('decryptSelectedSecret — fail closed', () => {
  try {
    decryptSelectedSecret({ secretRef: 'enc:broken' }, () => { throw new Error('decrypt failed'); });
    assert.fail('Should have thrown');
  } catch (err: any) {
    assert.equal(err.code, 'CONNECTION_SECRET_UNAVAILABLE');
    assert.equal(err.statusCode, 500);
  }
});
