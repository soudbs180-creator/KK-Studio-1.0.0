import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

import {
  ProviderConnectionListDtoSchema,
  ReorderProviderConnectionsRequestSchema,
} from '../../packages/shared/src/index.ts';

const timestamp = '2026-08-02T00:00:00.000Z';
const firstId = '550e8400-e29b-41d4-a716-446655440000';
const secondId = '550e8400-e29b-41d4-a716-446655440001';

function createPool(queryHandler: (sql: string, values?: unknown[]) => Promise<{ rows: Record<string, unknown>[] }>) {
  const client = {
    query: queryHandler,
    release() {},
  };
  return { async connect() { return client; } };
}

test('provider connection list accepts compatible v1 and priority-aware v2 payloads', () => {
  const connection = {
    connectionId: firstId,
    providerId: 'google',
    displayName: 'Google',
    protocolProfile: 'google-official',
    status: 'available',
    hasSecret: true,
    createdAt: timestamp,
    updatedAt: timestamp,
  };

  assert.equal(ProviderConnectionListDtoSchema.parse({ version: 'v1', connections: [connection] }).version, 'v1');
  const v2 = ProviderConnectionListDtoSchema.parse({
    version: 'v2',
    orderRevision: 4,
    connections: [{ ...connection, routingPriority: 0 }],
  });
  assert.equal(v2.version, 'v2');
  if (v2.version === 'v2') assert.equal(v2.orderRevision, 4);
});

test('provider connection reorder request requires a complete duplicate-free order', () => {
  assert.deepEqual(ReorderProviderConnectionsRequestSchema.parse({
    connectionIds: [firstId, secondId],
    expectedOrderRevision: 3,
  }).connectionIds, [firstId, secondId]);

  assert.equal(ReorderProviderConnectionsRequestSchema.safeParse({
    connectionIds: [firstId, firstId],
    expectedOrderRevision: 3,
  }).success, false);
});

test('routing priority migration initializes owner order and revision idempotently', () => {
  const source = readFileSync('infrastructure/database/migrations/029_provider_connection_routing_priority.sql', 'utf8');

  assert.match(source, /ADD COLUMN IF NOT EXISTS routing_priority/);
  assert.match(source, /row_number\(\) OVER \(PARTITION BY user_id ORDER BY updated_at DESC/);
  assert.match(source, /provider_connection_order_revisions/);
  assert.match(source, /ENABLE ROW LEVEL SECURITY/);
});

test('service exposes conflict state with the latest canonical order', async () => {
  const module = await import('../../services/api/lib/capability-graph/providerConnectionService.js');
  const { reorderConnections } = module.default || module;

  await assert.rejects(
    reorderConnections('owner-1', {
      connectionIds: [firstId, secondId],
      expectedOrderRevision: 1,
    }, {
      store: {
        async reorderProviderConnections() {
          return {
            conflict: true,
            orderRevision: 2,
            connectionIds: [secondId, firstId],
          };
        },
      },
    }),
    (error: Error & { code?: string; statusCode?: number; canonicalOrder?: unknown }) => {
      assert.equal(error.code, 'ORDER_REVISION_CONFLICT');
      assert.equal(error.statusCode, 409);
      assert.deepEqual(error.canonicalOrder, {
        orderRevision: 2,
        connectionIds: [secondId, firstId],
      });
      return true;
    },
  );
});

test('create and delete serialize behind the same owner order revision lock', async () => {
  const module = await import('../../services/api/lib/capability-graph/providerConnectionStore.js');
  const { createProviderConnection, deleteProviderConnection } = module.default || module;
  const createQueries: string[] = [];
  const connectionRow = {
    connectionId: firstId,
    providerId: 'google',
    displayName: 'Google',
    protocolProfile: 'google-official',
    endpoint: 'https://generativelanguage.googleapis.com',
    routingPriority: 0,
    status: 'unverified',
    hasSecret: true,
    createdAt: timestamp,
    updatedAt: timestamp,
  };
  const createPoolMock = createPool(async (sql) => {
    createQueries.push(sql);
    if (sql.includes('INSERT INTO public.provider_connections')) return { rows: [connectionRow] };
    return { rows: [] };
  });

  await createProviderConnection('owner-1', {
    providerId: 'google',
    displayName: 'Google',
    protocolProfile: 'google-official',
    endpoint: 'https://generativelanguage.googleapis.com',
    secret: 'request-only-secret',
  }, { encrypt: () => 'encrypted-envelope', pool: createPoolMock });

  const createLockIndex = createQueries.findIndex((sql) => /SELECT revision[\s\S]+FOR UPDATE/.test(sql));
  const createInsertIndex = createQueries.findIndex((sql) => sql.includes('INSERT INTO public.provider_connections'));
  assert.ok(createLockIndex >= 0 && createLockIndex < createInsertIndex);

  const deleteQueries: string[] = [];
  const deletePoolMock = createPool(async (sql) => {
    deleteQueries.push(sql);
    if (sql.includes('DELETE FROM public.provider_connections')) return { rows: [{ connection_id: firstId }] };
    return { rows: [] };
  });
  assert.equal(await deleteProviderConnection('owner-1', firstId, { pool: deletePoolMock }), true);
  const deleteLockIndex = deleteQueries.findIndex((sql) => /SELECT revision[\s\S]+FOR UPDATE/.test(sql));
  const deleteMutationIndex = deleteQueries.findIndex((sql) => sql.includes('DELETE FROM public.provider_connections'));
  assert.ok(deleteLockIndex >= 0 && deleteLockIndex < deleteMutationIndex);
});

test('an order mutation failure rolls back instead of publishing a partial revision', async () => {
  const module = await import('../../services/api/lib/capability-graph/providerConnectionStore.js');
  const { reorderProviderConnections } = module.default || module;
  const statements: string[] = [];
  const pool = createPool(async (sql) => {
    statements.push(sql);
    if (/SELECT revision AS "orderRevision"[\s\S]+FOR UPDATE/.test(sql)) return { rows: [{ orderRevision: 3 }] };
    if (/SELECT connection_id AS "connectionId"[\s\S]+FOR UPDATE/.test(sql)) {
      return { rows: [{ connectionId: firstId }, { connectionId: secondId }] };
    }
    if (sql.includes('UPDATE public.provider_connections AS connection')) throw new Error('simulated write failure');
    return { rows: [] };
  });

  await assert.rejects(
    reorderProviderConnections('owner-1', {
      connectionIds: [secondId, firstId],
      expectedOrderRevision: 3,
    }, { pool }),
    /simulated write failure/,
  );
  assert.equal(statements[statements.length - 1], 'ROLLBACK');
  assert.equal(statements.includes('COMMIT'), false);
});
