import type {
  GenerationJobOutputDto,
  GenerationJobPhase,
  GenerationJobProgressDto,
  GenerationJobStatus,
  GenerationMediaTaskType,
  GenerationBatchJobDto,
} from '@kk/shared';

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
  outputs?: GenerationJobOutputDto[];
  providerTaskId?: string;
}

export type GenerationErrorCategory =
  | 'cancelled'
  | 'authentication'
  | 'billing'
  | 'invalid_input'
  | 'rate_limit'
  | 'provider_unavailable'
  | 'network'
  | 'unknown';

export interface GenerationQueuePrompt {
  id: string;
  prompt: string;
  referenceImageNodeId?: string;
  status: 'queued' | 'running' | 'completed' | 'failed';
  phase: GenerationJobPhase;
  promptNodeId?: string;
  resultImageNodeIds?: string[];
  outputs?: GenerationJobOutputDto[];
  providerTaskId?: string;
  error?: string;
  errorCategory?: GenerationErrorCategory;
  retryable?: boolean;
  retryCount: number;
}

export interface GenerationQueueOptions {
  taskType: GenerationMediaTaskType;
  modelId: string;
  aspectRatio: string;
  imageSize: string;
  countPerPrompt: number;
  concurrency: number;
  layout: 'grid' | 'row' | 'column';
  layoutPreset?: 'grid' | 'row' | 'column' | 'compact-grid';
  columns?: number;
  gap?: number;
  durationSeconds?: number;
  resolution?: string;
  generateAudio?: boolean;
  firstFrameAssetId?: string;
  lastFrameAssetId?: string;
  motion?: string;
  voice?: string;
  lyrics?: string;
  genre?: string;
}

export interface GenerationBatchJob {
  schemaVersion: 2;
  id: string;
  idempotencyKey: string;
  canvasId: string;
  taskType: GenerationMediaTaskType;
  status: GenerationJobStatus;
  progress: GenerationJobProgressDto;
  outputs: GenerationJobOutputDto[];
  createdBy: 'assistant' | 'user';
  prompts: GenerationQueuePrompt[];
  options: GenerationQueueOptions;
  outputGroup?: GenerationBatchOutputGroup;
  arranged?: boolean;
  completionHandled?: boolean;
  createdAt: number;
  updatedAt: number;
}

interface QueueStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

interface MediaQueueLimits {
  defaultConcurrency: number;
  maxConcurrency: number;
  maxBatchSize: number;
}

const STORAGE_KEY = 'kk_durable_generation_jobs';
const MEDIA_LIMITS: Record<GenerationMediaTaskType, MediaQueueLimits> = {
  image: { defaultConcurrency: 3, maxConcurrency: 8, maxBatchSize: 100 },
  video: { defaultConcurrency: 1, maxConcurrency: 2, maxBatchSize: 20 },
  audio: { defaultConcurrency: 2, maxConcurrency: 4, maxBatchSize: 50 },
};
const RETRY_ATTEMPTS = 3;
const RETRY_BACKOFF_MS = 2000;
const MAX_PERSISTED_JOBS = 50;

export type GenerationQueueListener = (jobs: GenerationBatchJob[]) => void;
export type GenerationQueueExecutor = (
  prompt: string,
  options: GenerationQueueOptions & { referenceImageNodeId?: string },
  jobId: string,
  promptId: string,
  signal: AbortSignal,
) => Promise<string[] | GenerationExecutorResult>;

const getBrowserStorage = (): QueueStorage | null => {
  try {
    if (typeof globalThis === 'undefined' || !('localStorage' in globalThis)) return null;
    return globalThis.localStorage;
  } catch {
    return null;
  }
};

const stableStringify = (value: unknown): string => {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.keys(value as Record<string, unknown>)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${stableStringify((value as Record<string, unknown>)[key])}`)
      .join(',')}}`;
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
  options: unknown,
  canvasId: string,
): string => `batch_${hashString(stableStringify({ canvasId, prompts, options }))}`;

