import assert from 'node:assert/strict';
import test from 'node:test';

type WorkerState = {
  attemptCount: number;
  cancelRequested: boolean;
  enqueuedAt?: number;
  failureCount: number;
  errorCode?: string;
  itemStatus: string;
  leaseExpiresAt: number;
  leaseToken?: string;
  nextAttemptAt: number;
  providerTaskId?: string;
  status: string;
  workerId?: string;
};

const loadWorker = async () => {
  const module: any = await import('../../services/api/lib/generation-v3/worker/imageWorker.js');
  return module.default || module;
};

const loadFeatureFlag = async () => {
  const module: any = await import('../../services/api/lib/generation-v3/worker/featureFlag.js');
  return module.default || module;
};

test('worker server flag supports off, internal, invited, and full rollout scopes', async () => {
  const { hasImageDurableWorkerRollout, isImageDurableWorkerEnabled } = await loadFeatureFlag();
  assert.equal(isImageDurableWorkerEnabled('internal-1', {}), false);
  assert.equal(isImageDurableWorkerEnabled('internal-1', {
    GENERATION_IMAGE_DURABLE_WORKER_ENABLED: 'internal',
    GENERATION_IMAGE_WORKER_INTERNAL_USER_IDS: 'internal-1',
  }), true);
  assert.equal(isImageDurableWorkerEnabled('invited-1', {
    GENERATION_IMAGE_DURABLE_WORKER_ENABLED: 'invited',
    GENERATION_IMAGE_WORKER_INVITED_USER_IDS: 'invited-1',
  }), true);
  assert.equal(isImageDurableWorkerEnabled('other', {
    GENERATION_IMAGE_DURABLE_WORKER_ENABLED: 'full',
  }), true);
  assert.equal(hasImageDurableWorkerRollout({
    GENERATION_IMAGE_DURABLE_WORKER_ENABLED: 'internal',
  }), true);
});

test('worker poll delay uses bounded exponential backoff', async () => {
  const { calculateRetryDelay } = await loadWorker();
  assert.equal(calculateRetryDelay(1, 1_000, 30_000), 1_000);
  assert.equal(calculateRetryDelay(3, 1_000, 30_000), 4_000);
  assert.equal(calculateRetryDelay(20, 1_000, 30_000), 30_000);
});

function createHarness(initial: Partial<WorkerState> = {}) {
  const state: WorkerState = {
    attemptCount: 0,
    cancelRequested: false,
    failureCount: 0,
    itemStatus: 'pending',
    leaseExpiresAt: 0,
    nextAttemptAt: 0,
    status: 'queued',
    ...initial,
  };
  let heartbeatCount = 0;
  const now = () => Date.now();

  const store = {
    async claimNext({ workerId, leaseMs }: { workerId: string; leaseMs: number }) {
      if (['completed', 'failed', 'cancelled', 'timed_out'].includes(state.status)) return null;
      if (state.status === 'leased' && state.leaseExpiresAt > now()) return null;
      if (['queued', 'polling'].includes(state.status) && state.nextAttemptAt > now()) return null;
      state.attemptCount += 1;
      state.status = 'leased';
      state.workerId = workerId;
      state.leaseToken = `lease-${state.attemptCount}`;
      state.leaseExpiresAt = now() + leaseMs;
      return {
        attemptCount: state.attemptCount,
        enqueuedAt: new Date(initial.enqueuedAt || Date.now()).toISOString(),
        failureCount: state.failureCount,
        itemId: 'item-1',
        jobId: 'job-1',
        leaseToken: state.leaseToken,
        payload: { prompt: 'durable image', async: true },
        providerTaskId: state.providerTaskId,
        quoteId: 'quote-1',
        userId: 'user-1',
      };
    },
    async heartbeat(claim: { leaseToken: string }, leaseMs: number) {
      if (claim.leaseToken !== state.leaseToken || state.status !== 'leased') return false;
      heartbeatCount += 1;
      state.leaseExpiresAt = now() + leaseMs;
      return true;
    },
    async isCancellationRequested() {
      return state.cancelRequested;
    },
    async recordSubmission(claim: { leaseToken: string }, providerTaskId: string) {
      assert.equal(claim.leaseToken, state.leaseToken);
      state.providerTaskId = providerTaskId;
      state.itemStatus = 'submitted';
    },
    async requeue(_claim: unknown, options: { delayMs: number }) {
      if ('errorCode' in options && options.errorCode) state.failureCount += 1;
      state.status = 'polling';
      state.itemStatus = 'running';
      state.nextAttemptAt = now() + options.delayMs;
      state.leaseToken = undefined;
      state.workerId = undefined;
    },
    async complete(_claim: unknown) {
      state.status = 'completed';
      state.itemStatus = 'completed';
      state.leaseToken = undefined;
    },
    async fail(_claim: unknown, options: { errorCode: string; terminalStatus?: string }) {
      state.status = options.terminalStatus || 'failed';
      state.itemStatus = 'failed';
      state.errorCode = options.errorCode;
      state.leaseToken = undefined;
    },
    async cancel() {
      state.status = 'cancelled';
      state.itemStatus = 'cancelled';
      state.leaseToken = undefined;
    },
  };

  return { getHeartbeatCount: () => heartbeatCount, state, store };
}

