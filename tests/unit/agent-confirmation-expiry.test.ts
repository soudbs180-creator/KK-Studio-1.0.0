import assert from 'node:assert/strict';
import test from 'node:test';
import type { AgentSessionDto, AgentSessionUpsertDto } from '@kk/shared';
import type { AssistantPlan } from '../../apps/web/src/features/ai-takeover/types.ts';
import { durableGenerationQueue } from '../../apps/web/src/features/ai-assistant-runtime/queue/DurableGenerationQueue.ts';
import { toolRegistryInstance } from '../../apps/web/src/features/ai-assistant-runtime/tools/ToolRegistry.ts';
import {
  createAssistantPlanHash,
  createAssistantStepAuthorization,
  createAssistantTargetSnapshotHash,
  isAssistantConfirmationGrantFresh,
  type AssistantConfirmationGrant,
  type AssistantExecutionContext,
} from '../../apps/web/src/features/ai-assistant-runtime/runtime/AssistantExecutionContext.ts';
import { AgentRuntime } from '../../apps/web/src/features/ai-assistant-runtime/runtime/AgentRuntime.ts';
import { agentRunStore } from '../../apps/web/src/features/ai-assistant-runtime/runtime/AgentRunStore.ts';
import {
  AgentSessionProjectionStore,
  agentSessionProjectionStore,
} from '../../apps/web/src/features/ai-assistant-runtime/runtime/agentSessionProjection.ts';
import {
  createAgentSessionConfirmationRecords,
  doesAgentSessionAuthorizeConfirmation,
  expireAgentSessionConfirmations,
  persistAgentSessionConfirmationGrant,
} from '../../apps/web/src/features/ai-assistant-runtime/runtime/agentConfirmationGrant.ts';
import { emitAuthSessionChange } from '../../apps/web/src/services/auth/authSessionEvents.ts';
import { readSource } from '../support/workspacePaths.js';

const OWNER_ID = 'confirmation-owner';
const SESSION_ID = 'confirmation-session';
const GRANTED_AT = '2026-07-24T08:00:00.000Z';
const EXPIRES_AT = '2026-07-24T08:05:00.000Z';
const NOW = Date.parse('2026-07-24T08:01:00.000Z');
const QUOTE_ID = 'c3ad0bd8-0ab3-4bd8-8bd6-b3be56518fd1';
const OTHER_QUOTE_ID = 'd82e0ae0-36d3-45b8-bb3e-d023c07d6387';
const BOUND_TOOL_NAME = 'test.boundSessionConfirmation';

let boundSessionExecutionCount = 0;

const authorizationScope = {
  ownerId: OWNER_ID,
  workspaceSurface: 'canvas',
  projectId: 'project-1',
  canvasId: 'canvas-1',
  selectedNodeIds: ['node-1'],
  selectedModelId: 'model-1',
  mutableConfigurationFingerprint: 'config-fingerprint',
} as const;

function createGrant(): AssistantConfirmationGrant {
  return {
    runId: 'run-confirmation-1',
    planId: 'plan-confirmation-1',
    planHash: createAssistantPlanHash({ id: 'plan-confirmation-1', action: 'costly.write' }),
    targetSnapshotHash: createAssistantTargetSnapshotHash(authorizationScope),
    ownerId: OWNER_ID,
    confirmed: true,
    toolNames: ['costly.write'],
    authorizedSteps: [{
      stepId: 'step-1',
      toolName: 'costly.write',
      idempotencyKey: 'run-confirmation-1:step-1',
      inputFingerprint: 'input-fingerprint',
    }],
    authorizationScope,
    quoteId: QUOTE_ID,
    maxCostCredits: 12,
    grantedAt: GRANTED_AT,
    expiresAt: EXPIRES_AT,
    source: 'user',
  };
}

function createSession(confirmations: AgentSessionDto['confirmations'] = []): AgentSessionDto {
  return {
    sessionId: SESSION_ID,
    ownerId: OWNER_ID,
    collaborationMode: 'assist',
    messages: [],
    summary: { text: 'Bound confirmation session.', coveredMessageCount: 0, updatedAt: GRANTED_AT },
    toolResults: [],
    knowledgeRefs: [],
    tokenBudget: { maxTokens: 4096, usedTokens: 0, reservedTokens: 256 },
    confirmations,
    checkpoints: [],
    lastHeartbeatAt: GRANTED_AT,
    createdAt: GRANTED_AT,
    updatedAt: GRANTED_AT,
  };
}

function withSessionProof(grant: AssistantConfirmationGrant): AssistantConfirmationGrant {
  const confirmationIds = createAgentSessionConfirmationRecords(grant).map((record) => record.id);
  return {
    ...grant,
    sessionConfirmation: { sessionId: SESSION_ID, confirmationIds, sessionUpdatedAt: GRANTED_AT },
  };
}

