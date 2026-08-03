import assert from 'node:assert/strict';
import test from 'node:test';
import { AgentToolRegistry, toolRegistryInstance } from '../../apps/web/src/features/ai-assistant-runtime/tools/ToolRegistry.ts';
import { agentRunStore } from '../../apps/web/src/features/ai-assistant-runtime/runtime/AgentRunStore.ts';
import { durableGenerationQueue } from '../../apps/web/src/features/ai-assistant-runtime/queue/DurableGenerationQueue.ts';
import { CONFIRM_ACTIONS } from '../../apps/web/src/features/ai-takeover/core/confirmationPolicy.ts';
import type { AgentPlanStep } from '../../apps/web/src/features/ai-takeover/types.ts';
import { readSource } from '../support/workspacePaths.js';
import { createUserActionConfirmation } from '../../apps/web/src/features/ai-assistant-runtime/runtime/AssistantExecutionContext.ts';
import { emitAuthSessionChange } from '../../apps/web/src/services/auth/authSessionEvents.ts';

test('registered mutating tools expose impact, cost, recovery, idempotency, validation and verification metadata', () => {
  const tools = toolRegistryInstance.getAllTools();
  const mutatingTools = tools.filter((tool: any) => tool.control?.effect === 'mutation');

  assert.ok(mutatingTools.length > 0, 'the registry must classify mutating tools');
  for (const tool of mutatingTools) {
    assert.equal(tool.control.idempotency.required, true, `${tool.name} must require an idempotency key`);
    assert.equal(typeof tool.control.impact.summary, 'string', `${tool.name} must summarize impact`);
    assert.equal(typeof tool.control.cost.summary, 'string', `${tool.name} must summarize cost`);
    assert.equal(typeof tool.control.recovery.cancellable, 'boolean', `${tool.name} must declare cancellation support`);
    assert.equal(typeof tool.control.recovery.reversible, 'boolean', `${tool.name} must declare undo support`);
    assert.equal(typeof tool.inputValidator?.parse, 'function', `${tool.name} must validate input`);
    assert.equal(typeof tool.verify, 'function', `${tool.name} must verify its outcome`);
    if (tool.permission === 'safe') {
      assert.equal(
        tool.control.recovery.reversible,
        true,
        `${tool.name} cannot be an autonomous safe mutation unless it is reversible`,
      );
    }
  }

  assert.equal(toolRegistryInstance.getTool('generation.createBatchJob')?.permission, 'confirm');
  assert.equal(toolRegistryInstance.getTool('generation.retryJob')?.permission, 'confirm');
  assert.equal(toolRegistryInstance.getTool('generation.resumeJob')?.permission, 'confirm');
  assert.equal(toolRegistryInstance.getTool('generation.resumeJob')?.control.cost.kind, 'variable');
  assert.equal(toolRegistryInstance.getTool('generation.cancelJob')?.permission, 'confirm');
  assert.equal(toolRegistryInstance.getTool('generation.cancelJob')?.control.recovery.cancellable, false);
  assert.equal(
    toolRegistryInstance.getTool('generation.createBatchJob')?.control.recovery.cancelToolName,
    'generation.cancelJob',
  );
  assert.equal(toolRegistryInstance.getTool('assets.zipOriginals')?.permission, 'confirm');
  assert.equal(toolRegistryInstance.getTool('browser.writeBackDom')?.permission, 'dangerous');
  assert.equal(toolRegistryInstance.getTool('fillApiKey')?.permission, 'forbidden');
  for (const toolName of [
    'assets.zipOriginals',
    'generation.createBatchJob',
    'generation.cancelJob',
    'generation.retryJob',
    'generation.resumeJob',
    'generation.start',
    'generation.submitComposer',
    'knowledge.recordChange',
    'skills.upsertSkill',
    'ui.recordLayoutChange',
    'workflow.controlPanel',
    'browser.publishDraft',
    'browser.writeBackDom',
  ]) {
    assert.ok(CONFIRM_ACTIONS.includes(toolName), `${toolName} must be confirmed before AgentRuntime execution`);
  }
});

test('ToolRegistry cannot downgrade non-reversible mutations or their idempotency invariant', () => {
  const registry = new AgentToolRegistry();
  registry.register({
    name: 'test.nonReversibleMutation',
    description: 'must be promoted to confirmation',
    permission: 'safe',
    control: {
      effect: 'mutation',
      idempotency: { required: false },
    },
    inputSchema: { type: 'object' },
    handler: async () => ({ success: true }),
  });
  registry.register({
    name: 'test.reversibleMutation',
    description: 'explicitly reversible local mutation',
    permission: 'safe',
    control: {
      effect: 'mutation',
      recovery: { reversible: true },
      idempotency: { required: false },
    },
    inputSchema: { type: 'object' },
    handler: async () => ({ success: true }),
  });

  const nonReversible = registry.getTool('test.nonReversibleMutation');
  assert.equal(nonReversible?.permission, 'confirm');
  assert.equal(nonReversible?.control.idempotency.required, true);
  assert.equal(nonReversible?.control.idempotency.keyField, 'idempotencyKey');
  const reversible = registry.getTool('test.reversibleMutation');
  assert.equal(reversible?.permission, 'safe');
  assert.equal(reversible?.control.idempotency.required, true);
  assert.equal(reversible?.control.idempotency.keyField, 'idempotencyKey');
});

