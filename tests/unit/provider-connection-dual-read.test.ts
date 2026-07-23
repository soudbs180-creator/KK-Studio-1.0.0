import assert from 'node:assert/strict';
import test from 'node:test';
import localUserRouteStore from '../../services/api/lib/dispatcher/localUserRouteStore.js';

interface QueryCall {
  text: string;
  values: unknown[];
}

interface PoolOptions {
  candidates?: Array<Record<string, unknown>>;
  secretRef?: string;
  queryError?: Error;
}

function createPool(options: PoolOptions = {}) {
  const calls: QueryCall[] = [];
  const client = {
    async query(text: string, values: unknown[] = []) {
      calls.push({ text, values });
      if (options.queryError && text.includes('FROM public.provider_connections pc')) {
        throw options.queryError;
      }
      if (text.includes('pc.secret_ref AS "secretRef"')) {
        return { rows: options.secretRef ? [{ secretRef: options.secretRef }] : [] };
      }
      if (text.includes('FROM public.provider_connections pc')) {
        return { rows: options.candidates || [] };
      }
      return { rows: [] };
    },
    release() {},
  };
  return {
    calls,
    pool: { async connect() { return client; } },
  };
}

function googleCandidate(connectionId: string, modelId = 'gemini-2.5-flash-image') {
  return {
    connectionId,
    providerId: 'google',
    displayName: 'Google official',
    protocolProfile: 'google-official',
    endpoint: 'https://generativelanguage.googleapis.com',
    modelId,
    requestProfile: 'google-generate-content-v1beta',
  };
}

test('dual-read flag defaults off without touching Provider Connection storage', async () => {
  const module = await import('../../services/api/lib/capability-graph/providerConnectionLegacyRouteAdapter.js');
  const { resolveProviderConnectionLegacyRoute } = module.default || module;
  let connectCount = 0;
  const route = await resolveProviderConnectionLegacyRoute('owner-1', 'google-1017-1', {
    env: {},
    pool: { async connect() { connectCount += 1; throw new Error('must not connect'); } },
  });

  assert.equal(route, null);
  assert.equal(connectCount, 0);
});

test('enabled dual-read ignores unrelated legacy aliases without touching the database', async () => {
  const module = await import('../../services/api/lib/capability-graph/providerConnectionLegacyRouteAdapter.js');
  const { resolveProviderConnectionLegacyRoute } = module.default || module;
  let connectCount = 0;
  const route = await resolveProviderConnectionLegacyRoute('owner-1', 'wuyinkeji-google-omni-1015-1', {
    env: { PROVIDER_CONNECTION_LEGACY_DUAL_READ_ENABLED: 'true' },
    pool: { async connect() { connectCount += 1; throw new Error('must not connect'); } },
  });

  assert.equal(route, null);
  assert.equal(connectCount, 0);
});

test('exact Connection ID selects an owner-scoped available active binding', async () => {
  const module = await import('../../services/api/lib/capability-graph/providerConnectionLegacyRouteAdapter.js');
  const { resolveProviderConnectionLegacyRoute } = module.default || module;
  const connectionId = '550e8400-e29b-41d4-a716-446655440000';
  const { pool, calls } = createPool({
    candidates: [googleCandidate(connectionId)],
    secretRef: 'encrypted-envelope',
  });

  const route = await resolveProviderConnectionLegacyRoute('owner-1', `slot_${connectionId}`, {
    env: { PROVIDER_CONNECTION_LEGACY_DUAL_READ_ENABLED: 'true' },
    pool,
    decrypt: () => 'new-owner-secret',
  });

  assert.equal(route?.id, connectionId);
  assert.equal(route?.apiKey, 'new-owner-secret');
  assert.equal(route?.baseUrl, 'https://generativelanguage.googleapis.com');
  assert.deepEqual(route?.models, ['gemini-2.5-flash-image']);
  assert.equal(JSON.stringify(route).includes('secretRef'), false);
  assert.equal(JSON.stringify(route).includes('encrypted-envelope'), false);

  const candidateQuery = calls.find(({ text }) => text.includes('pc.display_name AS "displayName"'));
  assert.deepEqual(candidateQuery?.values, ['owner-1']);
  assert.match(candidateQuery?.text || '', /pc\.user_id = \$1/);
  assert.match(candidateQuery?.text || '', /pc\.status = 'available'/);
  assert.match(candidateQuery?.text || '', /cb\.status = 'active'/);
  assert.match(candidateQuery?.text || '', /pc\.revoked_at IS NULL/);
});

