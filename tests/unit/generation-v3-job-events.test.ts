import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { createRequire } from 'node:module';
import test from 'node:test';

import { GenerationJobEventSchema, type GenerationJobDto } from '../../packages/shared/src/index.ts';

const JOB_ID = '11111111-1111-4111-8111-111111111111';
const QUOTE_ID = '22222222-2222-4222-8222-222222222222';
const ITEM_ID = '33333333-3333-4333-8333-333333333333';
const require = createRequire(import.meta.url);

function createJob(overrides: Partial<GenerationJobDto> = {}): GenerationJobDto {
  return {
    jobId: JOB_ID,
    quoteId: QUOTE_ID,
    channel: 'platform-credits',
    provider: 'fake-provider',
    model: 'fake-image-model',
    capabilityVersion: 'v1',
    status: 'running',
    items: [{
      itemId: ITEM_ID,
      sequence: 0,
      status: 'running',
      reconciliation: 'pending',
    }],
    createdAt: '2026-07-22T00:00:00.000Z',
    updatedAt: '2026-07-22T00:00:01.000Z',
    ownerId: 'owner-a',
    retryCount: 0,
    maxRetries: 3,
    ...overrides,
  };
}

async function loadJobEventStream() {
  const module = await import('../../services/api/lib/generation-v3/jobEventStream.js');
  return module.default || module;
}

test('job projection events use the shared contract and distinguish item and terminal changes', async () => {
  const { createJobProjectionEvent } = await loadJobEventStream();
  const runningJob = createJob();
  const itemChangedJob = createJob({
    items: [{ ...runningJob.items[0], status: 'submitted' }],
    updatedAt: '2026-07-22T00:00:02.000Z',
  });
  const completedJob = createJob({
    status: 'completed',
    items: [{ ...runningJob.items[0], status: 'completed' }],
    updatedAt: '2026-07-22T00:00:03.000Z',
  });
  const options = {
    createEventId: () => '44444444-4444-4444-8444-444444444444',
    now: () => Date.parse('2026-07-22T00:00:04.000Z'),
  };

  const initial = createJobProjectionEvent(runningJob, null, options);
  const itemChanged = createJobProjectionEvent(itemChangedJob, runningJob, options);
  const completed = createJobProjectionEvent(completedJob, itemChangedJob, options);

  assert.equal(GenerationJobEventSchema.parse(initial).type, 'job_created');
  assert.equal(GenerationJobEventSchema.parse(itemChanged).type, 'item_status_changed');
  assert.equal(GenerationJobEventSchema.parse(completed).type, 'job_completed');
  assert.deepEqual(completed.payload, { job: completedJob });
});

test('job event stream checks owner-scoped storage before opening SSE headers', async () => {
  const { startJobEventStream } = await loadJobEventStream();
  const request = new EventEmitter();
  const headerCalls: string[] = [];
  const response = {
    setHeader(name: string) {
      headerCalls.push(name);
    },
  };
  const lookups: Array<[string, string]> = [];

  const controller = await startJobEventStream({
    getJob: async (jobId: string, userId: string) => {
      lookups.push([jobId, userId]);
      return null;
    },
    jobId: JOB_ID,
    request,
    response,
    userId: 'owner-b',
  });

  assert.equal(controller, null);
  assert.deepEqual(lookups, [[JOB_ID, 'owner-b']]);
  assert.deepEqual(headerCalls, []);
});

test('job event stream sends changed projections, heartbeats and closes after a terminal snapshot', async () => {
  const { startJobEventStream } = await loadJobEventStream();
  const request = new EventEmitter();
  const headers = new Map<string, string>();
  const writes: string[] = [];
  const clearedTimers: number[] = [];
  const scheduled: Array<{ callback: () => void | Promise<void>; intervalMs: number }> = [];
  let endCount = 0;
  let currentJob = createJob();
  const response = {
    end() {
      endCount += 1;
    },
    flushHeaders() {},
    setHeader(name: string, value: string) {
      headers.set(name, value);
    },
    status() {
      return response;
    },
    write(chunk: string) {
      writes.push(chunk);
      return true;
    },
  };

  const controller = await startJobEventStream({
    clearIntervalFn: (timerId: number) => clearedTimers.push(timerId),
    createEventId: () => '55555555-5555-4555-8555-555555555555',
    getJob: async () => currentJob,
    heartbeatIntervalMs: 15_000,
    jobId: JOB_ID,
    now: () => Date.parse('2026-07-22T00:00:05.000Z'),
    pollIntervalMs: 1_000,
    request,
    response,
    setIntervalFn: (callback: () => void | Promise<void>, intervalMs: number) => {
      scheduled.push({ callback, intervalMs });
      return scheduled.length;
    },
    userId: 'owner-a',
  });

  assert.ok(controller);
  assert.equal(headers.get('Content-Type'), 'text/event-stream; charset=utf-8');
  assert.match(writes[0], /event: job_created/);
  assert.match(writes[0], new RegExp(`\\"jobId\\":\\"${JOB_ID}\\"`));

  const pollTimer = scheduled.find((timer) => timer.intervalMs === 1_000);
  const heartbeatTimer = scheduled.find((timer) => timer.intervalMs === 15_000);
  assert.ok(pollTimer);
  assert.ok(heartbeatTimer);
  heartbeatTimer.callback();
  assert.equal(writes[writes.length - 1], ': heartbeat\n\n');

  currentJob = createJob({
    status: 'completed',
    items: [{ ...currentJob.items[0], status: 'completed' }],
    updatedAt: '2026-07-22T00:00:06.000Z',
  });
  await pollTimer.callback();

  assert.match(writes[writes.length - 1] || '', /event: job_completed/);
  assert.equal(endCount, 1);
  assert.deepEqual(clearedTimers.sort(), [1, 2]);
});

test('generation job events route returns the same JSON 404 before SSE for a non-owner', async () => {
  const generationV3 = require('../../services/api/lib/generation-v3/index.js');
  const originalGetJob = generationV3.getJob;
  const router = require('../../services/api/routes/generation-v3.js');
  const routeLayer = router.stack.find(
    (layer: { route?: { path?: string } }) => layer.route?.path === '/v1/generation/jobs/:jobId/events',
  );
  assert.ok(routeLayer);

  const handler = routeLayer.route.stack.at(-1).handle;
  const request = Object.assign(new EventEmitter(), {
    params: { jobId: JOB_ID },
    userId: 'owner-b',
  });
  const headers = new Map<string, string>();
  let statusCode = 200;
  let payload: unknown;
  const response = {
    json(value: unknown) {
      payload = value;
      return value;
    },
    setHeader(name: string, value: string) {
      headers.set(name, value);
    },
    status(value: number) {
      statusCode = value;
      return response;
    },
  };
  const lookups: Array<[string, string]> = [];
  generationV3.getJob = async (jobId: string, userId: string) => {
    lookups.push([jobId, userId]);
    return null;
  };

  try {
    await handler(request, response);
  } finally {
    generationV3.getJob = originalGetJob;
  }

  assert.equal(statusCode, 404);
  assert.deepEqual(lookups, [[JOB_ID, 'owner-b']]);
  assert.equal(headers.has('Content-Type'), false);
  assert.equal((payload as { error?: { code?: string } })?.error?.code, 'JOB_NOT_FOUND');
});
