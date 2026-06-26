import assert from 'node:assert/strict';
import { test, vi } from 'vitest';

// Mock localStorage for node environment before importing keyManager
global.localStorage = {
  getItem: vi.fn(() => null),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn(),
  length: 0,
  key: vi.fn(() => null)
} as any;

// Mock network probes and health status
vi.mock('../../apps/web/src/local/localNetworkProbe', () => ({
  getNetworkStatus: () => 'normal',
  isUserVpnEnabled: () => false,
  probeNetwork: async () => 'normal'
}));

import { capabilityRegistry } from '../../apps/web/src/core/capability/capabilityRegistry';
import { permissionPolicy } from '../../apps/web/src/core/permissions/PermissionPolicy';
import { taskOrchestrator } from '../../apps/web/src/core/orchestration/TaskOrchestrator';

test('CapabilityRegistry registration and listing', async () => {
  const sources = capabilityRegistry.getAllSources();
  assert.ok(sources.length >= 8, 'Should register at least 8 builtin capability sources.');
  
  const imgSources = await capabilityRegistry.findSourcesForTask('image');
  assert.ok(imgSources.length > 0, 'Should find capability sources supporting image tasks.');
});

test('PermissionPolicy risk assessment', async () => {
  const lowRisk = await permissionPolicy.assessRisk({
    type: 'generation',
    mediaType: 'image',
    modelId: 'dummy-model',
    prompt: 'hello'
  });
  assert.equal(lowRisk, 'low');

  const highRisk = await permissionPolicy.assessRisk({
    type: 'browser',
    taskId: 'test-task',
    userText: 'download',
    targetSite: 'chatgpt',
    actionType: 'download',
    requiresLogin: false,
    usesMembership: false,
    outputTarget: 'canvas',
    payload: {}
  });
  assert.equal(highRisk, 'high');
  
  const requiresConfirm = await permissionPolicy.requiresConfirmation({
    type: 'browser',
    taskId: 'test-task',
    userText: 'download',
    targetSite: 'chatgpt',
    actionType: 'download',
    requiresLogin: false,
    usesMembership: false,
    outputTarget: 'canvas',
    payload: {}
  });
  assert.equal(requiresConfirm, true);
});

test('TaskOrchestrator validation', async () => {
  assert.ok(taskOrchestrator, 'TaskOrchestrator should exist.');
});
