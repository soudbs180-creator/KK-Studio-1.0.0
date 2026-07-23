import assert from 'node:assert/strict';
import test from 'node:test';
import type {
  AgentRunDto,
  AgentRunReplanEventDto,
  AgentRunSnapshotEventDto,
  AgentRunStepOutcomeEventDto,
} from '@kk/shared';
import {
  AgentRunStore,
  agentRunStore,
  hasLocalAgentRunExecutionAuthority,
} from '../../apps/web/src/features/ai-assistant-runtime/runtime/AgentRunStore.ts';
import { AgentRuntime } from '../../apps/web/src/features/ai-assistant-runtime/runtime/AgentRuntime.ts';
import {
  AgentRunEventCursorStore,
  refreshAgentRunEventProjection,
  type AgentRunEventRecoveryClient,
} from '../../apps/web/src/features/ai-assistant-runtime/runtime/agentRunEventRecovery.ts';
import { kkWebApiClient } from '../../apps/web/src/services/api/kkApiClient.ts';
import { emitAuthSessionChange } from '../../apps/web/src/services/auth/authSessionEvents.ts';

const createStorage = (): Storage => {
  const values = new Map<string, string>();
  return {
    get length() {
      return values.size;
    },
    clear: () => values.clear(),
    getItem: (key) => values.get(key) ?? null,
    key: (index) => [...values.keys()][index] ?? null,
    removeItem: (key) => values.delete(key),
    setItem: (key, value) => values.set(key, String(value)),
  };
};

const makeRun = (overrides: Partial<AgentRunDto> = {}): AgentRunDto => ({
  id: 'event-run-1',
  userMessage: 'recover from event',
  intent: 'workspace_task',
  plan: { id: 'server-plan', actions: [] },
  status: 'running',
  toolCalls: [],
  stepResults: [],
  createdAt: '2026-07-22T00:00:00.000Z',
  updatedAt: '2026-07-22T00:01:00.000Z',
  ...overrides,
});

const makeEvent = (
  overrides: Partial<AgentRunSnapshotEventDto> = {},
): AgentRunSnapshotEventDto => ({
  runId: 'event-run-1',
  sequence: 1,
  type: 'run_snapshot',
  status: 'completed',
  runUpdatedAt: '2026-07-22T00:02:00.000Z',
  createdAt: '2026-07-22T00:02:01.000Z',
  ...overrides,
});

const makeStepOutcomeEvent = (sequence: number): AgentRunStepOutcomeEventDto => ({
  runId: 'event-run-1',
  sequence,
  type: 'step_outcome',
  status: 'running',
  runUpdatedAt: '2026-07-22T00:02:00.000Z',
  createdAt: '2026-07-22T00:02:01.000Z',
  step: {
    stepId: 'step-1',
    toolName: 'canvas.arrangeNodes',
    outcome: 'success',
    verificationRule: 'canvas_state',
    retryable: false,
    verifiedAt: '2026-07-22T00:02:00.000Z',
  },
});

const makeReplanEvent = (sequence: number): AgentRunReplanEventDto => ({
  runId: 'event-run-1',
  sequence,
  type: 'replan',
  status: 'running',
  runUpdatedAt: '2026-07-22T00:02:00.000Z',
  createdAt: '2026-07-22T00:02:01.000Z',
  replan: {
    count: 1,
    reasonCode: 'plan_replaced',
    triggerCode: 'accepted_plan_change',
  },
});

const ok = <Payload>(payload: Payload) => Promise.resolve({
  success: true as const,
  data: { ok: true as const, data: payload },
  meta: { requestId: 'event-recovery-test', timestamp: '2026-07-22T00:00:00.000Z' },
});

