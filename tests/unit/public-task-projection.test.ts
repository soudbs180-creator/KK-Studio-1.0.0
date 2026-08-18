import assert from 'node:assert/strict';
import test from 'node:test';
import { PublicTaskProjectionDtoSchema } from '../../packages/shared/src/index.ts';
import type { GenerationBatchJob } from '../../apps/web/src/features/ai-assistant-runtime/queue/DurableGenerationQueue.ts';
import type { AgentRunRecord } from '../../apps/web/src/features/ai-assistant-runtime/runtime/AgentRunStore.ts';
import {
  getPublicTaskProgressPercent,
  projectAgentRunTask,
  projectAppUpdateTask,
  projectGenerationJobTask,
  projectLocalTask,
  projectPairedCommandTask,
} from '../../apps/web/src/features/tasks/publicTaskProjection.ts';
import { isPublicTaskActionCurrentlyAllowed } from '../../apps/web/src/features/tasks/publicTaskProjectionSource.ts';

const NOW_MS = Date.parse('2026-08-13T00:00:00.000Z');
const NOW = new Date(NOW_MS).toISOString();

const createGenerationJob = (
  overrides: Partial<GenerationBatchJob> = {},
): GenerationBatchJob => ({
  schemaVersion: 2,
  id: 'job-1',
  idempotencyKey: 'idem-1',
  canvasId: 'canvas-1',
  taskType: 'image',
  status: 'running',
  progress: {
    total: 2,
    queued: 0,
    running: 1,
    completed: 1,
    failed: 0,
    percent: 50,
    phase: 'provider_processing',
  },
  outputs: [],
  createdBy: 'assistant',
  prompts: [
    { id: 'prompt-1', prompt: 'first', status: 'completed', phase: 'completed', retryCount: 0 },
    { id: 'prompt-2', prompt: 'second', status: 'running', phase: 'provider_processing', retryCount: 0 },
  ],
  options: {
    taskType: 'image',
    modelId: 'model-1',
    aspectRatio: '1:1',
    imageSize: '1K',
    countPerPrompt: 1,
    concurrency: 1,
    layout: 'grid',
  },
  createdAt: NOW_MS,
  updatedAt: NOW_MS,
  ...overrides,
});

const createAgentRun = (overrides: Partial<AgentRunRecord> = {}): AgentRunRecord => ({
  id: 'run-1',
  userMessage: 'Create a launch board',
  intent: 'create',
  plan: {},
  status: 'running',
  toolCalls: [],
  totalSteps: 4,
  completedStepIds: ['step-1'],
  createdAt: NOW,
  updatedAt: NOW,
  executionTarget: 'local-desktop',
  ...overrides,
});

test('projects generation and Agent sources without replacing their authoritative stores', () => {
  const generation = projectGenerationJobTask(createGenerationJob());
  const agent = projectAgentRunTask(createAgentRun());

  assert.equal(PublicTaskProjectionDtoSchema.safeParse(generation).success, true);
  assert.equal(PublicTaskProjectionDtoSchema.safeParse(agent).success, true);
  assert.deepEqual(generation.progress, { completed: 1, total: 2 });
  assert.equal(getPublicTaskProgressPercent(generation), 50);
  assert.deepEqual(generation.allowedActions, ['pause', 'cancel', 'open_task_details']);
  assert.deepEqual(agent.progress, { completed: 1, total: 4 });
  assert.equal(agent.phase, 'running');
});

test('projects paired command, local task, and app update source identities', () => {
  const paired = projectPairedCommandTask({
    commandId: 'command-1',
    runId: 'run-1',
    status: 'cancelling',
    createdAt: NOW,
    updatedAt: NOW,
  });
  const local = projectLocalTask({
    id: 'local-1',
    status: 'completed',
    progress: 100,
    createdAt: NOW_MS,
    updatedAt: NOW_MS,
  });
  const update = projectAppUpdateTask('update-1', {
    schemaVersion: 1,
    phase: 'downloading',
    currentVersion: '1.6.1',
    targetVersion: '1.7.0',
    releaseChannel: 'canary',
    progressPercent: 42,
    affectedTaskIds: [],
    safeActions: ['cancel_update'],
    updatedAt: NOW,
  }, NOW);

  for (const projection of [paired, local, update]) {
    assert.equal(PublicTaskProjectionDtoSchema.safeParse(projection).success, true);
  }
  assert.equal(paired.phase, 'cancelling');
  assert.equal(local.terminalOutcome, 'completed');
  assert.equal(update.source, 'app_update');
  assert.deepEqual(update.progress, { completed: 42, total: 100 });
});

