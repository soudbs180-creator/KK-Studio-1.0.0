import assert from 'node:assert/strict';
import test from 'node:test';

const loadWorkerMetrics = async () => {
  const module: any = await import('../../services/api/lib/generation-v3/worker/workerMetrics.js');
  return module.default || module;
};

const loadWorkerSubmissionRouter = async () => {
  const module: any = await import('../../services/api/lib/generation-v3/worker/workerSubmissionRouter.js');
  return module.default || module;
};

const loadWorkerLoop = async () => {
  const module: any = await import('../../services/api/lib/generation-v3/worker/workerLoop.js');
  return module.default || module;
};

test('worker submission rollout keeps off and nonmatching users on the synchronous path', async () => {
  const { createImageWorkerMetrics } = await loadWorkerMetrics();
  const { submitJobWithWorkerRollout } = await loadWorkerSubmissionRouter();
  const metrics = createImageWorkerMetrics();
  const calls: string[] = [];
  const generation = {
    async enqueueImageJob() {
      calls.push('enqueue');
      return { jobId: 'queued-job' };
    },
    async submitJob() {
      calls.push('sync');
      return { jobId: 'sync-job' };
    },
  };

  const offResult = await submitJobWithWorkerRollout({
    env: {
      GENERATION_IMAGE_DURABLE_WORKER_ENABLED: 'off',
      GENERATION_IMAGE_WORKER_EXECUTION_ENABLED: 'true',
    },
    generation,
    jobId: 'job-off',
    metrics,
    userId: 'internal-user',
  });
  const unmatchedResult = await submitJobWithWorkerRollout({
    env: { GENERATION_IMAGE_DURABLE_WORKER_ENABLED: 'internal' },
    generation,
    jobId: 'job-unmatched',
    metrics,
    userId: 'other-user',
  });

  assert.equal(offResult.jobId, 'sync-job');
  assert.equal(unmatchedResult.jobId, 'sync-job');
  assert.deepEqual(calls, ['sync', 'sync']);
  assert.equal(metrics.getSnapshot().submissions.legacy, 2);
});

test('matched internal users enqueue image work while non-image fallback stays synchronous', async () => {
  const { createImageWorkerMetrics } = await loadWorkerMetrics();
  const { submitJobWithWorkerRollout } = await loadWorkerSubmissionRouter();
  const metrics = createImageWorkerMetrics();
  let enqueueResult: { jobId: string } | null = { jobId: 'queued-job' };
  let syncCalls = 0;
  const generation = {
    async enqueueImageJob() {
      return enqueueResult;
    },
    async submitJob() {
      syncCalls += 1;
      return { jobId: 'sync-job' };
    },
  };
  const env = {
    GENERATION_IMAGE_DURABLE_WORKER_ENABLED: 'internal',
    GENERATION_IMAGE_WORKER_INTERNAL_USER_IDS: 'internal-user',
  };

  assert.equal((await submitJobWithWorkerRollout({ env, generation, jobId: 'image-job', metrics, userId: 'internal-user' })).jobId, 'queued-job');
  enqueueResult = null;
  assert.equal((await submitJobWithWorkerRollout({ env, generation, jobId: 'video-job', metrics, userId: 'internal-user' })).jobId, 'sync-job');
  assert.equal(syncCalls, 1);
  assert.deepEqual(metrics.getSnapshot().submissions, { durable: 1, durableFallback: 1, legacy: 0 });
});

test('worker metrics expose aggregate rollout, outcome, error, and latency data only', async () => {
  const { createImageWorkerMetrics } = await loadWorkerMetrics();
  const metrics = createImageWorkerMetrics({ now: () => 1_000 });

  metrics.configure({ running: true, scope: 'off' });
  metrics.recordResult('completed', 20);
  metrics.recordResult('lease_lost', 40);
  metrics.recordLoopError(60);
  const snapshot = metrics.getSnapshot();
  const serialized = JSON.stringify(snapshot);

  assert.equal(snapshot.scope, 'off');
  assert.equal(snapshot.running, true);
  assert.equal(snapshot.ticks, 3);
  assert.equal(snapshot.outcomes.completed, 1);
  assert.equal(snapshot.outcomes.lease_lost, 1);
  assert.equal(snapshot.outcomes.loop_error, 1);
  assert.equal(snapshot.averageLatencyMs, 40);
  assert.doesNotMatch(serialized, /userId|jobId|itemId|prompt|providerTaskId/);
});

test('worker loop drains existing work when admission is off and execution is enabled', async () => {
  const { createImageWorkerMetrics } = await loadWorkerMetrics();
  const { startImageWorkerLoop } = await loadWorkerLoop();
  const metrics = createImageWorkerMetrics();
  let runCalls = 0;
  const worker = {
    async runOnce() {
      runCalls += 1;
      return { status: 'completed' };
    },
  };

  const running = startImageWorkerLoop({
    env: {
      GENERATION_IMAGE_DURABLE_WORKER_ENABLED: 'off',
      GENERATION_IMAGE_WORKER_EXECUTION_ENABLED: 'true',
      GENERATION_IMAGE_WORKER_TICK_INTERVAL_MS: '60000',
    },
    metrics,
    worker,
  });
  assert.notEqual(running, null);
  assert.deepEqual(
    { running: metrics.getSnapshot().running, scope: metrics.getSnapshot().scope },
    { running: true, scope: 'off' },
  );
  await new Promise((resolve) => setImmediate(resolve));
  running.stop();
  assert.equal(runCalls, 1);
  assert.equal(metrics.getSnapshot().outcomes.completed, 1);
  assert.equal(metrics.getSnapshot().running, false);
});

test('worker loop stays stopped when execution is disabled even if admission is enabled', async () => {
  const { createImageWorkerMetrics } = await loadWorkerMetrics();
  const { startImageWorkerLoop } = await loadWorkerLoop();
  const metrics = createImageWorkerMetrics();
  let runCalls = 0;
  const worker = {
    async runOnce() {
      runCalls += 1;
      return { status: 'completed' };
    },
  };

  const stopped = startImageWorkerLoop({
    env: {
      GENERATION_IMAGE_DURABLE_WORKER_ENABLED: 'internal',
      GENERATION_IMAGE_WORKER_EXECUTION_ENABLED: 'false',
    },
    metrics,
    worker,
  });
  assert.equal(stopped, null);
  assert.equal(runCalls, 0);
  assert.equal(metrics.getSnapshot().scope, 'internal');
  assert.equal(metrics.getSnapshot().running, false);
});

test('existing metrics route includes the aggregate Worker snapshot without changing its envelope', async () => {
  const { imageWorkerMetrics } = await loadWorkerMetrics();
  imageWorkerMetrics.reset();
  imageWorkerMetrics.recordResult('lease_lost', 12);
  const telemetryModule: any = await import('../../services/api/routes/telemetry.js');
  const router = telemetryModule.default || telemetryModule;
  const metricsLayer = router.stack.find((layer: any) => layer.route?.path === '/v1/metrics');
  let payload: any;

  metricsLayer.route.stack[0].handle({}, {
    json(value: any) {
      payload = value;
      return value;
    },
  });

  assert.equal(payload.success, true);
  assert.equal(payload.data.imageDurableWorker.outcomes.lease_lost, 1);
  assert.ok(payload.data.circuitBreaker);
});
