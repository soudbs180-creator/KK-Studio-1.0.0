import assert from 'node:assert/strict';
import test from 'node:test';

test('service resolves the canonical Google endpoint before encrypted storage', async () => {
  const module = await import('../../services/api/lib/capability-graph/providerConnectionService.js');
  const { createConnection } = module.default || module;
  let storedInput: Record<string, unknown> | undefined;
  const expected = { connectionId: 'connection-1' };

  const result = await createConnection('user-1', {
    providerId: 'google',
    displayName: 'Google official',
    protocolProfile: 'google-official',
    secret: 'request-secret',
  }, {
    store: {
      async createProviderConnection(_userId: string, input: Record<string, unknown>) {
        storedInput = input;
        return expected;
      },
    },
  });

  assert.equal(storedInput?.endpoint, 'https://generativelanguage.googleapis.com');
  assert.equal(result, expected);
});

test('service decrypts only for verify and persists a secret-free result', async () => {
  const module = await import('../../services/api/lib/capability-graph/providerConnectionService.js');
  const { verifyConnection } = module.default || module;
  let verifierSecret = '';
  let savedBindings: unknown[] = [];
  const safeConnection = { connectionId: 'connection-1', hasSecret: true, status: 'available' };

  const result = await verifyConnection('user-1', 'connection-1', {
    decrypt: () => 'decrypted-request-secret',
    verifyConnectionEndpoint: async (input: { secret: string }) => {
      verifierSecret = input.secret;
      return {
        status: 'available',
        verifiedAt: '2026-07-22T00:00:00.000Z',
        message: 'Provider connection verified.',
        bindings: [{ modelId: 'gemini-image', capabilityId: 'image.generate' }],
      };
    },
    store: {
      async getProviderConnectionSecretRecord() {
        return {
          providerId: 'google',
          protocolProfile: 'google-official',
          endpoint: 'https://generativelanguage.googleapis.com',
          secretRef: 'encrypted-envelope',
        };
      },
      async saveVerificationResult(_userId: string, _connectionId: string, verification: { bindings: unknown[] }) {
        savedBindings = verification.bindings;
        return safeConnection;
      },
      async saveVerificationFailure() {},
    },
  });

  assert.equal(verifierSecret, 'decrypted-request-secret');
  assert.equal(savedBindings.length, 1);
  assert.equal(result, safeConnection);
  assert.equal(JSON.stringify(result).includes('decrypted-request-secret'), false);
});