test('advances an owner-qualified cursor only after a valid authoritative Run merge', async () => {
  const ownerId = 'event-owner-a';
  const storage = createStorage();
  const store = new AgentRunStore(storage, () => ownerId);
  const cursors = new AgentRunEventCursorStore(storage);
  store.hydrateAuthoritativeRuns(ownerId, [makeRun()]);
  const requestedCursors: number[] = [];
  let detailRequests = 0;
  const client: AgentRunEventRecoveryClient = {
    listAgentRunEvents: async (_runId, input, options) => {
      assert.equal(options?.expectedAuthSubject, ownerId);
      requestedCursors.push(input?.afterSequence ?? 0);
      return ok(requestedCursors.length === 1
        ? [makeEvent(), makeEvent({ sequence: 2, createdAt: '2026-07-22T00:02:02.000Z' })]
        : []);
    },
    getAgentRun: async (_runId, options) => {
      detailRequests += 1;
      assert.equal(options?.expectedAuthSubject, ownerId);
      return ok(makeRun({ status: 'completed', updatedAt: '2026-07-22T00:02:00.000Z' }));
    },
  };

  const first = await refreshAgentRunEventProjection({
    ownerId,
    store,
    cursorStore: cursors,
    client,
    getOwnerId: () => ownerId,
  });
  const second = await refreshAgentRunEventProjection({
    ownerId,
    store,
    cursorStore: new AgentRunEventCursorStore(storage),
    client,
    getOwnerId: () => ownerId,
  });

  assert.equal(first.outcome, 'refreshed');
  assert.equal(second.outcome, 'no_changes');
  assert.equal(second.queriedRunCount, 0);
  assert.deepEqual(requestedCursors, [0]);
  assert.equal(detailRequests, 1);
  assert.equal(cursors.getSequence(ownerId, 'event-run-1'), 2);
  assert.equal(new AgentRunEventCursorStore(storage).getSequence(ownerId, 'event-run-1'), 2);
  assert.equal(store.getRun('event-run-1')?.status, 'completed');
  assert.equal(hasLocalAgentRunExecutionAuthority(store.getRun('event-run-1')), false);
});

test('treats mixed snapshot, step outcome, and replan events as read-only invalidation signals', async () => {
  const ownerId = 'event-owner-semantic';
  const storage = createStorage();
  const store = new AgentRunStore(storage, () => ownerId);
  const cursors = new AgentRunEventCursorStore(storage);
  store.hydrateAuthoritativeRuns(ownerId, [makeRun()]);
  let detailRequests = 0;
  const client: AgentRunEventRecoveryClient = {
    listAgentRunEvents: async () => ok([makeEvent(), makeStepOutcomeEvent(2), makeReplanEvent(3)]),
    getAgentRun: async () => {
      detailRequests += 1;
      return ok(makeRun({
        status: 'completed',
        updatedAt: '2026-07-22T00:02:00.000Z',
        stepResults: [makeStepOutcomeEvent(2).step],
        replanCount: 1,
      }));
    },
  };

  const result = await refreshAgentRunEventProjection({
    ownerId,
    store,
    cursorStore: cursors,
    client,
    getOwnerId: () => ownerId,
  });

  assert.equal(result.outcome, 'refreshed');
  assert.equal(detailRequests, 1);
  assert.equal(cursors.getSequence(ownerId, 'event-run-1'), 3);
  assert.equal(store.getRun('event-run-1')?.stepResults?.[0]?.stepId, 'step-1');
  assert.equal(store.getRun('event-run-1')?.replanCount, 1);
  assert.equal(hasLocalAgentRunExecutionAuthority(store.getRun('event-run-1')), false);
});

test('rejects cross-Run or non-monotonic event pages without reading detail or advancing', async () => {
  const ownerId = 'event-owner-invalid';
  const storage = createStorage();
  const store = new AgentRunStore(storage, () => ownerId);
  const cursors = new AgentRunEventCursorStore(storage);
  store.hydrateAuthoritativeRuns(ownerId, [makeRun()]);
  let detailRequests = 0;
  const client: AgentRunEventRecoveryClient = {
    listAgentRunEvents: async () => ok([
      makeEvent({ sequence: 2 }),
      makeEvent({ runId: 'another-run', sequence: 1 }),
    ]),
    getAgentRun: async () => {
      detailRequests += 1;
      return ok(makeRun({ status: 'completed' }));
    },
  };

  const result = await refreshAgentRunEventProjection({
    ownerId,
    store,
    cursorStore: cursors,
    client,
    getOwnerId: () => ownerId,
  });

  assert.equal(result.outcome, 'invalid_payload');
  assert.equal(detailRequests, 0);
  assert.equal(cursors.getSequence(ownerId, 'event-run-1'), 0);
  assert.equal(store.getRun('event-run-1')?.status, 'running');
});

