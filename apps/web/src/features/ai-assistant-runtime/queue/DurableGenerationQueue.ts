// 简体中文：持久化批量任务生成队列 (Durable Generation Queue)

export interface GenerationBatchOutputGroup {
  groupId?: string;
  label: string;
  color: string;
  includePromptNodes?: boolean;
  tags?: string[];
  nodeIds?: string[];
}

export interface GenerationExecutorResult {
  promptNodeId?: string;
  resultImageNodeIds: string[];
  nodeIds?: string[];
}

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
    layoutPreset?: 'grid' | 'row' | 'column' | 'compact-grid';
    columns?: number;
    gap?: number;
  };
  outputGroup?: GenerationBatchOutputGroup;
  createdAt: number;
  updatedAt: number;
}

const STORAGE_KEY = 'kk_durable_generation_jobs';
const DEFAULT_CONCURRENCY = 3;
const MAX_CONCURRENCY = 8;
const MAX_BATCH_SIZE = 100;
const RETRY_ATTEMPTS = 3;
const RETRY_BACKOFF_MS = 2000;
const MAX_PERSISTED_JOBS = 50;

export type GenerationQueueListener = (jobs: GenerationBatchJob[]) => void;

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

const normalizeExecutorResult = (value: string[] | GenerationExecutorResult): GenerationExecutorResult => {
  if (Array.isArray(value)) {
    return {
      resultImageNodeIds: value
    };
  }

  const resultImageNodeIds = Array.isArray(value?.resultImageNodeIds)
    ? value.resultImageNodeIds
    : [];

  return {
    promptNodeId: value?.promptNodeId,
    resultImageNodeIds,
    nodeIds: value?.nodeIds
  };
};

const getJobOutputNodeIds = (job: GenerationBatchJob): string[] => {
  const includePromptNodes = job.outputGroup?.includePromptNodes !== false;
  const promptNodeIds = includePromptNodes
    ? job.prompts.map(prompt => prompt.promptNodeId).filter((id): id is string => Boolean(id))
    : [];
  const imageNodeIds = job.prompts.flatMap(prompt => prompt.resultImageNodeIds || []);

  return Array.from(new Set([
    ...promptNodeIds,
    ...imageNodeIds,
    ...(job.outputGroup?.nodeIds || [])
  ]));
};

const cloneOutputGroup = (outputGroup?: GenerationBatchOutputGroup): GenerationBatchOutputGroup | undefined => {
  if (!outputGroup) return undefined;

  return {
    ...outputGroup,
    tags: outputGroup.tags ? [...outputGroup.tags] : undefined,
    nodeIds: outputGroup.nodeIds ? [...outputGroup.nodeIds] : undefined,
  };
};

const cloneJob = (job: GenerationBatchJob): GenerationBatchJob => ({
  ...job,
  prompts: job.prompts.map(prompt => ({
    ...prompt,
    resultImageNodeIds: prompt.resultImageNodeIds ? [...prompt.resultImageNodeIds] : undefined,
  })),
  options: { ...job.options },
  outputGroup: cloneOutputGroup(job.outputGroup),
});

const cloneJobs = (jobs: GenerationBatchJob[]): GenerationBatchJob[] => jobs.map(cloneJob);

export class DurableGenerationQueue {
  private jobs: GenerationBatchJob[] = [];
  private executor: ((prompt: string, options: any, jobId: string, promptId: string) => Promise<string[] | GenerationExecutorResult>) | null = null;
  private arrangeHandler: ((nodeIds: string[], layout: any, job?: GenerationBatchJob) => Promise<void>) | null = null;
  private completionHandler: ((job: GenerationBatchJob, nodeIds: string[]) => Promise<void>) | null = null;
  private listeners = new Set<GenerationQueueListener>();
  private inFlightTasks = new Set<string>();
  private processTimer: ReturnType<typeof setTimeout> | null = null;
  private isProcessing = false;
  private processRequested = false;

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

  private notifyListeners() {
    const snapshot = cloneJobs(this.jobs);
    for (const listener of this.listeners) {
      try {
        listener(snapshot);
      } catch (error) {
        console.error('[DurableQueue] Queue listener failed:', error);
      }
    }
  }

  private prunePersistedJobs() {
    if (this.jobs.length <= MAX_PERSISTED_JOBS) return;
    const active = this.jobs.filter(job => job.status === 'queued' || job.status === 'running' || job.status === 'paused');
    const inactive = this.jobs
      .filter(job => job.status !== 'queued' && job.status !== 'running' && job.status !== 'paused')
      .sort((a, b) => b.updatedAt - a.updatedAt);
    this.jobs = [...active, ...inactive].slice(0, MAX_PERSISTED_JOBS);
  }

