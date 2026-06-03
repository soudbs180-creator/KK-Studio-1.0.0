// 简体中文：持久化批量任务生成队列 (Durable Generation Queue)

export interface GenerationBatchJob {
  id: string;
  idempotencyKey: string;
  canvasId: string;
  status: 'queued' | 'running' | 'paused' | 'completed' | 'failed' | 'cancelled';
  createdBy: 'assistant' | 'user';
  prompts: Array<{
    id: string;
    prompt: string;
    referenceImageNodeId?: string;
    status: 'queued' | 'running' | 'completed' | 'failed';
    promptNodeId?: string;
    resultImageNodeIds?: string[];
    error?: string;
    retryCount: number;
  }>;
  options: {
    modelId: string;
    aspectRatio: string;
    imageSize: string;
    countPerPrompt: number;
    concurrency: number;
    layout: 'grid' | 'row' | 'column';
    columns?: number;
    gap?: number;
  };
  createdAt: number;
  updatedAt: number;
}

const STORAGE_KEY = 'kk_durable_generation_jobs';
const DEFAULT_CONCURRENCY = 3;
const MAX_CONCURRENCY = 8;
const MAX_BATCH_SIZE = 100;
const RETRY_ATTEMPTS = 3;
const RETRY_BACKOFF_MS = 2000;

const getBrowserStorage = (): Storage | null => {
  try {
    if (typeof globalThis === 'undefined' || !('localStorage' in globalThis)) {
      return null;
    }

    return globalThis.localStorage;
  } catch {
    return null;
  }
};

const stableStringify = (value: unknown): string => {
  if (Array.isArray(value)) {
    return `[${value.map(stableStringify).join(',')}]`;
  }

  if (value && typeof value === 'object') {
    return `{${Object.keys(value as Record<string, unknown>).sort().map((key) => (
      `${JSON.stringify(key)}:${stableStringify((value as Record<string, unknown>)[key])}`
    )).join(',')}}`;
  }

  return JSON.stringify(value);
};

const hashString = (value: string): string => {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = ((hash << 5) - hash + value.charCodeAt(index)) | 0;
  }
  return Math.abs(hash).toString(36);
};

const createDeterministicIdempotencyKey = (
  prompts: Array<{ id: string; prompt: string; referenceImageNodeId?: string }>,
  options: any,
  canvasId: string
): string => `batch_${hashString(stableStringify({ canvasId, prompts, options }))}`;

const normalizeConcurrency = (value: unknown): number => {
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric <= 0) return DEFAULT_CONCURRENCY;
  return Math.min(Math.floor(numeric), MAX_CONCURRENCY);
};

export class DurableGenerationQueue {
  private jobs: GenerationBatchJob[] = [];
  private executor: ((prompt: string, options: any, jobId: string, promptId: string) => Promise<string[]>) | null = null;
  private arrangeHandler: ((nodeIds: string[], layout: any) => Promise<void>) | null = null;

  constructor() {
    this.loadJobs();
  }

  private loadJobs() {
    const storage = getBrowserStorage();
    if (!storage) {
      this.jobs = [];
      return;
    }

    try {
      const stored = storage.getItem(STORAGE_KEY);
      if (stored) {
        this.jobs = JSON.parse(stored);
      }
    } catch (e) {
      console.error('[DurableQueue] Failed to load jobs from storage:', e);
      this.jobs = [];
    }
  }

  private saveJobs() {
    const storage = getBrowserStorage();
    if (!storage) {
      return;
    }

    try {
      storage.setItem(STORAGE_KEY, JSON.stringify(this.jobs));
    } catch (e) {
      console.error('[DurableQueue] Failed to save jobs to storage:', e);
    }
  }

  public registerExecutor(executor: typeof this.executor) {
    this.executor = executor;
  }

  public registerArrangeHandler(handler: typeof this.arrangeHandler) {
    this.arrangeHandler = handler;
  }

  public getJobs(): GenerationBatchJob[] {
    return this.jobs;
  }

  public getJob(id: string): GenerationBatchJob | undefined {
    return this.jobs.find(j => j.id === id);
  }

  public clearAllJobs() {
    this.jobs = [];
    this.saveJobs();
  }

  public createJob(
    prompts: Array<{ id: string; prompt: string; referenceImageNodeId?: string }>,
    options: any,
    canvasId: string,
    idempotencyKey?: string
  ): GenerationBatchJob {
    const normalizedPrompts = Array.isArray(prompts) ? prompts : [];
    if (normalizedPrompts.length === 0) {
      throw new Error('DurableGenerationQueue requires at least one prompt.');
    }
    if (normalizedPrompts.length > MAX_BATCH_SIZE) {
      throw new Error(`Batch size exceeds maxBatchSize=${MAX_BATCH_SIZE}.`);
    }

    const stableIdempotencyKey = typeof idempotencyKey === 'string' && idempotencyKey.trim().length > 0
      ? idempotencyKey.trim()
      : createDeterministicIdempotencyKey(normalizedPrompts, options || {}, canvasId);

    const existing = this.jobs.find(j => j.idempotencyKey === stableIdempotencyKey);
    if (existing) {
      console.log(`[DurableQueue] Idempotency match found for key: ${stableIdempotencyKey}`);
      return existing;
    }

    const newJob: GenerationBatchJob = {
      id: 'job_' + Date.now() + '_' + Math.random().toString(36).substring(2, 11),
      idempotencyKey: stableIdempotencyKey,
      canvasId,
      status: 'queued',
      createdBy: 'assistant',
      prompts: normalizedPrompts.map(p => ({
        id: p.id,
        prompt: p.prompt,
        referenceImageNodeId: p.referenceImageNodeId,
        status: 'queued',
        retryCount: 0
      })),
      options: {
        modelId: options?.modelId || 'gemini-2.5-flash',
        aspectRatio: options?.aspectRatio || '1:1',
        imageSize: options?.imageSize || '1K',
        countPerPrompt: options?.countPerPrompt || 1,
        concurrency: normalizeConcurrency(options?.concurrency),
        layout: options?.layout || 'grid',
        columns: options?.columns,
        gap: options?.gap
      },
      createdAt: Date.now(),
      updatedAt: Date.now()
    };

    this.jobs.push(newJob);
    this.saveJobs();
    
    // 异步触发队列处理
    setTimeout(() => this.processQueue(), 0);
    
    return newJob;
  }

