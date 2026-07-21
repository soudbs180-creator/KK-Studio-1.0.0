import assert from 'node:assert/strict';
import test from 'node:test';

import { buildConnectionCapabilityRows } from '../../apps/web/src/components/settings/providerConnectionViewModel.ts';
import { CapabilityGraphSnapshotDtoSchema } from '../../packages/shared/src/index.ts';

test('connection view model explains Provider to Model to Capability to Channel', () => {
  const timestamp = '2026-07-22T00:00:00.000Z';
  const connectionId = '550e8400-e29b-41d4-a716-446655440000';
  const snapshot = CapabilityGraphSnapshotDtoSchema.parse({
    version: 'v1',
    generatedAt: timestamp,
    nodes: [
      { id: 'provider:google', type: 'Provider', providerId: 'google', displayName: 'Google', status: 'available', ownerScope: 'global', source: 'catalog', version: '1', updatedAt: timestamp },
      { id: `connection:${connectionId}`, type: 'ProviderConnection', connectionId, providerId: 'google', displayName: 'Google official', hasSecret: true, status: 'connected', ownerScope: 'user', source: 'connections', version: '1', updatedAt: timestamp },
      { id: 'model:google:gemini-image', type: 'Model', modelId: 'gemini-image', providerId: 'google', displayName: 'Gemini Image', status: 'available', ownerScope: 'user', source: 'bindings', version: '1', updatedAt: timestamp },
      { id: 'capability:image.generate', type: 'Capability', capabilityId: 'image.generate', displayName: 'Image generation', mediaType: 'image', status: 'available', ownerScope: 'user', source: 'bindings', version: '1', updatedAt: timestamp },
    ],
    edges: [
      { from: `connection:${connectionId}`, to: 'provider:google', relation: 'connectsTo', status: 'active', source: 'connections', constraints: {}, permissions: 'safe', version: '1' },
      { from: `connection:${connectionId}`, to: 'model:google:gemini-image', relation: 'binds', status: 'active', source: 'bindings', constraints: { channel: 'byok', requestProfile: 'google-v1beta' }, permissions: 'safe', version: '1' },
      { from: 'model:google:gemini-image', to: 'capability:image.generate', relation: 'supports', status: 'active', source: 'bindings', constraints: {}, permissions: 'safe', version: '1' },
    ],
  });

  assert.deepEqual(buildConnectionCapabilityRows(snapshot), [{
    connectionId,
    connectionName: 'Google official',
    status: 'connected',
    providerName: 'Google',
    modelName: 'Gemini Image',
    capabilityName: 'Image generation',
    channel: 'byok',
    requestProfile: 'google-v1beta',
  }]);
});
