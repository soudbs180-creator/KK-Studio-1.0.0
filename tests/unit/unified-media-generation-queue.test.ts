import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { DurableGenerationQueue } from '../../apps/web/src/features/ai-assistant-runtime/queue/DurableGenerationQueue.ts';

const createStorage = (seed?: Record<string, string>) => {
  const values = new Map(Object.entries(seed || {}));
  return {
    getItem(key: string) {
      return values.get(key) || null;
    },
    setItem(key: string, value: string) {
      values.set(key, value);
    },
  };
};

const waitForTerminal = async (queue: DurableGenerationQueue, jobId: string) => {
  for (let attempt = 0; attempt < 50; attempt += 1) {
    const job = queue.getJob(jobId);
    if (job && ['completed', 'completed_with_errors', 'failed', 'cancelled'].includes(job.status)) return job;
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
  throw new Error(`Job ${jobId} did not reach a terminal state.`);
};

describe('Unified media DurableGenerationQueue', () => {
  it('migrates legacy localStorage jobs to schema v2 image jobs', () => {
    const legacy = [{
      id: 'legacy-job',
      idempotencyKey: 'legacy-key',
      canvasId: 'canvas-1',
      status: 'queued',
      createdBy: 'assistant',
      prompts: [{ id: 'p1', prompt: 'legacy image', status: 'queued', retryCount: 0 }],
      options: { modelId: 'legacy-model', concurrency: 3, layout: 'grid' },
      createdAt: 1,
      updatedAt: 1,
    }];
    const queue = new DurableGenerationQueue(createStorage({
      kk_durable_generation_jobs: JSON.stringify(legacy),
    }));
    const migrated = queue.getJob('legacy-job');
    assert.equal(migrated?.schemaVersion, 2);
    assert.equal(migrated?.taskType, 'image');
    assert.equal(migrated?.progress.total, 1);
  });

  it('enforces media-specific batch and concurrency limits', () => {
    const queue = new DurableGenerationQueue(createStorage());
    const prompts = Array.from({ length: 21 }, (_, index) => ({ id: `v${index}`, prompt: `video ${index}` }));
    assert.throws(() => queue.createJob(prompts, { taskType: 'video' }, 'canvas'), /maxBatchSize=20/);

    const video = queue.createJob([{ id: 'v1', prompt: 'orbit shot' }], { taskType: 'video', concurrency: 99 }, 'canvas', 'video-limit');
    const audio = queue.createJob([{ id: 'a1', prompt: 'ambient music' }], { taskType: 'audio', concurrency: 99 }, 'canvas', 'audio-limit');
    assert.equal(video.options.concurrency, 2);
    assert.equal(audio.options.concurrency, 4);
  });

  it('marks mixed results completed_with_errors and keeps stage progress', async () => {
    const queue = new DurableGenerationQueue(createStorage());
    queue.registerExecutor(async (_prompt, _options, _jobId, promptId) => {
      if (promptId === 'bad') throw new Error('invalid input for provider');
      return {
        resultImageNodeIds: [`node-${promptId}`],
        providerTaskId: `provider-${promptId}`,
      };
    });
    const created = queue.createJob([
      { id: 'good', prompt: 'valid prompt' },
      { id: 'bad', prompt: 'invalid prompt' },
    ], { taskType: 'video', concurrency: 2 }, 'canvas', 'partial-video');
    const finished = await waitForTerminal(queue, created.id);
    assert.equal(finished.status, 'completed_with_errors');
    assert.equal(finished.progress.percent, 100);
    assert.equal(finished.progress.completed, 1);
    assert.equal(finished.progress.failed, 1);
    assert.equal(finished.prompts.find((item) => item.id === 'bad')?.retryable, false);
    assert.equal(finished.prompts.find((item) => item.id === 'good')?.providerTaskId, 'provider-good');
  });

  it('does not retry localized setup errors', async () => {
    const queue = new DurableGenerationQueue(createStorage());
    let calls = 0;
    queue.registerExecutor(async () => {
      calls += 1;
      throw new Error('未配置 API 密钥');
    });
    const created = queue.createJob(
      [{ id: 'setup-error', prompt: 'product poster' }],
      { taskType: 'image' },
      'canvas',
      'localized-setup-error',
    );
    const finished = await waitForTerminal(queue, created.id);
    assert.equal(finished.status, 'failed');
    assert.equal(finished.prompts[0]?.retryable, false);
    assert.equal(finished.prompts[0]?.errorCategory, 'authentication');
    assert.equal(calls, 1);
  });

  it('aborts an in-flight provider request when cancelled', async () => {
    const queue = new DurableGenerationQueue(createStorage());
    let aborted = false;
    queue.registerExecutor(async (_prompt, _options, _jobId, _promptId, signal) => new Promise((resolve, reject) => {
      signal.addEventListener('abort', () => {
        aborted = true;
        reject(new DOMException('cancelled', 'AbortError'));
      }, { once: true });
    }));
    const created = queue.createJob([{ id: 'v1', prompt: 'long video' }], { taskType: 'video' }, 'canvas', 'cancel-video');
    await new Promise((resolve) => setTimeout(resolve, 20));
    queue.cancelJob(created.id);
    const finished = await waitForTerminal(queue, created.id);
    assert.equal(finished.status, 'cancelled');
    assert.equal(aborted, true);
  });
});