test('AgentRuntime consumes plan verification rules and reports explicit step outcomes', async () => {
  const runtimeModule = await import('../../apps/web/src/features/ai-assistant-runtime/runtime/AgentRuntime.ts');
  const verifyAgentPlanStep = (runtimeModule as any).verifyAgentPlanStep;
  assert.equal(typeof verifyAgentPlanStep, 'function');

  const step: AgentPlanStep = {
    stepId: 'step-queue',
    action: {
      type: 'generation.createBatchJob',
      payload: { prompts: [{ prompt: 'test' }] },
    },
    dependsOn: [],
    idempotencyKey: 'run-1:step-queue',
    verification: { required: true, rule: 'queue_job' },
  };

  let durableStatus = 'queued';
  const queueContext = {
    generationQueue: {
      getJob: (jobId: string) => jobId === 'job-1' ? { id: jobId, status: durableStatus } : undefined,
      getJobs: () => [],
    },
  } as any;
  const success = await verifyAgentPlanStep(step, { id: 'job-1', status: 'queued' }, queueContext, { status: 'success' });
  durableStatus = 'completed_with_errors';
  const partial = await verifyAgentPlanStep(step, { id: 'job-1', status: 'completed_with_errors' }, queueContext, { status: 'partial_success' });
  const retryable = await verifyAgentPlanStep(step, { id: 'job-1', status: 'failed', retryable: true }, {}, { status: 'retryable_failure' });
  const rolledBack = await verifyAgentPlanStep(step, { id: 'job-1', status: 'rolled_back' }, {}, { status: 'rolled_back' });
  const cancelled = await verifyAgentPlanStep(step, { id: 'job-1', status: 'cancelled' }, {}, { status: 'cancelled' });
  const partialWithoutDurableJob = await verifyAgentPlanStep(
    step,
    { id: 'missing-job', executionOutcome: 'partial_success' },
    queueContext,
    { status: 'partial_success' },
  );

  assert.equal(success.outcome, 'success');
  assert.equal(partial.outcome, 'partial_success');
  assert.equal(retryable.outcome, 'retryable_failure');
  assert.equal(rolledBack.outcome, 'rolled_back_failure');
  assert.equal(cancelled.outcome, 'cancelled');
  assert.equal(partialWithoutDurableJob.outcome, 'retryable_failure');
  const redactedFailure = await verifyAgentPlanStep(
    step,
    undefined,
    {},
    {
      status: 'failed',
      error: 'Authorization: Bearer step-result-secret',
      retryable: false,
    },
  );
  assert.equal(redactedFailure.message?.includes('step-result-secret'), false);
  assert.match(redactedFailure.message || '', /Authorization: \*\*\*/);

  const cancelJobStep = {
    ...step,
    stepId: 'step-cancel-job',
    action: { type: 'generation.cancelJob', payload: { jobId: 'job-1' } },
  } as any;
  const cancelledDomainJob = await verifyAgentPlanStep(
    cancelJobStep,
    { id: 'job-1', status: 'cancelled' },
    {
      generationQueue: {
        getJob: (jobId: string) => jobId === 'job-1' ? { id: jobId, status: 'cancelled' } : undefined,
        getJobs: () => [],
      },
    } as any,
    { status: 'success' },
  );
  assert.equal(cancelledDomainJob.outcome, 'success');

  const readJobStep = {
    ...step,
    stepId: 'step-read-job',
    action: { type: 'generation.getJobStatus', payload: { jobId: 'job-1' } },
  } as any;
  const failedDomainJob = await verifyAgentPlanStep(
    readJobStep,
    { id: 'job-1', status: 'failed' },
    {
      generationQueue: {
        getJob: (jobId: string) => jobId === 'job-1' ? { id: jobId, status: 'failed' } : undefined,
        getJobs: () => [],
      },
    } as any,
    { status: 'success' },
  );
  assert.equal(failedDomainJob.outcome, 'success');

  const canvasNoopStep = {
    stepId: 'step-canvas-noop',
    action: { type: 'canvas.arrangeNodes', payload: { nodeIds: ['node-1'], mode: 'grid' } },
    dependsOn: [],
    idempotencyKey: 'run-1:step-canvas-noop',
    verification: { required: true, rule: 'canvas_state' },
  } as any;
  const runtimeState = {
    canvas: { lastModified: 100 },
    recentEvents: [],
  } as any;
  const noop = await verifyAgentPlanStep(
    canvasNoopStep,
    { status: 'completed' },
    {
      getCanvasRuntimeState: () => runtimeState,
      verificationBaseline: { canvasRevision: 100, recentEventIds: [] },
    },
    { status: 'success' },
  );
  assert.equal(noop.outcome, 'retryable_failure');

  const assetStep = {
    stepId: 'step-asset-manifest',
    action: { type: 'assets.zipOriginals', payload: { scope: 'selected_cards' } },
    dependsOn: [],
    idempotencyKey: 'run-1:step-asset-manifest',
    verification: { required: true, rule: 'asset_manifest' },
  } as any;
  const allFailedAssetExport = await verifyAgentPlanStep(
    assetStep,
    {
      count: 0,
      failedCount: 1,
      manifest: { count: 0, failedCount: 1, items: [], failedItems: [{ nodeId: 'node-1' }] },
    },
    {},
    { status: 'success' },
  );
  const booleanManifestShortcut = await verifyAgentPlanStep(
    assetStep,
    { count: 0, failedCount: 1, manifest: true },
    {},
    { status: 'success' },
  );
  const filenameShortcut = await verifyAgentPlanStep(
    assetStep,
    { count: 1, downloadName: 'assets.zip' },
    {},
    { status: 'success' },
  );
  const partialBooleanManifestShortcut = await verifyAgentPlanStep(
    assetStep,
    { count: 1, manifest: true, executionOutcome: 'partial_success' },
    {},
    { status: 'partial_success' },
  );
  assert.equal(allFailedAssetExport.outcome, 'retryable_failure');
  assert.equal(booleanManifestShortcut.outcome, 'retryable_failure');
  assert.equal(filenameShortcut.outcome, 'retryable_failure');
  assert.equal(partialBooleanManifestShortcut.outcome, 'retryable_failure');
});

