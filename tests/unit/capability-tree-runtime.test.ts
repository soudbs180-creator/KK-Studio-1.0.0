import assert from 'node:assert/strict';
import { test } from 'node:test';

// Mock localStorage for node environment before importing keyManager
globalThis.localStorage = {
  getItem: () => null,
  setItem: () => {},
  removeItem: () => {},
  clear: () => {},
  length: 0,
  key: () => null
} as any;

globalThis.fetch = async () => ({ ok: true }) as any;

import { capabilityRegistry } from '../../apps/web/src/core/capability/capabilityRegistry.ts';
import { permissionPolicy } from '../../apps/web/src/core/permissions/PermissionPolicy.ts';
import { taskOrchestrator } from '../../apps/web/src/core/orchestration/TaskOrchestrator.ts';

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
