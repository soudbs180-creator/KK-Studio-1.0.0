import assert from 'node:assert/strict';
import test from 'node:test';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const generationV3 = require('../../services/api/lib/generation-v3/index.js');

test('connection-backed quote freezes the verified route projection', async () => {
  const connectionId = '550e8400-e29b-41d4-a716-446655440000';
  const timestamp = '2026-07-22T00:00:00.000Z';
  const queries: Array<{ text: string; values: unknown[] }> = [];
  const pool = {
    async query(text: string, values: unknown[] = []) {
      queries.push({ text, values });
      return { rows: [] };
    },
  };

  const quote = await generationV3.createQuote('user-1', {
    mediaType: 'image',
    model: 'gemini-2.5-flash-image',
    connectionId,
    capabilityId: 'image.generate',
  }, {
    env: { CAPABILITY_GRAPH_IMAGE_PROVIDER_SLICE: 'full' },
    pool,
    async resolveQuoteConnectionRoute() {
      return {
        connectionId,
        providerId: 'google',
        endpoint: 'https://generativelanguage.googleapis.com',
        modelId: 'gemini-2.5-flash-image',
        capabilityId: 'image.generate',
        channel: 'byok',
        requestProfile: 'google-generate-content-v1beta',
        connectionUpdatedAt: timestamp,
        bindingUpdatedAt: timestamp,
        adapterId: 'google-image',
        capabilityVersion: '1.0.0',
      };
    },
  });

  assert.equal(quote.channel, 'byok');
  assert.equal(quote.routeSnapshot.connectionId, connectionId);
  assert.equal(quote.routeSnapshot.capabilityId, 'image.generate');
  assert.equal(quote.routeSnapshot.requestProfile, 'google-generate-content-v1beta');
  assert.equal(quote.routeSnapshot.connectionUpdatedAt, timestamp);
  const insert = queries.find(({ text }) => text.includes('INSERT INTO public.generation_quotes'));
  assert.ok(insert);
  assert.equal(String(insert.values[9]).includes(connectionId), true);
});

function createQuoteHarness(connectionId: string) {
  let resolverCalls = 0;
  let queryCalls = 0;
  const pool = {
    async query() {
      queryCalls += 1;
      return { rows: [] };
    },
  };
  const resolveQuoteConnectionRoute = async (_userId: string, request: { connectionId?: string }) => {
    resolverCalls += 1;
    if (!request.connectionId) return null;
    return {
      adapterId: 'google-image',
      capabilityId: 'image.generate',
      capabilityVersion: '1.0.0',
      channel: 'byok',
      connectionId,
      modelId: 'gemini-2.5-flash-image',
      providerId: 'google',
      requestProfile: 'google-generate-content-v1beta',
    };
  };
  return {
    getQueryCalls: () => queryCalls,
    getResolverCalls: () => resolverCalls,
    pool,
    resolveQuoteConnectionRoute,
  };
}

test('off blocks a Connection quote before resolver or persistence', async () => {
  const connectionId = '550e8400-e29b-41d4-a716-446655440000';
  const harness = createQuoteHarness(connectionId);

  await assert.rejects(
    () => generationV3.createQuote('user-1', {
      mediaType: 'image',
      model: 'gemini-2.5-flash-image',
      connectionId,
      capabilityId: 'image.generate',
    }, {
      env: { CAPABILITY_GRAPH_IMAGE_PROVIDER_SLICE: 'off' },
      pool: harness.pool,
      resolveQuoteConnectionRoute: harness.resolveQuoteConnectionRoute,
    }),
    (error: unknown) => {
      const featureError = error as { code?: string; statusCode?: number };
      return featureError.code === 'FEATURE_DISABLED' && featureError.statusCode === 404;
    },
  );
  assert.equal(harness.getResolverCalls(), 0);
  assert.equal(harness.getQueryCalls(), 0);
});

test('off leaves a non-Connection quote on the legacy path', async () => {
  const harness = createQuoteHarness('550e8400-e29b-41d4-a716-446655440000');
  const legacyQuote = await generationV3.createQuote('user-1', {
    mediaType: 'image',
    model: 'gemini-2.5-flash-image',
    preferredChannel: 'byok',
  }, {
    env: { CAPABILITY_GRAPH_IMAGE_PROVIDER_SLICE: 'off' },
    pool: harness.pool,
    resolveQuoteConnectionRoute: harness.resolveQuoteConnectionRoute,
  });
  assert.equal(legacyQuote.routeSnapshot.connectionId, undefined);
  assert.equal(harness.getResolverCalls(), 1);
  assert.equal(harness.getQueryCalls(), 1);
});