test('keeps waiting, verification, and reconciliation phases explicit', () => {
  const waiting = projectAgentRunTask(createAgentRun({
    status: 'waiting_for_device',
    executionTarget: 'paired-desktop',
    pairedRuntimeId: 'runtime-1',
  }));
  const verification = projectAgentRunTask(createAgentRun({ status: 'verification_required' }));
  const reconcile = projectAgentRunTask(createAgentRun({ status: 'manual_reconcile' }));

  assert.equal(waiting.phase, 'waiting_for_device');
  assert.equal(waiting.error?.code, 'requires_paired_desktop');
  assert.deepEqual(waiting.allowedActions, ['refresh_capabilities', 'open_pairing', 'cancel', 'open_task_details']);
  assert.equal(verification.phase, 'verification_required');
  assert.equal(reconcile.phase, 'manual_reconcile');
  assert.equal(reconcile.error?.code, 'ambiguous_side_effect');
  assert.equal(reconcile.error?.billingMayHaveChanged, true);
  assert.equal(reconcile.error?.retryMayChargeAgain, true);
});

test('derives setup and retry semantics only from structured evidence, never localized text', () => {
  const createFailedJob = (message: string): GenerationBatchJob => createGenerationJob({
    status: 'failed',
    progress: {
      total: 1,
      queued: 0,
      running: 0,
      completed: 0,
      failed: 1,
      percent: 100,
      phase: 'failed',
    },
    prompts: [{
      id: 'prompt-1',
      prompt: 'same input',
      status: 'failed',
      phase: 'failed',
      retryCount: 0,
      retryable: false,
      errorCategory: 'authentication',
      error: message,
    }],
  });
  const english = projectGenerationJobTask(createFailedJob('API key is missing'));
  const chinese = projectGenerationJobTask(createFailedJob('请先配置密钥'));

  assert.deepEqual(english.error, chinese.error);
  assert.equal(english.phase, 'setup_required');
  assert.equal(english.error?.code, 'local_runtime_unavailable');
  assert.equal(english.error?.inputPreserved, true);
  assert.equal(english.allowedActions.includes('open_runtime_settings'), true);
});

test('blocks automatic replay when generation outcome requires manual reconciliation', () => {
  const projection = projectGenerationJobTask(createGenerationJob({
    status: 'failed',
    progress: {
      total: 1,
      queued: 0,
      running: 0,
      completed: 0,
      failed: 1,
      percent: 100,
      phase: 'failed',
    },
    prompts: [{
      id: 'prompt-1',
      prompt: 'paid generation',
      status: 'failed',
      phase: 'failed',
      retryCount: 0,
      retryable: false,
      errorCategory: 'persistence',
      reconciliationRequired: true,
      error: 'localized diagnostics do not define semantics',
    }],
  }));

  assert.equal(projection.phase, 'manual_reconcile');
  assert.equal(projection.error?.code, 'ambiguous_side_effect');
  assert.equal(projection.allowedActions.includes('retry'), false);
  assert.deepEqual(projection.error?.safeActions, ['open_task_details', 'reconcile_manually']);
});

test('public projections exclude prompts, tool payloads, raw failures, and user labels', () => {
  const privateValues = [
    'PRIVATE_PROMPT_SENTINEL',
    'PRIVATE_TOOL_PAYLOAD_SENTINEL',
    'PRIVATE_FAILURE_SENTINEL',
    'PRIVATE_LABEL_SENTINEL',
  ];
  const generation = projectGenerationJobTask(createGenerationJob({
    outputGroup: { label: privateValues[3], color: '#000000' },
    prompts: [{
      id: 'prompt-private',
      prompt: privateValues[0],
      status: 'failed',
      phase: 'failed',
      retryCount: 0,
      retryable: false,
      errorCategory: 'provider_unavailable',
      error: privateValues[2],
    }],
    status: 'failed',
  }));
  const agent = projectAgentRunTask(createAgentRun({
    userMessage: privateValues[0],
    intent: privateValues[3],
    plan: { payload: privateValues[1] },
    nextStep: privateValues[2],
  }));
  const serialized = JSON.stringify([generation, agent]);

  for (const privateValue of privateValues) assert.equal(serialized.includes(privateValue), false);
  assert.equal(generation.title, '图像生成任务 (1 项)');
  assert.equal(agent.title, 'AI 助手任务');
});

test('public task actions are authorized against the current Store projection', () => {
  const requested = projectGenerationJobTask(createGenerationJob());
  const current = projectGenerationJobTask(createGenerationJob({ status: 'paused' }));

  assert.equal(isPublicTaskActionCurrentlyAllowed(requested, 'pause', requested), true);
  assert.equal(isPublicTaskActionCurrentlyAllowed(requested, 'pause', current), false);
  assert.equal(isPublicTaskActionCurrentlyAllowed(requested, 'pause', undefined), false);
  assert.equal(isPublicTaskActionCurrentlyAllowed(
    { ...requested, projectionId: 'generation:forged' },
    'pause',
    requested,
  ), false);
});