test('keeps the cursor when Run detail is older than the newest event', async () => {
  const ownerId = 'event-owner-stale-detail';
  const storage = createStorage();
  const store = new AgentRunStore(storage, () => ownerId);
  const cursors = new AgentRunEventCursorStore(storage);
  store.hydrateAuthoritativeRuns(ownerId, [makeRun()]);
  const client: AgentRunEventRecoveryClient = {
    listAgentRunEvents: async () => ok([makeEvent({ runUpdatedAt: '2026-07-22T00:03:00.000Z' })]),
    getAgentRun: async () => ok(makeRun({ status: 'completed', updatedAt: '2026-07-22T00:02:00.000Z' })),
  };

  const result = await refreshAgentRunEventProjection({
    ownerId,
    store,
    cursorStore: cursors,
    client,
    getOwnerId: () => ownerId,
  });

  assert.equal(result.outcome, 'invalid_payload');
  assert.equal(cursors.getSequence(ownerId, 'event-run-1'), 0);
  assert.equal(store.getRun('event-run-1')?.status, 'running');
});

test('does not advance the cursor when browser storage rejects persistence', async () => {
  const ownerId = 'event-owner-storage-failure';
  const baseStorage = createStorage();
  const failingStorage: Storage = {
    ...baseStorage,
    setItem: () => {
      throw new Error('simulated quota failure');
    },
  };
  const store = new AgentRunStore(null, () => ownerId);
  const cursors = new AgentRunEventCursorStore(failingStorage);
  store.hydrateAuthoritativeRuns(ownerId, [makeRun()]);
  const client: AgentRunEventRecoveryClient = {
    listAgentRunEvents: async () => ok([makeEvent()]),
    getAgentRun: async () => ok(makeRun({
      status: 'completed',
      updatedAt: '2026-07-22T00:02:00.000Z',
    })),
  };

  const result = await refreshAgentRunEventProjection({
    ownerId,
    store,
    cursorStore: cursors,
    client,
    getOwnerId: () => ownerId,
  });

  assert.equal(result.outcome, 'unavailable');
  assert.equal(result.refreshedRunCount, 1);
  assert.equal(cursors.getSequence(ownerId, 'event-run-1'), 0);
  assert.equal(store.getRun('event-run-1')?.status, 'completed');
});

test('discards a delayed detail response after the authenticated owner changes', async () => {
  let ownerId = 'event-owner-before';
  const storage = createStorage();
  const store = new AgentRunStore(storage, () => ownerId);
  const cursors = new AgentRunEventCursorStore(storage);
  store.hydrateAuthoritativeRuns(ownerId, [makeRun()]);
  let releaseDetail!: (value: Awaited<ReturnType<AgentRunEventRecoveryClient['getAgentRun']>>) => void;
  const client: AgentRunEventRecoveryClient = {
    listAgentRunEvents: async () => ok([makeEvent()]),
    getAgentRun: async () => await new Promise((resolve) => {
      releaseDetail = resolve;
    }),
  };

  const recovery = refreshAgentRunEventProjection({
    ownerId,
    store,
    cursorStore: cursors,
    client,
    getOwnerId: () => ownerId,
  });
  await new Promise((resolve) => setImmediate(resolve));
  ownerId = 'event-owner-after';
  releaseDetail(await ok(makeRun({ status: 'completed', updatedAt: '2026-07-22T00:02:00.000Z' })));

  assert.equal((await recovery).outcome, 'owner_changed');
  assert.equal(cursors.getSequence('event-owner-before', 'event-run-1'), 0);
  ownerId = 'event-owner-before';
  assert.equal(store.getRun('event-run-1')?.status, 'running');
});

