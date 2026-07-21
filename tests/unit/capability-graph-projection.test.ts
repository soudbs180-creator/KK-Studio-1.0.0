import assert from 'node:assert/strict';
import test from 'node:test';

import { CapabilityGraphSnapshotDtoSchema } from '../../packages/shared/src/index.ts';

test('projection derives a secret-free graph from canonical providers and user bindings', async () => {
  const module = await import('../../services/api/lib/capability-graph/projection.js');
  const { projectCapabilityGraph } = module.default || module;
  const generatedAt = '2026-07-22T00:00:00.000Z';
  const snapshot = projectCapabilityGraph({
    generatedAt,
    providers: [{ id: 'google', label: 'Google', category: 'official' }],
    connections: [{
      connectionId: '550e8400-e29b-41d4-a716-446655440000',
      providerId: 'google',
      displayName: 'Google official',
      status: 'available',
      hasSecret: true,
      updatedAt: generatedAt,
    }],
    bindings: [{
      connectionId: '550e8400-e29b-41d4-a716-446655440000',
      providerId: 'google',
      modelId: 'gemini-2.5-flash-image',
      capabilityId: 'image.generate',
      channel: 'byok',
      requestProfile: 'google-generate-content-v1beta',
      status: 'active',
      constraints: {},
      updatedAt: generatedAt,
    }],
  });

  const parsed = CapabilityGraphSnapshotDtoSchema.parse(snapshot);
  assert.ok(parsed.nodes.some((node) => node.type === 'ProviderConnection'));
  assert.ok(parsed.nodes.some((node) => node.type === 'Model'));
  assert.ok(parsed.nodes.some((node) => node.type === 'Capability'));
  assert.ok(parsed.edges.some((edge) => edge.relation === 'supports'));
  assert.equal(JSON.stringify(parsed).includes('secretRef'), false);
});
