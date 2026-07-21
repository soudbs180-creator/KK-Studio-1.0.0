import assert from 'node:assert/strict';
import test from 'node:test';

import { createKkApiClient } from '../../packages/shared/src/index.ts';

test('KkApiClient exposes all Provider Connection and Capability Graph endpoints', async () => {
  const requests: Array<{ url: string; method: string; body?: unknown }> = [];
  const client = createKkApiClient({
    baseUrl: 'https://api.example.test/',
    fetchImpl: async (input, init) => {
      requests.push({
        url: String(input),
        method: String(init?.method || 'GET'),
        body: typeof init?.body === 'string' ? JSON.parse(init.body) : undefined,
      });
      return new Response(JSON.stringify({ success: true, data: {}, meta: {} }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      });
    },
  });
  const connectionId = '550e8400-e29b-41d4-a716-446655440000';

  await client.getCapabilityGraphSnapshot();
  await client.listProviderConnections();
  await client.createProviderConnection({
    providerId: 'google',
    displayName: 'Google official',
    protocolProfile: 'google-official',
    secret: 'request-only-secret',
  });
  await client.updateProviderConnection(connectionId, { displayName: 'Google primary' });
  await client.verifyProviderConnection(connectionId);
  await client.deleteProviderConnection(connectionId);

  assert.deepEqual(requests.map(({ url, method }) => ({ url, method })), [
    { url: 'https://api.example.test/api/v1/capability-graph/snapshot', method: 'GET' },
    { url: 'https://api.example.test/api/v1/provider-connections', method: 'GET' },
    { url: 'https://api.example.test/api/v1/provider-connections', method: 'POST' },
    { url: `https://api.example.test/api/v1/provider-connections/${connectionId}`, method: 'PATCH' },
    { url: `https://api.example.test/api/v1/provider-connections/${connectionId}/verify`, method: 'POST' },
    { url: `https://api.example.test/api/v1/provider-connections/${connectionId}`, method: 'DELETE' },
  ]);
  assert.deepEqual(requests[2].body, {
    providerId: 'google',
    displayName: 'Google official',
    protocolProfile: 'google-official',
    secret: 'request-only-secret',
  });
});
