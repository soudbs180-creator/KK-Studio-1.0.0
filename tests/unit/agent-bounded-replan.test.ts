import assert from 'node:assert/strict';
import test from 'node:test';
import type { AgentRunDto, AgentStepResultDto } from '@kk/shared';
import type { AssistantPlan } from '../../apps/web/src/features/ai-takeover/types.ts';
import type { AssistantAuthorizationScopeSnapshot } from '../../apps/web/src/features/ai-assistant-runtime/runtime/AssistantExecutionContext.ts';
import { AgentRunStore, type AgentRunRecord } from '../../apps/web/src/features/ai-assistant-runtime/runtime/AgentRunStore.ts';
import {
  buildAgentReplacementPlan,
  evaluateAgentReplanPolicy,
} from '../../apps/web/src/features/ai-assistant-runtime/runtime/agentReplanPolicy.ts';
import {
  coordinateAgentReplan,
  type AgentReplanTransport,
} from '../../apps/web/src/features/ai-assistant-runtime/runtime/agentReplanCoordinator.ts';
import { readSource } from '../support/workspacePaths.js';

const OWNER_ID = 'bounded-replan-owner';
const BASE_TIME = '2026-07-24T09:00:00.000Z';

const INITIAL_SCOPE: AssistantAuthorizationScopeSnapshot = {
  ownerId: OWNER_ID,
  workspaceSurface: 'canvas',
  projectId: 'project-1',
  canvasId: 'canvas-1',
  selectedNodeIds: ['node-1'],
  selectedModelId: 'model-1',
  mutableConfigurationFingerprint: 'config-1',
};

const retryableFailure: AgentStepResultDto = {
  stepId: 'step-failed',
  toolName: 'canvas.getState',
  outcome: 'retryable_failure',
  verificationRule: 'tool',
  retryable: true,
  verifiedAt: BASE_TIME,
};

function createInitialPlan(): AssistantPlan {
  return {
    version: 2,
    id: 'plan-initial',
    reply: 'Initial plan',
    intent: 'help',
    confidence: 1,
    actions: [],
    steps: [
      {
        stepId: 'step-completed',
        action: { type: 'canvas.getState', payload: {} },
        dependsOn: [],
        idempotencyKey: 'old-completed-key',
        verification: { required: true, rule: 'canvas_state' },
      },
      {
        stepId: 'step-failed',
        action: { type: 'canvas.getState', payload: { attempt: 'retry' } } as never,
        dependsOn: ['step-completed'],
        idempotencyKey: 'old-failed-key',
        verification: { required: true, rule: 'tool' },
      },
    ],
    maxReplans: 3,
    requiresConfirmation: true,
    confirmation: {
      title: 'Initial confirmation',
      summary: 'Initial summary',
      confirmText: 'Run',
      cancelText: 'Cancel',
    },
  };
}

function createCandidatePlan(): AssistantPlan {
  return {
    id: 'untrusted-candidate-id',
    reply: 'Replacement plan',
    intent: 'help',
    confidence: 0.9,
    actions: [],
    steps: [
      {
        stepId: 'candidate-completed',
        action: { type: 'canvas.getState', payload: {} },
        dependsOn: [],
        idempotencyKey: 'candidate-completed-key',
        verification: { required: true, rule: 'canvas_state' },
      },
      {
        stepId: 'candidate-retry',
        action: { type: 'canvas.getState', payload: { attempt: 'retry' } } as never,
        dependsOn: ['candidate-completed'],
        idempotencyKey: 'candidate-retry-key',
        verification: { required: true, rule: 'tool' },
      },
      {
        stepId: 'candidate-new',
        action: { type: 'workspace.getState', payload: {} },
        dependsOn: ['candidate-retry'],
        idempotencyKey: 'candidate-new-key',
        verification: { required: true, rule: 'tool' },
      },
    ],
    requiresConfirmation: false,
  };
}