test('waiting confirmation requires a user-sourced grant and running cancellation stops dependent steps', async (t) => {
  const previousHandoffGuard = process.env.KK_DISABLE_HANDOFF_FS_WRITE;
  process.env.KK_DISABLE_HANDOFF_FS_WRITE = '1';
  t.after(() => {
    if (previousHandoffGuard === undefined) {
      delete process.env.KK_DISABLE_HANDOFF_FS_WRITE;
    } else {
      process.env.KK_DISABLE_HANDOFF_FS_WRITE = previousHandoffGuard;
    }
    agentRunStore.clearRuns();
  });

  const { AgentRuntime } = await import('../../apps/web/src/features/ai-assistant-runtime/runtime/AgentRuntime.ts');
  const runtime = new AgentRuntime();
  const notify = { success() {}, info() {}, warning() {}, error() {} };
  const baseContext = {
    currentPage: 'canvas' as const,
    collaborationMode: 'takeover' as const,
    trigger: 'resume' as const,
    selectedNodeIds: [],
    getActiveCanvas: () => undefined,
    getSelectedNodeIds: () => [],
    getCanvasRuntimeState: () => undefined,
    generationQueue: durableGenerationQueue,
    runStore: agentRunStore,
    notify,
  };

  agentRunStore.clearRuns();
  let confirmedCalls = 0;
  if (!toolRegistryInstance.getTool('test.confirmedMutation')) {
    toolRegistryInstance.register({
      name: 'test.confirmedMutation',
      description: 'control-plane confirmation test',
      permission: 'confirm',
      inputSchema: { type: 'object' },
      handler: async () => {
        confirmedCalls += 1;
        return { success: true, executionOutcome: 'success' };
      },
    });
  }
  const confirmationPlan = {
    id: 'plan-confirmation',
    intent: 'help',
    reply: 'confirm',
    actions: [{ type: 'test.confirmedMutation', payload: {} }],
    steps: [{
      stepId: 'confirm-step',
      action: { type: 'test.confirmedMutation', payload: {} },
      dependsOn: [],
      idempotencyKey: 'confirm-step-key',
      verification: { required: true, rule: 'tool' },
    }],
    requiresConfirmation: true,
  } as any;
  const confirmationRun = agentRunStore.createRun('confirm me', 'help', confirmationPlan);
  await assert.rejects(runtime.executePendingRun(confirmationRun.id, baseContext), /Explicit user confirmation/);
  assert.equal(confirmedCalls, 0);
  assert.equal(agentRunStore.getRun(confirmationRun.id)?.status, 'waiting_confirmation');

  const validConfirmationGrant = runtime.createConfirmationGrant(
    confirmationRun.id,
    confirmationPlan,
    { ...baseContext, runId: confirmationRun.id },
  );
  await assert.rejects(runtime.executePendingRun(confirmationRun.id, {
    ...baseContext,
    confirmationGrant: {
      ...validConfirmationGrant,
      toolNames: [],
      authorizedSteps: [],
    },
  }), /Explicit user confirmation/);
  assert.equal(confirmedCalls, 0);

  await runtime.executePendingRun(confirmationRun.id, {
    ...baseContext,
    trigger: 'takeover-confirmed',
    confirmationGrant: validConfirmationGrant,
  });
  assert.equal(confirmedCalls, 1);
  assert.equal(agentRunStore.getRun(confirmationRun.id)?.status, 'completed');
  await runtime.cancelPendingRun(confirmationRun.id);
  assert.equal(agentRunStore.getRun(confirmationRun.id)?.status, 'completed');

  let releaseSlowStep!: () => void;
  let signalSlowStepStarted!: () => void;
  const slowStepStarted = new Promise<void>((resolve) => { signalSlowStepStarted = resolve; });
  const slowStepRelease = new Promise<void>((resolve) => { releaseSlowStep = resolve; });
  let dependentCalls = 0;
  if (!toolRegistryInstance.getTool('test.slowMutation')) {
    toolRegistryInstance.register({
      name: 'test.slowMutation',
      description: 'control-plane cancellation test',
      permission: 'safe',
      control: { recovery: { reversible: true } },
      inputSchema: { type: 'object' },
      handler: async () => {
        signalSlowStepStarted();
        await slowStepRelease;
        return { status: 'completed' };
      },
    });
    toolRegistryInstance.register({
      name: 'test.dependentMutation',
      description: 'dependent cancellation test',
      permission: 'safe',
      control: { recovery: { reversible: true } },
      inputSchema: { type: 'object' },
      handler: async () => {
        dependentCalls += 1;
        return { status: 'completed' };
      },
    });
  }
  const cancelPlan = {
    id: 'plan-cancel',
    intent: 'help',
    reply: 'cancel',
    actions: [],
    steps: [
      {
        stepId: 'slow-step',
        action: { type: 'test.slowMutation', payload: {} },
        dependsOn: [],
        idempotencyKey: 'slow-step-key',
        verification: { required: true, rule: 'tool' },
      },
      {
        stepId: 'dependent-step',
        action: { type: 'test.dependentMutation', payload: {} },
        dependsOn: ['slow-step'],
        idempotencyKey: 'dependent-step-key',
        verification: { required: true, rule: 'tool' },
      },
    ],
    requiresConfirmation: false,
  } as any;
  const cancelRun = agentRunStore.createRun('cancel me', 'help', cancelPlan);
  const execution = runtime.executePendingRun(cancelRun.id, baseContext);
  await slowStepStarted;
  await runtime.cancelPendingRun(cancelRun.id);
  releaseSlowStep();
  await assert.rejects(execution);
  assert.equal(dependentCalls, 0);
  assert.equal(agentRunStore.getRun(cancelRun.id)?.status, 'cancelled');
});

test('a confirmation-required plan cannot execute from a tampered non-waiting status without a grant', async (t) => {
  const previousHandoffGuard = process.env.KK_DISABLE_HANDOFF_FS_WRITE;
  process.env.KK_DISABLE_HANDOFF_FS_WRITE = '1';
  t.after(() => {
    if (previousHandoffGuard === undefined) delete process.env.KK_DISABLE_HANDOFF_FS_WRITE;
    else process.env.KK_DISABLE_HANDOFF_FS_WRITE = previousHandoffGuard;
    agentRunStore.clearRuns();
  });

  let calls = 0;
  if (!toolRegistryInstance.getTool('test.confirmationStatusGuard')) {
    toolRegistryInstance.register({
      name: 'test.confirmationStatusGuard',
      description: 'safe reversible step inside a confirmation-required plan',
      permission: 'safe',
      control: { recovery: { reversible: true } },
      inputSchema: { type: 'object' },
      handler: async () => {
        calls += 1;
        return { success: true };
      },
    });
  }
  const plan = {
    id: 'plan-confirmation-status-guard',
    intent: 'help',
    reply: 'confirm first',
    actions: [{ type: 'test.confirmationStatusGuard', payload: {} }],
    requiresConfirmation: true,
  } as any;
  const run = agentRunStore.createRun('confirm first', 'help', plan);
  agentRunStore.updateRun(run.id, { status: 'waiting_execution' });
  const runtime = new (await import('../../apps/web/src/features/ai-assistant-runtime/runtime/AgentRuntime.ts')).AgentRuntime();
  await assert.rejects(runtime.executePendingRun(run.id, {
    currentPage: 'canvas',
    collaborationMode: 'assist',
    trigger: 'resume',
    selectedNodeIds: [],
    getActiveCanvas: () => undefined,
    getSelectedNodeIds: () => [],
    getCanvasRuntimeState: () => undefined,
    generationQueue: durableGenerationQueue,
    runStore: agentRunStore,
    notify: { success() {}, info() {}, warning() {}, error() {} },
  }), /Explicit user confirmation/);
  assert.equal(calls, 0);
  assert.equal(agentRunStore.getRun(run.id)?.status, 'waiting_confirmation');
});

