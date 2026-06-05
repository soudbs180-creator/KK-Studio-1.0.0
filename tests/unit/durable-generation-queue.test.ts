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

describe('DurableGenerationQueue Tests', () => {
  before(() => {
    mockLocalStorage.clear();
  });

  it('should create a job and keep initial queued status', async () => {
    mockLocalStorage.clear();
    const queue = new DurableGenerationQueue();
    
    // 注册一个空的 executor，防止意外自动处理
    queue.registerExecutor(async () => []);

    const prompts = [
      { id: 'p1', prompt: 'cute cat' },
      { id: 'p2', prompt: 'fluffy dog' }
    ];
    const options = {
      modelId: 'test-model',
      concurrency: 2
    };

    const job = queue.createJob(prompts, options, 'canvas-1', 'key-123');

    assert.equal(job.status, 'queued');
    assert.equal(job.canvasId, 'canvas-1');
    assert.equal(job.idempotencyKey, 'key-123');
    assert.equal(job.prompts.length, 2);
    assert.equal(job.prompts[0].status, 'queued');
    assert.equal(job.prompts[1].status, 'queued');

    // 检查是否成功持久化
    const stored = JSON.parse(mockLocalStorage.getItem('kk_durable_generation_jobs') || '[]');
    assert.equal(stored.length, 1);
    assert.equal(stored[0].id, job.id);
  });

  it('should support idempotency check to avoid duplicate job creation', async () => {
    mockLocalStorage.clear();
    const queue = new DurableGenerationQueue();
    queue.registerExecutor(async () => []);

    const prompts = [{ id: 'p1', prompt: 'test' }];
    const options = {};

    const job1 = queue.createJob(prompts, options, 'canvas-1', 'same-key');
    const job2 = queue.createJob(prompts, options, 'canvas-1', 'same-key');

    assert.equal(job1.id, job2.id);
    assert.equal(queue.getJobs().length, 1);
  });

  it('should derive a stable idempotency key when one is not provided', async () => {
    mockLocalStorage.clear();
    const queue = new DurableGenerationQueue();
    queue.registerExecutor(async () => []);

    const prompts = [{ id: 'p1', prompt: 'same prompt' }];
    const options = { modelId: 'test-model', concurrency: 3 };

    const job1 = queue.createJob(prompts, options, 'canvas-1');
    const job2 = queue.createJob(prompts, options, 'canvas-1');

    assert.equal(job1.id, job2.id);
    assert.equal(job1.idempotencyKey, job2.idempotencyKey);
    assert.equal(queue.getJobs().length, 1);
  });

  it('should enforce max batch size and normalize concurrency limits', async () => {
    mockLocalStorage.clear();
    const queue = new DurableGenerationQueue();
    queue.registerExecutor(async () => []);

    const prompts = Array.from({ length: 101 }, (_, index) => ({
      id: `p${index}`,
      prompt: `prompt ${index}`
    }));

    assert.throws(
      () => queue.createJob(prompts, { concurrency: 99 }, 'canvas-1'),
      /maxBatchSize=100/
    );

    const highConcurrencyJob = queue.createJob([{ id: 'p1', prompt: 'test' }], { concurrency: 99 }, 'canvas-1', 'high');
    const lowConcurrencyJob = queue.createJob([{ id: 'p2', prompt: 'test' }], { concurrency: -1 }, 'canvas-1', 'low');

    assert.equal(highConcurrencyJob.options.concurrency, 8);
    assert.equal(lowConcurrencyJob.options.concurrency, 3);
  });

  it('should respect concurrency limit and process queue sequentially', async () => {
    mockLocalStorage.clear();
    const queue = new DurableGenerationQueue();

    // 延时 executor
    let resolveFirst: ((val: string[]) => void) | null = null;
    let resolveSecond: ((val: string[]) => void) | null = null;
    
    queue.registerExecutor(async (prompt, opt, jobId, promptId) => {
      return new Promise<string[]>((resolve) => {
        if (promptId === 'p1') {
          resolveFirst = resolve;
        } else if (promptId === 'p2') {
          resolveSecond = resolve;
        } else {
          resolve([]);
        }
      });
    });

    const prompts = [
      { id: 'p1', prompt: 'prompt 1' },
      { id: 'p2', prompt: 'prompt 2' },
      { id: 'p3', prompt: 'prompt 3' }
    ];
    
    // 设置并发为 1
    const job = queue.createJob(prompts, { concurrency: 1 }, 'canvas-1');

    // 等待微任务/setTimeout 启动队列调度
    await new Promise(resolve => setTimeout(resolve, 10));

    // 因为并发限制为 1，此时只有第一个子任务在运行
    assert.equal(job.status, 'running');
    assert.equal(job.prompts[0].status, 'running');
    assert.equal(job.prompts[1].status, 'queued');
    assert.equal(job.prompts[2].status, 'queued');

    // 完成第一个子任务
    if (resolveFirst) {
      (resolveFirst as any)(['node-1']);
    }
    
    // 等待队列流转到下一个
    await new Promise(resolve => setTimeout(resolve, 10));

    // 第二个任务应该开始运行，第一个已完成，第三个仍在队列
    assert.equal(job.prompts[0].status, 'completed');
    assert.equal(job.prompts[0].resultImageNodeIds?.[0], 'node-1');
    assert.equal(job.prompts[1].status, 'running');
    assert.equal(job.prompts[2].status, 'queued');

    // 完成第二个子任务
    if (resolveSecond) {
      (resolveSecond as any)(['node-2']);
    }

    // 等待队列全部流转完成
    await new Promise(resolve => setTimeout(resolve, 50));

    assert.equal(job.prompts[1].status, 'completed');
    assert.equal(job.prompts[2].status, 'completed');
    assert.equal(job.status, 'completed');
  });

  it('should support pausing and resuming jobs', async () => {
    mockLocalStorage.clear();
    const queue = new DurableGenerationQueue();

    let resolveTask: ((val: string[]) => void) | null = null;
    queue.registerExecutor(async () => {
      return new Promise<string[]>((resolve) => {
        resolveTask = resolve;
      });
    });

    const prompts = [
      { id: 'p1', prompt: 'prompt 1' },
      { id: 'p2', prompt: 'prompt 2' }
    ];

    const job = queue.createJob(prompts, { concurrency: 1 }, 'canvas-1');

    // 等待调度启动第一个任务
    await new Promise(resolve => setTimeout(resolve, 10));
    assert.equal(job.status, 'running');
    assert.equal(job.prompts[0].status, 'running');

    // 暂停 Job
    queue.pauseJob(job.id);
    assert.equal(job.status, 'paused');
    // 暂停后，原先处于 running 的子任务应该重置为 queued
    assert.equal(job.prompts[0].status, 'queued');

    // 如果任务完成了，它也不应该触发下一个，因为已暂停
    if (resolveTask) {
      (resolveTask as any)(['node-1']);
    }
    await new Promise(resolve => setTimeout(resolve, 10));
    assert.equal(job.status, 'paused');
    assert.equal(job.prompts[1].status, 'queued');

    // 恢复 Job
    queue.resumeJob(job.id);
    assert.equal(job.status, 'queued'); // 恢复后变回 queued 等待调度

    // 等待调度重新启动
    await new Promise(resolve => setTimeout(resolve, 10));
    assert.equal(job.status, 'running');
    // 之前 prompts[0] 已经被 executor resolve 并设置为 completed 了，因此现在应该开始跑 prompts[1]
    assert.equal(job.prompts[0].status, 'completed');
    assert.equal(job.prompts[1].status, 'running');
  });

  it('should retry on failure up to max 3 times and backoff', async () => {
    mockLocalStorage.clear();
    const originalSetTimeout = globalThis.setTimeout;
    
    // 只在延迟为 2000 毫秒时，将其修改为 1 毫秒；其他毫秒数完整保留，避免影响 Node 的内部调度
    globalThis.setTimeout = function (cb: any, ms?: number, ...args: any[]) {
      const actualMs = ms === 2000 ? 1 : ms;
      return originalSetTimeout(cb, actualMs, ...args);
    } as any;

    try {
      const queue = new DurableGenerationQueue();
      let callCount = 0;

      queue.registerExecutor(async (prompt, options, jobId, promptId) => {
        callCount++;
        throw new Error('temporary_error');
      });

      const prompts = [{ id: 'p1', prompt: 'retry-test' }];
      const job = queue.createJob(prompts, { concurrency: 1 }, 'canvas-1');

      // 稍微多等待一下，确保 4 次（初始1次 + 3次重试）有足够时间在 1ms 延迟下全部调度完毕
      await new Promise(resolve => originalSetTimeout(resolve, 150));

      assert.equal(callCount, 4);
      assert.equal(job.prompts[0].status, 'failed');
      assert.equal(job.prompts[0].retryCount, 3);
      assert.equal(job.prompts[0].error, 'temporary_error');
      assert.equal(job.status, 'completed');
    } finally {
      // 还原 setTimeout
      globalThis.setTimeout = originalSetTimeout;
    }
  });

  it('should persist output group node ids and reuse the same job by idempotency key', async () => {
    mockLocalStorage.clear();
    const queue = new DurableGenerationQueue();
    let arrangedIds: string[] = [];
    let completedGroupId = '';

    queue.registerExecutor(async (_prompt, _options, _jobId, promptId) => ({
      promptNodeId: `prompt-node-${promptId}`,
      resultImageNodeIds: [`image-node-${promptId}`]
    }));
    queue.registerArrangeHandler(async (nodeIds) => {
      arrangedIds = nodeIds;
    });
    queue.registerCompletionHandler(async (job, nodeIds) => {
      if (job.outputGroup) {
        job.outputGroup.groupId = job.outputGroup.groupId || `group-${job.id}`;
        job.outputGroup.nodeIds = nodeIds;
        completedGroupId = job.outputGroup.groupId;
      }
    });

    const prompts = [
      { id: 'p1', prompt: 'compact product layout' },
      { id: 'p2', prompt: 'compact product layout' }
    ];
    const outputGroup = {
      label: 'AI ecommerce batch',
      color: '#ffffff',
      includePromptNodes: true,
      tags: ['automation']
    };
    const job = queue.createJob(prompts, {
      concurrency: 2,
      layoutPreset: 'compact-grid',
      outputGroup
    }, 'canvas-1', 'grouped-key');

    await new Promise(resolve => setTimeout(resolve, 50));

    assert.equal(job.status, 'completed');
    assert.ok(job.outputGroup?.nodeIds?.includes('prompt-node-p1'));
    assert.ok(job.outputGroup?.nodeIds?.includes('image-node-p1'));
    assert.deepEqual(arrangedIds.sort(), (job.outputGroup?.nodeIds || []).slice().sort());
    assert.equal(completedGroupId, job.outputGroup?.groupId);

    const sameJob = queue.createJob(prompts, {
      concurrency: 2,
      outputGroup: {
        ...outputGroup,
        groupId: 'should-not-replace-existing'
      }
    }, 'canvas-1', 'grouped-key');

    assert.equal(sameJob.id, job.id);
    assert.equal(queue.getJobs().length, 1);
    assert.equal(sameJob.outputGroup?.groupId, completedGroupId);
  });
});