  private saveJobs() {
    const storage = getBrowserStorage();
    this.prunePersistedJobs();
    if (!storage) {
      this.notifyListeners();
      return;
    }

    try {
      storage.setItem(STORAGE_KEY, JSON.stringify(this.jobs));
    } catch (e) {
      console.error('[DurableQueue] Failed to save jobs to storage:', e);
    } finally {
      this.notifyListeners();
    }
  }

  private getTaskKey(jobId: string, promptId: string): string {
    return `${jobId}:${promptId}`;
  }

  private scheduleProcess() {
    if (this.processTimer) return;
    this.processTimer = setTimeout(() => {
      this.processTimer = null;
      void this.processQueue();
    }, 0);
  }

  public registerExecutor(executor: typeof this.executor) {
    this.executor = executor;
  }

  public registerArrangeHandler(handler: typeof this.arrangeHandler) {
    this.arrangeHandler = handler;
  }

  public registerCompletionHandler(handler: typeof this.completionHandler) {
    this.completionHandler = handler;
  }

  public getJobs(): GenerationBatchJob[] {
    return cloneJobs(this.jobs);
  }

  public subscribe(listener: GenerationQueueListener): () => void {
    this.listeners.add(listener);
    listener(cloneJobs(this.jobs));
    return () => {
      this.listeners.delete(listener);
    };
  }

  public getJob(id: string): GenerationBatchJob | undefined {
    const job = this.findJob(id);
    return job ? cloneJob(job) : undefined;
  }

  private findJob(id: string): GenerationBatchJob | undefined {
    return this.jobs.find(j => j.id === id);
  }

  public clearAllJobs() {
    this.jobs = [];
    this.inFlightTasks.clear();
    this.saveJobs();
  }

