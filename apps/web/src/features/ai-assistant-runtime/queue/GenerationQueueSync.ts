import type {
  CreateGenerationBatchJobRequestDto,
  GenerationBatchJobDto,
  GenerationJobItemDto,
  GenerationJobParametersDto,
} from '@kk/shared';
import { kkWebApiClient } from '../../../services/api/kkApiClient.ts';
import { getStoredKkApiAccessToken } from '../../../services/api/authAccessToken.ts';
import { durableGenerationQueue, type GenerationBatchJob } from './DurableGenerationQueue.ts';

const DB_NAME = 'kk-generation-queue';
const DB_VERSION = 1;
const JOB_STORE = 'jobs-v2';
const DEVICE_ID_KEY = 'kk_generation_queue_device_id';
const ACTIVE_STATUSES = new Set(['queued', 'running', 'paused']);

const remoteIds = new Map<string, string>();
let stopSubscription: (() => void) | null = null;
let syncTimer: ReturnType<typeof setTimeout> | null = null;
let pullTimer: ReturnType<typeof setInterval> | null = null;
let syncInFlight = false;

const getDeviceId = () => {
  try {
    const existing = sessionStorage.getItem(DEVICE_ID_KEY);
    if (existing) return existing;
    const created = `web_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
    sessionStorage.setItem(DEVICE_ID_KEY, created);
    return created;
  } catch {
    return `web_ephemeral_${Date.now()}`;
  }
};

const openMirrorDb = (): Promise<IDBDatabase | null> => new Promise((resolve) => {
  if (typeof indexedDB === 'undefined') return resolve(null);
  const request = indexedDB.open(DB_NAME, DB_VERSION);
  request.onupgradeneeded = () => {
    const db = request.result;
    if (!db.objectStoreNames.contains(JOB_STORE)) db.createObjectStore(JOB_STORE, { keyPath: 'idempotencyKey' });
  };
  request.onsuccess = () => resolve(request.result);
  request.onerror = () => resolve(null);
});

const mirrorJobsToIndexedDb = async (jobs: GenerationBatchJob[]) => {
  const db = await openMirrorDb();
  if (!db) return;
  await new Promise<void>((resolve) => {
    const transaction = db.transaction(JOB_STORE, 'readwrite');
    const store = transaction.objectStore(JOB_STORE);
    for (const job of jobs) store.put(job);
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => resolve();
    transaction.onabort = () => resolve();
  });
  db.close();
};

const toParameters = (job: GenerationBatchJob): GenerationJobParametersDto => {
  if (job.taskType === 'video') {
    return {
      taskType: 'video',
      durationSeconds: job.options.durationSeconds || 4,
      resolution: job.options.resolution,
      aspectRatio: job.options.aspectRatio,
      generateAudio: job.options.generateAudio,
      firstFrameAssetId: job.options.firstFrameAssetId,
      lastFrameAssetId: job.options.lastFrameAssetId,
      motion: job.options.motion,
    };
  }
  if (job.taskType === 'audio') {
    return {
      taskType: 'audio',
      durationSeconds: job.options.durationSeconds,
      voice: job.options.voice,
      lyrics: job.options.lyrics,
      genre: job.options.genre,
    };
  }
  return {
    taskType: 'image',
    aspectRatio: job.options.aspectRatio,
    imageSize: job.options.imageSize,
    countPerPrompt: job.options.countPerPrompt,
  };
};

const toRemoteItems = (job: GenerationBatchJob): GenerationJobItemDto[] => job.prompts.map((prompt) => ({
  id: prompt.id,
  prompt: prompt.prompt,
  referenceImageNodeId: prompt.referenceImageNodeId,
  status: prompt.status,
  retryCount: prompt.retryCount,
  retryable: prompt.retryable,
  error: prompt.error,
  errorCategory: prompt.errorCategory,
  providerTaskId: prompt.providerTaskId,
  outputs: prompt.outputs || [],
}));

const toCreateRequest = (job: GenerationBatchJob): CreateGenerationBatchJobRequestDto => ({
  schemaVersion: 2,
  workspaceId: job.canvasId,
  modelCode: job.options.modelId,
  taskType: job.taskType,
  prompts: job.prompts.map((prompt) => ({
    id: prompt.id,
    prompt: prompt.prompt,
    referenceImageNodeId: prompt.referenceImageNodeId,
  })),
  parameters: toParameters(job),
  concurrency: job.options.concurrency,
  outputGroup: job.outputGroup,
  idempotencyKey: job.idempotencyKey,
});

const claimAndMerge = async (remote: GenerationBatchJobDto) => {
  remoteIds.set(remote.idempotencyKey, remote.id);
  if (!ACTIVE_STATUSES.has(remote.status)) {
    durableGenerationQueue.mergeRemoteJob(remote);
    return;
  }
  const claimed = await kkWebApiClient.claimGenerationJob(remote.id, {
    leaseOwner: getDeviceId(),
    leaseSeconds: 60,
  });
  if (claimed.success) durableGenerationQueue.mergeRemoteJob(claimed.data);
};

const pullRemoteJobs = async () => {
  if (!getStoredKkApiAccessToken()) return;
  const response = await kkWebApiClient.listGenerationJobs({ limit: 100 });
  if (!response.success) return;
  for (const remote of response.data.jobs) {
    await claimAndMerge(remote);
  }
};

const syncJobsToServer = async (jobs: GenerationBatchJob[]) => {
  if (!getStoredKkApiAccessToken() || syncInFlight) return;
  syncInFlight = true;
  try {
    for (const job of jobs) {
      let remoteId = remoteIds.get(job.idempotencyKey);
      if (!remoteId) {
        const created = await kkWebApiClient.createGenerationJob(toCreateRequest(job));
        if (!created.success) continue;
        remoteId = created.data.id;
        remoteIds.set(job.idempotencyKey, remoteId);
        if (ACTIVE_STATUSES.has(created.data.status)) {
          await kkWebApiClient.claimGenerationJob(remoteId, { leaseOwner: getDeviceId(), leaseSeconds: 60 });
        }
      }
      await kkWebApiClient.updateGenerationJob(remoteId, {
        status: job.status,
        progress: job.progress,
        outputs: job.outputs,
        items: toRemoteItems(job),
        leaseOwner: getDeviceId(),
        leaseExpiresAt: ACTIVE_STATUSES.has(job.status) ? new Date(Date.now() + 60_000).toISOString() : undefined,
      });
    }
  } finally {
    syncInFlight = false;
  }
};

const scheduleSync = (jobs: GenerationBatchJob[]) => {
  void mirrorJobsToIndexedDb(jobs);
  if (syncTimer) clearTimeout(syncTimer);
  syncTimer = setTimeout(() => {
    syncTimer = null;
    void syncJobsToServer(durableGenerationQueue.getJobs());
  }, 400);
};

export const startGenerationQueueSync = () => {
  if (stopSubscription || typeof window === 'undefined') return () => {};
  void pullRemoteJobs();
  stopSubscription = durableGenerationQueue.subscribe(scheduleSync);
  pullTimer = setInterval(() => void pullRemoteJobs(), 15_000);
  return () => {
    stopSubscription?.();
    stopSubscription = null;
    if (syncTimer) clearTimeout(syncTimer);
    if (pullTimer) clearInterval(pullTimer);
    syncTimer = null;
    pullTimer = null;
  };
};