test('confirmation grants are bound to owner, selection, model, and canvas scope', async (t) => {
  const registry = new AgentToolRegistry();
  let calls = 0;
  registry.register({
    name: 'test.scopedConfirmation',
    description: 'confirmation scope guard',
    permission: 'confirm',
    inputSchema: { type: 'object' },
    handler: async () => {
      calls += 1;
      return { success: true };
    },
  });
  t.after(() => emitAuthSessionChange({ hasSession: false, userId: null, isTempUser: false }));
  emitAuthSessionChange({ hasSession: true, userId: 'scope-owner-a', isTempUser: false });
  const input = {};
  const confirmed = createUserActionConfirmation('test.scopedConfirmation', input, {
    currentPage: 'canvas',
    activeCanvas: { id: 'canvas-a' },
    selectedNodeIds: ['node-a'],
    selectedModel: { id: 'model-a' },
  } as any);

  await assert.rejects(registry.execute('test.scopedConfirmation', input, {
    ...confirmed,
    selectedNodeIds: ['node-b'],
    getSelectedNodeIds: () => ['node-b'],
  }), /Confirmation grant required/);
  await assert.rejects(registry.execute('test.scopedConfirmation', input, {
    ...confirmed,
    selectedModel: { id: 'model-b' },
  }), /Confirmation grant required/);
  await assert.rejects(registry.execute('test.scopedConfirmation', input, {
    ...confirmed,
    activeCanvas: { id: 'canvas-b' },
  }), /Confirmation grant required/);
  emitAuthSessionChange({ hasSession: true, userId: 'scope-owner-b', isTempUser: false });
  await assert.rejects(
    registry.execute('test.scopedConfirmation', input, confirmed),
    /Confirmation grant required/,
  );
  assert.equal(calls, 0);
});

test('an owner switch during an awaited tool stops the Run and persists the terminal state to the original owner', async (t) => {
  const previousHandoffGuard = process.env.KK_DISABLE_HANDOFF_FS_WRITE;
  process.env.KK_DISABLE_HANDOFF_FS_WRITE = '1';
  let releaseTool!: () => void;
  let signalStarted!: () => void;
  const started = new Promise<void>((resolve) => { signalStarted = resolve; });
  const release = new Promise<void>((resolve) => { releaseTool = resolve; });
  t.after(() => {
    releaseTool?.();
    emitAuthSessionChange({ hasSession: false, userId: null, isTempUser: false });
    if (previousHandoffGuard === undefined) delete process.env.KK_DISABLE_HANDOFF_FS_WRITE;
    else process.env.KK_DISABLE_HANDOFF_FS_WRITE = previousHandoffGuard;
  });

  emitAuthSessionChange({ hasSession: true, userId: 'run-owner-a', isTempUser: false });
  agentRunStore.clearRuns();
  if (!toolRegistryInstance.getTool('test.ownerSwitchAwait')) {
    toolRegistryInstance.register({
      name: 'test.ownerSwitchAwait',
      description: 'owner switch await guard',
      permission: 'safe',
      control: { effect: 'read' },
      inputSchema: { type: 'object' },
      handler: async () => {
        signalStarted();
        await release;
        return { success: true };
      },
    });
  }
  const plan = {
    id: 'plan-owner-switch-await',
    intent: 'help',
    reply: 'run once',
    actions: [{ type: 'test.ownerSwitchAwait', payload: {} }],
    requiresConfirmation: false,
  } as any;
  const run = agentRunStore.createRun('owner switch', 'help', plan);
  const runtime = new (await import('../../apps/web/src/features/ai-assistant-runtime/runtime/AgentRuntime.ts')).AgentRuntime();
  const execution = runtime.executePendingRun(run.id, {
    currentPage: 'canvas',
    collaborationMode: 'takeover',
    trigger: 'takeover-auto',
    selectedNodeIds: [],
    getActiveCanvas: () => undefined,
    getSelectedNodeIds: () => [],
    getCanvasRuntimeState: () => undefined,
    generationQueue: durableGenerationQueue,
    runStore: agentRunStore,
    notify: { success() {}, info() {}, warning() {}, error() {} },
  });
  await started;
  emitAuthSessionChange({ hasSession: true, userId: 'run-owner-b', isTempUser: false });
  releaseTool();
  await assert.rejects(execution, /owner changed/i);
  assert.equal(agentRunStore.getRun(run.id), undefined);
  emitAuthSessionChange({ hasSession: true, userId: 'run-owner-a', isTempUser: false });
  assert.equal(agentRunStore.getRun(run.id)?.status, 'cancelled');
  assert.match(agentRunStore.getRun(run.id)?.nextStep || '', /owner changed/i);
});

test('an active canvas switch during an awaited tool cancels the Run before verification', async (t) => {
  const previousHandoffGuard = process.env.KK_DISABLE_HANDOFF_FS_WRITE;
  process.env.KK_DISABLE_HANDOFF_FS_WRITE = '1';
  let releaseTool!: () => void;
  let signalStarted!: () => void;
  const started = new Promise<void>((resolve) => { signalStarted = resolve; });
  const release = new Promise<void>((resolve) => { releaseTool = resolve; });
  t.after(() => {
    releaseTool?.();
    if (previousHandoffGuard === undefined) delete process.env.KK_DISABLE_HANDOFF_FS_WRITE;
    else process.env.KK_DISABLE_HANDOFF_FS_WRITE = previousHandoffGuard;
  });

  agentRunStore.clearRuns();
  if (!toolRegistryInstance.getTool('test.canvasSwitchAwait')) {
    toolRegistryInstance.register({
      name: 'test.canvasSwitchAwait',
      description: 'canvas switch await guard',
      permission: 'safe',
      control: { effect: 'read' },
      inputSchema: { type: 'object' },
      handler: async () => {
        signalStarted();
        await release;
        return { success: true };
      },
    });
  }
  const plan = {
    id: 'plan-canvas-switch-await',
    intent: 'help',
    reply: 'run once',
    actions: [{ type: 'test.canvasSwitchAwait', payload: {} }],
    requiresConfirmation: false,
  } as any;
  const run = agentRunStore.createRun('canvas switch', 'help', plan);
  const runtime = new (await import('../../apps/web/src/features/ai-assistant-runtime/runtime/AgentRuntime.ts')).AgentRuntime();
  let activeCanvasId = 'canvas-a';
  const execution = runtime.executePendingRun(run.id, {
    currentPage: 'canvas',
    collaborationMode: 'takeover',
    trigger: 'takeover-auto',
    selectedNodeIds: [],
    getActiveCanvas: () => ({ id: activeCanvasId } as any),
    getSelectedNodeIds: () => [],
    getCanvasRuntimeState: () => undefined,
    generationQueue: durableGenerationQueue,
    runStore: agentRunStore,
    notify: { success() {}, info() {}, warning() {}, error() {} },
  });

  await started;
  activeCanvasId = 'canvas-b';
  releaseTool();
  await assert.rejects(execution, /active canvas changed/i);
  assert.equal(agentRunStore.getRun(run.id)?.status, 'cancelled');
  const results = agentRunStore.getRun(run.id)?.stepResults;
  assert.equal(results?.[results.length - 1]?.outcome, 'cancelled');
});