function ensureBoundConfirmationTool(): void {
  if (toolRegistryInstance.getTool(BOUND_TOOL_NAME)) return;
  toolRegistryInstance.register({
    name: BOUND_TOOL_NAME,
    description: 'bound Session confirmation integration test',
    permission: 'confirm',
    control: { effect: 'read' },
    inputSchema: { type: 'object' },
    handler: async () => {
      boundSessionExecutionCount += 1;
      return { success: true, executionOutcome: 'success' };
    },
  });
}

function createBoundConfirmationPlan(): AssistantPlan {
  return {
    id: 'plan-bound-session-confirmation',
    intent: 'help',
    reply: 'confirm the bound Session action',
    actions: [],
    steps: [{
      stepId: 'bound-session-step',
      action: { type: BOUND_TOOL_NAME, payload: {} },
      dependsOn: [],
      idempotencyKey: 'bound-session-step-key',
      verification: { required: true, rule: 'tool' },
    }],
    requiresConfirmation: true,
    confirmation: {
      title: 'Confirm quoted action',
      summary: 'Quoted action summary',
      confirmText: 'Confirm',
      cancelText: 'Cancel',
      quoteId: QUOTE_ID,
      maxCostCredits: 12,
    },
  } as unknown as AssistantPlan;
}

function createBoundExecutionContext(): AssistantExecutionContext {
  const activeCanvas = { id: 'canvas-1' } as unknown as NonNullable<AssistantExecutionContext['activeCanvas']>;
  return {
    currentPage: 'canvas',
    collaborationMode: 'assist',
    trigger: 'takeover-confirmed',
    selectedNodeIds: ['node-1'],
    getActiveCanvas: () => activeCanvas,
    getSelectedNodeIds: () => ['node-1'],
    getCanvasRuntimeState: () => undefined,
    generationQueue: durableGenerationQueue,
    runStore: agentRunStore,
    notify: { success() {}, info() {}, warning() {}, error() {} },
  };
}

function persistBoundGrant(grant: AssistantConfirmationGrant) {
  return persistAgentSessionConfirmationGrant({ sessionId: SESSION_ID, ownerId: OWNER_ID, grant }, {
    client: {
      async getAgentSession() {
        return { success: true, data: { ok: true, data: createSession() } };
      },
      async upsertAgentSession(input: AgentSessionUpsertDto) {
        return { success: true, data: { ok: true, data: { ...input, ownerId: OWNER_ID } } };
      },
    },
    store: agentSessionProjectionStore,
    getOwnerId: () => OWNER_ID,
  });
}

test('confirmation freshness requires an explicit bounded expiresAt', () => {
  const grant = createGrant();
  assert.equal(isAssistantConfirmationGrantFresh(grant, NOW), true);
  assert.equal(isAssistantConfirmationGrantFresh(grant, Date.parse(EXPIRES_AT)), false);
  assert.equal(isAssistantConfirmationGrantFresh({ ...grant, expiresAt: 'not-a-date' }, NOW), false);
  const legacyGrant = { ...grant } as Partial<AssistantConfirmationGrant>;
  delete legacyGrant.expiresAt;
  assert.equal(isAssistantConfirmationGrantFresh(legacyGrant as AssistantConfirmationGrant, NOW), false);
  assert.equal(isAssistantConfirmationGrantFresh({ ...grant, maxCostCredits: undefined }, NOW), false);
  assert.equal(isAssistantConfirmationGrantFresh({ ...grant, quoteId: undefined }, NOW), false);
  assert.equal(isAssistantConfirmationGrantFresh({ ...grant, quoteId: '   ' }, NOW), false);
  assert.equal(isAssistantConfirmationGrantFresh({ ...grant, maxCostCredits: -1 }, NOW), false);
  assert.equal(isAssistantConfirmationGrantFresh({ ...grant, maxCostCredits: 1.5 }, NOW), false);
});

test('step confirmation fingerprints bind target, runtime, epoch, fence, attempt, and Quote projection', () => {
  const baseContext = {
    executionTarget: 'paired-desktop',
    executionAuthorityEnvelope: {
      authorityRuntimeId: 'paired-runtime-1',
      globalCoordinationEpoch: 4,
      executionFencingToken: 9,
      attempt: 2,
    },
    confirmationQuoteId: QUOTE_ID,
    confirmationMaxCostCredits: 12,
  };
  const authorize = (context: Record<string, unknown>) => createAssistantStepAuthorization({
    runId: 'run-fingerprint',
    stepId: 'step-fingerprint',
    toolName: 'costly.write',
    input: { idempotencyKey: 'run-fingerprint:step-fingerprint' },
    context,
    authorizationScope,
  }).inputFingerprint;
  const baseline = authorize(baseContext);
  const mutations = [
    { ...baseContext, executionTarget: 'cloud' },
    { ...baseContext, executionAuthorityEnvelope: { ...baseContext.executionAuthorityEnvelope, authorityRuntimeId: 'paired-runtime-2' } },
    { ...baseContext, executionAuthorityEnvelope: { ...baseContext.executionAuthorityEnvelope, globalCoordinationEpoch: 5 } },
    { ...baseContext, executionAuthorityEnvelope: { ...baseContext.executionAuthorityEnvelope, executionFencingToken: 10 } },
    { ...baseContext, executionAuthorityEnvelope: { ...baseContext.executionAuthorityEnvelope, attempt: 3 } },
    { ...baseContext, confirmationQuoteId: OTHER_QUOTE_ID },
    { ...baseContext, confirmationMaxCostCredits: 13 },
  ];
  for (const mutation of mutations) assert.notEqual(authorize(mutation), baseline);
});

