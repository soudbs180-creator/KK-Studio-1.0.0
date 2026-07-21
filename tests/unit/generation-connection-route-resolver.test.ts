import assert from 'node:assert/strict';
import test from 'node:test';

const connectionId = '550e8400-e29b-41d4-a716-446655440000';
const timestamp = '2026-07-22T00:00:00.000Z';

test('quote resolver selects an available user binding and preserves its routing versions', async () => {
  const module = await import('../../server/lib/capability-graph/generationConnectionResolver.js');
  const { resolveQuoteConnectionRoute } = module.default || module;
  const route = await resolveQuoteConnectionRoute('user-1', {
    connectionId,
    model: 'gemini-2.5-flash-image',
    capabilityId: 'image.generate',
  }, {
    store: {
      async getVerifiedRouteBinding() {
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
        };
      },
    },
  });

  assert.equal(route.adapterId, 'google-image');
  assert.equal(route.connectionId, connectionId);
  assert.equal(route.channel, 'byok');
  assert.equal(route.connectionUpdatedAt, timestamp);
});

test('execution resolver decrypts only a binding that still matches the frozen snapshot', async () => {
  const module = await import('../../server/lib/capability-graph/generationConnectionResolver.js');
  const { resolveExecutionConnectionAuth } = module.default || module;
  const routeSnapshot = {
    connectionId,
    providerId: 'google',
    modelId: 'gemini-2.5-flash-image',
    capabilityId: 'image.generate',
    channel: 'byok',
    requestProfile: 'google-generate-content-v1beta',
    connectionUpdatedAt: timestamp,
    bindingUpdatedAt: timestamp,
  };
  const auth = await resolveExecutionConnectionAuth('user-1', routeSnapshot, {
    decrypt: () => 'decrypted-connection-secret',
    store: {
      async getConnectionExecutionRecord() {
        return { ...routeSnapshot, secretRef: 'encrypted-envelope', endpoint: 'https://generativelanguage.googleapis.com' };
      },
    },
  });

  assert.deepEqual(auth, {
    apiKey: 'decrypted-connection-secret',
    connectionId,
    endpoint: 'https://generativelanguage.googleapis.com',
  });
  assert.equal(JSON.stringify(routeSnapshot).includes('decrypted-connection-secret'), false);
});
