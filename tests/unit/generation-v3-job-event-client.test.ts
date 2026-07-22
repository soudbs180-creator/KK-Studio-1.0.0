import assert from 'node:assert/strict';
import test from 'node:test';

import type { GenerationJobDto, GenerationJobEvent } from '../../packages/shared/src/index.ts';

const JOB_ID = '11111111-1111-4111-8111-111111111111';

function createJob(status: GenerationJobDto['status']): GenerationJobDto {
  return {
    jobId: JOB_ID,
    quoteId: '22222222-2222-4222-8222-222222222222',
    channel: 'platform-credits',
    provider: 'fake-provider',
    model: 'fake-image-model',
    capabilityVersion: 'v1',
    status,
    items: [{
      itemId: '33333333-3333-4333-8333-333333333333',
      sequence: 0,
      status: status === 'completed' ? 'completed' : 'running',
      reconciliation: 'pending',
    }],
    createdAt: '2026-07-22T00:00:00.000Z',
    updatedAt: status === 'completed'
      ? '2026-07-22T00:00:02.000Z'
      : '2026-07-22T00:00:01.000Z',
    ownerId: 'owner-a',
    retryCount: 0,
    maxRetries: 3,
  };
}

function createEvent(job: GenerationJobDto, type: GenerationJobEvent['type']): GenerationJobEvent {
  return {
    eventId: type === 'job_completed'
      ? '55555555-5555-4555-8555-555555555555'
      : '44444444-4444-4444-8444-444444444444',
    jobId: JOB_ID,
    type,
    payload: { job },
    createdAt: '2026-07-22T00:00:03.000Z',
  };
}

function eventFrame(event: GenerationJobEvent): string {
  return `id: ${event.eventId}\nevent: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`;
}

function streamResponse(chunks: string[], status = 200): Response {
  const encoder = new TextEncoder();
  return new Response(new ReadableStream({
    start(controller) {
      chunks.forEach((chunk) => controller.enqueue(encoder.encode(chunk)));
      controller.close();
    },
  }), {
    status,
    headers: { 'Content-Type': 'text/event-stream; charset=utf-8' },
  });
}

async function loadJobEventClient() {
  return import('../../apps/web/src/services/generation/generationJobEventClient.ts');
}

async function loadJobRecovery() {
  return import('../../apps/web/src/services/generation/generationJobRecovery.ts');
}

test('authenticated fetch SSE parses split frames and resolves the terminal Job projection', async () => {
  const { observeGenerationJob } = await loadJobEventClient();
  const completedJob = createJob('completed');
  const frame = eventFrame(createEvent(completedJob, 'job_completed'));
  const received: GenerationJobDto[] = [];
  const requests: Array<{ input: string; authorization?: string; accept?: string }> = [];

  const result = await observeGenerationJob(JOB_ID, {
    apiBaseUrl: 'https://api.kkstudio.test',
    fetchImpl: async (input: RequestInfo | URL, init?: RequestInit) => {
      const headers = new Headers(init?.headers);
      requests.push({
        input: String(input),
        authorization: headers.get('Authorization') || undefined,
        accept: headers.get('Accept') || undefined,
      });
      return streamResponse([frame.slice(0, 23), frame.slice(23)]);
    },
    getAccessToken: async () => 'owner-token',
    getOwnerId: () => 'owner-a',
    maxReconnectAttempts: 0,
    onEvent: (job: GenerationJobDto) => received.push(job),
  });

  assert.equal(result?.status, 'completed');
  assert.deepEqual(received, [completedJob]);
  assert.deepEqual(requests, [{
    input: `https://api.kkstudio.test/api/v1/generation/jobs/${JOB_ID}/events`,
    authorization: 'Bearer owner-token',
    accept: 'text/event-stream',
  }]);
});

test('job observer refreshes one unauthorized token and returns null for an owner-scoped 404', async () => {
  const { observeGenerationJob } = await loadJobEventClient();
  let refreshCount = 0;
  let requestCount = 0;
  const missing = await observeGenerationJob(JOB_ID, {
    apiBaseUrl: 'https://api.kkstudio.test',
    fetchImpl: async () => {
      requestCount += 1;
      return requestCount === 1
        ? new Response('', { status: 401 })
        : new Response('', { status: 404 });
    },
    getAccessToken: async () => 'expired-token',
    getOwnerId: () => 'owner-a',
    maxReconnectAttempts: 0,
    refreshAccessToken: async () => {
      refreshCount += 1;
      return 'fresh-token';
    },
  });

  assert.equal(missing, null);
  assert.equal(refreshCount, 1);
  assert.equal(requestCount, 2);
});

test('job observer reconnects after a truncated non-terminal stream', async () => {
  const { observeGenerationJob } = await loadJobEventClient();
  const runningFrame = eventFrame(createEvent(createJob('running'), 'job_created'));
  const completedFrame = eventFrame(createEvent(createJob('completed'), 'job_completed'));
  const delays: number[] = [];
  let requestCount = 0;

  const result = await observeGenerationJob(JOB_ID, {
    apiBaseUrl: 'https://api.kkstudio.test',
    fetchImpl: async () => {
      requestCount += 1;
      return streamResponse([requestCount === 1 ? runningFrame : completedFrame]);
    },
    getAccessToken: async () => 'owner-token',
    getOwnerId: () => 'owner-a',
    maxReconnectAttempts: 1,
    reconnectBaseDelayMs: 100,
    sleep: async (delayMs: number) => {
      delays.push(delayMs);
    },
  });

  assert.equal(result?.status, 'completed');
  assert.equal(requestCount, 2);
  assert.deepEqual(delays, [100]);
});