test('the unique Google canonical alias prefers the new Connection', async () => {
  const module = await import('../../services/api/lib/capability-graph/providerConnectionLegacyRouteAdapter.js');
  const { resolveProviderConnectionLegacyRoute } = module.default || module;
  const connectionId = '550e8400-e29b-41d4-a716-446655440001';
  const { pool } = createPool({
    candidates: [googleCandidate(connectionId), {
      ...googleCandidate('550e8400-e29b-41d4-a716-446655440002'),
      providerId: 'openai',
    }],
    secretRef: 'encrypted-envelope',
  });

  const route = await resolveProviderConnectionLegacyRoute('owner-1', 'provider_google-1017-1', {
    env: { PROVIDER_CONNECTION_LEGACY_DUAL_READ_ENABLED: 'true' },
    pool,
    decrypt: () => 'new-google-secret',
  });

  assert.equal(route?.id, connectionId);
  assert.equal(route?.apiKey, 'new-google-secret');
});

test('ambiguous Google aliases do not select randomly and preserve legacy fallback', async () => {
  const module = await import('../../services/api/lib/capability-graph/providerConnectionLegacyRouteAdapter.js');
  const { resolveProviderConnectionLegacyRoute } = module.default || module;
  const { pool, calls } = createPool({
    candidates: [
      googleCandidate('550e8400-e29b-41d4-a716-446655440003'),
      googleCandidate('550e8400-e29b-41d4-a716-446655440004'),
    ],
    secretRef: 'must-not-be-read',
  });

  const route = await resolveProviderConnectionLegacyRoute('owner-1', 'google-1017-1', {
    env: { PROVIDER_CONNECTION_LEGACY_DUAL_READ_ENABLED: 'true' },
    pool,
    decrypt: () => 'must-not-decrypt',
  });

  assert.equal(route, null);
  assert.equal(calls.some(({ text }) => text.includes('pc.secret_ref AS "secretRef"')), false);
});

test('no new match and query infrastructure failure both preserve legacy fallback', async () => {
  const module = await import('../../services/api/lib/capability-graph/providerConnectionLegacyRouteAdapter.js');
  const { resolveProviderConnectionLegacyRoute } = module.default || module;
  const enabledEnv = { PROVIDER_CONNECTION_LEGACY_DUAL_READ_ENABLED: 'true' };
  const noMatch = createPool({ candidates: [] });
  const failedQuery = createPool({ queryError: new Error('relation is unavailable') });

  assert.equal(await resolveProviderConnectionLegacyRoute('owner-1', 'google-1017-1', {
    env: enabledEnv,
    pool: noMatch.pool,
  }), null);
  assert.equal(await resolveProviderConnectionLegacyRoute('owner-1', 'google-1017-1', {
    env: enabledEnv,
    pool: failedQuery.pool,
  }), null);
});

test('a selected new Connection with an unreadable secret fails closed', async () => {
  const module = await import('../../services/api/lib/capability-graph/providerConnectionLegacyRouteAdapter.js');
  const { resolveProviderConnectionLegacyRoute } = module.default || module;
  const connectionId = '550e8400-e29b-41d4-a716-446655440005';
  const { pool } = createPool({
    candidates: [googleCandidate(connectionId)],
    secretRef: 'invalid-envelope',
  });

  await assert.rejects(
    resolveProviderConnectionLegacyRoute('owner-1', connectionId, {
      env: { PROVIDER_CONNECTION_LEGACY_DUAL_READ_ENABLED: 'true' },
      pool,
      decrypt: () => { throw new Error('decrypt failed'); },
    }),
    (error: unknown) => error instanceof Error
      && Reflect.get(error, 'code') === 'CONNECTION_SECRET_UNAVAILABLE',
  );
});

test('local route resolution checks the uncached new source before legacy cache', async () => {
  let callCount = 0;
  const firstRoute = await localUserRouteStore.resolveLocalUserRoute('owner-1', 'google-1017-1', {
    resolveProviderConnectionLegacyRoute: async () => {
      callCount += 1;
      return { id: 'connection-1', apiKey: 'first-secret' };
    },
  });
  const secondRoute = await localUserRouteStore.resolveLocalUserRoute('owner-1', 'google-1017-1', {
    resolveProviderConnectionLegacyRoute: async () => {
      callCount += 1;
      return { id: 'connection-1', apiKey: 'second-secret' };
    },
  });

  assert.equal(firstRoute?.apiKey, 'first-secret');
  assert.equal(secondRoute?.apiKey, 'second-secret');
  assert.equal(callCount, 2);
});
