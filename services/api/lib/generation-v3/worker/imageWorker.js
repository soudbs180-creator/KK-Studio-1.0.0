const DEFAULT_LEASE_MS = 30_000;
const DEFAULT_POLL_INTERVAL_MS = 1_000;
const DEFAULT_MAX_POLL_INTERVAL_MS = 30_000;
const DEFAULT_OPERATION_TIMEOUT_MS = 60_000;
const DEFAULT_JOB_TIMEOUT_MS = 15 * 60_000;
const DEFAULT_MAX_ATTEMPTS = 3;

function createTimeoutError() {
  const error = new Error('Provider operation exceeded the durable worker timeout.');
  error.code = 'WORKER_OPERATION_TIMEOUT';
  return error;
}

function withTimeout(operation, timeoutMs) {
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => reject(createTimeoutError()), timeoutMs);
  });
  return Promise.race([operation, timeout]).finally(() => clearTimeout(timer));
}

function createLeaseLostError() {
  const error = new Error('Durable worker lease is no longer owned by this process.');
  error.code = 'WORKER_LEASE_LOST';
  error.retryable = true;
  return error;
}

async function runWithHeartbeat(claim, operation, context) {
  let heartbeatError;
  const heartbeat = async () => {
    try {
      if (!await context.store.heartbeat(claim, context.leaseMs)) heartbeatError = createLeaseLostError();
    } catch (error) {
      heartbeatError = error;
    }
  };
  await heartbeat();
  if (heartbeatError) throw heartbeatError;
  const timer = setInterval(() => void heartbeat(), context.heartbeatIntervalMs);
  try {
    const result = await withTimeout(operation(), context.operationTimeoutMs);
    if (heartbeatError) throw heartbeatError;
    return result;
  } finally {
    clearInterval(timer);
  }
}

function calculateRetryDelay(attemptCount, baseDelayMs, maxDelayMs) {
  const exponent = Math.max(0, Math.min(10, attemptCount - 1));
  return Math.min(baseDelayMs * (2 ** exponent), maxDelayMs);
}

async function cancelClaim(claim, execution, context) {
  if (claim.providerTaskId) {
    await runWithHeartbeat(
      claim,
      () => execution.adapter.cancel(claim.providerTaskId, execution.auth),
      context,
    );
  }
  await context.store.cancel(claim);
  return { status: 'cancelled', itemId: claim.itemId };
}

async function cancelQueuedClaim(claim, context) {
  await context.store.cancel(claim);
  return { status: 'cancelled', itemId: claim.itemId };
}

async function settleProviderResult(claim, result, context) {
  if (result.status === 'success' && result.urls?.[0]) {
    await context.store.complete(claim, result.urls[0]);
    return { status: 'completed', itemId: claim.itemId };
  }
  if (result.status === 'failed') {
    await context.store.fail(claim, {
      errorCode: 'PROVIDER_ERROR',
      errorMessage: result.errorMessage || 'Provider operation failed.',
    });
    return { status: 'failed', itemId: claim.itemId };
  }
  if (result.status === 'cancelled') {
    await context.store.cancel(claim);
    return { status: 'cancelled', itemId: claim.itemId };
  }
  await context.store.requeue(claim, {
    delayMs: calculateRetryDelay(claim.attemptCount, context.pollIntervalMs, context.maxPollIntervalMs),
  });
  return { status: 'pending', itemId: claim.itemId };
}

async function executeClaim(claim, execution, context) {
  const isCancelled = await context.store.isCancellationRequested(claim);
  if (isCancelled) return cancelClaim(claim, execution, context);
  const invokeProvider = claim.providerTaskId
    ? () => execution.adapter.poll(claim.providerTaskId, execution.auth)
    : () => execution.adapter.submit(execution.input);
  const result = await runWithHeartbeat(claim, invokeProvider, context);
  if (!claim.providerTaskId && result.providerTaskId) {
    const recorded = await context.store.recordSubmission(claim, result.providerTaskId);
    if (recorded === false) throw createLeaseLostError();
    claim.providerTaskId = result.providerTaskId;
  }
  if (await context.store.isCancellationRequested(claim)) {
    return cancelClaim(claim, execution, context);
  }
  return settleProviderResult(claim, result, context);
}

async function handleClaimError(claim, error, context) {
  const errorCode = error?.code || 'WORKER_PROVIDER_ERROR';
  const errorMessage = error?.message || 'Durable image worker failed.';
  const nextFailureCount = (claim.failureCount || 0) + 1;
  if (nextFailureCount >= context.maxAttempts || error?.retryable === false) {
    const terminalStatus = errorCode === 'WORKER_OPERATION_TIMEOUT' ? 'timed_out' : 'failed';
    await context.store.fail(claim, { errorCode, errorMessage, terminalStatus });
    return { status: terminalStatus, itemId: claim.itemId };
  }
  await context.store.requeue(claim, {
    delayMs: calculateRetryDelay(claim.attemptCount, context.pollIntervalMs, context.maxPollIntervalMs),
    errorCode,
    errorMessage,
  });
  return { status: 'retrying', itemId: claim.itemId };
}

function isClaimTimedOut(claim, context) {
  const enqueuedAt = new Date(claim.enqueuedAt).getTime();
  return Number.isFinite(enqueuedAt) && Date.now() - enqueuedAt >= context.jobTimeoutMs;
}

async function timeoutClaim(claim, context) {
  await context.store.fail(claim, {
    errorCode: 'WORKER_JOB_TIMEOUT',
    errorMessage: 'Image generation exceeded the durable job deadline.',
    terminalStatus: 'timed_out',
  });
  return { status: 'timed_out', itemId: claim.itemId };
}

function buildContext(options) {
  const leaseMs = options.leaseMs || DEFAULT_LEASE_MS;
  return {
    heartbeatIntervalMs: options.heartbeatIntervalMs || Math.max(10, Math.floor(leaseMs / 3)),
    jobTimeoutMs: options.jobTimeoutMs || DEFAULT_JOB_TIMEOUT_MS,
    leaseMs,
    maxAttempts: options.maxAttempts || DEFAULT_MAX_ATTEMPTS,
    maxPollIntervalMs: options.maxPollIntervalMs || DEFAULT_MAX_POLL_INTERVAL_MS,
    operationTimeoutMs: options.operationTimeoutMs || DEFAULT_OPERATION_TIMEOUT_MS,
    pollIntervalMs: options.pollIntervalMs ?? DEFAULT_POLL_INTERVAL_MS,
    resolveExecution: options.resolveExecution,
    store: options.store,
    workerId: options.workerId,
  };
}

function createImageGenerationWorker(options) {
  const context = buildContext(options);
  return {
    async runOnce() {
      const claim = await context.store.claimNext({ workerId: context.workerId, leaseMs: context.leaseMs });
      if (!claim) return { status: 'idle' };
      if (isClaimTimedOut(claim, context)) return timeoutClaim(claim, context);
      try {
        const cancelQueued = !claim.providerTaskId
          && await context.store.isCancellationRequested(claim);
        if (cancelQueued) return await cancelQueuedClaim(claim, context);
        const execution = await context.resolveExecution(claim);
        return await executeClaim(claim, execution, context);
      } catch (error) {
        return handleClaimError(claim, error, context);
      }
    },
  };
}

module.exports = { calculateRetryDelay, createImageGenerationWorker };
