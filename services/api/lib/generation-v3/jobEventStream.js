const crypto = require('crypto');
const { GenerationJobEventSchema } = require('@kk/shared');

const DEFAULT_POLL_INTERVAL_MS = 1_000;
const DEFAULT_HEARTBEAT_INTERVAL_MS = 15_000;
const TERMINAL_JOB_STATUSES = new Set(['completed', 'failed', 'cancelled']);

function terminalEventType(status) {
  if (status === 'completed') return 'job_completed';
  if (status === 'failed') return 'job_failed';
  if (status === 'cancelled') return 'job_cancelled';
  return null;
}

function selectProjectionEventType(job, previousJob) {
  const terminalType = terminalEventType(job.status);
  if (terminalType && previousJob?.status !== job.status) return terminalType;
  if (!previousJob) return 'job_created';
  if (previousJob.status !== job.status) return 'job_status_changed';
  return 'item_status_changed';
}

/** Creates a validated, owner-scoped full Job projection event. */
function createJobProjectionEvent(job, previousJob, options = {}) {
  const createEventId = options.createEventId || crypto.randomUUID;
  const now = options.now || Date.now;
  return GenerationJobEventSchema.parse({
    eventId: createEventId(),
    jobId: job.jobId,
    type: selectProjectionEventType(job, previousJob),
    payload: { job },
    createdAt: new Date(now()).toISOString(),
  });
}

function configureSseResponse(response) {
  response.status?.(200);
  response.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
  response.setHeader('Cache-Control', 'no-cache, no-transform');
  response.setHeader('Connection', 'keep-alive');
  response.setHeader('X-Accel-Buffering', 'no');
  response.flushHeaders?.();
}

function writeProjection(response, event) {
  response.write(
    `id: ${event.eventId}\nevent: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`,
  );
}

function stopTimer(state, timerName) {
  const timerId = state[timerName];
  if (timerId === null) return;
  state.clearIntervalFn(timerId);
  state[timerName] = null;
}

function closeStream(state, endResponse = true) {
  if (state.closed) return;
  state.closed = true;
  stopTimer(state, 'pollTimer');
  stopTimer(state, 'heartbeatTimer');
  state.request.off?.('close', state.handleDisconnect);
  if (endResponse) state.response.end();
}

function publishIfChanged(state, job) {
  const fingerprint = JSON.stringify(job);
  if (fingerprint === state.fingerprint) return;
  const event = createJobProjectionEvent(job, state.currentJob, state);
  writeProjection(state.response, event);
  state.currentJob = job;
  state.fingerprint = fingerprint;
}

async function pollStream(state) {
  if (state.closed || state.polling) return;
  state.polling = true;
  try {
    const job = await state.getJob(state.jobId, state.userId);
    if (!job) return closeStream(state);
    publishIfChanged(state, job);
    if (TERMINAL_JOB_STATUSES.has(job.status)) closeStream(state);
  } catch {
    state.response.write('event: error\ndata: {"code":"JOB_STREAM_ERROR"}\n\n');
    closeStream(state);
  } finally {
    state.polling = false;
  }
}

function scheduleStream(state) {
  state.pollTimer = state.setIntervalFn(
    () => void pollStream(state),
    state.pollIntervalMs,
  );
  state.heartbeatTimer = state.setIntervalFn(() => {
    if (!state.closed) state.response.write(': heartbeat\n\n');
  }, state.heartbeatIntervalMs);
}

function createStreamState(options, initialJob) {
  const state = {
    ...options,
    clearIntervalFn: options.clearIntervalFn || clearInterval,
    createEventId: options.createEventId || crypto.randomUUID,
    currentJob: initialJob,
    fingerprint: JSON.stringify(initialJob),
    heartbeatIntervalMs: options.heartbeatIntervalMs || DEFAULT_HEARTBEAT_INTERVAL_MS,
    heartbeatTimer: null,
    now: options.now || Date.now,
    pollIntervalMs: options.pollIntervalMs || DEFAULT_POLL_INTERVAL_MS,
    polling: false,
    pollTimer: null,
    setIntervalFn: options.setIntervalFn || setInterval,
    closed: false,
  };
  state.handleDisconnect = () => closeStream(state, false);
  return state;
}

/** Opens an SSE stream only after an owner-scoped Job lookup succeeds. */
async function startJobEventStream(options) {
  const initialJob = await options.getJob(options.jobId, options.userId);
  if (!initialJob) return null;

  configureSseResponse(options.response);
  const state = createStreamState(options, initialJob);
  const initialEvent = createJobProjectionEvent(initialJob, null, state);
  writeProjection(state.response, initialEvent);
  options.request.once('close', state.handleDisconnect);

  if (TERMINAL_JOB_STATUSES.has(initialJob.status)) {
    closeStream(state);
  } else {
    scheduleStream(state);
  }
  return { close: () => closeStream(state), poll: () => pollStream(state) };
}

module.exports = { createJobProjectionEvent, startJobEventStream };
