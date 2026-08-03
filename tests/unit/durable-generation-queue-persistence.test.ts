import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { DurableGenerationQueue } from '../../apps/web/src/features/ai-assistant-runtime/queue/DurableGenerationQueue.ts';

class SwitchableStorage {
  readonly values = new Map<string, string>();
  failWrites = false;
  failWhen: ((value: string) => boolean) | null = null;

  getItem(key: string) {
    return this.values.get(key) || null;
  }

  setItem(key: string, value: string) {
    if (this.failWrites || this.failWhen?.(value)) throw new Error('simulated_storage_failure');
    this.values.set(key, value);
  }

  raw() {
    return this.getItem('kk_durable_generation_jobs');
  }
}

const waitFor = async (predicate: () => boolean, message: string, timeoutMs = 500) => {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (predicate()) return;
    await new Promise((resolve) => setTimeout(resolve, 5));
  }
  throw new Error(message);
};

describe('DurableGenerationQueue persistence safety', () => {
  it('rolls back pause and resume mutations without notifying an uncommitted state', () => {
    const storage = new SwitchableStorage();
    const queue = new DurableGenerationQueue(storage);
    const created = queue.createJob([{ id: 'p1', prompt: 'poster' }], {}, 'canvas', 'atomic-controls');
    const beforePause = queue.getJobs();
    const rawBeforePause = storage.raw();
    const observedStatuses: string[] = [];
    const unsubscribe = queue.subscribe((jobs) => {
      if (jobs[0]) observedStatuses.push(jobs[0].status);
    });

    storage.failWrites = true;
    assert.throws(() => queue.pauseJob(created.id), (error: any) => error?.code === 'DURABLE_STORAGE_UNAVAILABLE');
    assert.deepEqual(queue.getJobs(), beforePause);
    assert.equal(storage.raw(), rawBeforePause);
    assert.equal(observedStatuses.includes('paused'), false);

    storage.failWrites = false;
    queue.pauseJob(created.id);
    const pausedSnapshot = queue.getJobs();
    const pausedRaw = storage.raw();
    storage.failWrites = true;
    assert.throws(() => queue.resumeJob(created.id), (error: any) => error?.code === 'DURABLE_STORAGE_UNAVAILABLE');
    assert.deepEqual(queue.getJobs(), pausedSnapshot);
    assert.equal(storage.raw(), pausedRaw);
    unsubscribe();
  });

  it('persists cancellation before aborting an in-flight provider request', async () => {
    const storage = new SwitchableStorage();
    const queue = new DurableGenerationQueue(storage);
    let aborted = false;
    queue.registerExecutor(async (_prompt, _options, _jobId, _promptId, signal) => new Promise((resolve, reject) => {
      signal.addEventListener('abort', () => {
        aborted = true;
        reject(new DOMException('cancelled', 'AbortError'));
      }, { once: true });
    }));
    const created = queue.createJob([{ id: 'p1', prompt: 'video' }], { taskType: 'video' }, 'canvas', 'atomic-cancel');
    await waitFor(() => queue.getJob(created.id)?.prompts[0]?.providerStartedAt !== undefined, 'provider did not start');

    storage.failWrites = true;
    assert.throws(() => queue.cancelJob(created.id), (error: any) => error?.code === 'DURABLE_STORAGE_UNAVAILABLE');
    assert.equal(queue.getJob(created.id)?.status, 'running');
    assert.equal(aborted, false);

    storage.failWrites = false;
    queue.cancelJob(created.id);
    assert.equal(JSON.parse(storage.raw() || '[]')[0]?.status, 'cancelled');
    await waitFor(() => aborted, 'provider signal was not aborted after durable cancellation');
  });

  it('quarantines a provider result when its completion snapshot cannot be saved', async () => {
    const storage = new SwitchableStorage();
    const queue = new DurableGenerationQueue(storage);
    let calls = 0;
    queue.registerExecutor(async () => {
      calls += 1;
      return ['node-1'];
    });
    storage.failWhen = (value) => value.includes('"status":"completed"');
    const created = queue.createJob([{ id: 'p1', prompt: 'product' }], {}, 'canvas', 'terminal-write-failure');
    await waitFor(() => queue.getJob(created.id)?.prompts[0]?.reconciliationRequired === true, 'job was not quarantined');

    const quarantined = queue.getJob(created.id)!;
    assert.equal(calls, 1);
    assert.equal(quarantined.prompts[0]?.status, 'failed');
    assert.equal(quarantined.prompts[0]?.retryable, false);
    assert.equal(quarantined.prompts[0]?.errorCategory, 'persistence');
    assert.deepEqual(quarantined.prompts[0]?.resultImageNodeIds, ['node-1']);

    const reloaded = new DurableGenerationQueue(storage);
    reloaded.registerExecutor(async () => {
      calls += 1;
      return ['duplicate'];
    });
    await new Promise((resolve) => setTimeout(resolve, 30));
    assert.equal(calls, 1);
    assert.equal(reloaded.getJobs()[0]?.prompts[0]?.retryable, false);
  });

  it('never replays a persisted provider-started item when storage remains unavailable', async () => {
    const storage = new SwitchableStorage();
    const queue = new DurableGenerationQueue(storage);
    let calls = 0;
    let resolveProvider!: (value: string[]) => void;
    queue.registerExecutor(async () => {
      calls += 1;
      return new Promise<string[]>((resolve) => {
        resolveProvider = resolve;
      });
    });
    const created = queue.createJob([{ id: 'p1', prompt: 'paid request' }], {}, 'canvas', 'persistent-outage');
    await waitFor(() => queue.getJob(created.id)?.prompts[0]?.providerStartedAt !== undefined, 'provider attempt was not persisted');
    storage.failWrites = true;
    resolveProvider(['node-paid']);
    await waitFor(() => queue.getJob(created.id)?.prompts[0]?.reconciliationRequired === true, 'in-memory quarantine missing');

    const reloaded = new DurableGenerationQueue(storage);
    reloaded.registerExecutor(async () => {
      calls += 1;
      return ['duplicate'];
    });
    await new Promise((resolve) => setTimeout(resolve, 30));
    assert.equal(calls, 1);
    assert.equal(reloaded.getJobs()[0]?.prompts[0]?.reconciliationRequired, true);
    assert.equal(reloaded.getJobs()[0]?.prompts[0]?.retryable, false);
  });

  it('does not auto-retry a provider error when the retry snapshot cannot be committed', async () => {
    const storage = new SwitchableStorage();
    const queue = new DurableGenerationQueue(storage);
    let calls = 0;
    queue.registerExecutor(async () => {
      calls += 1;
      storage.failWrites = true;
      throw new Error('network timeout');
    });
    const created = queue.createJob([{ id: 'p1', prompt: 'network failure' }], {}, 'canvas', 'retry-write-failure');
    await waitFor(() => queue.getJob(created.id)?.prompts[0]?.reconciliationRequired === true, 'retry was not quarantined');
    await new Promise((resolve) => setTimeout(resolve, 30));
    assert.equal(calls, 1);
    assert.equal(queue.getJob(created.id)?.prompts[0]?.retryable, false);
  });

  it('maps a remote running provider item to reconciliation instead of a paid replay', async () => {
    const storage = new SwitchableStorage();
    const queue = new DurableGenerationQueue(storage);
    const now = new Date().toISOString();
    const remote: any = {
      schemaVersion: 2,
      id: 'remote-running',
      idempotencyKey: 'remote-running-key',
      workspaceId: 'canvas',
      modelCode: 'model',
      taskType: 'image',
      status: 'running',
      parameters: { taskType: 'image' },
      progress: { total: 1, queued: 0, running: 1, completed: 0, failed: 0, percent: 0, phase: 'provider_processing' },
      outputs: [],
      items: [{ id: 'p1', prompt: 'remote paid request', status: 'running', retryCount: 0, outputs: [] }],
      createdAt: now,
      updatedAt: now,
    };
    const merged = queue.mergeRemoteJob(remote);
    let calls = 0;
    queue.registerExecutor(async () => {
      calls += 1;
      return ['duplicate'];
    });
    await new Promise((resolve) => setTimeout(resolve, 30));
    assert.equal(calls, 0);
    assert.equal(merged.prompts[0]?.reconciliationRequired, true);
    assert.equal(merged.prompts[0]?.retryable, false);
  });

  it('keeps a remote target node binding when a job is hydrated on another device', () => {
    const storage = new SwitchableStorage();
    const queue = new DurableGenerationQueue(storage);
    const now = new Date().toISOString();
    const remote: any = {
      schemaVersion: 2,
      id: 'remote-target',
      idempotencyKey: 'remote-target-key',
      workspaceId: 'canvas',
      modelCode: 'model',
      taskType: 'image',
      status: 'queued',
      parameters: { taskType: 'image' },
      progress: { total: 1, queued: 1, running: 0, completed: 0, failed: 0, percent: 0, phase: 'queued' },
      outputs: [],
      items: [{ id: 'p1', prompt: 'reuse target', targetNodeId: 'prompt-existing', status: 'queued', retryCount: 0, outputs: [] }],
      createdAt: now,
      updatedAt: now,
    };

    const merged = queue.mergeRemoteJob(remote);
    assert.equal(merged.prompts[0]?.targetNodeId, 'prompt-existing');
  });
});
