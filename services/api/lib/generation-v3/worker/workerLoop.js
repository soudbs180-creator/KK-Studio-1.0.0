const { readImageDurableWorkerScope } = require('./featureFlag');
const { createProductionImageWorker } = require('./productionWorker');
const { imageWorkerMetrics } = require('./workerMetrics');

const DEFAULT_TICK_INTERVAL_MS = 500;

function readPositiveInteger(value, fallback) {
  const parsed = Number.parseInt(String(value || ''), 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

function readWorkerOptions(env) {
  return {
    heartbeatIntervalMs: readPositiveInteger(env.GENERATION_IMAGE_WORKER_HEARTBEAT_MS, undefined),
    jobTimeoutMs: readPositiveInteger(env.GENERATION_IMAGE_WORKER_JOB_TIMEOUT_MS, undefined),
    leaseMs: readPositiveInteger(env.GENERATION_IMAGE_WORKER_LEASE_MS, undefined),
    maxAttempts: readPositiveInteger(env.GENERATION_IMAGE_WORKER_MAX_ATTEMPTS, undefined),
    maxPollIntervalMs: readPositiveInteger(env.GENERATION_IMAGE_WORKER_MAX_POLL_INTERVAL_MS, undefined),
    operationTimeoutMs: readPositiveInteger(env.GENERATION_IMAGE_WORKER_OPERATION_TIMEOUT_MS, undefined),
    pollIntervalMs: readPositiveInteger(env.GENERATION_IMAGE_WORKER_POLL_INTERVAL_MS, undefined),
  };
}

function startImageWorkerLoop(options = {}) {
  const env = options.env || process.env;
  const metrics = options.metrics || imageWorkerMetrics;
  const scope = readImageDurableWorkerScope(env);
  metrics.configure({ running: false, scope });
  if (scope === 'off') return null;
  const worker = options.worker || createProductionImageWorker({
    ...readWorkerOptions(env),
    metrics,
  });
  const tickIntervalMs = readPositiveInteger(
    env.GENERATION_IMAGE_WORKER_TICK_INTERVAL_MS,
    DEFAULT_TICK_INTERVAL_MS,
  );
  let active = false;
  metrics.configure({ running: true, scope });
  const tick = async () => {
    if (active) return;
    active = true;
    const startedAt = Date.now();
    try {
      const result = await worker.runOnce();
      metrics.recordResult(result?.status || 'unknown', Date.now() - startedAt);
    } catch (error) {
      metrics.recordLoopError(Date.now() - startedAt);
      (options.onError || console.error)('[generation-image-worker]', error);
    } finally {
      active = false;
    }
  };
  const timer = setInterval(tick, tickIntervalMs);
  timer.unref?.();
  void tick();
  return {
    stop() {
      clearInterval(timer);
      metrics.configure({ running: false, scope });
    },
    tick,
  };
}

module.exports = { startImageWorkerLoop };
