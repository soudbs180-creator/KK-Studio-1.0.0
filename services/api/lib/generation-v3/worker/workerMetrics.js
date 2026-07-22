const OUTCOME_KEYS = Object.freeze([
  'idle',
  'pending',
  'retrying',
  'completed',
  'failed',
  'cancelled',
  'timed_out',
  'lease_lost',
  'loop_error',
  'unknown',
]);
const SUBMISSION_KEYS = Object.freeze(['durable', 'durableFallback', 'legacy']);
const PROVIDER_OPERATION_KEYS = Object.freeze(['cancel', 'poll', 'submit']);
const DEFAULT_LATENCY_WINDOW = 200;

function createCounters(keys) {
  return Object.fromEntries(keys.map((key) => [key, 0]));
}

function average(values) {
  if (values.length === 0) return 0;
  return Math.round(values.reduce((sum, value) => sum + value, 0) / values.length);
}

class ImageWorkerMetrics {
  constructor(options = {}) {
    this.now = options.now || Date.now;
    this.latencyWindowSize = options.latencyWindowSize || DEFAULT_LATENCY_WINDOW;
    this.reset();
  }

  configure({ running, scope }) {
    this.running = Boolean(running);
    this.scope = scope || 'off';
  }

  recordResult(status, latencyMs) {
    const outcome = OUTCOME_KEYS.includes(status) ? status : 'unknown';
    this.outcomes[outcome] += 1;
    this.recordTick(latencyMs);
  }

  recordLoopError(latencyMs) {
    this.outcomes.loop_error += 1;
    this.recordTick(latencyMs);
  }

  recordSubmissionRoute(route) {
    if (SUBMISSION_KEYS.includes(route)) this.submissions[route] += 1;
  }

  recordProviderOperation(operation) {
    if (PROVIDER_OPERATION_KEYS.includes(operation)) this.providerOperations[operation] += 1;
  }

  recordTick(latencyMs) {
    this.ticks += 1;
    this.lastTickAt = new Date(this.now()).toISOString();
    if (!Number.isFinite(latencyMs) || latencyMs < 0) return;
    this.latencies.push(latencyMs);
    if (this.latencies.length > this.latencyWindowSize) this.latencies.shift();
  }

  getSnapshot() {
    return {
      schemaVersion: 1,
      scope: this.scope,
      running: this.running,
      startedAt: this.startedAt,
      lastTickAt: this.lastTickAt,
      ticks: this.ticks,
      averageLatencyMs: average(this.latencies),
      outcomes: { ...this.outcomes },
      submissions: { ...this.submissions },
      providerOperations: { ...this.providerOperations },
    };
  }

  reset() {
    this.scope = 'off';
    this.running = false;
    this.startedAt = new Date(this.now()).toISOString();
    this.lastTickAt = null;
    this.ticks = 0;
    this.latencies = [];
    this.outcomes = createCounters(OUTCOME_KEYS);
    this.submissions = createCounters(SUBMISSION_KEYS);
    this.providerOperations = createCounters(PROVIDER_OPERATION_KEYS);
  }
}

/** Creates an isolated aggregate-only image Worker metrics collector. */
function createImageWorkerMetrics(options = {}) {
  return new ImageWorkerMetrics(options);
}

const imageWorkerMetrics = createImageWorkerMetrics();

module.exports = { createImageWorkerMetrics, imageWorkerMetrics };