test('AgentRuntime rejects a plan changed after the user confirmed the displayed snapshot', async () => {
  agentRunStore.clearRuns();
  const { AgentRuntime } = await import('../../apps/web/src/features/ai-assistant-runtime/runtime/AgentRuntime.ts');
  const runtime = new AgentRuntime();
  let handlerCalls = 0;
  if (!toolRegistryInstance.getTool('test.planSnapshotBinding')) {
    toolRegistryInstance.register({
      name: 'test.planSnapshotBinding',
      description: 'confirmation snapshot binding test',
      permission: 'confirm',
      inputSchema: {
        type: 'object',
        properties: { target: { type: 'string' } },
        required: ['target'],
      },
      handler: async () => {
        handlerCalls += 1;
        return { success: true };
      },
    });
  }
  const displayedPlan = {
    id: 'plan-snapshot-binding',
    intent: 'help',
    reply: 'confirm target A',
    actions: [],
    steps: [{
      stepId: 'snapshot-step',
      action: { type: 'test.planSnapshotBinding', payload: { target: 'target-a' } },
      dependsOn: [],
      idempotencyKey: 'snapshot-step-key',
      verification: { required: true, rule: 'tool' },
    }],
    requiresConfirmation: true,
  } as any;
  const run = agentRunStore.createRun('confirm target A', 'help', displayedPlan);
  const contextBase = {
    currentPage: 'canvas' as const,
    collaborationMode: 'takeover' as const,
    trigger: 'takeover-confirmed' as const,
    selectedNodeIds: [],
    getActiveCanvas: () => undefined,
    getSelectedNodeIds: () => [],
    getCanvasRuntimeState: () => undefined,
    generationQueue: durableGenerationQueue,
    runStore: agentRunStore,
    notify: { success() {}, info() {}, warning() {}, error() {} },
  };
  const grant = runtime.createConfirmationGrant(run.id, displayedPlan, contextBase);
  agentRunStore.updateRun(run.id, {
    plan: {
      ...displayedPlan,
      reply: 'silently changed to target B',
      steps: [{
        ...displayedPlan.steps[0],
        action: { type: 'test.planSnapshotBinding', payload: { target: 'target-b' } },
      }],
    },
  });

  await assert.rejects(
    runtime.executePendingRun(run.id, { ...contextBase, confirmationGrant: grant }),
    /Explicit user confirmation/,
  );
  assert.equal(handlerCalls, 0);
  assert.equal(agentRunStore.getRun(run.id)?.status, 'waiting_confirmation');
});

test('AgentRuntime cancels a durable generation job created after the Run abort signal', async (t) => {
  const previousHandoffGuard = process.env.KK_DISABLE_HANDOFF_FS_WRITE;
  process.env.KK_DISABLE_HANDOFF_FS_WRITE = '1';
  durableGenerationQueue.registerExecutor(null);
  durableGenerationQueue.clearAllJobs();
  agentRunStore.clearRuns();
  toolRegistryInstance.clearLogs();
  t.after(() => {
    if (previousHandoffGuard === undefined) delete process.env.KK_DISABLE_HANDOFF_FS_WRITE;
    else process.env.KK_DISABLE_HANDOFF_FS_WRITE = previousHandoffGuard;
    durableGenerationQueue.registerExecutor(null);
    durableGenerationQueue.clearAllJobs();
    agentRunStore.clearRuns();
    toolRegistryInstance.clearLogs();
  });

  const { AgentRuntime } = await import('../../apps/web/src/features/ai-assistant-runtime/runtime/AgentRuntime.ts');
  const runtime = new AgentRuntime();
  let signalBriefStarted!: () => void;
  let releaseBrief!: () => void;
  const briefStarted = new Promise<void>((resolve) => { signalBriefStarted = resolve; });
  const briefRelease = new Promise<void>((resolve) => { releaseBrief = resolve; });
  const idempotencyKey = 'cancel-race-generation-key';
  const plan = {
    id: 'plan-generation-cancel-race',
    intent: 'batch_generation',
    reply: 'create a durable generation job',
    actions: [],
    steps: [{
      stepId: 'create-generation-job',
      action: {
        type: 'generation.createBatchJob',
        payload: {
          prompts: [{ prompt: 'cancelled generation test' }],
          options: { researchBrief: 'wait before creating the queue job' },
        },
      },
      dependsOn: [],
      idempotencyKey,
      verification: { required: true, rule: 'queue_job' },
    }],
    requiresConfirmation: true,
  } as any;
  const run = agentRunStore.createRun('cancel generated work', 'batch_generation', plan);
  const contextBase = {
    currentPage: 'canvas' as const,
    collaborationMode: 'takeover' as const,
    trigger: 'takeover-confirmed' as const,
    selectedNodeIds: [],
    getActiveCanvas: () => undefined,
    getSelectedNodeIds: () => [],
    getCanvasRuntimeState: () => undefined,
    generationQueue: durableGenerationQueue,
    runStore: agentRunStore,
    notify: { success() {}, info() {}, warning() {}, error() {} },
    addPromptNode: async () => {
      signalBriefStarted();
      await briefRelease;
    },
    getNextCardPosition: () => ({ x: 100, y: 100 }),
  };
  const context = {
    ...contextBase,
    confirmationGrant: runtime.createConfirmationGrant(run.id, plan, contextBase),
  };

  const execution = runtime.executePendingRun(run.id, context);
  await briefStarted;
  await runtime.cancelPendingRun(run.id);
  assert.equal(durableGenerationQueue.getJobs().length, 0);

  releaseBrief();
  await assert.rejects(execution);
  await new Promise((resolve) => setTimeout(resolve, 0));

  const runtimeIdempotencyKey = `${run.id}:create-generation-job`;
  const job = durableGenerationQueue.getJobs().find((candidate) => candidate.idempotencyKey === runtimeIdempotencyKey);
  assert.ok(job);
  assert.equal(job.status, 'cancelled');
  assert.equal(job.prompts[0]?.errorCategory, 'cancelled');
  assert.equal(job.prompts[0]?.retryable, false);
  assert.equal(toolRegistryInstance.getLogs().some((log) => (
    log.runId === run.id && log.toolName === 'generation.cancelJob'
  )), false, 'runtime compensation must not mint a reusable recovery confirmation grant');
  assert.equal(agentRunStore.getRun(run.id)?.toolCalls.some((log) => log.toolName === 'generation.cancelJob'), false);
  assert.equal(agentRunStore.getRun(run.id)?.status, 'cancelled');
});