test('bounds recovery to the 20 most recent active synced Runs', async () => {
  const ownerId = 'event-owner-bounded';
  const storage = createStorage();
  const store = new AgentRunStore(storage, () => ownerId);
  const cursors = new AgentRunEventCursorStore(storage);
  const activeRuns = Array.from({ length: 24 }, (_, index) => makeRun({
    id: `active-${index}`,
    updatedAt: new Date(Date.parse('2026-07-22T00:01:00.000Z') + index * 1_000).toISOString(),
  }));
  store.hydrateAuthoritativeRuns(ownerId, [
    ...activeRuns,
    makeRun({ id: 'terminal', status: 'completed' }),
  ]);
  const pending = store.createRun('local pending', 'workspace_task', { id: 'local-plan', actions: [] });
  const requestedRunIds: string[] = [];
  const client: AgentRunEventRecoveryClient = {
    listAgentRunEvents: async (runId) => {
      requestedRunIds.push(runId);
      return ok([]);
    },
    getAgentRun: async () => ok(makeRun()),
  };

  const result = await refreshAgentRunEventProjection({
    ownerId,
    store,
    cursorStore: cursors,
    client,
    getOwnerId: () => ownerId,
  });

  assert.equal(result.outcome, 'no_changes');
  assert.equal(result.queriedRunCount, 20);
  assert.equal(requestedRunIds.length, 20);
  assert.equal(requestedRunIds.includes('terminal'), false);
  assert.equal(requestedRunIds.includes(pending.id), false);
});

test('Runtime hydrates once, then uses event recovery for later refresh requests', async (t) => {
  const ownerId = 'event-runtime-owner';
  const remoteRun = makeRun({ id: 'runtime-event-run' });
  const originalListRuns = kkWebApiClient.listAgentRuns;
  const originalListEvents = kkWebApiClient.listAgentRunEvents;
  const originalGetRun = kkWebApiClient.getAgentRun;
  let listCalls = 0;
  let eventCalls = 0;
  let detailCalls = 0;
  emitAuthSessionChange({ hasSession: true, userId: ownerId, isTempUser: false });
  agentRunStore.clearRuns();
  kkWebApiClient.listAgentRuns = (async () => {
    listCalls += 1;
    return ok([remoteRun]);
  }) as typeof kkWebApiClient.listAgentRuns;
  kkWebApiClient.listAgentRunEvents = (async (runId, input, options) => {
    assert.equal(runId, remoteRun.id);
    assert.equal(input?.afterSequence, 0);
    assert.equal(options?.expectedAuthSubject, ownerId);
    eventCalls += 1;
    return ok(eventCalls === 1 ? [] : [makeEvent({ runId: remoteRun.id })]);
  }) as typeof kkWebApiClient.listAgentRunEvents;
  kkWebApiClient.getAgentRun = (async () => {
    detailCalls += 1;
    return ok(makeRun({
      id: remoteRun.id,
      status: 'completed',
      updatedAt: '2026-07-22T00:02:00.000Z',
    }));
  }) as typeof kkWebApiClient.getAgentRun;
  t.after(() => {
    agentRunStore.clearRuns();
    emitAuthSessionChange({ hasSession: false, userId: null, isTempUser: false });
    kkWebApiClient.listAgentRuns = originalListRuns;
    kkWebApiClient.listAgentRunEvents = originalListEvents;
    kkWebApiClient.getAgentRun = originalGetRun;
  });

  const runtime = new AgentRuntime();
  await runtime.requestRunHydration();
  await runtime.requestRunHydration();

  assert.equal(listCalls, 1);
  assert.equal(eventCalls, 2);
  assert.equal(detailCalls, 1);
  assert.equal(agentRunStore.getRun(remoteRun.id)?.status, 'completed');
  assert.equal(hasLocalAgentRunExecutionAuthority(agentRunStore.getRun(remoteRun.id)), false);
});
