import assert from 'node:assert/strict';
import test from 'node:test';
import type { AgentRunDto, AgentToolCallDto } from '@kk/shared';
import { AgentRuntime } from '../../apps/web/src/features/ai-assistant-runtime/runtime/AgentRuntime.ts';
import { agentRunStore, type AgentRunRecord } from '../../apps/web/src/features/ai-assistant-runtime/runtime/AgentRunStore.ts';
import { emitAuthSessionChange } from '../../apps/web/src/services/auth/authSessionEvents.ts';
import { kkWebApiClient } from '../../apps/web/src/services/api/kkApiClient.ts';

const waitFor = async (predicate: () => boolean, message: string, timeoutMs = 1_000) => {
  const deadline = Date.now() + timeoutMs;
  while (!predicate()) {
    if (Date.now() >= deadline) throw new Error(message);
    await new Promise((resolve) => setTimeout(resolve, 5));
  }
};

const waitForRunSyncIdle = async (runtime: AgentRuntime, runId: string) => {
  await waitFor(
    () => !(runtime as any).runHydration && !(runtime as any).runSyncChains.has(runId),
    `Agent Run sync did not become idle: ${runId}`,
  );
};

const toAuthoritativeDto = (
  record: AgentRunRecord,
  overrides: Partial<AgentRunDto> = {},
): AgentRunDto => {
  const { backendSyncState: _backendSyncState, ...dto } = JSON.parse(JSON.stringify(record)) as AgentRunRecord;
  return { ...dto, ...overrides } as AgentRunDto;
};

const createToolCall = (runId: string): AgentToolCallDto => ({
  id: `tool-${runId}`,
  runId,
  stepId: 'step-1',
  toolName: 'canvas.getState',
  inputSummary: '{}',
  outputSummary: '{"canvasId":"canvas-1"}',
  status: 'success',
  startedAt: '2026-07-19T00:00:00.000Z',
  completedAt: '2026-07-19T00:00:01.000Z',
});

