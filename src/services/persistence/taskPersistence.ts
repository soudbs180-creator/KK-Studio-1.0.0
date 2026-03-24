import { supabase } from '../../lib/supabase';
import { GenerationMode } from '../../types';
import { tempUserService } from '../auth/tempUserService';

export type TaskType = 'image' | 'video' | 'audio';

export interface PersistedTask {
  id: string;
  taskId: string;
  taskType: TaskType;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  prompt?: string;
  model?: string;
  aspectRatio?: string;
  imageSize?: string;
  resultUrls?: string[];
  errorMessage?: string;
  cost?: number;
  tokens?: number;
  canvasId?: string;
  promptNodeId?: string;
  createdAt: string;
  updatedAt: string;
  completedAt?: string;
}

const TASK_STORAGE_PREFIX = 'kk_studio_generation_tasks';
const DEFAULT_TASK_LIMIT = 50;

function buildTaskRecordId(taskId: string): string {
  return `task_${taskId}`;
}

async function resolveStorageUserId(): Promise<string | null> {
  const tempUser = tempUserService.getCachedTempUser();
  if (tempUser?.user?.id) {
    return tempUser.user.id;
  }

  const { data: { user } } = await supabase.auth.getUser();
  return user?.id || null;
}

function buildStorageKey(userId: string): string {
  return `${TASK_STORAGE_PREFIX}:${userId}`;
}

function normalizeTask(raw: Partial<PersistedTask>): PersistedTask {
  const nowIso = new Date().toISOString();
  return {
    id: String(raw.id || buildTaskRecordId(String(raw.taskId || nowIso))),
    taskId: String(raw.taskId || ''),
    taskType: raw.taskType === 'video' || raw.taskType === 'audio' ? raw.taskType : 'image',
    status:
      raw.status === 'processing'
        || raw.status === 'completed'
        || raw.status === 'failed'
        ? raw.status
        : 'pending',
    prompt: raw.prompt,
    model: raw.model,
    aspectRatio: raw.aspectRatio,
    imageSize: raw.imageSize,
    resultUrls: Array.isArray(raw.resultUrls) ? raw.resultUrls.map((item) => String(item)) : [],
    errorMessage: raw.errorMessage,
    cost: typeof raw.cost === 'number' ? raw.cost : undefined,
    tokens: typeof raw.tokens === 'number' ? raw.tokens : undefined,
    canvasId: raw.canvasId,
    promptNodeId: raw.promptNodeId,
    createdAt: raw.createdAt || nowIso,
    updatedAt: raw.updatedAt || raw.createdAt || nowIso,
    completedAt: raw.completedAt,
  };
}

function loadTasksForUser(userId: string): PersistedTask[] {
  try {
    const stored = localStorage.getItem(buildStorageKey(userId));
    if (!stored) return [];

    const parsed = JSON.parse(stored);
    if (!Array.isArray(parsed)) return [];

    return parsed
      .filter((task): task is Partial<PersistedTask> => Boolean(task) && typeof task === 'object')
      .map((task) => normalizeTask(task))
      .filter((task) => Boolean(task.taskId));
  } catch (error) {
    console.error('[TaskPersistence] Failed to load local tasks:', error);
    return [];
  }
}

function saveTasksForUser(userId: string, tasks: PersistedTask[]): void {
  try {
    localStorage.setItem(buildStorageKey(userId), JSON.stringify(tasks));
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
  prompt?: string;
  model?: string;
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
      status: previous?.status === 'completed' || previous?.status === 'failed'
        ? previous.status
        : 'pending',
      prompt: params.prompt,
      model: params.model,
      aspectRatio: params.aspectRatio,
      imageSize: params.imageSize,
      canvasId: params.canvasId,
      promptNodeId: params.promptNodeId,
      createdAt: previous?.createdAt || nowIso,
      updatedAt: nowIso,
      completedAt: previous?.completedAt,
      resultUrls: previous?.resultUrls || [],
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
    errorMessage?: string;
    cost?: number;
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
      errorMessage: updates?.errorMessage ?? tasks[index].errorMessage,
      cost: updates?.cost ?? tasks[index].cost,
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

export async function cleanupCompletedTasks(): Promise<number> {
  return withUserTasks((userId, tasks) => {
    const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;
    const nextTasks = tasks.filter((task) => {
      if (task.status !== 'completed' && task.status !== 'failed') {
        return true;
      }

      const createdAt = Date.parse(task.createdAt);
      return Number.isFinite(createdAt) && createdAt >= thirtyDaysAgo;
    });

    saveTasksForUser(userId, nextTasks);
    return tasks.length - nextTasks.length;
  }, 0);
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