test('AgentRuntime does not cancel a matching job for a future step that never started', async (t) => {
  const previousHandoffGuard = process.env.KK_DISABLE_HANDOFF_FS_WRITE;
  process.env.KK_DISABLE_HANDOFF_FS_WRITE = '1';
  durableGenerationQueue.registerExecutor(null);
  durableGenerationQueue.clearAllJobs();
  agentRunStore.clearRuns();
  toolRegistryInstance.clearLogs();
  t.after(() => {
    if (previousHandoffGuard === undefined) delete process.env.KK_DISABLE_HANDOFF_FS_WRITE;
    else process.env.KK_DISABLE_HANDOFF_FS_WRITE = previousHandoffGuard;
    durableGenerationQueue.registerExecutor(null);
    durableGenerationQueue.clearAllJobs();
    agentRunStore.clearRuns();
    toolRegistryInstance.clearLogs();
  });

  let signalStarted!: () => void;
  let releaseSlowStep!: () => void;
  const started = new Promise<void>((resolve) => { signalStarted = resolve; });
  const slowStepRelease = new Promise<void>((resolve) => { releaseSlowStep = resolve; });
  if (!toolRegistryInstance.getTool('test.futureGenerationGuard')) {
    toolRegistryInstance.register({
      name: 'test.futureGenerationGuard',
      description: 'wait before a future generation step',
      permission: 'safe',
      control: { effect: 'read' },
      inputSchema: { type: 'object' },
      handler: async () => {
        signalStarted();
        await slowStepRelease;
        return { id: 'guard-complete', status: 'completed' };
      },
    });
  }

  const futureIdempotencyKey = 'future-generation-step-key';
  const existingJob = durableGenerationQueue.createJob(
    [{ id: 'existing-prompt', prompt: 'belongs outside this Run' }],
    { taskType: 'image', modelId: 'test-model' },
    'canvas-existing',
    futureIdempotencyKey,
  );
  const plan = {
    id: 'plan-future-generation-guard',
    intent: 'help',
    reply: 'do not touch the future job',
    actions: [],
    steps: [
      {
        stepId: 'guard-step',
        action: { type: 'test.futureGenerationGuard', payload: {} },
        dependsOn: [],
        idempotencyKey: 'guard-step-key',
        verification: { required: true, rule: 'tool' },
      },
      {
        stepId: 'future-generation-step',
        action: {
          type: 'generation.createBatchJob',
          payload: { prompts: [{ prompt: 'future work' }], idempotencyKey: futureIdempotencyKey },
        },
        dependsOn: ['guard-step'],
        idempotencyKey: futureIdempotencyKey,
        verification: { required: true, rule: 'queue_job' },
      },
    ],
    requiresConfirmation: true,
  } as any;
  const run = agentRunStore.createRun('cancel before generation', 'help', plan);
  const { AgentRuntime } = await import('../../apps/web/src/features/ai-assistant-runtime/runtime/AgentRuntime.ts');
  const runtime = new AgentRuntime();
  const contextBase = {
    currentPage: 'canvas' as const,
    collaborationMode: 'takeover' as const,
    trigger: 'takeover-confirmed' as const,
    selectedNodeIds: [],
    getActiveCanvas: () => undefined,
    getSelectedNodeIds: () => [],
    getCanvasRuntimeState: () => undefined,
    generationQueue: durableGenerationQueue,
    runStore: agentRunStore,
    notify: { success() {}, info() {}, warning() {}, error() {} },
  };
  const context = {
    ...contextBase,
    confirmationGrant: runtime.createConfirmationGrant(run.id, plan, contextBase),
  };
  const execution = runtime.executePendingRun(run.id, context);
  await started;
  await runtime.cancelPendingRun(run.id);
  assert.equal(durableGenerationQueue.getJob(existingJob.id)?.status, 'queued');
  releaseSlowStep();
  await assert.rejects(execution);
  assert.equal(durableGenerationQueue.getJob(existingJob.id)?.status, 'queued');
  assert.equal(toolRegistryInstance.getLogs().some((log) => (
    log.runId === run.id
    && log.toolName === 'generation.cancelJob'
  )), false);
});

test('AgentRuntime uses one in-flight execution per runId', async (t) => {
  const previousHandoffGuard = process.env.KK_DISABLE_HANDOFF_FS_WRITE;
  process.env.KK_DISABLE_HANDOFF_FS_WRITE = '1';
  t.after(() => {
    if (previousHandoffGuard === undefined) delete process.env.KK_DISABLE_HANDOFF_FS_WRITE;
    else process.env.KK_DISABLE_HANDOFF_FS_WRITE = previousHandoffGuard;
    agentRunStore.clearRuns();
  });

  const { AgentRuntime } = await import('../../apps/web/src/features/ai-assistant-runtime/runtime/AgentRuntime.ts');
  const runtime = new AgentRuntime();
  let calls = 0;
  let signalStarted!: () => void;
  let release!: () => void;
  const started = new Promise<void>((resolve) => { signalStarted = resolve; });
  const released = new Promise<void>((resolve) => { release = resolve; });
  if (!toolRegistryInstance.getTool('test.singleFlightMutation')) {
    toolRegistryInstance.register({
      name: 'test.singleFlightMutation',
      description: 'single-flight execution test',
      permission: 'safe',
      control: { recovery: { reversible: true } },
      inputSchema: { type: 'object' },
      handler: async () => {
        calls += 1;
        signalStarted();
        await released;
        return { id: 'single-flight-result', status: 'completed' };
      },
    });
  }

  const plan = {
    id: 'plan-single-flight',
    intent: 'help',
    reply: 'run once',
    actions: [{ type: 'test.singleFlightMutation', payload: {} }],
    steps: [{
      stepId: 'single-flight-step',
      action: { type: 'test.singleFlightMutation', payload: {} },
      dependsOn: [],
      idempotencyKey: 'single-flight-key',
      verification: { required: true, rule: 'tool' },
    }],
    requiresConfirmation: false,
  } as any;
  const run = agentRunStore.createRun('single flight', 'help', plan);
  const context = {
    currentPage: 'canvas' as const,
    collaborationMode: 'takeover' as const,
    trigger: 'takeover-auto' as const,
    selectedNodeIds: [],
    getActiveCanvas: () => undefined,
    getSelectedNodeIds: () => [],
    getCanvasRuntimeState: () => undefined,
    generationQueue: durableGenerationQueue,
    runStore: agentRunStore,
    notify: { success() {}, info() {}, warning() {}, error() {} },
  };

  const first = runtime.executePendingRun(run.id, context);
  await started;
  const second = runtime.executePendingRun(run.id, context);
  release();
  const results = await Promise.allSettled([first, second]);
  assert.equal(first, second);
  assert.equal(calls, 1);
  assert.deepEqual(results.map((result) => result.status), ['fulfilled', 'fulfilled']);
  assert.equal(agentRunStore.getRun(run.id)?.status, 'completed');
});

