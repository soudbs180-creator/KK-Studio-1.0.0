import assert from 'node:assert/strict';
import test from 'node:test';

interface QueryCall {
  text: string;
  values: unknown[];
}

function createPool(returnedRow: Record<string, unknown>) {
  const calls: QueryCall[] = [];
  const client = {
    async query(text: string, values: unknown[] = []) {
      calls.push({ text, values });
      return text.includes('RETURNING') ? { rows: [returnedRow] } : { rows: [] };
    },
    release() {},
  };
  return {
    calls,
    pool: { async connect() { return client; } },
  };
}

test('connection creation sets RLS context, parameterizes the encrypted secret, and returns a safe DTO', async () => {
  const module = await import('../../server/lib/capability-graph/providerConnectionStore.js');
  const { createProviderConnection } = module.default || module;
  const timestamp = '2026-07-22T00:00:00.000Z';
  const { pool, calls } = createPool({
    connectionId: '550e8400-e29b-41d4-a716-446655440000',
    providerId: 'google',
    displayName: 'Google official',
    protocolProfile: 'google-official',
    endpoint: 'https://generativelanguage.googleapis.com',
    status: 'unverified',
    hasSecret: true,
    verifiedAt: null,
    verificationErrorCode: null,
    verificationMessage: null,
    createdAt: timestamp,
    updatedAt: timestamp,
  });

  const connection = await createProviderConnection('user-1', {
    providerId: 'google',
    displayName: 'Google official',
    protocolProfile: 'google-official',
    endpoint: 'https://generativelanguage.googleapis.com',
    secret: 'raw-secret',
  }, {
    pool,
    encrypt: () => 'encrypted-envelope',
  });

  const contextCall = calls.find(({ text }) => text.includes("set_config('app.current_user_id'"));
  assert.deepEqual(contextCall?.values, ['user-1']);
  const insertCall = calls.find(({ text }) => text.includes('INSERT INTO public.provider_connections'));
  assert.ok(insertCall);
  assert.equal(insertCall.text.includes('raw-secret'), false);
  assert.ok(insertCall.values.includes('encrypted-envelope'));
  assert.equal(JSON.stringify(connection).includes('secret'), false);
  assert.equal(connection.hasSecret, true);
});
