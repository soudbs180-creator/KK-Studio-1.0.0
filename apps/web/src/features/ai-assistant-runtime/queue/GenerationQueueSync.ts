import type {
  CreateGenerationBatchJobRequestDto,
  GenerationBatchJobDto,
  GenerationJobItemDto,
  GenerationJobParametersDto,
} from '@kk/shared';
import { kkWebApiClient } from '../../../services/api/kkApiClient.ts';
import { getStoredKkApiAccessToken } from '../../../services/api/authAccessToken.ts';
import { subscribeAuthSessionChange } from '../../../services/auth/authSessionEvents.ts';
import { durableGenerationQueue, type GenerationBatchJob } from './DurableGenerationQueue.ts';

const DB_NAME = 'kk-generation-queue';
const DB_VERSION = 2;
const JOB_STORE = 'jobs-v3-owner';
const DEVICE_ID_KEY = 'kk_generation_queue_device_id';
const ACTIVE_STATUSES = new Set(['queued', 'running', 'paused']);

const remoteIds = new Map<string, string>();
let stopSubscription: (() => void) | null = null;
let syncTimer: ReturnType<typeof setTimeout> | null = null;
let pullTimer: ReturnType<typeof setInterval> | null = null;
let syncInFlightOwnerId: string | null = null;
let syncRequestedWhileInFlight = false;
let stopAuthSubscription: (() => void) | null = null;
let activeSyncOwnerId = durableGenerationQueue.getOwnerScopeId();

const ensureSyncOwner = (): string => {
  const ownerId = durableGenerationQueue.refreshOwnerScope();
  if (ownerId !== activeSyncOwnerId) {
    activeSyncOwnerId = ownerId;
    remoteIds.clear();
  }
  return ownerId;
};

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
    if (db.objectStoreNames.contains('jobs-v2')) db.deleteObjectStore('jobs-v2');
    if (!db.objectStoreNames.contains(JOB_STORE)) db.createObjectStore(JOB_STORE, { keyPath: 'ownerJobKey' });
  };
  request.onsuccess = () => resolve(request.result);
  request.onerror = () => resolve(null);
});

const mirrorJobsToIndexedDb = async (jobs: GenerationBatchJob[], ownerId: string) => {
  const db = await openMirrorDb();
  if (!db) return;
  await new Promise<void>((resolve) => {
    const transaction = db.transaction(JOB_STORE, 'readwrite');
    const store = transaction.objectStore(JOB_STORE);
    for (const job of jobs) store.put({
      ...job,
      ownerId,
      ownerJobKey: `${ownerId}\u0000${job.idempotencyKey}`,
    });
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

const claimAndMerge = async (remote: GenerationBatchJobDto, ownerId: string) => {
  if (ownerId !== ensureSyncOwner()) return;
  remoteIds.set(remote.idempotencyKey, remote.id);
  if (!ACTIVE_STATUSES.has(remote.status)) {
    durableGenerationQueue.mergeRemoteJob(remote);
    return;
  }
  const claimed = await kkWebApiClient.claimGenerationJob(remote.id, {
    leaseOwner: getDeviceId(),
    leaseSeconds: 60,
  }, { expectedAuthSubject: ownerId });
  if (claimed.success && ownerId === ensureSyncOwner()) durableGenerationQueue.mergeRemoteJob(claimed.data);
};

const pullRemoteJobs = async () => {
  const ownerId = ensureSyncOwner();
  if (ownerId === 'local_user') return;
  if (!getStoredKkApiAccessToken()) return;
  const response = await kkWebApiClient.listGenerationJobs(
    { limit: 100 },
    { expectedAuthSubject: ownerId },
  );
  if (!response.success || ownerId !== ensureSyncOwner()) return;
  for (const remote of response.data.jobs) {
    await claimAndMerge(remote, ownerId);
  }
};

const syncJobsToServer = async (jobs: GenerationBatchJob[]) => {
  const ownerId = ensureSyncOwner();
  if (ownerId === 'local_user') return;
  if (!getStoredKkApiAccessToken()) return;
  if (syncInFlightOwnerId) {
    syncRequestedWhileInFlight = true;
    return;
  }
  syncInFlightOwnerId = ownerId;
  try {
    for (const job of jobs) {
      let remoteId = remoteIds.get(job.idempotencyKey);
      if (!remoteId) {
        const created = await kkWebApiClient.createGenerationJob(
          toCreateRequest(job),
          { expectedAuthSubject: ownerId },
        );
        if (!created.success || ownerId !== ensureSyncOwner()) return;
        remoteId = created.data.id;
        remoteIds.set(job.idempotencyKey, remoteId);
        if (ACTIVE_STATUSES.has(created.data.status)) {
          await kkWebApiClient.claimGenerationJob(
            remoteId,
            { leaseOwner: getDeviceId(), leaseSeconds: 60 },
            { expectedAuthSubject: ownerId },
          );
          if (ownerId !== ensureSyncOwner()) return;
        }
      }
      await kkWebApiClient.updateGenerationJob(
        remoteId,
        {
          status: job.status,
          progress: job.progress,
          outputs: job.outputs,
          items: toRemoteItems(job),
          leaseOwner: getDeviceId(),
          leaseExpiresAt: ACTIVE_STATUSES.has(job.status) ? new Date(Date.now() + 60_000).toISOString() : undefined,
        },
        { expectedAuthSubject: ownerId },
      );
      if (ownerId !== ensureSyncOwner()) return;
    }
  } finally {
    syncInFlightOwnerId = null;
    const currentOwnerId = ensureSyncOwner();
    if (syncRequestedWhileInFlight || currentOwnerId !== ownerId) {
      syncRequestedWhileInFlight = false;
      queueMicrotask(() => void syncJobsToServer(durableGenerationQueue.getJobs()));
    }
  }
};

const scheduleSync = (jobs: GenerationBatchJob[]) => {
  const ownerId = ensureSyncOwner();
  void mirrorJobsToIndexedDb(jobs, ownerId);
  if (syncTimer) clearTimeout(syncTimer);
  syncTimer = setTimeout(() => {
    syncTimer = null;
    void syncJobsToServer(durableGenerationQueue.getJobs());
  }, 400);
};

export const startGenerationQueueSync = () => {
  if (stopSubscription || typeof window === 'undefined') return () => {};
  ensureSyncOwner();
  void pullRemoteJobs();
  stopSubscription = durableGenerationQueue.subscribe(scheduleSync);
  stopAuthSubscription = subscribeAuthSessionChange(() => {
    ensureSyncOwner();
    if (syncTimer) clearTimeout(syncTimer);
    syncTimer = null;
    void pullRemoteJobs();
    scheduleSync(durableGenerationQueue.getJobs());
  });
  pullTimer = setInterval(() => void pullRemoteJobs(), 15_000);
  return () => {
    stopSubscription?.();
    stopSubscription = null;
    stopAuthSubscription?.();
    stopAuthSubscription = null;
    if (syncTimer) clearTimeout(syncTimer);
    if (pullTimer) clearInterval(pullTimer);
    syncTimer = null;
    pullTimer = null;
  };
};