function createStore(): { store: AgentRunStore; record: AgentRunRecord } {
  const store = new AgentRunStore(null, () => OWNER_ID);
  const created = store.createRun('finish the current task', 'help', createInitialPlan(), 'session-1');
  const record = store.updateRun(created.id, {
    status: 'running',
    completedStepIds: ['step-completed'],
    stepResults: [retryableFailure],
    confirmationGrantedAt: BASE_TIME,
  });
  return { store, record };
}

function toDto(record: AgentRunRecord, overrides: Partial<AgentRunDto> = {}): AgentRunDto {
  const {
    backendSyncState: _backendSyncState,
    executionAuthority: _executionAuthority,
    ...dto
  } = JSON.parse(JSON.stringify(record)) as AgentRunRecord;
  return { ...dto, ...overrides } as AgentRunDto;
}

function ok(data: AgentRunDto, stale = false) {
  return { success: true, data: { ok: true, stale, data } };
}

test('replacement plan drops completed actions, reuses the failed step id, and allocates new ids', () => {
  const replacement = buildAgentReplacementPlan({
    runId: 'run-1',
    previousPlan: createInitialPlan(),
    candidatePlan: createCandidatePlan(),
    completedStepIds: ['step-completed'],
    failedStepId: 'step-failed',
    nextReplanCount: 1,
  });

  assert.deepEqual(replacement.steps?.map((step) => step.stepId), [
    'step-failed',
    'run-1:replan:1:step:1',
  ]);
  assert.deepEqual(replacement.steps?.[0]?.dependsOn, []);
  assert.deepEqual(replacement.steps?.[1]?.dependsOn, ['step-failed']);
  assert.equal(replacement.id, 'run-1:plan:replan:1');
  assert.equal(replacement.requiresConfirmation, false);
  assert.equal(replacement.confirmation, undefined);
});

test('replan policy permits only explicit retryable or trusted rolled-back failures', () => {
  const { record } = createStore();
  const allowed = evaluateAgentReplanPolicy({
    record,
    failure: retryableFailure,
    recovery: { failedJobIds: [], recoveredStepIds: [] },
    initialScope: INITIAL_SCOPE,
    currentScope: INITIAL_SCOPE,
  });
  assert.deepEqual(allowed, { allowed: true });

  const blockedCases = [
    { failure: { ...retryableFailure, retryable: false }, reason: 'failure_not_retryable' },
    { failure: { ...retryableFailure, outcome: 'cancelled' as const }, reason: 'run_cancelled' },
    { failure: retryableFailure, recovery: { failedJobIds: ['job-1'], recoveredStepIds: [] }, reason: 'recovery_incomplete' },
    { failure: retryableFailure, failureClass: 'permission' as const, reason: 'unsafe_failure_class' },
    {
      failure: retryableFailure,
      currentScope: { ...INITIAL_SCOPE, selectedModelId: 'model-2' },
      reason: 'scope_changed',
    },
  ];
  for (const blocked of blockedCases) {
    const decision = evaluateAgentReplanPolicy({
      record,
      failure: blocked.failure,
      failureClass: blocked.failureClass,
      recovery: blocked.recovery || { failedJobIds: [], recoveredStepIds: [] },
      initialScope: INITIAL_SCOPE,
      currentScope: blocked.currentScope || INITIAL_SCOPE,
    });
    assert.deepEqual(decision, { allowed: false, reason: blocked.reason });
  }

  assert.deepEqual(evaluateAgentReplanPolicy({
    record,
    failure: { ...retryableFailure, outcome: 'rolled_back_failure', retryable: false },
    recovery: { failedJobIds: [], recoveredStepIds: ['step-failed'] },
    initialScope: INITIAL_SCOPE,
    currentScope: INITIAL_SCOPE,
  }), { allowed: true });
});

