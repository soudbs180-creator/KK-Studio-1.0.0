import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import type { ProviderConnectionDto } from '@kk/shared';

const MIGRATION_MODULE = '../../apps/web/src/services/provider-connections/providerConnectionMigration.ts';

function createConnection(overrides: Partial<ProviderConnectionDto> = {}): ProviderConnectionDto {
  return {
    connectionId: '550e8400-e29b-41d4-a716-446655440000',
    providerId: 'google',
    displayName: 'Existing Google',
    protocolProfile: 'google-official',
    endpoint: 'https://generativelanguage.googleapis.com',
    status: 'available',
    hasSecret: true,
    createdAt: '2026-07-22T00:00:00.000Z',
    updatedAt: '2026-07-22T00:00:00.000Z',
    ...overrides,
  };
}

test('legacy Provider routes project to canonical migration candidates without secret material', async () => {
  const { buildProviderConnectionMigrationCandidates } = await import(MIGRATION_MODULE);
  const candidates = buildProviderConnectionMigrationCandidates([
    {
      id: 'slot-google-1',
      name: 'Studio Google',
      provider: 'Google',
      baseUrl: 'https://generativelanguage.googleapis.com/',
      key: 'must-not-leak',
      apiKey: 'must-not-leak-either',
    },
    {
      id: 'provider-openai-1',
      name: 'OpenAI primary',
      provider: 'OpenAI',
      baseUrl: 'https://api.openai.com/v1',
      protocolFamily: 'openai-compatible',
    },
  ], []);

  assert.deepEqual(candidates.map(({ providerId, protocolProfile }) => ({ providerId, protocolProfile })), [
    { providerId: 'google', protocolProfile: 'google-official' },
    { providerId: 'openai', protocolProfile: 'openai-compatible' },
  ]);
  assert.equal(candidates[0].endpoint, 'https://generativelanguage.googleapis.com');
  assert.equal(candidates.every((candidate) => candidate.requiresSecretReentry), true);
  assert.equal(JSON.stringify(candidates).includes('must-not-leak'), false);
  assert.equal('key' in candidates[0], false);
  assert.equal('apiKey' in candidates[0], false);
});

test('migration projection skips inactive routes and de-duplicates already migrated metadata', async () => {
  const { buildProviderConnectionMigrationCandidates } = await import(MIGRATION_MODULE);
  const candidates = buildProviderConnectionMigrationCandidates([
    { id: 'slot-google-1', name: 'Existing Google', provider: 'Google' },
    { id: 'slot-google-disabled', name: 'Disabled Google', provider: 'Google', disabled: true },
    { id: 'provider-openai-disabled', name: 'Disabled OpenAI', provider: 'OpenAI', isActive: false },
    { id: '', name: 'Missing identity', provider: 'Google' },
    { id: 'unknown-route', name: 'Unknown route', provider: 'Not In Catalog' },
  ], [createConnection()]);

  assert.deepEqual(candidates, []);
});

test('migration projection resolves canonical hosts and preserves separate legacy route identities', async () => {
  const { buildProviderConnectionMigrationCandidates } = await import(MIGRATION_MODULE);
  const candidates = buildProviderConnectionMigrationCandidates([
    { id: 'route-a', name: 'Relay A', baseUrl: 'https://api.siliconflow.cn/v1/' },
    { id: 'route-b', name: 'Relay B', baseUrl: 'https://api.siliconflow.cn/v1' },
  ], []);

  assert.deepEqual(candidates.map(({ legacyRouteId, providerId, endpoint }) => ({ legacyRouteId, providerId, endpoint })), [
    { legacyRouteId: 'route-a', providerId: 'siliconflow', endpoint: 'https://api.siliconflow.cn/v1' },
    { legacyRouteId: 'route-b', providerId: 'siliconflow', endpoint: 'https://api.siliconflow.cn/v1' },
  ]);
});

test('migration projection can restrict candidates to the currently supported provider template', async () => {
  const { buildProviderConnectionMigrationCandidates } = await import(MIGRATION_MODULE);
  const candidates = buildProviderConnectionMigrationCandidates([
    { id: 'route-google', name: 'Google route', provider: 'Google' },
    { id: 'route-openai', name: 'OpenAI route', provider: 'OpenAI' },
  ], [], { providerIds: ['google'] });

  assert.deepEqual(candidates.map(({ legacyRouteId, providerId }) => ({ legacyRouteId, providerId })), [
    { legacyRouteId: 'route-google', providerId: 'google' },
  ]);
});

test('migration projection rejects conflicting canonical provider and endpoint identities', async () => {
  const { buildProviderConnectionMigrationCandidates } = await import(MIGRATION_MODULE);
  const candidates = buildProviderConnectionMigrationCandidates([
    {
      id: 'conflicting-route',
      name: 'Unsafe route',
      provider: 'Google',
      baseUrl: 'https://api.openai.com/v1',
    },
  ], []);

  assert.deepEqual(candidates, []);
});

test('migration projection rejects endpoint userinfo that could expose legacy credentials', async () => {
  const { buildProviderConnectionMigrationCandidates } = await import(MIGRATION_MODULE);
  const candidates = buildProviderConnectionMigrationCandidates([
    {
      id: 'credential-url-route',
      name: 'Unsafe URL route',
      provider: 'Google',
      baseUrl: 'https://legacy-user:legacy-secret@generativelanguage.googleapis.com',
    },
  ], []);

  assert.deepEqual(candidates, []);
});

test('Provider Connections UI exposes an explicit secret re-entry migration bridge', () => {
  const source = fs.readFileSync('apps/web/src/components/settings/ProviderConnectionsPanel.tsx', 'utf8');

  assert.match(source, /listProviderConnections/);
  assert.match(source, /buildProviderConnectionMigrationCandidates/);
  assert.match(source, /keyManager\.getSlots\(\)/);
  assert.match(source, /keyManager\.getProviders\(\)/);
  assert.match(source, /providerIds: \[PHASE_ONE_PROVIDER_TEMPLATE\.providerId\]/);
  assert.match(source, /requiresSecretReentry/);
  assert.match(source, /candidate\.endpoint/);
  assert.match(source, /setSelectedMigration/);
  assert.match(source, /readOnly=\{Boolean\(props\.selectedMigration\)\}/);
  assert.match(source, /handleMigrationCancel/);
  assert.match(source, /finally \{[\s\S]*if \(resetForm\) \{[\s\S]*setSecret\(''\);[\s\S]*setSelectedMigration\(null\);[\s\S]*setDisplayName\(PHASE_ONE_PROVIDER_TEMPLATE\.title\);[\s\S]*await refreshGraph\(\);/);
  assert.doesNotMatch(source, /revealUserApiSecret/);
});