test('server worker continues an image job after the submitting browser is gone and across restart', async () => {
  const { createImageGenerationWorker } = await loadWorker();
  const harness = createHarness();
  let submitCount = 0;
  let pollCount = 0;
  const adapter = {
    async submit() {
      submitCount += 1;
      return { providerTaskId: 'provider-task-1', status: 'pending' };
    },
    async poll() {
      pollCount += 1;
      return { status: 'success', urls: ['https://assets.local/image.png'] };
    },
    async cancel() {},
  };
  const dependencies = {
    pollIntervalMs: 0,
    resolveExecution: async () => ({ adapter, auth: {}, input: {} }),
    store: harness.store,
  };

  const firstProcess = createImageGenerationWorker({ ...dependencies, workerId: 'worker-before-restart' });
  assert.equal((await firstProcess.runOnce()).status, 'pending');

  const restartedProcess = createImageGenerationWorker({ ...dependencies, workerId: 'worker-after-restart' });
  assert.equal((await restartedProcess.runOnce()).status, 'completed');
  assert.equal(harness.state.itemStatus, 'completed');
  assert.equal(submitCount, 1);
  assert.equal(pollCount, 1);
});

test('an expired lease with a persisted provider task is reclaimed without duplicate submit', async () => {
  const { createImageGenerationWorker } = await loadWorker();
  const harness = createHarness({
    attemptCount: 1,
    leaseExpiresAt: Date.now() - 1,
    leaseToken: 'dead-lease',
    providerTaskId: 'provider-task-existing',
    status: 'leased',
    workerId: 'dead-worker',
  });
  let submitCount = 0;
  let polledTaskId = '';
  const adapter = {
    async submit() {
      submitCount += 1;
      return { providerTaskId: 'duplicate', status: 'pending' };
    },
    async poll(taskId: string) {
      polledTaskId = taskId;
      return { status: 'success', urls: ['https://assets.local/recovered.png'] };
    },
    async cancel() {},
  };
  const worker = createImageGenerationWorker({
    workerId: 'recovery-worker',
    store: harness.store,
    resolveExecution: async () => ({ adapter, auth: {}, input: {} }),
  });

  assert.equal((await worker.runOnce()).status, 'completed');
  assert.equal(submitCount, 0);
  assert.equal(polledTaskId, 'provider-task-existing');
});

test('worker heartbeats its lease while a provider operation is in flight', async () => {
  const { createImageGenerationWorker } = await loadWorker();
  const harness = createHarness();
  const adapter = {
    async submit() {
      await new Promise((resolve) => setTimeout(resolve, 20));
      return { providerTaskId: 'provider-task-heartbeat', status: 'pending' };
    },
    async poll() {
      return { status: 'pending' };
    },
    async cancel() {},
  };
  const worker = createImageGenerationWorker({
    heartbeatIntervalMs: 5,
    leaseMs: 50,
    pollIntervalMs: 100,
    workerId: 'heartbeat-worker',
    store: harness.store,
    resolveExecution: async () => ({ adapter, auth: {}, input: {} }),
  });

  assert.equal((await worker.runOnce()).status, 'pending');
  assert.ok(harness.getHeartbeatCount() >= 2);
});

