import { GenerationMode, TaskProviderType } from '../../types';
import { getLatestAuthSessionChange } from '../auth/authSessionEvents';
import { resolveRuntimeAuthenticatedProfileContext } from '../auth/runtimeSessionProfile.ts';
import { tempUserService } from '../auth/tempUserService';

export type TaskType = 'image' | 'video' | 'audio';

export interface PersistedTask {
  id: string;
  taskId: string;
  taskType: TaskType;
  taskProviderType?: TaskProviderType;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  prompt?: string;
  model?: string;
  provider?: string;
  providerLabel?: string;
  keySlotId?: string;
  runtimeStrategyId?: string;
  aspectRatio?: string;
  imageSize?: string;
  resultUrls?: string[];
  resultStorageIds?: Record<string, string>;
  errorMessage?: string;
  cost?: number;
  costSource?: 'snapshot' | 'explicit' | 'stored' | 'estimated' | 'none';
  tokens?: number;
  canvasId?: string;
  promptNodeId?: string;
  createdAt: string;
  updatedAt: string;
  completedAt?: string;
}

const TASK_STORAGE_PREFIX = 'kk_studio_generation_tasks';
const DEFAULT_TASK_LIMIT = 50;
let cachedUserTasks: { userId: string; tasks: PersistedTask[] } | null = null;
let cachedResolvedStorageUserId: string | null = null;
let pendingStorageUserIdPromise: Promise<string | null> | null = null;

function normalizeStorageUserId(userId: unknown): string | null {
  if (typeof userId !== 'string') return null;
  const normalized = userId.trim();
  return normalized.length > 0 ? normalized : null;
}

function setCachedResolvedStorageUserId(userId: string | null): string | null {
  cachedResolvedStorageUserId = normalizeStorageUserId(userId);
  return cachedResolvedStorageUserId;
}

export function setTaskPersistenceStorageUserId(userId: string | null): void {
  setCachedResolvedStorageUserId(userId);
}

function buildTaskRecordId(taskId: string): string {
  return `task_${taskId}`;
}

async function resolveStorageUserId(): Promise<string | null> {
  const tempUserId = normalizeStorageUserId(tempUserService.getCachedTempUser()?.user?.id);
  if (tempUserId) {
    return setCachedResolvedStorageUserId(tempUserId);
  }

  const latestAuthState = getLatestAuthSessionChange();
  const latestAuthUserId = normalizeStorageUserId(latestAuthState?.userId);
  if (latestAuthUserId) {
    return setCachedResolvedStorageUserId(latestAuthUserId);
  }

  const authStateExplicitlyCleared = !!latestAuthState
    && latestAuthState.hasSession !== true
    && latestAuthState.isTempUser !== true;
  if (authStateExplicitlyCleared) {
    return setCachedResolvedStorageUserId(null);
  }

  if (cachedResolvedStorageUserId) {
    return cachedResolvedStorageUserId;
  }

  if (!pendingStorageUserIdPromise) {
    pendingStorageUserIdPromise = (async () => {
      const runtimeProfile = resolveRuntimeAuthenticatedProfileContext();
      const runtimeUserId = normalizeStorageUserId(runtimeProfile?.userId);
      if (runtimeUserId) {
        return setCachedResolvedStorageUserId(runtimeUserId);
      }

      if (authStateExplicitlyCleared) {
        return setCachedResolvedStorageUserId(null);
      }

      const fallbackUserId = normalizeStorageUserId(cachedUserTasks?.userId);
      if (fallbackUserId) {
        return setCachedResolvedStorageUserId(fallbackUserId);
      }

      return null;
    })().finally(() => {
      pendingStorageUserIdPromise = null;
    });
  }

  return pendingStorageUserIdPromise;
}

function buildStorageKey(userId: string): string {
  return `${TASK_STORAGE_PREFIX}:${userId}`;
}

