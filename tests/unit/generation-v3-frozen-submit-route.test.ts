import assert from 'node:assert/strict';
import test from 'node:test';

test('job submit resolves adapter and credential from the frozen Connection route', async () => {
  const module = await import('../../server/lib/generation-v3/jobLifecycle.js');
  const { resolveFrozenProviderRoute } = module.default || module;
  const connectionId = '550e8400-e29b-41d4-a716-446655440000';
  let observedConnectionRoute: Record<string, unknown> | undefined;
  const quote = {
    mediaType: 'image',
    model: 'gemini-2.5-flash-image',
    channel: 'byok',
    routeSnapshot: {
      providerId: 'google',
      connectionId,
      modelId: 'gemini-2.5-flash-image',
      capabilityId: 'image.generate',
      channel: 'byok',
      requestProfile: 'google-generate-content-v1beta',
      adapterId: 'google-image',
      adapterVersion: '1.0.0',
      capabilityVersion: '1.0.0',
      connectionUpdatedAt: '2026-07-22T00:00:00.000Z',
      bindingUpdatedAt: '2026-07-22T00:00:00.000Z',
    },
  };
  const result = await resolveFrozenProviderRoute('user-1', quote, {
    selectRoute(input: { options?: { connectionRoute?: Record<string, unknown> } }) {
      observedConnectionRoute = input.options?.connectionRoute;
      return { adapterId: 'google-image', adapterVersion: '1.0.0', adapter: { submit() {} } };
    },
    async resolveExecutionConnectionAuth() {
      return { apiKey: 'decrypted-secret', connectionId };
    },
  });

  assert.equal(observedConnectionRoute?.connectionId, connectionId);
  assert.equal(result.auth.connectionId, connectionId);
  assert.equal(result.route.adapterId, 'google-image');
});