test('coordinator applies and exposes a replacement only after exact server acceptance', async () => {
  const { store, record } = createStore();
  const order: string[] = [];
  let replacementInput: AgentRunRecord | undefined;
  let upsertCount = 0;
  const transport: AgentReplanTransport = {
    async upsertAgentRun(input) {
      upsertCount += 1;
      if (upsertCount === 1) {
        order.push('baseline-accepted');
        return ok(toDto(record, { replanCount: 0 }));
      }
      order.push('replacement-accepted');
      replacementInput = input;
      return ok(toDto(input, { replanCount: 1 }));
    },
    async getAgentRun() {
      assert.fail('GET recovery is not needed for an intact POST response');
    },
  };

  const result = await coordinateAgentReplan({
    ownerId: OWNER_ID,
    runId: record.id,
    failure: retryableFailure,
    recovery: { failedJobIds: [], recoveredStepIds: [] },
    initialScope: INITIAL_SCOPE,
    captureCurrentScope: () => INITIAL_SCOPE,
    getCurrentOwnerId: () => OWNER_ID,
    store,
    transport,
    createReplacementPlan: async (nextReplanCount) => {
      order.push('planner');
      return buildAgentReplacementPlan({
        runId: record.id,
        previousPlan: createInitialPlan(),
        candidatePlan: createCandidatePlan(),
        completedStepIds: ['step-completed'],
        failedStepId: 'step-failed',
        nextReplanCount,
      });
    },
  });

  assert.equal(result.outcome, 'accepted', JSON.stringify({ result, order, replacementInput }));
  assert.deepEqual(order, ['baseline-accepted', 'planner', 'replacement-accepted']);
  assert.equal(store.getRun(record.id)?.replanCount, 1);
  assert.equal(store.getRun(record.id)?.confirmationGrantedAt, undefined);
  assert.equal(store.getRun(record.id)?.status, 'waiting_execution');
  assert.deepEqual((store.getRun(record.id)?.plan as AssistantPlan).steps?.map((step) => step.stepId), [
    'step-failed',
    `${record.id}:replan:1:step:1`,
  ]);
});

test('lost replacement POST response recovers only through an exact owner-qualified GET', async () => {
  const { store, record } = createStore();
  let replacementDto: AgentRunDto | undefined;
  let upsertCount = 0;
  let getCount = 0;
  const transport: AgentReplanTransport = {
    async upsertAgentRun(input) {
      upsertCount += 1;
      if (upsertCount === 1) return ok(toDto(record, { replanCount: 0 }));
      replacementDto = toDto(input, { replanCount: 1 });
      throw new Error('response lost after commit');
    },
    async getAgentRun(runId, options) {
      getCount += 1;
      assert.equal(runId, record.id);
      assert.equal(options.expectedAuthSubject, OWNER_ID);
      return ok(replacementDto!);
    },
  };

  const result = await coordinateAgentReplan({
    ownerId: OWNER_ID,
    runId: record.id,
    failure: retryableFailure,
    recovery: { failedJobIds: [], recoveredStepIds: [] },
    initialScope: INITIAL_SCOPE,
    captureCurrentScope: () => INITIAL_SCOPE,
    getCurrentOwnerId: () => OWNER_ID,
    store,
    transport,
    createReplacementPlan: async (nextReplanCount) => buildAgentReplacementPlan({
      runId: record.id,
      previousPlan: createInitialPlan(),
      candidatePlan: createCandidatePlan(),
      completedStepIds: ['step-completed'],
      failedStepId: 'step-failed',
      nextReplanCount,
    }),
  });

  assert.equal(result.outcome, 'accepted', JSON.stringify(result));
  assert.equal(getCount, 1);
  assert.equal(store.getRun(record.id)?.replanCount, 1);
});