test('Session confirmation records bind plan, tool, target, quote, cost, and expiry', () => {
  const records = createAgentSessionConfirmationRecords(createGrant());
  assert.deepEqual(records, [{
    id: records[0]?.id,
    status: 'granted',
    planHash: createGrant().planHash,
    toolId: 'costly.write',
    targetSnapshotHash: createGrant().targetSnapshotHash,
    quoteId: createGrant().quoteId,
    maxCostCredits: 12,
    expiresAt: EXPIRES_AT,
    decidedAt: GRANTED_AT,
  }]);
  assert.ok((records[0]?.id.length || 0) <= 200);
  assert.doesNotMatch(JSON.stringify(records), /authorizedSteps|inputFingerprint|selectedNodeIds/);
});

test('Session confirmation validation fails closed for every authorization dimension', () => {
  const grant = withSessionProof(createGrant());
  const records = createAgentSessionConfirmationRecords(grant);
  assert.equal(doesAgentSessionAuthorizeConfirmation(createSession(records), grant, NOW), true);
  const mutations = [
    { ...records[0], planHash: 'other-plan' },
    { ...records[0], toolId: 'other.tool' },
    { ...records[0], targetSnapshotHash: 'other-target' },
    { ...records[0], quoteId: OTHER_QUOTE_ID },
    { ...records[0], maxCostCredits: 13 },
    { ...records[0], expiresAt: '2026-07-24T08:06:00.000Z' },
    { ...records[0], status: 'expired' as const },
  ];
  for (const mutatedRecord of mutations) {
    assert.equal(doesAgentSessionAuthorizeConfirmation(createSession([mutatedRecord]), grant, NOW), false);
  }
  assert.equal(doesAgentSessionAuthorizeConfirmation(
    { ...createSession(records), ownerId: 'other-owner' },
    grant,
    NOW,
  ), false);
});

test('expired Session confirmations are made explicit without reviving rejected records', () => {
  const records = createAgentSessionConfirmationRecords(createGrant());
  const rejected = { ...records[0]!, id: 'rejected-confirmation', status: 'rejected' as const };
  const expired = expireAgentSessionConfirmations(
    [...records, rejected],
    Date.parse(EXPIRES_AT),
  );
  assert.equal(expired[0]?.status, 'expired');
  assert.equal(expired[0]?.decidedAt, EXPIRES_AT);
  assert.equal(expired[1]?.status, 'rejected');
});

test('bound confirmation persists through an owner-stable authoritative Session response', async () => {
  const store = new AgentSessionProjectionStore(() => OWNER_ID);
  let submitted: AgentSessionUpsertDto | undefined;
  const client = {
    async getAgentSession() {
      return { success: true, data: { ok: true, data: createSession() } };
    },
    async upsertAgentSession(input: AgentSessionUpsertDto) {
      submitted = input;
      return { success: true, data: { ok: true, data: { ...input, ownerId: OWNER_ID }, stale: false } };
    },
  };
  const result = await persistAgentSessionConfirmationGrant({
    sessionId: SESSION_ID,
    ownerId: OWNER_ID,
    grant: createGrant(),
  }, { client, store, getOwnerId: () => OWNER_ID, now: NOW });

  assert.equal(result.ok, true);
  assert.equal(submitted?.confirmations.length, 1);
  assert.equal(store.getSession(SESSION_ID)?.confirmations[0]?.status, 'granted');
  if (result.ok) {
    assert.equal(doesAgentSessionAuthorizeConfirmation(result.session, result.grant, NOW), true);
  }
});

test('bound confirmation does not write after the owner changes during the authoritative read', async () => {
  let currentOwnerId = OWNER_ID;
  let upsertCalls = 0;
  const result = await persistAgentSessionConfirmationGrant({
    sessionId: SESSION_ID,
    ownerId: OWNER_ID,
    grant: createGrant(),
  }, {
    getOwnerId: () => currentOwnerId,
    client: {
      async getAgentSession() {
        currentOwnerId = 'other-owner';
        return { success: true, data: { ok: true, data: createSession() } };
      },
      async upsertAgentSession() {
        upsertCalls += 1;
        return { success: true, data: { ok: true, data: createSession() } };
      },
    },
    store: new AgentSessionProjectionStore(() => currentOwnerId),
    now: NOW,
  });

  assert.deepEqual(result, { ok: false, reason: 'owner_changed' });
  assert.equal(upsertCalls, 0);
});