test('job observer refreshes authentication at most once across reconnects', async () => {
  const { GenerationJobObservationError, observeGenerationJob } = await loadJobEventClient();
  const runningFrame = eventFrame(createEvent(createJob('running'), 'job_created'));
  let refreshCount = 0;
  let requestCount = 0;

  await assert.rejects(
    () => observeGenerationJob(JOB_ID, {
      apiBaseUrl: 'https://api.kkstudio.test',
      fetchImpl: async () => {
        requestCount += 1;
        if (requestCount === 1 || requestCount === 3) return new Response('', { status: 401 });
        return streamResponse([runningFrame]);
      },
      getAccessToken: async () => 'expired-token',
      getOwnerId: () => 'owner-a',
      maxReconnectAttempts: 1,
      refreshAccessToken: async () => {
        refreshCount += 1;
        return `fresh-token-${refreshCount}`;
      },
      sleep: async () => undefined,
    }),
    (error: unknown) => error instanceof GenerationJobObservationError && error.code === 'AUTH_REQUIRED',
  );

  assert.equal(requestCount, 3);
  assert.equal(refreshCount, 1);
});

test('job observer stops without dispatching when the authenticated owner changes', async () => {
  const { GenerationJobObservationError, observeGenerationJob } = await loadJobEventClient();
  const completedFrame = eventFrame(createEvent(createJob('completed'), 'job_completed'));
  let ownerReadCount = 0;
  let dispatchCount = 0;

  await assert.rejects(
    () => observeGenerationJob(JOB_ID, {
      apiBaseUrl: 'https://api.kkstudio.test',
      fetchImpl: async () => streamResponse([completedFrame]),
      getAccessToken: async () => 'owner-token',
      getOwnerId: () => (++ownerReadCount === 1 ? 'owner-a' : 'owner-b'),
      maxReconnectAttempts: 3,
      onEvent: () => {
        dispatchCount += 1;
      },
    }),
    (error: unknown) => error instanceof GenerationJobObservationError && error.code === 'OWNER_CHANGED',
  );

  assert.equal(dispatchCount, 0);
});

test('job observer preserves an in-flight abort even with no reconnect budget', async () => {
  const { GenerationJobObservationError, observeGenerationJob } = await loadJobEventClient();
  const controller = new AbortController();

  await assert.rejects(
    () => observeGenerationJob(JOB_ID, {
      apiBaseUrl: 'https://api.kkstudio.test',
      fetchImpl: async () => {
        controller.abort();
        throw new DOMException('aborted', 'AbortError');
      },
      getAccessToken: async () => 'owner-token',
      getOwnerId: () => 'owner-a',
      maxReconnectAttempts: 0,
      signal: controller.signal,
    }),
    (error: unknown) => error instanceof GenerationJobObservationError && error.code === 'ABORTED',
  );
});

test('generation recovery uses SSE for a v3 Job then performs one existing terminal projection update', async () => {
  const { resumeGenerationTask } = await loadJobRecovery();
  const node = { id: 'prompt-node' };
  const polled: Array<{ node: typeof node; taskId: string }> = [];
  let observedJobId = '';

  const outcome = await resumeGenerationTask(node, JOB_ID, async (currentNode, taskId) => {
    polled.push({ node: currentNode, taskId });
  }, {
    observeJob: async (jobId: string) => {
      observedJobId = jobId;
      return createJob('completed');
    },
  });

  assert.equal(outcome, 'streamed');
  assert.equal(observedJobId, JOB_ID);
  assert.deepEqual(polled, [{ node, taskId: JOB_ID }]);
});

test('generation recovery falls back to polling for non-v3 ids, 404 and transient stream failures', async () => {
  const { resumeGenerationTask } = await loadJobRecovery();
  const polled: string[] = [];
  let observeCount = 0;
  const poll = async (_node: { id: string }, taskId: string) => {
    polled.push(taskId);
  };

  await resumeGenerationTask({ id: 'node-a' }, 'local_proxy:task-1', poll, {
    observeJob: async () => {
      observeCount += 1;
      return null;
    },
  });
  await resumeGenerationTask({ id: 'node-b' }, JOB_ID, poll, {
    observeJob: async () => {
      observeCount += 1;
      return null;
    },
  });
  await resumeGenerationTask({ id: 'node-c' }, JOB_ID, poll, {
    observeJob: async () => {
      observeCount += 1;
      throw new Error('network unavailable');
    },
  });

  assert.equal(observeCount, 2);
  assert.deepEqual(polled, ['local_proxy:task-1', JOB_ID, JOB_ID]);
});

test('generation recovery never falls back across owner change or abort', async () => {
  const { GenerationJobObservationError } = await loadJobEventClient();
  const { resumeGenerationTask } = await loadJobRecovery();
  const polled: string[] = [];
  const controller = new AbortController();

  const ownerOutcome = await resumeGenerationTask({ id: 'node-a' }, JOB_ID, async (_node, taskId) => {
    polled.push(taskId);
  }, {
    observeJob: async () => {
      throw new GenerationJobObservationError('OWNER_CHANGED', 'owner changed');
    },
  });
  controller.abort();
  const abortOutcome = await resumeGenerationTask({ id: 'node-b' }, JOB_ID, async (_node, taskId) => {
    polled.push(taskId);
  }, {
    observeJob: async () => createJob('completed'),
    signal: controller.signal,
  });

  assert.equal(ownerOutcome, 'cancelled');
  assert.equal(abortOutcome, 'cancelled');
  assert.deepEqual(polled, []);
});
