const crypto = require('crypto');
const os = require('os');
const { getQuote } = require('../quoteEngine');
const { resolveFrozenProviderRoute } = require('../jobLifecycle');
const { createImageGenerationWorker } = require('./imageWorker');
const { createPostgresWorkerStore } = require('./workerStore');
const { imageWorkerMetrics } = require('./workerMetrics');

function buildSubmitInput(claim, quote, auth) {
  return {
    requestId: `${claim.jobId}:${claim.itemId}`,
    modelId: quote.model,
    prompt: claim.payload?.prompt || '',
    aspectRatio: quote.routeSnapshot?.aspectRatio,
    size: quote.routeSnapshot?.size,
    payload: claim.payload,
    auth,
  };
}

async function resolveExecution(claim) {
  const quote = await getQuote(claim.userId, claim.quoteId);
  const { route, auth } = await resolveFrozenProviderRoute(claim.userId, quote);
  return {
    adapter: route.adapter,
    auth,
    input: buildSubmitInput(claim, quote, auth),
  };
}

function createWorkerId() {
  return `${os.hostname()}:${process.pid}:${crypto.randomUUID()}`;
}

function createProductionImageWorker(options = {}) {
  return createImageGenerationWorker({
    heartbeatIntervalMs: options.heartbeatIntervalMs,
    jobTimeoutMs: options.jobTimeoutMs,
    leaseMs: options.leaseMs,
    maxAttempts: options.maxAttempts,
    maxPollIntervalMs: options.maxPollIntervalMs,
    metrics: options.metrics || imageWorkerMetrics,
    operationTimeoutMs: options.operationTimeoutMs,
    pollIntervalMs: options.pollIntervalMs,
    resolveExecution: options.resolveExecution || resolveExecution,
    store: options.store || createPostgresWorkerStore(),
    workerId: options.workerId || createWorkerId(),
  });
}

module.exports = { createProductionImageWorker, resolveExecution };