test('bound confirmation rejects stale or stripped authoritative responses', async () => {
  const result = await persistAgentSessionConfirmationGrant({
    sessionId: SESSION_ID,
    ownerId: OWNER_ID,
    grant: createGrant(),
  }, {
    getOwnerId: () => OWNER_ID,
    client: {
      async getAgentSession() {
        return { success: true, data: { ok: true, data: createSession() } };
      },
      async upsertAgentSession() {
        return { success: true, data: { ok: true, data: createSession(), stale: true } };
      },
    },
    store: new AgentSessionProjectionStore(() => OWNER_ID),
    now: NOW,
  });
  assert.deepEqual(result, { ok: false, reason: 'confirmation_not_authoritative' });
});

test('bound confirmation rejects an authoritative response for a different Session', async () => {
  const result = await persistAgentSessionConfirmationGrant({
    sessionId: SESSION_ID,
    ownerId: OWNER_ID,
    grant: createGrant(),
  }, {
    getOwnerId: () => OWNER_ID,
    client: {
      async getAgentSession() {
        return { success: true, data: { ok: true, data: createSession() } };
      },
      async upsertAgentSession(input: AgentSessionUpsertDto) {
        return {
          success: true,
          data: { ok: true, data: { ...input, ownerId: OWNER_ID, sessionId: 'different-session' } },
        };
      },
    },
    store: new AgentSessionProjectionStore(() => OWNER_ID),
    now: NOW,
  });
  assert.deepEqual(result, { ok: false, reason: 'confirmation_not_authoritative' });
});

test('AgentRuntime executes a bound Run only with its persisted Session confirmation proof', async (testContext) => {
  const previousHandoffGuard = process.env.KK_DISABLE_HANDOFF_FS_WRITE;
  process.env.KK_DISABLE_HANDOFF_FS_WRITE = '1';
  emitAuthSessionChange({ hasSession: true, userId: OWNER_ID, isTempUser: false });
  agentRunStore.clearRuns();
  agentSessionProjectionStore.replaceOwnerProjection(OWNER_ID, []);
  testContext.after(() => {
    agentRunStore.clearRuns();
    agentSessionProjectionStore.replaceOwnerProjection(OWNER_ID, []);
    emitAuthSessionChange({ hasSession: false, userId: null, isTempUser: false });
    if (previousHandoffGuard === undefined) delete process.env.KK_DISABLE_HANDOFF_FS_WRITE;
    else process.env.KK_DISABLE_HANDOFF_FS_WRITE = previousHandoffGuard;
  });

  ensureBoundConfirmationTool();
  boundSessionExecutionCount = 0;
  const plan = createBoundConfirmationPlan();
  const runtime = new AgentRuntime();
  const run = agentRunStore.createRun('execute bound confirmation', 'help', plan, SESSION_ID);
  const executionContext = createBoundExecutionContext();
  const grant = runtime.createConfirmationGrant(run.id, plan, executionContext);
  assert.equal(grant.quoteId, QUOTE_ID);
  assert.equal(grant.maxCostCredits, 12);

  const tampered = await persistBoundGrant({ ...grant, quoteId: OTHER_QUOTE_ID });
  if (tampered.ok === false) assert.fail(`tampered grant setup failed: ${tampered.reason}`);
  await assert.rejects(
    runtime.executePendingRun(run.id, { ...executionContext, confirmationGrant: tampered.grant }),
    /Explicit user confirmation/,
  );
  assert.equal(boundSessionExecutionCount, 0);

  const persisted = await persistBoundGrant(grant);
  if (persisted.ok === false) assert.fail(`confirmation persistence failed: ${persisted.reason}`);

  await runtime.executePendingRun(run.id, { ...executionContext, confirmationGrant: persisted.grant });
  assert.equal(boundSessionExecutionCount, 1);
  assert.equal(agentRunStore.getRun(run.id)?.status, 'completed');
});

test('confirmed Run execution awaits Session confirmation persistence', () => {
  const takeover = readSource('apps/web/src/features/ai-takeover/context/AITakeoverContext.tsx');
  const runtime = readSource('apps/web/src/features/ai-assistant-runtime/runtime/AgentRuntime.ts');
  assert.match(takeover, /await agentRuntimeInstance\.persistConfirmationGrant/);
  assert.match(runtime, /doesAgentSessionAuthorizeConfirmation/);
  assert.match(runtime, /record\.sessionId/);
});