function normalizeTask(raw: Partial<PersistedTask>): PersistedTask {
  const nowIso = new Date().toISOString();
  const resultStorageIds = raw.resultStorageIds && typeof raw.resultStorageIds === 'object'
    ? Object.fromEntries(
        Object.entries(raw.resultStorageIds)
          .filter(([key, value]) => (
            String(key).trim().length > 0
            && typeof value === 'string'
            && value.trim().length > 0
          ))
          .map(([key, value]) => [String(key).trim(), value.trim()])
      )
    : undefined;

  return {
    id: String(raw.id || buildTaskRecordId(String(raw.taskId || nowIso))),
    taskId: String(raw.taskId || ''),
    taskType: raw.taskType === 'video' || raw.taskType === 'audio' ? raw.taskType : 'image',
    taskProviderType: raw.taskProviderType === 'midjourney' ? 'midjourney' : 'generic',
    status:
      raw.status === 'processing'
        || raw.status === 'completed'
        || raw.status === 'failed'
        ? raw.status
        : 'pending',
    prompt: raw.prompt,
    model: raw.model,
    provider: raw.provider,
    providerLabel: raw.providerLabel,
    keySlotId: raw.keySlotId,
    runtimeStrategyId: raw.runtimeStrategyId,
    aspectRatio: raw.aspectRatio,
    imageSize: raw.imageSize,
    resultUrls: Array.isArray(raw.resultUrls) ? raw.resultUrls.map((item) => String(item)) : [],
    resultStorageIds: resultStorageIds && Object.keys(resultStorageIds).length > 0 ? resultStorageIds : undefined,
    errorMessage: raw.errorMessage,
    cost: typeof raw.cost === 'number' ? raw.cost : undefined,
    costSource:
      raw.costSource === 'snapshot'
      || raw.costSource === 'explicit'
      || raw.costSource === 'stored'
      || raw.costSource === 'estimated'
      || raw.costSource === 'none'
        ? raw.costSource
        : undefined,
    tokens: typeof raw.tokens === 'number' ? raw.tokens : undefined,
    canvasId: raw.canvasId,
    promptNodeId: raw.promptNodeId,
    createdAt: raw.createdAt || nowIso,
    updatedAt: raw.updatedAt || raw.createdAt || nowIso,
    completedAt: raw.completedAt,
  };
}

function cloneTask(task: PersistedTask): PersistedTask {
  return {
    ...task,
    resultUrls: Array.isArray(task.resultUrls) ? [...task.resultUrls] : [],
    resultStorageIds: task.resultStorageIds ? { ...task.resultStorageIds } : undefined,
  };
}

function cloneTasks(tasks: PersistedTask[]): PersistedTask[] {
  return tasks.map(cloneTask);
}

function setCachedTasks(userId: string, tasks: PersistedTask[]): void {
  const normalizedUserId = normalizeStorageUserId(userId);
  if (!normalizedUserId) {
    cachedUserTasks = null;
    setCachedResolvedStorageUserId(null);
    return;
  }

  cachedUserTasks = {
    userId: normalizedUserId,
    tasks: cloneTasks(tasks),
  };
  setCachedResolvedStorageUserId(normalizedUserId);
}

function loadTasksForUser(userId: string): PersistedTask[] {
  if (cachedUserTasks?.userId === userId) {
    return cloneTasks(cachedUserTasks.tasks);
  }

  try {
    const stored = localStorage.getItem(buildStorageKey(userId));
    if (!stored) {
      setCachedTasks(userId, []);
      return [];
    }

    const parsed = JSON.parse(stored);
    if (!Array.isArray(parsed)) {
      setCachedTasks(userId, []);
      return [];
    }

    const tasks = parsed
      .filter((task): task is Partial<PersistedTask> => Boolean(task) && typeof task === 'object')
      .map((task) => normalizeTask(task))
      .filter((task) => Boolean(task.taskId));
    setCachedTasks(userId, tasks);
    return cloneTasks(tasks);
  } catch (error) {
    console.error('[TaskPersistence] Failed to load local tasks:', error);
    if (cachedUserTasks?.userId === userId) {
      cachedUserTasks = null;
    }
    return [];
  }
}

function saveTasksForUser(userId: string, tasks: PersistedTask[]): void {
  const normalizedTasks = tasks.map((task) => normalizeTask(task));
  try {
    localStorage.setItem(buildStorageKey(userId), JSON.stringify(normalizedTasks));
    setCachedTasks(userId, normalizedTasks);
  } catch (error) {
    console.error('[TaskPersistence] Failed to save local tasks:', error);
  }
}

async function withUserTasks<T>(
  action: (userId: string, tasks: PersistedTask[]) => T | Promise<T>,
  fallback: T,
): Promise<T> {
  try {
    const userId = await resolveStorageUserId();
    if (!userId) return fallback;

    const tasks = loadTasksForUser(userId);
    return await action(userId, tasks);
  } catch (error) {
    console.error('[TaskPersistence] Local task persistence failed:', error);
    return fallback;
  }
}