test('Agent Run backend reconciliation is fail-closed for stale, partial, and racing responses', async (t) => {
  const originalListAgentRuns = kkWebApiClient.listAgentRuns;
  const originalUpsertAgentRun = kkWebApiClient.upsertAgentRun;
  const originalRecordAgentToolCall = kkWebApiClient.recordAgentToolCall;
  const ownerId = 'agent-sync-reconciliation-user';
  emitAuthSessionChange({ hasSession: true, userId: ownerId, isTempUser: false });
  agentRunStore.clearRuns();

  let upsertImpl: (record: AgentRunRecord) => Promise<any> = async () => ({ success: false });
  let toolCallImpl: (toolCall: AgentToolCallDto) => Promise<any> = async () => ({
    success: true,
    data: { ok: true },
  });
  kkWebApiClient.listAgentRuns = (async () => ({
    success: true,
    data: { ok: true, data: [] },
  })) as typeof kkWebApiClient.listAgentRuns;
  kkWebApiClient.upsertAgentRun = ((record: AgentRunRecord) => upsertImpl(record)) as typeof kkWebApiClient.upsertAgentRun;
  kkWebApiClient.recordAgentToolCall = ((toolCall: AgentToolCallDto) => toolCallImpl(toolCall)) as typeof kkWebApiClient.recordAgentToolCall;

  t.after(() => {
    agentRunStore.clearRuns();
    emitAuthSessionChange({ hasSession: false, userId: null, isTempUser: false });
    kkWebApiClient.listAgentRuns = originalListAgentRuns;
    kkWebApiClient.upsertAgentRun = originalUpsertAgentRun;
    kkWebApiClient.recordAgentToolCall = originalRecordAgentToolCall;
  });

  // Hydration must complete before the first pending local snapshot is uploaded.
  agentRunStore.clearRuns();
  const hydrationFirstRun = agentRunStore.createRun('hydrate first', 'test', { requiresConfirmation: false });
  const syncOrder: string[] = [];
  kkWebApiClient.listAgentRuns = (async () => {
    syncOrder.push('list');
    return { success: true, data: { ok: true, data: [] } };
  }) as typeof kkWebApiClient.listAgentRuns;
  upsertImpl = async () => {
    syncOrder.push('upsert');
    return { success: true, data: { ok: true } };
  };
  const hydrationFirstRuntime = new AgentRuntime();
  hydrationFirstRuntime.requestPendingRunSync();
  await waitFor(() => syncOrder.includes('upsert'), 'pending Run upload did not follow hydration');
  await waitForRunSyncIdle(hydrationFirstRuntime, hydrationFirstRun.id);
  assert.deepEqual(syncOrder, ['list', 'upsert']);

  // A stale response without its authoritative DTO cannot clear the durable retry marker.
  agentRunStore.clearRuns();
  const missingAuthorityRun = agentRunStore.createRun('missing authority', 'test', { requiresConfirmation: false });
  let missingAuthorityCalls = 0;
  upsertImpl = async () => {
    missingAuthorityCalls += 1;
    return { success: true, data: { ok: true, stale: true } };
  };
  const missingAuthorityRuntime = new AgentRuntime();
  missingAuthorityRuntime.requestPendingRunSync();
  await waitFor(() => missingAuthorityCalls === 1, 'missing-authority upsert was not called');
  await waitForRunSyncIdle(missingAuthorityRuntime, missingAuthorityRun.id);
  assert.equal(agentRunStore.getRun(missingAuthorityRun.id)?.backendSyncState, 'pending');
  assert.equal(agentRunStore.getRun(missingAuthorityRun.id)?.status, 'waiting_execution');

  // Tool-call persistence must finish before a stale Run snapshot is accepted.
  agentRunStore.clearRuns();
  const failedToolSyncRun = agentRunStore.createRun('tool sync failure', 'test', { requiresConfirmation: false });
  const failedToolSnapshot = agentRunStore.updateRun(failedToolSyncRun.id, {
    status: 'failed',
    toolCalls: [createToolCall(failedToolSyncRun.id)],
  });
  upsertImpl = async () => ({
    success: true,
    data: {
      ok: true,
      stale: true,
      data: toAuthoritativeDto(failedToolSnapshot, {
        status: 'completed',
        updatedAt: new Date(Date.parse(failedToolSnapshot.updatedAt) + 1_000).toISOString(),
      }),
    },
  });
  toolCallImpl = async () => ({ success: false, error: 'simulated_tool_call_sync_failure' });
  const failedToolRuntime = new AgentRuntime();
  failedToolRuntime.requestPendingRunSync();
  await waitForRunSyncIdle(failedToolRuntime, failedToolSyncRun.id);
  assert.equal(agentRunStore.getRun(failedToolSyncRun.id)?.status, 'failed');
  assert.equal(agentRunStore.getRun(failedToolSyncRun.id)?.backendSyncState, 'pending');

  // Once every tool call is durable, an authoritative stale response applies and keeps local-only calls.
  toolCallImpl = async () => ({ success: true, data: { ok: true } });
  const successfulRuntime = new AgentRuntime();
  successfulRuntime.requestPendingRunSync();
  await waitForRunSyncIdle(successfulRuntime, failedToolSyncRun.id);
  const reconciled = agentRunStore.getRun(failedToolSyncRun.id);
  assert.equal(reconciled?.status, 'completed');
  assert.equal(reconciled?.backendSyncState, 'synced');
  assert.deepEqual(reconciled?.toolCalls.map((toolCall) => toolCall.id), [createToolCall(failedToolSyncRun.id).id]);

  // A delayed stale response cannot overwrite a newer local transition.
  agentRunStore.clearRuns();
  const racingRun = agentRunStore.createRun('CAS race', 'test', { requiresConfirmation: false });
  const racingSnapshot = { ...racingRun };
  let releaseDelayedUpsert!: (value: any) => void;
  let delayedUpsertStarted = false;
  upsertImpl = async () => {
    delayedUpsertStarted = true;
    return await new Promise((resolve) => { releaseDelayedUpsert = resolve; });
  };
  const racingRuntime = new AgentRuntime();
  racingRuntime.requestPendingRunSync();
  await waitFor(() => delayedUpsertStarted, 'delayed stale upsert did not start');
  const newerLocal = agentRunStore.updateRun(racingRun.id, { status: 'cancelled' });
  releaseDelayedUpsert({
    success: true,
    data: {
      ok: true,
      stale: true,
      data: toAuthoritativeDto(racingSnapshot, {
        status: 'completed',
        updatedAt: new Date(Date.parse(racingSnapshot.updatedAt) + 60_000).toISOString(),
      }),
    },
  });
  await waitForRunSyncIdle(racingRuntime, racingRun.id);
  assert.equal(agentRunStore.getRun(racingRun.id)?.status, 'cancelled');
  assert.equal(agentRunStore.getRun(racingRun.id)?.updatedAt, newerLocal.updatedAt);
  assert.equal(agentRunStore.getRun(racingRun.id)?.backendSyncState, 'pending');

  // Authenticated active state remains recoverable until server hydration resolves its authority.
  agentRunStore.clearRuns();
  const timeoutRun = agentRunStore.createRun('timeout marker', 'test', { requiresConfirmation: false });
  agentRunStore.restoreRunSnapshot({
    ...timeoutRun,
    updatedAt: new Date(Date.now() - 6 * 60 * 1_000).toISOString(),
  });
  assert.equal(agentRunStore.getPendingRun()?.id, timeoutRun.id);
  assert.equal(agentRunStore.getRun(timeoutRun.id)?.status, 'waiting_execution');
  let sentTimeoutSnapshot: AgentRunRecord | undefined;
  upsertImpl = async (record) => {
    sentTimeoutSnapshot = JSON.parse(JSON.stringify(record));
    return { success: true, data: { ok: true, data: toAuthoritativeDto(record) } };
  };
  const timeoutRuntime = new AgentRuntime();
  timeoutRuntime.requestPendingRunSync();
  await waitForRunSyncIdle(timeoutRuntime, timeoutRun.id);
  assert.equal(sentTimeoutSnapshot?.status, 'waiting_execution');
  assert.equal(agentRunStore.getRun(timeoutRun.id)?.backendSyncState, 'synced');
});
