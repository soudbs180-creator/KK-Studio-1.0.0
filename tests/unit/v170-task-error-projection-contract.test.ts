import assert from 'node:assert/strict';
import test from 'node:test';
import {
  PublicTaskErrorProjectionDtoSchema,
  PublicTaskProjectionDtoSchema,
  STABLE_PUBLIC_TASK_ERROR_MAPPINGS,
} from '../../packages/shared/src/index.ts';

const NOW = '2026-08-13T00:00:00.000Z';

test('stable task errors pin category, phase, retry, input, billing, and safe actions', () => {
  for (const [code, mapping] of Object.entries(STABLE_PUBLIC_TASK_ERROR_MAPPINGS)) {
    assert.equal(PublicTaskErrorProjectionDtoSchema.safeParse({
      code,
      ...mapping,
    }).success, true);
  }
  assert.equal(PublicTaskErrorProjectionDtoSchema.safeParse({
    code: 'ambiguous_side_effect',
    ...STABLE_PUBLIC_TASK_ERROR_MAPPINGS.ambiguous_side_effect,
    retryable: true,
  }).success, false);
  assert.equal(PublicTaskErrorProjectionDtoSchema.safeParse({
    code: 'confirmation_expired',
    ...STABLE_PUBLIC_TASK_ERROR_MAPPINGS.confirmation_expired,
    category: 'permission_required',
  }).success, false);
  assert.equal(PublicTaskErrorProjectionDtoSchema.safeParse({
    code: 'provider_made_this_up',
    category: 'unknown',
    publicPhase: 'terminal',
    retryable: false,
    inputPreserved: true,
    billingMayHaveChanged: false,
    retryMayChargeAgain: false,
    safeActions: ['open_task_details'],
  }).success, false);
});

test('public task projection is a strict source union with phase separate from terminal outcome', () => {
  const agentRun = {
    schemaVersion: 1,
    projectionId: 'task-agent-1',
    source: 'agent_run',
    runId: 'run-1',
    phase: 'waiting_for_device',
    title: 'Waiting for desktop',
    allowedActions: ['refresh_capabilities', 'open_pairing'],
    error: {
      code: 'requires_paired_desktop',
      ...STABLE_PUBLIC_TASK_ERROR_MAPPINGS.requires_paired_desktop,
      runId: 'run-1',
      executionTarget: 'paired-desktop',
    },
    createdAt: NOW,
    updatedAt: NOW,
  } as const;
  assert.equal(PublicTaskProjectionDtoSchema.safeParse(agentRun).success, true);
  assert.equal(PublicTaskProjectionDtoSchema.safeParse({
    ...agentRun,
    source: 'generation_job',
  }).success, false);
  assert.equal(PublicTaskProjectionDtoSchema.safeParse({
    ...agentRun,
    phase: 'setup_required',
  }).success, false);
  assert.equal(PublicTaskProjectionDtoSchema.safeParse({
    ...agentRun,
    terminalOutcome: 'failed',
  }).success, false);
});

test('every public task source has a source-specific identity and terminal states are explicit', () => {
  const variants = [
    { source: 'generation_job', jobId: 'job-1' },
    { source: 'agent_run', runId: 'run-1' },
    { source: 'paired_command', commandId: 'command-1', runId: 'run-1' },
    { source: 'local_task', localTaskId: 'local-1' },
    { source: 'app_update', updateId: 'update-1', targetVersion: '1.7.0' },
  ] as const;
  for (const source of variants) {
    assert.equal(PublicTaskProjectionDtoSchema.safeParse({
      schemaVersion: 1,
      projectionId: `task-${source.source}`,
      ...source,
      phase: 'terminal',
      terminalOutcome: 'completed',
      title: source.source,
      allowedActions: [],
      createdAt: NOW,
      updatedAt: NOW,
    }).success, true);
  }
  assert.equal(PublicTaskProjectionDtoSchema.safeParse({
    schemaVersion: 1,
    projectionId: 'task-unknown',
    source: 'provider_task',
    providerTaskId: 'provider-1',
    phase: 'running',
    title: 'Unknown source',
    allowedActions: [],
    createdAt: NOW,
    updatedAt: NOW,
  }).success, false);
  assert.equal(PublicTaskProjectionDtoSchema.safeParse({
    schemaVersion: 1,
    projectionId: 'task-missing-outcome',
    source: 'local_task',
    localTaskId: 'local-1',
    phase: 'terminal',
    title: 'Missing outcome',
    allowedActions: [],
    createdAt: NOW,
    updatedAt: NOW,
  }).success, false);
});