test('an authoritative cancellation cannot be revived through baseline synchronization', async () => {
  const { store, record } = createStore();
  let plannerCalls = 0;
  const transport: AgentReplanTransport = {
    async upsertAgentRun() {
      return ok(toDto(record, { status: 'cancelled' }));
    },
    async getAgentRun() {
      assert.fail('a conflicting authoritative status must fail closed without GET recovery');
    },
  };

  const result = await coordinateAgentReplan({
    ownerId: OWNER_ID,
    runId: record.id,
    failure: retryableFailure,
    recovery: { failedJobIds: [], recoveredStepIds: [] },
    initialScope: INITIAL_SCOPE,
    captureCurrentScope: () => INITIAL_SCOPE,
    getCurrentOwnerId: () => OWNER_ID,
    store,
    transport,
    createReplacementPlan: async () => {
      plannerCalls += 1;
      return createCandidatePlan();
    },
  });

  assert.deepEqual(result, {
    outcome: 'blocked',
    reason: 'authoritative_baseline_unavailable',
  });
  assert.equal(plannerCalls, 0);
  assert.equal(store.getRun(record.id)?.status, 'running');
});

test('authoritative count three, cancellation, scope drift, recovery debt, and projections fail closed', async () => {
  const scenarios = ['limit', 'cancelled', 'scope', 'recovery', 'projection'] as const;
  for (const scenario of scenarios) {
    const { store, record } = createStore();
    if (scenario === 'projection') {
      store.restoreRunSnapshot({ ...record, executionAuthority: 'server_projection' });
    }
    let plannerCalls = 0;
    let replacementPosts = 0;
    const transport: AgentReplanTransport = {
      async upsertAgentRun(input) {
        replacementPosts += 1;
        return ok(toDto(input, { replanCount: scenario === 'limit' ? 3 : 0 }));
      },
      async getAgentRun() {
        assert.fail('blocked replans must not recover through GET');
      },
    };
    let scopeCalls = 0;
    const result = await coordinateAgentReplan({
      ownerId: OWNER_ID,
      runId: record.id,
      failure: retryableFailure,
      recovery: scenario === 'recovery'
        ? { failedJobIds: ['job-left-running'], recoveredStepIds: [] }
        : { failedJobIds: [], recoveredStepIds: [] },
      initialScope: INITIAL_SCOPE,
      captureCurrentScope: () => {
        scopeCalls += 1;
        return scenario === 'scope' && scopeCalls > 1
          ? { ...INITIAL_SCOPE, canvasId: 'canvas-2' }
          : INITIAL_SCOPE;
      },
      getCurrentOwnerId: () => OWNER_ID,
      store,
      transport,
      createReplacementPlan: async () => {
        plannerCalls += 1;
        if (scenario === 'cancelled') store.updateRun(record.id, { status: 'cancelled' });
        return createCandidatePlan();
      },
    });

    assert.equal(result.outcome, 'blocked');
    if (scenario === 'limit') assert.equal(result.reason, 'replan_limit_reached');
    if (scenario === 'cancelled') assert.equal(result.reason, 'run_cancelled');
    if (scenario === 'scope') assert.equal(result.reason, 'scope_changed');
    if (scenario === 'recovery') assert.equal(result.reason, 'recovery_incomplete');
    if (scenario === 'projection') assert.equal(result.reason, 'server_projection');
    if (scenario === 'limit') assert.equal(replacementPosts, 1);
    if (scenario === 'recovery' || scenario === 'projection') assert.equal(replacementPosts, 0);
    if (scenario !== 'cancelled' && scenario !== 'scope') assert.equal(plannerCalls, 0);
  }
});

test('runtime integrates the bounded coordinator without granting remote projections execution authority', () => {
  const runtime = readSource('apps/web/src/features/ai-assistant-runtime/runtime/AgentRuntime.ts');
  const takeover = readSource('apps/web/src/features/ai-takeover/context/AITakeoverContext.tsx');
  assert.match(runtime, /coordinateAgentReplan/);
  assert.match(runtime, /getSanitizedProjectContext/);
  assert.match(runtime, /requestReplanConfirmation/);
  assert.match(runtime, /hasLocalAgentRunExecutionAuthority/);
  assert.match(takeover, /requestReplanConfirmation/);
});
