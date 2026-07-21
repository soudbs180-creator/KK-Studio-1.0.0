import assert from 'node:assert/strict';
import test from 'node:test';

import type { CapabilityGraphSnapshotDto } from '../../packages/shared/src/index.ts';
import { toolRegistryInstance } from '../../apps/web/src/features/ai-assistant-runtime/tools/ToolRegistry.ts';
import { kkWebApiClient } from '../../apps/web/src/services/api/kkApiClient.ts';

test('capabilities.listAvailable reads the server snapshot as a safe, secret-free tool', async (context) => {
  const timestamp = '2026-07-22T00:00:00.000Z';
  const snapshot: CapabilityGraphSnapshotDto = {
    version: 'v1',
    generatedAt: timestamp,
    nodes: [],
    edges: [],
  };
  const originalGetSnapshot = kkWebApiClient.getCapabilityGraphSnapshot;
  kkWebApiClient.getCapabilityGraphSnapshot = async () => ({
    success: true,
    data: snapshot,
    meta: { requestId: 'test-request', timestamp },
  });
  context.after(() => {
    kkWebApiClient.getCapabilityGraphSnapshot = originalGetSnapshot;
  });

  const tool = toolRegistryInstance.getTool('capabilities.listAvailable');
  assert.ok(tool);
  assert.equal(tool.permission, 'safe');
  assert.equal(tool.control.effect, 'read');

  const result = await toolRegistryInstance.execute('capabilities.listAvailable', {}, {});
  assert.deepEqual(result, snapshot);
  assert.equal(JSON.stringify(result).includes('secret'), false);
});