export async function saveTask(params: {
  taskId: string;
  taskType: TaskType;
  taskProviderType?: TaskProviderType;
  prompt?: string;
  model?: string;
  provider?: string;
  providerLabel?: string;
  keySlotId?: string;
  runtimeStrategyId?: string;
  aspectRatio?: string;
  imageSize?: string;
  canvasId?: string;
  promptNodeId?: string;
}): Promise<PersistedTask | null> {
  return withUserTasks((userId, tasks) => {
    const nowIso = new Date().toISOString();
    const existingIndex = tasks.findIndex((task) => task.taskId === params.taskId);
    const previous = existingIndex >= 0 ? tasks[existingIndex] : undefined;

    const nextTask = normalizeTask({
      ...previous,
      id: previous?.id || buildTaskRecordId(params.taskId),
      taskId: params.taskId,
      taskType: params.taskType,
      taskProviderType: params.taskProviderType || previous?.taskProviderType || 'generic',
      status: previous?.status === 'completed' || previous?.status === 'failed'
        ? previous.status
        : 'pending',
      prompt: params.prompt,
      model: params.model,
      provider: params.provider,
      providerLabel: params.providerLabel,
      keySlotId: params.keySlotId,
      runtimeStrategyId: params.runtimeStrategyId,
      aspectRatio: params.aspectRatio,
      imageSize: params.imageSize,
      canvasId: params.canvasId,
      promptNodeId: params.promptNodeId,
      createdAt: previous?.createdAt || nowIso,
      updatedAt: nowIso,
      completedAt: previous?.completedAt,
      resultUrls: previous?.resultUrls || [],
      resultStorageIds: previous?.resultStorageIds,
    });

    if (existingIndex >= 0) {
      tasks[existingIndex] = nextTask;
    } else {
      tasks.unshift(nextTask);
    }

    saveTasksForUser(userId, tasks.slice(0, DEFAULT_TASK_LIMIT));
    return nextTask;
  }, null);
}

export async function updateTaskStatus(
  taskId: string,
  status: PersistedTask['status'],
  updates?: {
    resultUrls?: string[];
    resultStorageIds?: Record<string, string>;
    errorMessage?: string;
    cost?: number;
    costSource?: PersistedTask['costSource'];
    tokens?: number;
  }
): Promise<boolean> {
  return withUserTasks((userId, tasks) => {
    const index = tasks.findIndex((task) => task.taskId === taskId);
    if (index < 0) return false;

    const nowIso = new Date().toISOString();
    const nextTask = normalizeTask({
      ...tasks[index],
      status,
      updatedAt: nowIso,
      completedAt: status === 'completed' || status === 'failed'
        ? nowIso
        : undefined,
      resultUrls: updates?.resultUrls ?? tasks[index].resultUrls,
      resultStorageIds: updates?.resultStorageIds ?? tasks[index].resultStorageIds,
      errorMessage: updates?.errorMessage ?? tasks[index].errorMessage,
      cost: updates?.cost ?? tasks[index].cost,
      costSource: updates?.costSource ?? tasks[index].costSource,
      tokens: updates?.tokens ?? tasks[index].tokens,
    });

    tasks[index] = nextTask;
    saveTasksForUser(userId, tasks);
    return true;
  }, false);
}

export async function getPendingTasks(): Promise<PersistedTask[]> {
  return withUserTasks((_userId, tasks) => {
    return tasks
      .filter((task) => task.status === 'pending' || task.status === 'processing')
      .sort((left, right) => right.createdAt.localeCompare(left.createdAt));
  }, []);
}

export async function getAllTasks(limit = DEFAULT_TASK_LIMIT): Promise<PersistedTask[]> {
  return withUserTasks((_userId, tasks) => {
    return [...tasks]
      .sort((left, right) => right.createdAt.localeCompare(left.createdAt))
      .slice(0, limit);
  }, []);
}

export async function deleteTask(taskId: string): Promise<boolean> {
  return withUserTasks((userId, tasks) => {
    const nextTasks = tasks.filter((task) => task.taskId !== taskId);
    if (nextTasks.length === tasks.length) {
      return false;
    }

    saveTasksForUser(userId, nextTasks);
    return true;
  }, false);
}

export async function cleanupCompletedTasksOlderThan(days: number): Promise<number> {
  if (!Number.isFinite(days) || days <= 0) {
    throw new Error('INVALID_TASK_RETENTION_RANGE');
  }

  return withUserTasks((userId, tasks) => {
    const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;
    const nextTasks = tasks.filter((task) => {
      if (task.status !== 'completed' && task.status !== 'failed') {
        return true;
      }

      const createdAt = Date.parse(task.createdAt);
      return Number.isFinite(createdAt) && createdAt >= cutoff;
    });

    saveTasksForUser(userId, nextTasks);
    return tasks.length - nextTasks.length;
  }, 0);
}

export async function cleanupCompletedTasks(): Promise<number> {
  return cleanupCompletedTasksOlderThan(30);
}

export function modeToTaskType(mode: GenerationMode): TaskType {
  switch (mode) {
    case GenerationMode.VIDEO:
      return 'video';
    case GenerationMode.AUDIO:
      return 'audio';
    default:
      return 'image';
  }
}
