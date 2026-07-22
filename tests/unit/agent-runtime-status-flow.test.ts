import { before, describe, it } from 'node:test';
import assert from 'node:assert/strict';

// Mock localStorage
const mockLocalStorage = (() => {
  let store: Record<string, string> = {};
  return {
    getItem(key: string) {
      return store[key] || null;
    },
    setItem(key: string, value: string) {
      store[key] = value.toString();
    },
    clear() {
      store = {};
    },
    removeItem(key: string) {
      delete store[key];
    }
  };
})();

globalThis.localStorage = mockLocalStorage as any;

import { agentRunStore, AgentRunStore } from '../../apps/web/src/features/ai-assistant-runtime/runtime/AgentRunStore.ts';

describe('AgentRunStore Status Flow Tests', () => {
  before(() => {
    globalThis.localStorage = mockLocalStorage as any;
    mockLocalStorage.clear();
    agentRunStore.clearRuns();
  });

  it('P0: should initialize run status to waiting_execution if requiresConfirmation is false', () => {
    mockLocalStorage.clear();
    agentRunStore.clearRuns();

    const plan = {
      intent: 'test',
      requiresConfirmation: false
    };

    const record = agentRunStore.createRun('打开日志', 'test', plan);
    assert.equal(record.status, 'waiting_execution');
  });

  it('P0: should initialize run status to waiting_confirmation if requiresConfirmation is true', () => {
    mockLocalStorage.clear();
    agentRunStore.clearRuns();

    const plan = {
      intent: 'test',
      requiresConfirmation: true
    };

    const record = agentRunStore.createRun('生成图片', 'test', plan);
    assert.equal(record.status, 'waiting_confirmation');
  });

  it('returns immutable Run snapshots instead of mutable store-owned records', () => {
    mockLocalStorage.clear();
    const store = new AgentRunStore(mockLocalStorage as any, () => 'immutable-run-user');
    const created = store.createRun('immutable', 'test', {
      requiresConfirmation: true,
      nested: { value: 'original' },
    });
    created.status = 'running';
    (created.plan as { nested: { value: string } }).nested.value = 'tampered';
    const fetched = store.getRun(created.id)!;
    assert.equal(fetched.status, 'waiting_confirmation');
    assert.equal((fetched.plan as { nested: { value: string } }).nested.value, 'original');
    fetched.status = 'completed';
    assert.equal(store.getRun(created.id)?.status, 'waiting_confirmation');
  });

  it('preserves authenticated active Runs on load so the server can hydrate them first', () => {
    mockLocalStorage.clear();
    const ownerId = 'authenticated-recovery-user';
    const activeRuns = [
      {
        id: 'run_server_running',
        userMessage: 'continue on server',
        intent: 'test',
        plan: {},
        status: 'running',
        toolCalls: [],
        backendSyncState: 'synced',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      {
        id: 'run_waiting_execution',
        userMessage: 'wait for recovery',
        intent: 'test',
        plan: {},
        status: 'waiting_execution',
        toolCalls: [],
        backendSyncState: 'synced',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    ];
    mockLocalStorage.setItem(
      `kk_agent_runs_history:owner:${encodeURIComponent(ownerId)}`,
      JSON.stringify(activeRuns),
    );

    const store = new AgentRunStore(mockLocalStorage as any, () => ownerId);

    assert.equal(store.getRun('run_server_running')?.status, 'running');
    assert.equal(store.getRun('run_waiting_execution')?.status, 'waiting_execution');
    assert.equal(store.getRun('run_server_running')?.backendSyncState, 'synced');
  });

  it('keeps the legacy local-only zombie repair when no authenticated server owner exists', () => {
    globalThis.localStorage = mockLocalStorage as any;
    mockLocalStorage.clear();
    
    // 手动在 localStorage 里写入处于 running 和 waiting_execution 的脏记录
    const dirtyRuns = [
      {
        id: 'run_1',
        userMessage: 'test',
        intent: 'test',
        plan: {},
        status: 'running',
        toolCalls: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      },
      {
        id: 'run_2',
        userMessage: 'test2',
        intent: 'test',
        plan: {},
        status: 'waiting_execution',
        toolCalls: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }
    ];

    mockLocalStorage.setItem('kk_agent_runs_history:owner:local_user', JSON.stringify(dirtyRuns));

    // 实例化一个新的 Store，它在 constructor 里调用 loadRuns()
    const tempStore = new AgentRunStore(mockLocalStorage as any, () => 'local_user');

    const run1 = tempStore.getRun('run_1')!;
    const run2 = tempStore.getRun('run_2')!;

    assert.equal(run1.status, 'failed');
    assert.equal(run1.nextStep, '任务运行异常中断，请重试。');
    assert.equal(run2.status, 'failed');
    assert.equal(run2.nextStep, '任务运行异常中断，请重试。');
  });

  it('P0: getPendingRun should ignore runs updated more than 5 minutes ago', () => {
    mockLocalStorage.clear();
    agentRunStore.clearRuns();

    const plan = {
      intent: 'test',
      requiresConfirmation: false
    };

    const record = agentRunStore.createRun('打开日志', 'test', plan);
    
    // 强制修改 updatedAt 为 6 分钟前
    const sixMinutesAgo = new Date(Date.now() - 6 * 60 * 1000).toISOString();
    agentRunStore.restoreRunSnapshot({ ...record, updatedAt: sixMinutesAgo });

    const pending = agentRunStore.getPendingRun();
    assert.equal(pending, undefined);
    assert.equal(agentRunStore.getRun(record.id)?.status, 'failed');
    assert.equal(agentRunStore.getRun(record.id)?.backendSyncState, 'pending');
  });

  it('keeps an old waiting_confirmation Run reachable until the user decides', () => {
    mockLocalStorage.clear();
    const store = new AgentRunStore(mockLocalStorage as any, () => 'confirmation-user');
    const record = store.createRun('confirm later', 'test', { requiresConfirmation: true });
    store.restoreRunSnapshot({
      ...record,
      updatedAt: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
    });

    const pending = store.getPendingRun();

    assert.equal(pending?.id, record.id);
    assert.equal(record.status, 'waiting_confirmation');
    assert.equal(record.nextStep, undefined);
  });

  it('applies a stale-server authority snapshot only with a matching local CAS and preserves local tool calls', () => {
    mockLocalStorage.clear();
    const store = new AgentRunStore(mockLocalStorage as any, () => 'authority-user');
    const created = store.createRun('reconcile me', 'test', { requiresConfirmation: false });
    const localToolCall = {
      id: 'tool-local-only',
      runId: created.id,
      toolName: 'canvas.getState',
      inputSummary: '{}',
      status: 'success' as const,
      startedAt: created.createdAt,
    };
    const local = store.updateRun(created.id, {
      status: 'failed',
      toolCalls: [localToolCall],
    });
    const expectedLocalUpdatedAt = local.updatedAt;
    const authoritativeUpdatedAt = new Date(Date.parse(local.updatedAt) + 1_000).toISOString();

    const applied = store.applyAuthoritativeRun({
      id: local.id,
      userMessage: local.userMessage,
      intent: local.intent,
      plan: local.plan,
      status: 'completed',
      toolCalls: [],
      stepResults: [],
      createdAt: local.createdAt,
      updatedAt: authoritativeUpdatedAt,
    }, expectedLocalUpdatedAt);

    assert.equal(applied?.status, 'completed');
    assert.deepEqual(applied?.toolCalls.map((toolCall) => toolCall.id), ['tool-local-only']);
    assert.equal(applied?.backendSyncState, 'synced');

    const newerLocal = store.updateRun(local.id, { status: 'cancelled' });
    const rejected = store.applyAuthoritativeRun({
      ...applied!,
      status: 'completed_with_errors',
      updatedAt: new Date(Date.parse(newerLocal.updatedAt) + 1_000).toISOString(),
    }, authoritativeUpdatedAt);

    assert.equal(rejected, undefined);
    assert.equal(store.getRun(local.id)?.status, 'cancelled');
    assert.equal(store.getRun(local.id)?.backendSyncState, 'pending');
  });

  it('keeps local Agent Run history isolated when the authenticated owner changes', () => {
    mockLocalStorage.clear();
    let ownerId = 'user-a';
    const store = new AgentRunStore(mockLocalStorage as any, () => ownerId);

    const runA = store.createRun('private A', 'test', { requiresConfirmation: true });
    ownerId = 'user-b';
    assert.equal(store.listRuns().length, 0);
    const runB = store.createRun('private B', 'test', { requiresConfirmation: false });

    ownerId = 'user-a';
    assert.deepEqual(store.listRuns().map((run) => run.id), [runA.id]);
    ownerId = 'user-b';
    assert.deepEqual(store.listRuns().map((run) => run.id), [runB.id]);
  });

  it('persists whether the latest Run snapshot still needs backend synchronization', () => {
    mockLocalStorage.clear();
    const store = new AgentRunStore(mockLocalStorage as any, () => 'sync-user');
    const run = store.createRun('sync me', 'test', { requiresConfirmation: false });
    const initialUpdatedAt = run.updatedAt;

    assert.equal(run.backendSyncState, 'pending');
    store.markBackendSynced(run.id, initialUpdatedAt);
    assert.equal(store.getRun(run.id)?.backendSyncState, 'synced');

    const updated = store.updateRun(run.id, { status: 'completed' });
    assert.equal(updated.backendSyncState, 'pending');
    store.markBackendSynced(run.id, initialUpdatedAt);
    assert.equal(store.getRun(run.id)?.backendSyncState, 'pending');
    store.markBackendSynced(run.id, updated.updatedAt);
    assert.equal(store.getRun(run.id)?.backendSyncState, 'synced');
  });
});
