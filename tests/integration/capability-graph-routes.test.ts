import assert from 'node:assert/strict';
import http from 'node:http';
import test from 'node:test';

import express from 'express';

async function startTestServer() {
  const routeModule = await import('../../server/routes/capability-graph.js');
  const { createCapabilityGraphRouter } = routeModule.default || routeModule;
  const timestamp = '2026-07-22T00:00:00.000Z';
  const safeConnection = {
    connectionId: '550e8400-e29b-41d4-a716-446655440000',
    providerId: 'google',
    displayName: 'Google official',
    protocolProfile: 'google-official',
    status: 'unverified',
    hasSecret: true,
    createdAt: timestamp,
    updatedAt: timestamp,
  };
  const router = createCapabilityGraphRouter({
    verifyJWT: () => 'user-1',
    isEnabled: () => true,
    service: {
      async createConnection() { return safeConnection; },
      async deleteConnection() { return true; },
      async getCapabilitySnapshot() { return { version: 'v1', generatedAt: timestamp, nodes: [], edges: [] }; },
      async listConnections() { return { version: 'v1', connections: [safeConnection] }; },
      async updateConnection() { return safeConnection; },
      async verifyConnection() { return { ...safeConnection, status: 'available', verifiedAt: timestamp }; },
    },
  });
  const app = express();
  app.use(express.json());
  app.use('/api', router);
  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('Test server did not expose a TCP address.');
  return { server, baseUrl: `http://127.0.0.1:${address.port}` };
}

test('connection and snapshot routes return safe envelopes behind the server flag', async () => {
  const { server, baseUrl } = await startTestServer();
  try {
    const createResponse = await fetch(`${baseUrl}/api/v1/provider-connections`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: 'Bearer test' },
      body: JSON.stringify({
        providerId: 'google',
        displayName: 'Google official',
        protocolProfile: 'google-official',
        secret: 'request-only-secret',
      }),
    });
    assert.equal(createResponse.status, 201);
    const createBody = await createResponse.text();
    assert.equal(createBody.includes('request-only-secret'), false);
    assert.equal(createBody.includes('secretRef'), false);

    const snapshotResponse = await fetch(`${baseUrl}/api/v1/capability-graph/snapshot`, {
      headers: { authorization: 'Bearer test' },
    });
    assert.equal(snapshotResponse.status, 200);
    assert.match(await snapshotResponse.text(), /"version":"v1"/);
  } finally {
    await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  }
});
