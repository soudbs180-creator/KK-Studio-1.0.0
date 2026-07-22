import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import type { AgentRunDto, AgentToolCallDto } from '@kk/shared';
import {
  AgentRunStore,
  hasLocalAgentRunExecutionAuthority,
} from '../../apps/web/src/features/ai-assistant-runtime/runtime/AgentRunStore.ts';
import {
  hydrateAgentRunProjection,
  type AgentRunHydrationClient,
} from '../../apps/web/src/features/ai-assistant-runtime/runtime/agentRunHydration.ts';

const createStorage = (): Storage => {
  const values = new Map<string, string>();
  return {
    get length() {
      return values.size;
    },
    clear: () => values.clear(),
    getItem: (key) => values.get(key) ?? null,
    key: (index) => [...values.keys()][index] ?? null,
    removeItem: (key) => {
      values.delete(key);
    },
    setItem: (key, value) => {
      values.set(key, String(value));
    },
  };
};

const makeRun = (overrides: Partial<AgentRunDto> = {}): AgentRunDto => ({
  id: 'run-authoritative-1',
  userMessage: 'restore my run',
  intent: 'workspace_task',
  plan: { id: 'plan-server', actions: [] },
  status: 'running',
  toolCalls: [],
  stepResults: [],
  createdAt: '2026-07-22T00:00:00.000Z',
  updatedAt: '2026-07-22T00:01:00.000Z',
  ...overrides,
});

const successClient = (
  payload: unknown,
  onRequest?: (options: { expectedAuthSubject?: string }) => void,
): AgentRunHydrationClient => ({
  listAgentRuns: async (options) => {
    onRequest?.(options || {});
    return { success: true, data: { ok: true, data: payload } };
  },
});

test('hydrates remote-only Runs as owner-scoped, non-executable server projections', async () => {
  const ownerId = 'hydration-owner-a';
  const store = new AgentRunStore(createStorage(), () => ownerId);
  let requestedOwner = '';

  const result = await hydrateAgentRunProjection({
    ownerId,
    store,
    client: successClient([makeRun()], (options) => {
      requestedOwner = String(options.expectedAuthSubject || '');
    }),
    getOwnerId: () => ownerId,
  });

  const hydrated = store.getRun('run-authoritative-1');
  assert.equal(result.outcome, 'hydrated');
  assert.equal(requestedOwner, ownerId);
  assert.equal(hydrated?.status, 'running');
  assert.equal(hydrated?.backendSyncState, 'synced');
  assert.equal(hasLocalAgentRunExecutionAuthority(hydrated), false);
});

test('newer server state merges into a local validated Run without replacing its plan', async () => {
  const ownerId = 'hydration-owner-b';
  const store = new AgentRunStore(createStorage(), () => ownerId);
  const localPlan = { id: 'plan-local-validated', actions: [] };
  const created = store.createRun('local run', 'workspace_task', localPlan);
  const localToolCall: AgentToolCallDto = {
    id: 'tool-local',
    runId: created.id,
    toolName: 'canvas.getState',
    inputSummary: '{}',
    status: 'success',
    startedAt: created.createdAt,
  };
  const local = store.updateRun(created.id, { toolCalls: [localToolCall] });
  store.markBackendSynced(local.id, local.updatedAt);
  const remoteToolCall: AgentToolCallDto = {
    ...localToolCall,
    id: 'tool-remote',
    runId: local.id,
  };
  const remote = makeRun({
    id: local.id,
    userMessage: local.userMessage,
    plan: { id: 'plan-server-untrusted', actions: [{ type: 'unknown.action' }] },
    status: 'completed',
    toolCalls: [remoteToolCall],
    createdAt: local.createdAt,
    updatedAt: new Date(Date.parse(local.updatedAt) + 1_000).toISOString(),
  });

  await hydrateAgentRunProjection({
    ownerId,
    store,
    client: successClient([remote]),
    getOwnerId: () => ownerId,
  });

  const merged = store.getRun(local.id);
  assert.equal(merged?.status, 'completed');
  assert.deepEqual(merged?.plan, localPlan);
  assert.deepEqual(merged?.toolCalls.map((call) => call.id).sort(), ['tool-local', 'tool-remote']);
  assert.equal(hasLocalAgentRunExecutionAuthority(merged), true);
  assert.equal(merged?.backendSyncState, 'synced');
});

test('preserves a newer pending local snapshot and discards a response after owner change', async () => {
  let ownerId = 'hydration-owner-c';
  const store = new AgentRunStore(createStorage(), () => ownerId);
  const created = store.createRun('newer local', 'workspace_task', { id: 'local-plan', actions: [] });
  const newerLocal = store.updateRun(created.id, { status: 'cancelled' });
  const staleRemote = makeRun({
    id: created.id,
    userMessage: created.userMessage,
    createdAt: created.createdAt,
    updatedAt: new Date(Date.parse(newerLocal.updatedAt) - 1_000).toISOString(),
  });

  await hydrateAgentRunProjection({
    ownerId,
    store,
    client: successClient([staleRemote]),
    getOwnerId: () => ownerId,
  });
  assert.equal(store.getRun(created.id)?.status, 'cancelled');
  assert.equal(store.getRun(created.id)?.backendSyncState, 'pending');

  let releaseResponse!: (value: Awaited<ReturnType<AgentRunHydrationClient['listAgentRuns']>>) => void;
  const delayedClient: AgentRunHydrationClient = {
    listAgentRuns: async () => await new Promise((resolve) => {
      releaseResponse = resolve;
    }),
  };
  const hydration = hydrateAgentRunProjection({
    ownerId,
    store,
    client: delayedClient,
    getOwnerId: () => ownerId,
  });
  ownerId = 'hydration-owner-d';
  releaseResponse({ success: true, data: { ok: true, data: [makeRun()] } });

  assert.equal((await hydration).outcome, 'owner_changed');
  assert.deepEqual(store.listRuns(), []);
});

test('rejects a malformed authoritative collection without mutating the local projection', async () => {
  const ownerId = 'hydration-owner-invalid';
  const store = new AgentRunStore(createStorage(), () => ownerId);
  const local = store.createRun('keep me', 'workspace_task', { id: 'local-plan', actions: [] });

  const result = await hydrateAgentRunProjection({
    ownerId,
    store,
    client: successClient([{ ...makeRun(), status: 'invented-status' }]),
    getOwnerId: () => ownerId,
  });

  assert.equal(result.outcome, 'invalid_payload');
  assert.deepEqual(store.listRuns().map((run) => run.id), [local.id]);
});

test('AI takeover context subscribes to hydrated projections and does not execute server-only plans', () => {
  const contextSource = readFileSync(
    'apps/web/src/features/ai-takeover/context/AITakeoverContext.tsx',
    'utf8',
  );
  const runtimeSource = readFileSync(
    'apps/web/src/features/ai-assistant-runtime/runtime/AgentRuntime.ts',
    'utf8',
  );

  assert.match(contextSource, /agentRunStore\.subscribe/);
  assert.match(contextSource, /agentRuntimeInstance\.requestRunHydration/);
  assert.match(contextSource, /hasLocalAgentRunExecutionAuthority/);
  assert.match(runtimeSource, /server projection and cannot execute/);
});