const normalizeTaskType = (value: unknown): GenerationMediaTaskType => (
  value === 'video' || value === 'audio' ? value : 'image'
);

const normalizeConcurrency = (value: unknown, taskType: GenerationMediaTaskType): number => {
  const limits = MEDIA_LIMITS[taskType];
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric <= 0) return limits.defaultConcurrency;
  return Math.min(Math.floor(numeric), limits.maxConcurrency);
};

const normalizeExecutorResult = (value: string[] | GenerationExecutorResult): GenerationExecutorResult => {
  if (Array.isArray(value)) return { resultImageNodeIds: value };
  return {
    promptNodeId: value?.promptNodeId,
    resultImageNodeIds: Array.isArray(value?.resultImageNodeIds) ? value.resultImageNodeIds : [],
    nodeIds: Array.isArray(value?.nodeIds) ? value.nodeIds : undefined,
    outputs: Array.isArray(value?.outputs) ? value.outputs : undefined,
    providerTaskId: value?.providerTaskId,
  };
};

const phaseForStatus = (status: GenerationJobStatus): GenerationJobPhase => {
  if (status === 'queued' || status === 'paused') return 'queued';
  if (status === 'running') return 'provider_processing';
  if (status === 'completed' || status === 'completed_with_errors') return 'completed';
  return 'failed';
};

const calculateProgress = (job: Pick<GenerationBatchJob, 'prompts' | 'status'>): GenerationJobProgressDto => {
  const total = job.prompts.length;
  const completed = job.prompts.filter((item) => item.status === 'completed').length;
  const failed = job.prompts.filter((item) => item.status === 'failed').length;
  const running = job.prompts.filter((item) => item.status === 'running').length;
  const queued = Math.max(0, total - completed - failed - running);
  return {
    total,
    queued,
    running,
    completed,
    failed,
    percent: total > 0 ? Math.round(((completed + failed) / total) * 100) : 0,
    phase: phaseForStatus(job.status),
  };
};

const classifyGenerationError = (error: unknown): { category: GenerationErrorCategory; retryable: boolean; message: string } => {
  const message = error instanceof Error ? error.message : String(error || 'Generation failed');
  const normalized = message.toLowerCase();
  if (normalized.includes('abort') || normalized.includes('cancel')) {
    return { category: 'cancelled', retryable: false, message };
  }
  if (normalized.includes('unauthor') || normalized.includes('forbidden') || normalized.includes('api key') || normalized.includes('authentication') || normalized.includes('密钥') || normalized.includes('未配置')) {
    return { category: 'authentication', retryable: false, message };
  }
  if (normalized.includes('credit') || normalized.includes('billing') || normalized.includes('balance') || normalized.includes('积分') || normalized.includes('余额')) {
    return { category: 'billing', retryable: false, message };
  }
  if (normalized.includes('invalid') || normalized.includes('validation') || normalized.includes('unsupported') || normalized.includes('参数无效') || normalized.includes('不支持')) {
    return { category: 'invalid_input', retryable: false, message };
  }
  if (normalized.includes('429') || normalized.includes('rate limit')) {
    return { category: 'rate_limit', retryable: true, message };
  }
  if (normalized.includes('network') || normalized.includes('fetch') || normalized.includes('timeout')) {
    return { category: 'network', retryable: true, message };
  }
  if (normalized.includes('provider') || normalized.includes('503') || normalized.includes('502')) {
    return { category: 'provider_unavailable', retryable: true, message };
  }
  return { category: 'unknown', retryable: true, message };
};

const outputsFromExecution = (
  taskType: GenerationMediaTaskType,
  promptId: string,
  result: GenerationExecutorResult,
): GenerationJobOutputDto[] => {
  if (result.outputs?.length) return result.outputs.map((output) => ({ ...output }));
  const nodeIds = Array.from(new Set([...(result.nodeIds || []), ...result.resultImageNodeIds]));
  return nodeIds.map((nodeId, index) => ({
    itemId: `${promptId}_${index}`,
    taskType,
    nodeId,
    promptNodeId: result.promptNodeId,
    providerTaskId: result.providerTaskId,
  }));
};

