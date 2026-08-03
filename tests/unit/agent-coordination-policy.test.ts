import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import test from 'node:test';

const require = createRequire(import.meta.url);
const {
  canPreempt,
  canRoleTransition,
  canTransition,
  detectCoordinationDeadlock,
  isAdmissionRoleAllowed,
  resolveCoordinationPolicy,
} = require('../../services/api/lib/agent-coordinator/policy.js');

test('coordination policy ranks business priority and clamps server-owned limits', () => {
  const policy = resolveCoordinationPolicy({
    KK_AGENT_MAX_ACTIVE_TASKS: '3',
    KK_AGENT_MAX_CLUSTER_AGENTS: '5',
    KK_AGENT_MAX_RESOURCE_KEYS: '7',
    KK_AGENT_MAX_ROUNDS_HIGH: '9',
  });

  assert.equal(policy.maxActiveTasks, 3);
  assert.equal(policy.maxClusterAgents, 5);
  assert.equal(policy.maxResourceKeys, 7);
  assert.equal(policy.maxRounds.high, 9);
  assert.equal(isAdmissionRoleAllowed('executor', policy), true);
  assert.equal(isAdmissionRoleAllowed('coordinator', policy), false);
  assert.equal(canPreempt(
    { state: 'queued', priority: 'critical', riskClass: 'high' },
    { state: 'admitted', priority: 'normal', riskClass: 'medium' },
    policy,
  ), true);
  assert.equal(canPreempt(
    { state: 'running', priority: 'critical', riskClass: 'critical' },
    { state: 'running', priority: 'normal', riskClass: 'low' },
    policy,
  ), false);
});

test('coordination policy detects wait-for cycles using explicit task fields', () => {
  assert.equal(detectCoordinationDeadlock([
    { taskId: 'task-a', blockedOnTaskId: 'task-b' },
    { taskId: 'task-b', blockedOnTaskId: 'task-a' },
  ]), true);
  assert.equal(detectCoordinationDeadlock([
    { taskId: 'task-a', blockedOnTaskId: 'task-b' },
    { taskId: 'task-b', blockedOnTaskId: 'task-c' },
  ]), false);
});

test('coordination state and role transitions remain bounded', () => {
  assert.equal(canTransition('admitted', 'running'), true);
  assert.equal(canTransition('completed', 'running'), false);
  assert.equal(canRoleTransition('executor', 'running', 'failed'), true);
  assert.equal(canRoleTransition('observer', 'running', 'failed'), false);
  assert.equal(canRoleTransition('compensator', 'fenced', 'compensating'), true);
});