test('worker propagates cancellation to the provider and settles the item once', async () => {
  const { createImageGenerationWorker } = await loadWorker();
  const harness = createHarness({ cancelRequested: true, providerTaskId: 'provider-task-cancel' });
  let cancelledTaskId = '';
  const adapter = {
    async submit() {
      throw new Error('submit must not run for cancelled work');
    },
    async poll() {
      throw new Error('poll must not run for cancelled work');
    },
    async cancel(taskId: string) {
      cancelledTaskId = taskId;
    },
  };
  const worker = createImageGenerationWorker({
    workerId: 'cancel-worker',
    store: harness.store,
    resolveExecution: async () => ({ adapter, auth: {}, input: {} }),
  });

  assert.equal((await worker.runOnce()).status, 'cancelled');
  assert.equal(cancelledTaskId, 'provider-task-cancel');
  assert.equal(harness.state.itemStatus, 'cancelled');
  assert.equal((await worker.runOnce()).status, 'idle');
});

test('queued cancellation settles without resolving provider credentials', async () => {
  const { createImageGenerationWorker } = await loadWorker();
  const harness = createHarness({ cancelRequested: true });
  let resolveCalls = 0;
  const worker = createImageGenerationWorker({
    workerId: 'queued-cancel-worker',
    store: harness.store,
    resolveExecution: async () => {
      resolveCalls += 1;
      throw new Error('provider credentials are unavailable');
    },
  });

  assert.equal((await worker.runOnce()).status, 'cancelled');
  assert.equal(resolveCalls, 0);
  assert.equal(harness.state.itemStatus, 'cancelled');
});

test('worker converts exhausted provider timeouts into a terminal timeout once', async () => {
  const { createImageGenerationWorker } = await loadWorker();
  const harness = createHarness();
  const adapter = {
    async submit() {
      return new Promise(() => {});
    },
    async poll() {
      return { status: 'pending' };
    },
    async cancel() {},
  };
  const worker = createImageGenerationWorker({
    maxAttempts: 1,
    operationTimeoutMs: 5,
    workerId: 'timeout-worker',
    store: harness.store,
    resolveExecution: async () => ({ adapter, auth: {}, input: {} }),
  });

  assert.equal((await worker.runOnce()).status, 'timed_out');
  assert.equal(harness.state.errorCode, 'WORKER_OPERATION_TIMEOUT');
  assert.equal((await worker.runOnce()).status, 'idle');
});

test('normal pending polls do not consume the provider failure retry budget', async () => {
  const { createImageGenerationWorker } = await loadWorker();
  const harness = createHarness();
  let pollCount = 0;
  const adapter = {
    async submit() {
      return { providerTaskId: 'provider-task-retry-budget', status: 'pending' };
    },
    async poll() {
      pollCount += 1;
      if (pollCount === 1) return { status: 'pending' };
      const error: any = new Error(`transient-${pollCount}`);
      error.code = 'TRANSIENT_PROVIDER_ERROR';
      throw error;
    },
    async cancel() {},
  };
  const worker = createImageGenerationWorker({
    maxAttempts: 2,
    pollIntervalMs: 0,
    workerId: 'retry-budget-worker',
    store: harness.store,
    resolveExecution: async () => ({ adapter, auth: {}, input: {} }),
  });

  assert.equal((await worker.runOnce()).status, 'pending');
  assert.equal((await worker.runOnce()).status, 'pending');
  assert.equal((await worker.runOnce()).status, 'retrying');
  assert.equal((await worker.runOnce()).status, 'failed');
  assert.equal(harness.state.failureCount, 1);
});

test('worker times out an expired job deadline without another provider call', async () => {
  const { createImageGenerationWorker } = await loadWorker();
  const harness = createHarness({ enqueuedAt: Date.now() - 60_000 });
  let providerCalls = 0;
  const adapter = {
    async submit() {
      providerCalls += 1;
      return { providerTaskId: 'too-late', status: 'pending' };
    },
    async poll() {
      providerCalls += 1;
      return { status: 'pending' };
    },
    async cancel() {},
  };
  const worker = createImageGenerationWorker({
    jobTimeoutMs: 1_000,
    workerId: 'deadline-worker',
    store: harness.store,
    resolveExecution: async () => ({ adapter, auth: {}, input: {} }),
  });

  assert.equal((await worker.runOnce()).status, 'timed_out');
  assert.equal(harness.state.errorCode, 'WORKER_JOB_TIMEOUT');
  assert.equal(providerCalls, 0);
});
