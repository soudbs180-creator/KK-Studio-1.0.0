import { before, describe, it } from 'node:test';
import assert from 'node:assert/strict';

// 在导入任何模块之前，先 mock localStorage，防止 DurableGenerationQueue 实例化时报错
const mockLocalStorage = (() => {
  let store: Record<string, string> = {};
  return {
    getItem(key: string) {
      return store[key] || null;
    },
    setItem(key: string, value: string) {
      store[key] = value.toString();
    },
    clear() {
      store = {};
    },
    removeItem(key: string) {
      delete store[key];
    }
  };
})();

globalThis.localStorage = mockLocalStorage as any;

// 导入被测模块
import { DurableGenerationQueue } from '../../apps/web/src/features/ai-assistant-runtime/queue/DurableGenerationQueue.ts';

describe('DurableGenerationQueue Recovery Tests', () => {
  before(() => {
    globalThis.localStorage = mockLocalStorage as any;
    mockLocalStorage.clear();
  });

  it('P0: should hold task as queued if executor is missing, and auto-process once executor is registered', async () => {
    mockLocalStorage.clear();
    const queue = new DurableGenerationQueue();

    // 此时 executor 为空
    const prompts = [{ id: 'p1', prompt: 'cute cat' }];
    const options = { modelId: 'test-model', concurrency: 1 };

    const job = queue.createJob(prompts, options, 'canvas-1', 'key-recover-1');
    assert.equal(job.status, 'queued');

    // 等待一个小周期，验证它不会自动跑起来，或者即使跑了也会退回到 queued
    await new Promise(resolve => setTimeout(resolve, 50));
    const currentJob = queue.getJob(job.id)!;
    assert.equal(currentJob.status, 'queued');
    assert.equal(currentJob.prompts[0].status, 'queued');
    assert.equal(currentJob.prompts[0].error, 'No executor registered yet');

    // 注册 executor
    let executed = false;
    queue.registerExecutor(async (prompt) => {
      executed = true;
      return ['img_123'];
    });

    // 注册后应触发 scheduleProcess()，等待一会看任务是否成功执行
    await new Promise(resolve => setTimeout(resolve, 100));

    const finalJob = queue.getJob(job.id)!;
    assert.equal(finalJob.status, 'completed');
    assert.equal(finalJob.prompts[0].status, 'completed');
    assert.deepEqual(finalJob.prompts[0].resultImageNodeIds, ['img_123']);
    assert.equal(executed, true);
  });

  it('P0: cancelled job should not recover after registering executor', async () => {
    mockLocalStorage.clear();
    const queue = new DurableGenerationQueue();

    const prompts = [{ id: 'p1', prompt: 'cute dog' }];
    const options = { modelId: 'test-model', concurrency: 1 };

    const job = queue.createJob(prompts, options, 'canvas-1', 'key-cancelled');
    queue.cancelJob(job.id);

    const cancelledJob = queue.getJob(job.id)!;
    assert.equal(cancelledJob.status, 'cancelled');

    // 注册 executor
    let executed = false;
    queue.registerExecutor(async () => {
      executed = true;
      return ['img_dog'];
    });

    await new Promise(resolve => setTimeout(resolve, 50));
    const postRegisterJob = queue.getJob(job.id)!;
    assert.equal(postRegisterJob.status, 'cancelled');
    assert.equal(executed, false);
  });

  it('P0: paused job should not recover after registering executor, but resume recovers it', async () => {
    mockLocalStorage.clear();
    const queue = new DurableGenerationQueue();

    const prompts = [{ id: 'p1', prompt: 'cute fox' }];
    const options = { modelId: 'test-model', concurrency: 1 };

    const job = queue.createJob(prompts, options, 'canvas-1', 'key-paused');
    queue.pauseJob(job.id);

    const pausedJob = queue.getJob(job.id)!;
    assert.equal(pausedJob.status, 'paused');

    // 注册 executor
    let executed = false;
    queue.registerExecutor(async () => {
      executed = true;
      return ['img_fox'];
    });

    await new Promise(resolve => setTimeout(resolve, 50));
    const postRegisterJob = queue.getJob(job.id)!;
    assert.equal(postRegisterJob.status, 'paused');
    assert.equal(executed, false);

    // 恢复执行
    queue.resumeJob(job.id);
    await new Promise(resolve => setTimeout(resolve, 100));

    const completedJob = queue.getJob(job.id)!;
    assert.equal(completedJob.status, 'completed');
    assert.equal(executed, true);
  });

  it('P0: should respect idempotency key to prevent duplicate creation', async () => {
    mockLocalStorage.clear();
    const queue = new DurableGenerationQueue();
    queue.clearAllJobs();
    if (queue['processTimer']) {
      clearTimeout(queue['processTimer']);
      queue['processTimer'] = null;
    }
    queue.registerExecutor(async () => []);

    const prompts = [{ id: 'p1', prompt: 'test' }];
    const job1 = queue.createJob(prompts, {}, 'canvas-1', 'same-idempotency');
    const job2 = queue.createJob(prompts, {}, 'canvas-1', 'same-idempotency');

    assert.equal(job1.id, job2.id);
    assert.equal(queue.getJobs().length, 1);
  });
});
