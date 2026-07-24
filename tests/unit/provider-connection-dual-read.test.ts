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

test('multiple Google connections select the latest verified candidate deterministically', async () => {
  const module = await import('../../services/api/lib/capability-graph/providerConnectionLegacyRouteAdapter.js');
  const { resolveProviderConnectionLegacyRoute } = module.default || module;
  const newerConnId = '550e8400-e29b-41d4-a716-446655440003';
  const olderConnId = '550e8400-e29b-41d4-a716-446655440004';
  const { pool } = createPool({
    candidates: [
      { ...googleCandidate(newerConnId), verifiedAt: '2026-07-01T00:00:00Z' },
      { ...googleCandidate(olderConnId), verifiedAt: '2026-01-01T00:00:00Z' },
    ],
    secretRef: 'encrypted-envelope',
  });

  const route = await resolveProviderConnectionLegacyRoute('owner-1', 'google-1017-1', {
    env: { PROVIDER_CONNECTION_LEGACY_DUAL_READ_ENABLED: 'true' },
    pool,
    decrypt: () => 'selected-key',
  });

  assert.ok(route);
  assert.equal(route.id, newerConnId, 'Should pick the latest verified connection');
  assert.equal(route.apiKey, 'selected-key');
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

test('dual-read records aggregate rollout outcomes without retaining request identity', async () => {
  const adapterModule = await import('../../services/api/lib/capability-graph/providerConnectionLegacyRouteAdapter.js');
  const metricsModule = await import('../../services/api/lib/capability-graph/providerConnectionDualReadMetrics.js');
  const { resolveProviderConnectionLegacyRoute } = adapterModule.default || adapterModule;
  const { createProviderConnectionDualReadMetrics } = metricsModule.default || metricsModule;
  const metrics = createProviderConnectionDualReadMetrics({ now: () => 1_000 });
  const enabledEnv = { PROVIDER_CONNECTION_LEGACY_DUAL_READ_ENABLED: 'true' };
  const connectionId = '550e8400-e29b-41d4-a716-446655440006';

  await resolveProviderConnectionLegacyRoute('owner-private', connectionId, {
    env: enabledEnv,
    metrics,
    pool: createPool({ candidates: [googleCandidate(connectionId)], secretRef: 'encrypted-private' }).pool,
    decrypt: () => 'secret-private',
  });
  await resolveProviderConnectionLegacyRoute('owner-private', 'google-1017-1', {
    env: enabledEnv,
    metrics,
    pool: createPool({ candidates: [] }).pool,
  });
  await resolveProviderConnectionLegacyRoute('owner-private', 'google-1017-1', {
    env: enabledEnv,
    metrics,
    pool: createPool({ queryError: new Error('private database detail') }).pool,
  });
  await resolveProviderConnectionLegacyRoute('owner-private', 'legacy-private-route', {
    env: enabledEnv,
    metrics,
  });
  await assert.rejects(resolveProviderConnectionLegacyRoute('owner-private', connectionId, {
    env: enabledEnv,
    metrics,
    pool: createPool({ candidates: [googleCandidate(connectionId)], secretRef: 'invalid-private' }).pool,
    decrypt: () => { throw new Error('private decrypt detail'); },
  }));

  const snapshot = metrics.getSnapshot();
  assert.deepEqual(snapshot.outcomes, {
    selected: 1,
    fallbackNoMatch: 1,
    fallbackStorageUnavailable: 1,
    fallbackUnsupportedRoute: 1,
    blockedSecretUnavailable: 1,
  });
  assert.equal(snapshot.lastEventAt, new Date(1_000).toISOString());
  assert.doesNotMatch(
    JSON.stringify(snapshot),
    /owner-private|legacy-private-route|encrypted-private|secret-private|private database detail|private decrypt detail/,
  );
});

test('existing telemetry envelope exposes the aggregate dual-read snapshot', async () => {
  const metricsModule = await import('../../services/api/lib/capability-graph/providerConnectionDualReadMetrics.js');
  const { providerConnectionDualReadMetrics } = metricsModule.default || metricsModule;
  providerConnectionDualReadMetrics.reset();
  providerConnectionDualReadMetrics.recordOutcome('fallbackNoMatch');

  const telemetryModule = await import('../../services/api/routes/telemetry.js');
  const router = telemetryModule.default || telemetryModule;
  const metricsLayer = router.stack.find((layer: { route?: { path?: string } }) => layer.route?.path === '/v1/metrics');
  let payload: {
    success: boolean;
    data: { providerConnectionDualRead: { enabled: boolean; outcomes: { fallbackNoMatch: number } } };
  } | undefined;

  metricsLayer.route.stack[0].handle({}, {
    json(value: typeof payload) {
      payload = value;
      return value;
    },
  });

  assert.equal(payload?.success, true);
  assert.equal(payload?.data.providerConnectionDualRead.enabled, false);
  assert.equal(payload?.data.providerConnectionDualRead.outcomes.fallbackNoMatch, 1);
});