const getJobOutputNodeIds = (job: GenerationBatchJob): string[] => {
  const includePromptNodes = job.outputGroup?.includePromptNodes !== false;
  const promptNodeIds = includePromptNodes
    ? job.prompts.map((prompt) => prompt.promptNodeId).filter((id): id is string => Boolean(id))
    : [];
  const resultNodeIds = job.prompts.flatMap((prompt) => prompt.resultImageNodeIds || []);
  const outputNodeIds = job.outputs.map((output) => output.nodeId).filter((id): id is string => Boolean(id));
  return Array.from(new Set([...promptNodeIds, ...resultNodeIds, ...outputNodeIds, ...(job.outputGroup?.nodeIds || [])]));
};

const cloneOutputGroup = (outputGroup?: GenerationBatchOutputGroup): GenerationBatchOutputGroup | undefined => (
  outputGroup ? {
    ...outputGroup,
    tags: outputGroup.tags ? [...outputGroup.tags] : undefined,
    nodeIds: outputGroup.nodeIds ? [...outputGroup.nodeIds] : undefined,
  } : undefined
);

const cloneJob = (job: GenerationBatchJob): GenerationBatchJob => ({
  ...job,
  progress: { ...job.progress },
  outputs: job.outputs.map((output) => ({ ...output })),
  prompts: job.prompts.map((prompt) => ({
    ...prompt,
    resultImageNodeIds: prompt.resultImageNodeIds ? [...prompt.resultImageNodeIds] : undefined,
    outputs: prompt.outputs?.map((output) => ({ ...output })),
  })),
  options: { ...job.options },
  outputGroup: cloneOutputGroup(job.outputGroup),
});

const cloneJobs = (jobs: GenerationBatchJob[]): GenerationBatchJob[] => jobs.map(cloneJob);

const migrateStoredJob = (raw: Partial<GenerationBatchJob> & Record<string, unknown>): GenerationBatchJob | null => {
  if (!raw.id || !raw.canvasId || !Array.isArray(raw.prompts)) return null;
  const taskType = normalizeTaskType(raw.taskType || (raw.options as { taskType?: unknown } | undefined)?.taskType);
  const options = (raw.options || {}) as Partial<GenerationQueueOptions>;
  const status = (raw.status || 'queued') as GenerationJobStatus;
  const prompts = raw.prompts.map((item) => {
    const prompt = item as Partial<GenerationQueuePrompt>;
    return {
      id: String(prompt.id || `prompt_${Math.random().toString(36).slice(2, 10)}`),
      prompt: String(prompt.prompt || ''),
      referenceImageNodeId: prompt.referenceImageNodeId,
      status: prompt.status || 'queued',
      phase: prompt.phase || (prompt.status === 'completed' ? 'completed' : prompt.status === 'failed' ? 'failed' : 'queued'),
      promptNodeId: prompt.promptNodeId,
      resultImageNodeIds: prompt.resultImageNodeIds,
      outputs: prompt.outputs,
      providerTaskId: prompt.providerTaskId,
      error: prompt.error,
      errorCategory: prompt.errorCategory,
      retryable: prompt.retryable,
      retryCount: Number(prompt.retryCount || 0),
    } satisfies GenerationQueuePrompt;
  });
  const migrated: GenerationBatchJob = {
    schemaVersion: 2,
    id: String(raw.id),
    idempotencyKey: String(raw.idempotencyKey || `migrated_${raw.id}`),
    canvasId: String(raw.canvasId),
    taskType,
    status,
    progress: raw.progress || { total: 0, queued: 0, running: 0, completed: 0, failed: 0, percent: 0, phase: 'queued' },
    outputs: Array.isArray(raw.outputs) ? raw.outputs : prompts.flatMap((prompt) => prompt.outputs || []),
    createdBy: raw.createdBy === 'user' ? 'user' : 'assistant',
    prompts,
    options: {
      taskType,
      modelId: options.modelId || 'gemini-2.5-flash',
      aspectRatio: options.aspectRatio || '1:1',
      imageSize: options.imageSize || '1K',
      countPerPrompt: options.countPerPrompt || 1,
      concurrency: normalizeConcurrency(options.concurrency, taskType),
      layout: options.layout || 'grid',
      layoutPreset: options.layoutPreset,
      columns: options.columns,
      gap: options.gap,
      durationSeconds: options.durationSeconds,
      resolution: options.resolution,
      generateAudio: options.generateAudio,
      firstFrameAssetId: options.firstFrameAssetId,
      lastFrameAssetId: options.lastFrameAssetId,
      motion: options.motion,
      voice: options.voice,
      lyrics: options.lyrics,
      genre: options.genre,
    },
    outputGroup: raw.outputGroup,
    arranged: raw.arranged,
    completionHandled: raw.completionHandled,
    createdAt: Number(raw.createdAt || Date.now()),
    updatedAt: Number(raw.updatedAt || Date.now()),
  };
  migrated.progress = calculateProgress(migrated);
  return migrated;
};

