import assert from 'node:assert/strict';
import test from 'node:test';

import {
  CapabilityGraphSnapshotDtoSchema,
  CreateProviderConnectionRequestSchema,
  ProviderConnectionDtoSchema,
} from '../../packages/shared/src/index.ts';

const updatedAt = '2026-07-22T00:00:00.000Z';

test('capability graph v1 parses typed nodes and ownership-aware edges', () => {
  const snapshot = CapabilityGraphSnapshotDtoSchema.parse({
    version: 'v1',
    generatedAt: updatedAt,
    nodes: [
      {
        id: 'provider:google',
        type: 'Provider',
        status: 'available',
        ownerScope: 'global',
        source: 'canonical-provider-catalog',
        version: '1',
        updatedAt,
        providerId: 'google',
        displayName: 'Google',
      },
      {
        id: 'connection:550e8400-e29b-41d4-a716-446655440000',
        type: 'ProviderConnection',
        status: 'connected',
        ownerScope: 'user',
        source: 'provider_connections',
        version: '1',
        updatedAt,
        connectionId: '550e8400-e29b-41d4-a716-446655440000',
        providerId: 'google',
        displayName: 'Google official',
        hasSecret: true,
      },
    ],
    edges: [{
      from: 'connection:550e8400-e29b-41d4-a716-446655440000',
      to: 'provider:google',
      relation: 'connectsTo',
      status: 'active',
      source: 'provider_connections',
      constraints: {},
      permissions: 'safe',
      version: '1',
    }],
  });

  assert.equal(snapshot.nodes[1].type, 'ProviderConnection');
  assert.equal(snapshot.edges[0].relation, 'connectsTo');
});

test('capability graph rejects unknown snapshot versions', () => {
  assert.throws(() => CapabilityGraphSnapshotDtoSchema.parse({
    version: 'v2',
    generatedAt: updatedAt,
    nodes: [],
    edges: [],
  }));
});

test('provider connection output rejects secret material while create input accepts it', () => {
  const createRequest = CreateProviderConnectionRequestSchema.parse({
    providerId: 'google',
    displayName: 'Google official',
    protocolProfile: 'google-official',
    secret: 'request-only-secret',
  });
  assert.equal(createRequest.secret, 'request-only-secret');

  const response = {
    connectionId: '550e8400-e29b-41d4-a716-446655440000',
    providerId: 'google',
    displayName: 'Google official',
    protocolProfile: 'google-official',
    status: 'unverified',
    hasSecret: true,
    createdAt: updatedAt,
    updatedAt,
    secretRef: 'must-not-leak',
  };
  assert.equal(ProviderConnectionDtoSchema.safeParse(response).success, false);
});