test('AgentRuntime freezes latest failed retry intent to one job revision before confirmation', async (t) => {
  const previousHandoffGuard = process.env.KK_DISABLE_HANDOFF_FS_WRITE;
  process.env.KK_DISABLE_HANDOFF_FS_WRITE = '1';
  emitAuthSessionChange({ hasSession: false, userId: null, isTempUser: false });
  agentRunStore.clearRuns();
  const jobs: any[] = [{
    id: 'job-frozen-a',
    status: 'completed_with_errors',
    updatedAt: 100,
    canvasId: 'canvas-frozen-retry',
    prompts: [{ id: 'prompt-frozen-a', status: 'failed', retryable: true }],
  }];
  const retriedJobIds: string[] = [];
  const queue = {
    getJobs: () => jobs,
    getJob: (jobId: string) => jobs.find((job) => job.id === jobId),
    retryFailedPrompts: (jobId: string) => {
      retriedJobIds.push(jobId);
      const job = jobs.find((candidate) => candidate.id === jobId);
      if (!job) return;
      job.prompts.forEach((prompt: any) => {
        if (prompt.status === 'failed' && prompt.retryable !== false) prompt.status = 'queued';
      });
      job.status = 'queued';
      job.updatedAt += 1;
    },
  };
  t.after(() => {
    if (previousHandoffGuard === undefined) delete process.env.KK_DISABLE_HANDOFF_FS_WRITE;
    else process.env.KK_DISABLE_HANDOFF_FS_WRITE = previousHandoffGuard;
    agentRunStore.clearRuns();
  });

  const { AgentRuntime } = await import('../../apps/web/src/features/ai-assistant-runtime/runtime/AgentRuntime.ts');
  const runtime = new AgentRuntime(queue as any);
  const planningContext = {
    currentPage: 'canvas',
    aiTakeover: { enabled: true, mode: 'local', collaborationMode: 'takeover' },
    agent: { enabled: true },
    canvas: { id: 'canvas-frozen-retry', selectedNodeIds: [], promptNodes: [], imageNodes: [] },
    assets: { imageCollections: [], images: [], files: [], outputs: [] },
    settings: { apiKeyStatus: 'missing', providerCount: 0 },
    billing: { balanceKnown: false, canEstimateCost: false },
    errors: [],
  } as any;
  const run = await runtime.run('重试刚才失败的批次', planningContext);
  const retryAction = (run.plan.actions || []).find((action: any) => action.type === 'generation.retryJob');
  assert.deepEqual(retryAction?.payload, {
    jobId: 'job-frozen-a',
    expectedUpdatedAt: 100,
    expectedRetryablePromptIds: ['prompt-frozen-a'],
  });
  assert.equal(JSON.stringify(run.plan).includes('latest_failed'), false);
  assert.match(run.plan.confirmation?.summary || '', /job-frozen-a/);
  assert.match(run.plan.confirmation?.summary || '', /1 个失败项/);

  jobs.push({
    id: 'job-newer-b',
    status: 'completed_with_errors',
    updatedAt: 200,
    canvasId: 'canvas-frozen-retry',
    prompts: [{ id: 'prompt-newer-b', status: 'failed', retryable: true }],
  });
  const contextBase = {
    currentPage: 'canvas' as const,
    collaborationMode: 'takeover' as const,
    trigger: 'takeover-confirmed' as const,
    selectedNodeIds: [],
    getActiveCanvas: () => ({ id: 'canvas-frozen-retry' }),
    getSelectedNodeIds: () => [],
    getCanvasRuntimeState: () => undefined,
    generationQueue: queue as any,
    runStore: agentRunStore,
    notify: { success() {}, info() {}, warning() {}, error() {} },
  };
  const grant = runtime.createConfirmationGrant(run.id, run.plan as any, contextBase as any);
  await runtime.executePendingRun(run.id, { ...contextBase, confirmationGrant: grant } as any);

  assert.deepEqual(retriedJobIds, ['job-frozen-a']);
  assert.equal(queue.getJob('job-frozen-a')?.prompts[0]?.status, 'queued');
  assert.equal(queue.getJob('job-newer-b')?.prompts[0]?.status, 'failed');
});

test('AgentRuntime fails closed when a frozen retry job changes after preview', async (t) => {
  process.env.KK_DISABLE_HANDOFF_FS_WRITE = '1';
  emitAuthSessionChange({ hasSession: false, userId: null, isTempUser: false });
  agentRunStore.clearRuns();
  const job: any = {
    id: 'job-stale-retry',
    status: 'completed_with_errors',
    updatedAt: 300,
    canvasId: 'canvas-stale-retry',
    prompts: [{ id: 'prompt-stale-retry', status: 'failed', retryable: true }],
  };
  let retryCalls = 0;
  const queue = {
    getJobs: () => [job],
    getJob: (jobId: string) => jobId === job.id ? job : undefined,
    retryFailedPrompts: () => { retryCalls += 1; },
  };
  t.after(() => {
    delete process.env.KK_DISABLE_HANDOFF_FS_WRITE;
    agentRunStore.clearRuns();
  });
  const { AgentRuntime } = await import('../../apps/web/src/features/ai-assistant-runtime/runtime/AgentRuntime.ts');
  const runtime = new AgentRuntime(queue as any);
  const run = await runtime.run('重试刚才失败的批次', {
    currentPage: 'canvas',
    aiTakeover: { enabled: true, mode: 'local', collaborationMode: 'takeover' },
    agent: { enabled: true },
    canvas: { id: 'canvas-stale-retry', selectedNodeIds: [], promptNodes: [], imageNodes: [] },
    assets: { imageCollections: [], images: [], files: [], outputs: [] },
    settings: { apiKeyStatus: 'missing', providerCount: 0 },
    billing: { balanceKnown: false, canEstimateCost: false },
    errors: [],
  } as any);
  const contextBase = {
    currentPage: 'canvas' as const,
    collaborationMode: 'takeover' as const,
    trigger: 'takeover-confirmed' as const,
    selectedNodeIds: [],
    getActiveCanvas: () => ({ id: 'canvas-stale-retry' }),
    getSelectedNodeIds: () => [],
    getCanvasRuntimeState: () => undefined,
    generationQueue: queue as any,
    runStore: agentRunStore,
    notify: { success() {}, info() {}, warning() {}, error() {} },
  };
  const grant = runtime.createConfirmationGrant(run.id, run.plan as any, contextBase as any);
  job.updatedAt = 301;
  await assert.rejects(runtime.executePendingRun(run.id, { ...contextBase, confirmationGrant: grant } as any));
  assert.equal(retryCalls, 0);
  assert.equal(agentRunStore.getRun(run.id)?.status, 'failed');
  assert.equal(agentRunStore.getRun(run.id)?.nextStep?.includes('STALE_RETRY_TARGET'), false);
});