  public pauseJob(jobId: string) {
    const job = this.getJob(jobId);
    if (job && (job.status === 'queued' || job.status === 'running')) {
      job.status = 'paused';
      // 暂停时将正在运行的子任务重置为 queued
      job.prompts.forEach(p => {
        if (p.status === 'running') {
          p.status = 'queued';
        }
      });
      job.updatedAt = Date.now();
      this.saveJobs();
    }
  }

  public resumeJob(jobId: string) {
    const job = this.getJob(jobId);
    if (job && job.status === 'paused') {
      job.status = 'queued';
      job.updatedAt = Date.now();
      this.saveJobs();
      setTimeout(() => this.processQueue(), 0);
    }
  }

  public cancelJob(jobId: string) {
    const job = this.getJob(jobId);
    if (job) {
      job.status = 'cancelled';
      job.prompts.forEach(p => {
        if (p.status === 'queued' || p.status === 'running') {
          p.status = 'failed';
          p.error = 'Job cancelled by user';
        }
      });
      job.updatedAt = Date.now();
      this.saveJobs();
    }
  }

  // 核心队列调度循环
  public async processQueue() {
    const runningJobs = this.jobs.filter(j => j.status === 'running');
    const queuedJobs = this.jobs.filter(j => j.status === 'queued');

    if (runningJobs.length === 0 && queuedJobs.length > 0) {
      const nextJob = queuedJobs[0];
      nextJob.status = 'running';
      nextJob.updatedAt = Date.now();
      this.saveJobs();
      runningJobs.push(nextJob);
    }

    if (runningJobs.length === 0) return;

    const currentJob = runningJobs[0];
    const concurrencyLimit = currentJob.options.concurrency;

    const queuedPrompts = currentJob.prompts.filter(p => p.status === 'queued');
    const activePrompts = currentJob.prompts.filter(p => p.status === 'running');

    // 检查是否全部子任务都完成了
    const allPromptsFinished = currentJob.prompts.every(p => p.status === 'completed' || p.status === 'failed');
    if (allPromptsFinished) {
      currentJob.status = 'completed';
      currentJob.updatedAt = Date.now();
      this.saveJobs();
      
      // 触发自动排版
      const allResultIds = currentJob.prompts.flatMap(p => p.resultImageNodeIds || []);
      if (allResultIds.length > 0 && this.arrangeHandler) {
        try {
          await this.arrangeHandler(allResultIds, currentJob.options);
        } catch (err) {
          console.error('[DurableQueue] Layout auto-arrangement failed:', err);
        }
      }

      // 递归处理下一个 Job
      setTimeout(() => this.processQueue(), 0);
      return;
    }

    // 启动新的并发子任务
    const availableSlots = concurrencyLimit - activePrompts.length;
    if (availableSlots > 0 && queuedPrompts.length > 0) {
      const toStart = queuedPrompts.slice(0, availableSlots);
      toStart.forEach(promptItem => {
        promptItem.status = 'running';
        this.saveJobs();
        this.executePromptTask(currentJob.id, promptItem.id);
      });
    }
  }

  private async executePromptTask(jobId: string, promptId: string) {
    const job = this.getJob(jobId);
    if (!job || job.status !== 'running') return;

    const promptItem = job.prompts.find(p => p.id === promptId);
    if (!promptItem || promptItem.status !== 'running') return;

    if (!this.executor) {
      console.warn('[DurableQueue] No executor registered yet. Holding...');
      promptItem.status = 'queued';
      this.saveJobs();
      return;
    }

    try {
      const imageNodeIds = await this.executor(promptItem.prompt, {
        ...job.options,
        referenceImageNodeId: promptItem.referenceImageNodeId
      }, jobId, promptId);

      promptItem.status = 'completed';
      promptItem.resultImageNodeIds = imageNodeIds;
    } catch (err: any) {
      console.error(`[DurableQueue] Prompt task failed (attempt ${promptItem.retryCount + 1}):`, err);
      
      if (promptItem.retryCount < RETRY_ATTEMPTS && job.status === 'running') {
        promptItem.retryCount++;
        promptItem.status = 'queued';
        this.saveJobs();
        await new Promise(resolve => setTimeout(resolve, RETRY_BACKOFF_MS));
      } else {
        promptItem.status = 'failed';
        promptItem.error = err.message || 'Generation failed';
      }
    }

    job.updatedAt = Date.now();
    this.saveJobs();

    // 触发队列循环继续调度
    setTimeout(() => this.processQueue(), 0);
  }
}

export const durableGenerationQueue = new DurableGenerationQueue();