  public archiveFinishedJobs() {
    this.jobs = this.jobs.filter(job => (
      job.status === 'queued' || job.status === 'running' || job.status === 'paused'
    ));
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
      const outputGroup = options?.outputGroup;
      if (!existing.outputGroup && outputGroup) {
        existing.outputGroup = outputGroup;
        existing.updatedAt = Date.now();
        this.saveJobs();
      }
      console.log(`[DurableQueue] Idempotency match found for key: ${stableIdempotencyKey}`);
      return cloneJob(existing);
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
        layoutPreset: options?.layoutPreset,
        columns: options?.columns,
        gap: options?.gap
      },
      outputGroup: options?.outputGroup,
      createdAt: Date.now(),
      updatedAt: Date.now()
    };

    this.jobs.push(newJob);
    this.saveJobs();
    
    // 异步触发队列处理
    this.scheduleProcess();
    
    return cloneJob(newJob);
  }

  public pauseJob(jobId: string) {
    const job = this.findJob(jobId);
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
      this.scheduleProcess();
    }
  }

  public resumeJob(jobId: string) {
    const job = this.findJob(jobId);
    if (job && job.status === 'paused') {
      job.status = 'queued';
      job.updatedAt = Date.now();
      this.saveJobs();
      this.scheduleProcess();
    }
  }

  public retryFailedPrompts(jobId: string) {
    const job = this.findJob(jobId);
    if (!job || job.status === 'cancelled') return;

    let hasRetryablePrompt = false;
    job.prompts.forEach(promptItem => {
      if (promptItem.status !== 'failed') return;
      promptItem.status = 'queued';
      promptItem.retryCount = 0;
      delete promptItem.error;
      hasRetryablePrompt = true;
    });

    if (!hasRetryablePrompt) return;

    job.status = 'queued';
    job.updatedAt = Date.now();
    this.saveJobs();
    this.scheduleProcess();
  }

  public cancelJob(jobId: string) {
    const job = this.findJob(jobId);
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
    if (this.isProcessing) {
      this.processRequested = true;
      return;
    }

    this.isProcessing = true;
    try {
      do {
        this.processRequested = false;
        await this.processQueueOnce();
      } while (this.processRequested);
    } finally {
      this.isProcessing = false;
      if (this.processRequested) {
        this.scheduleProcess();
      }
    }
  }

  private async processQueueOnce() {
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
      const outputNodeIds = getJobOutputNodeIds(currentJob);
      if (currentJob.outputGroup) {
        currentJob.outputGroup.nodeIds = outputNodeIds;
      }
      currentJob.updatedAt = Date.now();
      this.saveJobs();
      
      // 触发自动排版
      if (outputNodeIds.length > 0 && this.arrangeHandler) {
        try {
          await this.arrangeHandler(outputNodeIds, currentJob.options, currentJob);
        } catch (err) {
          console.error('[DurableQueue] Layout auto-arrangement failed:', err);
        }
      }

      if (outputNodeIds.length > 0 && this.completionHandler) {
        try {
          await this.completionHandler(currentJob, outputNodeIds);
          if (currentJob.outputGroup) {
            currentJob.outputGroup.nodeIds = outputNodeIds;
          }
          currentJob.updatedAt = Date.now();
          this.saveJobs();
        } catch (err) {
          console.error('[DurableQueue] Completion handler failed:', err);
        }
      }

      // 递归处理下一个 Job
      this.scheduleProcess();
      return;
    }

    // 启动新的并发子任务
    const activePromptCount = currentJob.prompts.filter(prompt => (
      prompt.status === 'running' || this.inFlightTasks.has(this.getTaskKey(currentJob.id, prompt.id))
    )).length;
    const availableSlots = concurrencyLimit - activePromptCount;
    if (availableSlots > 0 && queuedPrompts.length > 0) {
      const toStart = queuedPrompts
        .filter(promptItem => !this.inFlightTasks.has(this.getTaskKey(currentJob.id, promptItem.id)))
        .slice(0, availableSlots);
      for (const promptItem of toStart) {
        promptItem.status = 'running';
        this.executePromptTask(currentJob.id, promptItem.id);
      }
      if (toStart.length > 0) {
        this.saveJobs();
      }
    }
  }

  private async executePromptTask(jobId: string, promptId: string) {
    const taskKey = this.getTaskKey(jobId, promptId);
    if (this.inFlightTasks.has(taskKey)) return;

    const job = this.findJob(jobId);
    if (!job || job.status !== 'running') return;

    const promptItem = job.prompts.find(p => p.id === promptId);
    if (!promptItem || promptItem.status !== 'running') return;

    if (!this.executor) {
      console.warn('[DurableQueue] No executor registered yet. Holding...');
      promptItem.status = 'queued';
      this.saveJobs();
      return;
    }

    this.inFlightTasks.add(taskKey);
    try {
      const executionResult = normalizeExecutorResult(await this.executor(promptItem.prompt, {
        ...job.options,
        referenceImageNodeId: promptItem.referenceImageNodeId
      }, jobId, promptId));

      const activeJob = this.findJob(jobId);
      const activePromptItem = activeJob?.prompts.find(p => p.id === promptId);
      if (!activeJob || activeJob.status === 'cancelled' || !activePromptItem) {
        return;
      }
      activePromptItem.status = 'completed';
      activePromptItem.promptNodeId = executionResult.promptNodeId;
      activePromptItem.resultImageNodeIds = executionResult.resultImageNodeIds;
      if (activeJob.outputGroup) {
        activeJob.outputGroup.nodeIds = Array.from(new Set([
          ...(activeJob.outputGroup.nodeIds || []),
          ...(executionResult.nodeIds || []),
          ...(executionResult.promptNodeId ? [executionResult.promptNodeId] : []),
          ...executionResult.resultImageNodeIds
        ]));
      }
    } catch (err: any) {
      console.error(`[DurableQueue] Prompt task failed (attempt ${promptItem.retryCount + 1}):`, err);
      
      const retryJob = this.findJob(jobId);
      const retryPromptItem = retryJob?.prompts.find(p => p.id === promptId);
      if (!retryJob || retryJob.status === 'cancelled' || !retryPromptItem) {
        return;
      }

      if (retryPromptItem.retryCount < RETRY_ATTEMPTS && retryJob.status === 'running') {
        retryPromptItem.retryCount++;
        retryPromptItem.status = 'queued';
        this.saveJobs();
        await new Promise(resolve => setTimeout(resolve, RETRY_BACKOFF_MS));
      } else if (retryPromptItem.retryCount < RETRY_ATTEMPTS && retryJob.status === 'paused') {
        retryPromptItem.retryCount++;
        retryPromptItem.status = 'queued';
      } else {
        retryPromptItem.status = 'failed';
        retryPromptItem.error = err.message || 'Generation failed';
      }
    } finally {
      this.inFlightTasks.delete(taskKey);
      job.updatedAt = Date.now();
      this.saveJobs();

      // 触发队列循环继续调度
      this.scheduleProcess();
    }
  }
}

export const durableGenerationQueue = new DurableGenerationQueue();