test('AgentRuntime discards a planner result when the authenticated owner changes during await', async (t) => {
  const { LocalAssistantBrain } = await import('../../apps/web/src/features/ai-takeover/core/localBrain.ts');
  const originalPlan = LocalAssistantBrain.prototype.plan;
  let release!: () => void;
  let signalStarted!: () => void;
  const started = new Promise<void>((resolve) => { signalStarted = resolve; });
  const waitForRelease = new Promise<void>((resolve) => { release = resolve; });
  LocalAssistantBrain.prototype.plan = async () => {
    signalStarted();
    await waitForRelease;
    return {
      id: 'plan-owner-switch-during-planning',
      intent: 'unknown',
      reply: 'must be discarded',
      confidence: 1,
      actions: [],
      requiresConfirmation: false,
    } as any;
  };
  t.after(() => {
    LocalAssistantBrain.prototype.plan = originalPlan;
    emitAuthSessionChange({ hasSession: false, userId: null, isTempUser: false });
  });

  emitAuthSessionChange({ hasSession: true, userId: 'planner-owner-a', isTempUser: false });
  agentRunStore.clearRuns();
  const { AgentRuntime } = await import('../../apps/web/src/features/ai-assistant-runtime/runtime/AgentRuntime.ts');
  const execution = new AgentRuntime().run('owner switch while planning', {
    currentPage: 'canvas',
    aiTakeover: { enabled: true, mode: 'local', collaborationMode: 'takeover' },
    agent: { enabled: true },
    canvas: { selectedNodeIds: [], promptNodes: [], imageNodes: [] },
    assets: { imageCollections: [], images: [], files: [], outputs: [] },
    settings: { apiKeyStatus: 'missing', providerCount: 0 },
    billing: { balanceKnown: false, canEstimateCost: false },
    errors: [],
  } as any);
  await started;
  emitAuthSessionChange({ hasSession: true, userId: 'planner-owner-b', isTempUser: false });
  release();
  await assert.rejects(execution, /owner changed/i);
  assert.equal(agentRunStore.listRuns().length, 0);
  emitAuthSessionChange({ hasSession: true, userId: 'planner-owner-a', isTempUser: false });
  assert.equal(agentRunStore.listRuns().length, 0);
});

test('Agent runtime and knowledge synchronization use the typed KK API client instead of raw fetch', () => {
  const runtimeSource = readSource('apps/web/src/features/ai-assistant-runtime/runtime/AgentRuntime.ts');
  const knowledgeSource = readSource('apps/web/src/features/ai-assistant-runtime/knowledge/KnowledgeStore.ts');

  assert.match(runtimeSource, /kkWebApiClient\.upsertAgentRun/);
  assert.match(runtimeSource, /kkWebApiClient\.recordAgentToolCall/);
  assert.match(knowledgeSource, /kkWebApiClient\.recordKnowledgeChange/);
  assert.match(knowledgeSource, /kkWebApiClient\.upsertAgentSkill/);
  assert.match(knowledgeSource, /kkWebApiClient\.deleteAgentSkill/);
  assert.doesNotMatch(runtimeSource, /\bfetch\s*\(/);
  assert.doesNotMatch(knowledgeSource, /\bfetch\s*\(/);
});

test('the takeover provider constructs the public typed AssistantExecutionContext', () => {
  const providerSource = readSource('apps/web/src/features/ai-takeover/context/AITakeoverContext.tsx');
  const runtimeIndexSource = readSource('apps/web/src/features/ai-assistant-runtime/index.ts');

  assert.match(providerSource, /AssistantExecutionContext/);
  assert.match(providerSource, /const ctx: AssistantExecutionContext/);
  assert.match(providerSource, /currentPage/);
  assert.match(providerSource, /generationQueue: durableGenerationQueue/);
  assert.match(providerSource, /runStore: agentRunStore/);
  assert.match(providerSource, /confirmedPlanSnapshot/);
  assert.match(providerSource, /agentRuntimeInstance\.createConfirmationGrant/);
  assert.doesNotMatch(providerSource, /confirmedToolNames/);
  assert.match(runtimeIndexSource, /AssistantExecutionContext/);
  assert.match(runtimeIndexSource, /createAssistantStepAuthorization/);
});

test('running Agent runs keep a reachable cancellation action until terminal state', () => {
  const providerSource = readSource('apps/web/src/features/ai-takeover/context/AITakeoverContext.tsx');
  const dockSource = readSource('apps/web/src/features/ai-takeover/components/AIAssistantDock.tsx');
  const sidebarSource = readSource('apps/web/src/components/layout/ChatSidebar.tsx');

  assert.doesNotMatch(providerSource, /setCurrentRunId\(null\);\s*await executePlan/);
  assert.match(dockSource, /currentRun\?\.status === 'running'[\s\S]*cancelPendingPlan/);
  assert.match(sidebarSource, /currentRun\?\.status === 'running'[\s\S]*cancelPendingPlan/);
});

test('Agent Run backend synchronization is ordered and retains failed snapshots for retry', () => {
  const runtimeSource = readSource('apps/web/src/features/ai-assistant-runtime/runtime/AgentRuntime.ts');
  const runStoreSource = readSource('apps/web/src/features/ai-assistant-runtime/runtime/AgentRunStore.ts');
  const routeSource = readSource('services/api/routes/ai-assistant.js');
  const writeStoreSource = readSource('services/api/lib/agent-run-write-store.js');

  assert.match(runtimeSource, /runSyncChains/);
  assert.match(runtimeSource, /pendingRunSyncs/);
  assert.match(runtimeSource, /restorePendingRunSyncsFromStore/);
  assert.match(runtimeSource, /markBackendSynced/);
  assert.match(runtimeSource, /addEventListener\('online'/);
  assert.match(runStoreSource, /backendSyncState/);
  assert.match(runStoreSource, /owner:/);
  assert.match(routeSource, /agentRunWriteStore\.upsertAgentRun/);
  assert.match(writeStoreSource, /current_run\.updated_at\s*<=\s*EXCLUDED\.updated_at/);
});