export class DurableGenerationQueue {
  private jobs: GenerationBatchJob[] = [];
  private executor: GenerationQueueExecutor | null = null;
  private arrangeHandler: ((nodeIds: string[], layout: GenerationQueueOptions, job?: GenerationBatchJob) => Promise<void>) | null = null;
  private completionHandler: ((job: GenerationBatchJob, nodeIds: string[]) => Promise<void>) | null = null;
  private listeners = new Set<GenerationQueueListener>();
  private inFlightTasks = new Set<string>();
  private abortControllers = new Map<string, AbortController>();
  private processTimer: ReturnType<typeof setTimeout> | null = null;
  private isProcessing = false;
  private processRequested = false;
  private readonly storage: QueueStorage | null;

  constructor(storage?: QueueStorage | null) {
    this.storage = storage === undefined ? getBrowserStorage() : storage;
    this.loadJobs();
  }

  private loadJobs() {
    if (!this.storage) return;
    try {
      const stored = this.storage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        this.jobs = Array.isArray(parsed)
          ? parsed.map((job) => migrateStoredJob(job)).filter((job): job is GenerationBatchJob => Boolean(job))
          : [];
      }
    } catch (error) {
      console.error('[DurableQueue] Failed to load jobs from storage:', error);
      this.jobs = [];
    }
    this.healZombieTasks();
  }

  private healZombieTasks() {
    let changed = false;
    for (const job of this.jobs) {
      if (['paused', 'cancelled', 'completed', 'completed_with_errors', 'failed'].includes(job.status)) continue;
      let hasRunningPrompt = false;
      for (const promptItem of job.prompts) {
        if (promptItem.status !== 'running') continue;
        const taskKey = this.getTaskKey(job.id, promptItem.id);
        if (!this.inFlightTasks.has(taskKey)) {
          promptItem.status = 'queued';
          promptItem.phase = 'queued';
          changed = true;
        } else {
          hasRunningPrompt = true;
        }
      }
      if (job.status === 'running' && !hasRunningPrompt) {
        job.status = 'queued';
        changed = true;
      }
    }
    if (changed) this.saveJobs();
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
    const active = this.jobs.filter((job) => ['queued', 'running', 'paused'].includes(job.status));
    const inactive = this.jobs
      .filter((job) => !['queued', 'running', 'paused'].includes(job.status))
      .sort((left, right) => right.updatedAt - left.updatedAt);
    this.jobs = [...active, ...inactive].slice(0, MAX_PERSISTED_JOBS);
  }

  private saveJobs() {
    for (const job of this.jobs) job.progress = calculateProgress(job);
    this.prunePersistedJobs();
    try {
      this.storage?.setItem(STORAGE_KEY, JSON.stringify(this.jobs));
    } catch (error) {
      console.error('[DurableQueue] Failed to save jobs to storage:', error);
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

  public registerExecutor(executor: GenerationQueueExecutor | null) {
    this.executor = executor;
    this.healZombieTasks();
    this.scheduleProcess();
  }

  public registerArrangeHandler(handler: typeof this.arrangeHandler) {
    this.arrangeHandler = handler;
    this.scheduleProcess();
  }

  public registerCompletionHandler(handler: typeof this.completionHandler) {
    this.completionHandler = handler;
    this.scheduleProcess();
  }

  public getJobs(): GenerationBatchJob[] {
    return cloneJobs(this.jobs);
  }

  public subscribe(listener: GenerationQueueListener): () => void {
    this.listeners.add(listener);
    listener(cloneJobs(this.jobs));
    return () => this.listeners.delete(listener);
  }

  public getJob(id: string): GenerationBatchJob | undefined {
    const job = this.findJob(id);
    return job ? cloneJob(job) : undefined;
  }

  public mergeRemoteJob(remote: GenerationBatchJobDto): GenerationBatchJob {
    let job = this.jobs.find((item) => item.idempotencyKey === remote.idempotencyKey);
    if (!job) {
      const parameters = remote.parameters as unknown as Record<string, unknown>;
      const created = this.createJob(
        remote.items.map((item) => ({
          id: item.id,
          prompt: item.prompt,
          referenceImageNodeId: item.referenceImageNodeId,
        })),
        {
          ...parameters,
          taskType: remote.taskType,
          modelId: remote.modelCode,
          outputGroup: remote.outputGroup,
        },
        remote.workspaceId,
        remote.idempotencyKey,
      );
      job = this.findJob(created.id);
    }
    if (!job) throw new Error(`Failed to mirror generation job ${remote.id}.`);

    const remoteItems = new Map(remote.items.map((item) => [item.id, item]));
    job.prompts = job.prompts.map((prompt) => {
      const item = remoteItems.get(prompt.id);
      if (!item) return prompt;
      const status = item.status === 'running' && remote.status === 'running' ? 'queued' : item.status;
      return {
        ...prompt,
        status,
        phase: status === 'completed' ? 'completed' : status === 'failed' ? 'failed' : 'queued',
        retryCount: item.retryCount,
        retryable: item.retryable,
        error: item.error,
        errorCategory: item.errorCategory as GenerationErrorCategory | undefined,
        providerTaskId: item.providerTaskId,
        outputs: item.outputs.map((output) => ({ ...output })),
      };
    });
    job.status = remote.status === 'running' ? 'queued' : remote.status;
    job.outputs = remote.outputs.map((output) => ({ ...output }));
    job.outputGroup = remote.outputGroup ? cloneOutputGroup(remote.outputGroup) : job.outputGroup;
    job.createdAt = Date.parse(remote.createdAt) || job.createdAt;
    job.updatedAt = Date.parse(remote.updatedAt) || Date.now();
    this.saveJobs();
    if (job.status === 'queued') this.scheduleProcess();
    return cloneJob(job);
  }

  private findJob(id: string): GenerationBatchJob | undefined {
    return this.jobs.find((job) => job.id === id);
  }

  public clearAllJobs() {
    for (const controller of this.abortControllers.values()) controller.abort();
    this.jobs = [];
    this.inFlightTasks.clear();
    this.abortControllers.clear();
    this.saveJobs();
  }

  public archiveFinishedJobs() {
    this.jobs = this.jobs.filter((job) => ['queued', 'running', 'paused'].includes(job.status));
    this.saveJobs();
  }

  public createJob(
    prompts: Array<{ id: string; prompt: string; referenceImageNodeId?: string }>,
    options: Partial<GenerationQueueOptions> & Record<string, unknown>,
    canvasId: string,
    idempotencyKey?: string,
  ): GenerationBatchJob {
    const normalizedPrompts = Array.isArray(prompts) ? prompts : [];
    const taskType = normalizeTaskType(options?.taskType);
    const limits = MEDIA_LIMITS[taskType];
    if (normalizedPrompts.length === 0) throw new Error('DurableGenerationQueue requires at least one prompt.');
    if (normalizedPrompts.length > limits.maxBatchSize) {
      throw new Error(`Batch size exceeds maxBatchSize=${limits.maxBatchSize} for taskType=${taskType}.`);
    }

    const stableIdempotencyKey = typeof idempotencyKey === 'string' && idempotencyKey.trim().length > 0
      ? idempotencyKey.trim()
      : createDeterministicIdempotencyKey(normalizedPrompts, { ...options, taskType }, canvasId);
    const existing = this.jobs.find((job) => job.idempotencyKey === stableIdempotencyKey);
    if (existing) {
      if (!existing.outputGroup && options?.outputGroup) {
        existing.outputGroup = options.outputGroup as GenerationBatchOutputGroup;
        existing.updatedAt = Date.now();
        this.saveJobs();
      }
      return cloneJob(existing);
    }

    const now = Date.now();
    const newJob: GenerationBatchJob = {
      schemaVersion: 2,
      id: `job_${now}_${Math.random().toString(36).substring(2, 11)}`,
      idempotencyKey: stableIdempotencyKey,
      canvasId,
      taskType,
      status: 'queued',
      progress: { total: normalizedPrompts.length, queued: normalizedPrompts.length, running: 0, completed: 0, failed: 0, percent: 0, phase: 'queued' },
      outputs: [],
      createdBy: 'assistant',
      prompts: normalizedPrompts.map((prompt) => ({
        id: prompt.id,
        prompt: prompt.prompt,
        referenceImageNodeId: prompt.referenceImageNodeId,
        status: 'queued',
        phase: 'queued',
        retryCount: 0,
      })),
      options: {
        taskType,
        modelId: String(options?.modelId || 'gemini-2.5-flash'),
        aspectRatio: String(options?.aspectRatio || '1:1'),
        imageSize: String(options?.imageSize || '1K'),
        countPerPrompt: Number(options?.countPerPrompt || 1),
        concurrency: normalizeConcurrency(options?.concurrency, taskType),
        layout: options?.layout === 'row' || options?.layout === 'column' ? options.layout : 'grid',
        layoutPreset: options?.layoutPreset,
        columns: options?.columns,
        gap: options?.gap,
        durationSeconds: options?.durationSeconds,
        resolution: options?.resolution,
        generateAudio: options?.generateAudio,
        firstFrameAssetId: options?.firstFrameAssetId,
        lastFrameAssetId: options?.lastFrameAssetId,
        motion: options?.motion,
        voice: options?.voice,
        lyrics: options?.lyrics,
        genre: options?.genre,
      },
      outputGroup: options?.outputGroup as GenerationBatchOutputGroup | undefined,
      createdAt: now,
      updatedAt: now,
    };
    this.jobs.push(newJob);
    this.saveJobs();
    this.scheduleProcess();
    return cloneJob(newJob);
  }

  public pauseJob(jobId: string) {
    const job = this.findJob(jobId);
    if (!job || (job.status !== 'queued' && job.status !== 'running')) return;
    job.status = 'paused';
    for (const prompt of job.prompts) {
      if (prompt.status === 'running') {
        prompt.status = 'queued';
        prompt.phase = 'queued';
      }
    }
    job.updatedAt = Date.now();
    this.saveJobs();
  }

  public resumeJob(jobId: string) {
    const job = this.findJob(jobId);
    if (!job || job.status !== 'paused') return;
    job.status = 'queued';
    job.updatedAt = Date.now();
    this.saveJobs();
    this.scheduleProcess();
  }

  public retryFailedPrompts(jobId: string) {
    const job = this.findJob(jobId);
    if (!job || job.status === 'cancelled') return;
    let changed = false;
    for (const prompt of job.prompts) {
      if (prompt.status !== 'failed' || prompt.retryable === false) continue;
      prompt.status = 'queued';
      prompt.phase = 'queued';
      prompt.retryCount = 0;
      delete prompt.error;
      delete prompt.errorCategory;
      delete prompt.retryable;
      changed = true;
    }
    if (!changed) return;
    job.status = 'queued';
    job.updatedAt = Date.now();
    this.saveJobs();
    this.scheduleProcess();
  }

  public cancelJob(jobId: string) {
    const job = this.findJob(jobId);
    if (!job || ['completed', 'completed_with_errors', 'failed', 'cancelled'].includes(job.status)) return;
    job.status = 'cancelled';
    for (const prompt of job.prompts) {
      if (prompt.status === 'queued' || prompt.status === 'running') {
        prompt.status = 'failed';
        prompt.phase = 'failed';
        prompt.error = 'Job cancelled by user';
        prompt.errorCategory = 'cancelled';
        prompt.retryable = false;
      }
      this.abortControllers.get(this.getTaskKey(job.id, prompt.id))?.abort();
    }
    job.updatedAt = Date.now();
    this.saveJobs();
  }

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
      if (this.processRequested) this.scheduleProcess();
    }
  }

  private async handleFinishedJob(job: GenerationBatchJob) {
    const outputNodeIds = getJobOutputNodeIds(job);
    if (job.outputGroup) job.outputGroup.nodeIds = outputNodeIds;
    if (!job.arranged && outputNodeIds.length > 0 && this.arrangeHandler) {
      try {
        await this.arrangeHandler(outputNodeIds, job.options, job);
        job.arranged = true;
      } catch (error) {
        console.error('[DurableQueue] Layout auto-arrangement failed:', error);
      }
    }
    if (!job.completionHandled && outputNodeIds.length > 0 && this.completionHandler) {
      try {
        await this.completionHandler(job, outputNodeIds);
        job.completionHandled = true;
      } catch (error) {
        console.error('[DurableQueue] Completion handler failed:', error);
      }
    }
    job.updatedAt = Date.now();
    this.saveJobs();
  }

  private async processQueueOnce() {
    for (const job of this.jobs.filter((item) => (
      (item.status === 'completed' || item.status === 'completed_with_errors')
      && (!item.arranged || !item.completionHandled)
    ))) {
      await this.handleFinishedJob(job);
    }

    const runningJobs = this.jobs.filter((job) => job.status === 'running');
    if (runningJobs.length === 0) {
      const nextJob = this.jobs.find((job) => job.status === 'queued');
      if (nextJob) {
        nextJob.status = 'running';
        nextJob.updatedAt = Date.now();
        this.saveJobs();
        runningJobs.push(nextJob);
      }
    }
    if (runningJobs.length === 0) return;

    const currentJob = runningJobs[0];
    const allFinished = currentJob.prompts.every((prompt) => prompt.status === 'completed' || prompt.status === 'failed');
    if (allFinished) {
      const completedCount = currentJob.prompts.filter((prompt) => prompt.status === 'completed').length;
      const failedCount = currentJob.prompts.length - completedCount;
      currentJob.status = failedCount === 0 ? 'completed' : completedCount === 0 ? 'failed' : 'completed_with_errors';
      await this.handleFinishedJob(currentJob);
      this.scheduleProcess();
      return;
    }

    const activeCount = currentJob.prompts.filter((prompt) => (
      prompt.status === 'running' || this.inFlightTasks.has(this.getTaskKey(currentJob.id, prompt.id))
    )).length;
    const availableSlots = currentJob.options.concurrency - activeCount;
    if (availableSlots <= 0) return;
    const toStart = currentJob.prompts
      .filter((prompt) => prompt.status === 'queued' && !this.inFlightTasks.has(this.getTaskKey(currentJob.id, prompt.id)))
      .slice(0, availableSlots);
    for (const prompt of toStart) {
      prompt.status = 'running';
      prompt.phase = 'provider_processing';
      void this.executePromptTask(currentJob.id, prompt.id);
    }
    if (toStart.length > 0) this.saveJobs();
  }

  private async executePromptTask(jobId: string, promptId: string) {
    const taskKey = this.getTaskKey(jobId, promptId);
    if (this.inFlightTasks.has(taskKey)) return;
    const job = this.findJob(jobId);
    const promptItem = job?.prompts.find((prompt) => prompt.id === promptId);
    if (!job || !promptItem || (job.status !== 'running' && job.status !== 'queued')) return;
    if (!this.executor) {
      promptItem.status = 'queued';
      promptItem.phase = 'queued';
      promptItem.error = 'No executor registered yet';
      job.status = 'queued';
      this.saveJobs();
      return;
    }

    promptItem.status = 'running';
    promptItem.phase = 'provider_processing';
    job.status = 'running';
    const controller = new AbortController();
    this.abortControllers.set(taskKey, controller);
    this.inFlightTasks.add(taskKey);
    try {
      const result = normalizeExecutorResult(await this.executor(
        promptItem.prompt,
        { ...job.options, referenceImageNodeId: promptItem.referenceImageNodeId },
        jobId,
        promptId,
        controller.signal,
      ));
      const activeJob = this.findJob(jobId);
      const activePrompt = activeJob?.prompts.find((prompt) => prompt.id === promptId);
      if (!activeJob || activeJob.status === 'cancelled' || !activePrompt) return;
      const outputs = outputsFromExecution(activeJob.taskType, promptId, result);
      activePrompt.status = 'completed';
      activePrompt.phase = 'completed';
      activePrompt.promptNodeId = result.promptNodeId;
      activePrompt.resultImageNodeIds = result.resultImageNodeIds;
      activePrompt.outputs = outputs;
      activePrompt.providerTaskId = result.providerTaskId;
      activeJob.outputs = [...activeJob.outputs.filter((output) => output.itemId !== promptId), ...outputs];
      if (activeJob.outputGroup) {
        activeJob.outputGroup.nodeIds = Array.from(new Set([
          ...(activeJob.outputGroup.nodeIds || []),
          ...(result.nodeIds || []),
          ...(result.promptNodeId ? [result.promptNodeId] : []),
          ...result.resultImageNodeIds,
          ...outputs.map((output) => output.nodeId).filter((id): id is string => Boolean(id)),
        ]));
      }
    } catch (error) {
      const retryJob = this.findJob(jobId);
      const retryPrompt = retryJob?.prompts.find((prompt) => prompt.id === promptId);
      if (!retryJob || retryJob.status === 'cancelled' || !retryPrompt) return;
      const classified = classifyGenerationError(error);
      if (classified.retryable && retryPrompt.retryCount < RETRY_ATTEMPTS && retryJob.status === 'running') {
        retryPrompt.retryCount += 1;
        retryPrompt.status = 'queued';
        retryPrompt.phase = 'queued';
        retryPrompt.error = classified.message;
        retryPrompt.errorCategory = classified.category;
        retryPrompt.retryable = true;
        this.saveJobs();
        await new Promise((resolve) => setTimeout(resolve, RETRY_BACKOFF_MS));
      } else if (classified.retryable && retryPrompt.retryCount < RETRY_ATTEMPTS && retryJob.status === 'paused') {
        retryPrompt.retryCount += 1;
        retryPrompt.status = 'queued';
        retryPrompt.phase = 'queued';
      } else {
        retryPrompt.status = 'failed';
        retryPrompt.phase = 'failed';
        retryPrompt.error = classified.message;
        retryPrompt.errorCategory = classified.category;
        retryPrompt.retryable = classified.retryable;
      }
    } finally {
      this.inFlightTasks.delete(taskKey);
      this.abortControllers.delete(taskKey);
      const activeJob = this.findJob(jobId);
      if (activeJob) activeJob.updatedAt = Date.now();
      this.saveJobs();
      this.scheduleProcess();
    }
  }
}

export const durableGenerationQueue = new DurableGenerationQueue();
