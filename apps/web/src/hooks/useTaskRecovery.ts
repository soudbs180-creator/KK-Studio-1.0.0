import { useState, useEffect, useCallback, useRef } from 'react';
import type { PromptNode, TaskProviderType } from '../types';
import { GenerationMode } from '../types';
import {
  getPendingTasks,
  saveTask,
  updateTaskStatus,
  modeToTaskType,
  type PersistedTask,
} from '../services/persistence/taskPersistence';
import { keyManager } from '../services/auth/keyManager';
import { resolveProviderRuntime } from '../services/api/providerStrategy';
import { normalizePersistentResultUrl } from '../utils/imageResultPersistence';
import { resumeGenerationTask } from '../services/generation/generationJobRecovery';
import {
  discoverPendingGenerationJobs,
  findRecoveryPromptNode,
  mergeRecoveryCandidates,
  type GenerationJobRecoveryCandidate,
} from '../services/generation/generationJobDiscovery';
import { getRuntimeOwnerId } from '../services/auth/runtimeSessionProfile';
import {
  getLatestStartupSnapshot,
  isStartupStageReady,
  subscribeStartupSnapshot,
} from '../services/system/appStartup';

interface TaskRecoveryState {
  isLoading: boolean;
  recoveredCount: number;
  pendingCount: number;
}

type RecoveryReason = 'initial' | 'visibility' | 'online' | 'manual';

const RECOVERY_THROTTLE_MS = 30_000;

const isBackgroundStartupReady = (): boolean => (
  isStartupStageReady(getLatestStartupSnapshot().stage, 'background_ready')
);

type LlmServiceModule = typeof import('../features/generation/generateService');

const checkTaskStatuses: LlmServiceModule['generationService']['checkTaskStatuses'] = async (...args) => {
  const { generationService: runtimeLlmService } = await import('../features/generation/generateService');
  return runtimeLlmService.checkTaskStatuses(...args);
};

type TaskRecoveryCanvasSnapshot = {
  id?: string;
  promptNodes?: PromptNode[];
} | null | undefined;

type HydrateDiscoveredTask = (
  node: PromptNode,
  taskId: string,
  expectedOwnerId: string,
) => PromptNode | null;

type RecoverableEntry = {
  task: GenerationJobRecoveryCandidate;
  node: PromptNode;
};

const detectTaskProviderType = (model?: string, runtimeStrategyId?: string): TaskProviderType => {
  const normalizedModel = String(model || '').trim().toLowerCase();
  if (
    normalizedModel.includes('midjourney')
    || normalizedModel.startsWith('mj-')
    || normalizedModel.startsWith('mj_')
    || normalizedModel.includes('/mj')
  ) {
    return 'midjourney';
  }

  if (runtimeStrategyId === 'gpt-best' && normalizedModel.includes('journey')) {
    return 'midjourney';
  }

  return 'generic';
};

function abortRecoveryControllers(controllers: Map<string, AbortController>): void {
  controllers.forEach((controller) => controller.abort());
  controllers.clear();
}

function isRecoveryActive(ownerId: string, signal: AbortSignal): boolean {
  return !signal.aborted && getRuntimeOwnerId() === ownerId;
}

function filterPendingTasks(tasks: PersistedTask[]): PersistedTask[] {
  return tasks.filter((task) => task.status === 'pending' || task.status === 'processing');
}

/**
 * 任务恢复 Hook
 * 在页面加载、回到前台和网络恢复后自动恢复进行中的任务
 */
export function useTaskRecovery(
  activeCanvas: TaskRecoveryCanvasSnapshot,
  pollTaskFn: (node: PromptNode, taskId: string) => Promise<void>,
  enabled = true,
  hydrateDiscoveredTask?: HydrateDiscoveredTask,
) {
  const [state, setState] = useState<TaskRecoveryState>({
    isLoading: false,
    recoveredCount: 0,
    pendingCount: 0,
  });
  const isRecoveringRef = useRef(false);
  const lastRecoveredAtRef = useRef(new Map<string, number>());
  const activeRecoveryControllersRef = useRef(new Map<string, AbortController>());
  const discoveryControllerRef = useRef<AbortController | null>(null);
  const activeCanvasSnapshotRef = useRef(activeCanvas);
  activeCanvasSnapshotRef.current = activeCanvas;
  const canvasRecoveryKey = `${activeCanvas?.id || 'no-canvas'}:${Boolean(activeCanvas?.promptNodes?.length)}`;

  /**
   * 恢复数据库中的待处理任务
   */
  const recoverTasks = useCallback(async (reason: RecoveryReason = 'manual') => {
    if (isRecoveringRef.current) return;
    isRecoveringRef.current = true;

    setState(prev => ({ ...prev, isLoading: true }));
    const recoveryOwnerId = getRuntimeOwnerId();
    const discoveryController = new AbortController();
    discoveryControllerRef.current = discoveryController;

    try {
      const localTasks = filterPendingTasks(await getPendingTasks());
      if (!isRecoveryActive(recoveryOwnerId, discoveryController.signal)) return;
      let serverTasks: GenerationJobRecoveryCandidate[] = [];
      try {
        serverTasks = await discoverPendingGenerationJobs({ signal: discoveryController.signal });
      } catch (error) {
        if (!isRecoveryActive(recoveryOwnerId, discoveryController.signal)) return;
        console.warn('[TaskRecovery] Server Job discovery unavailable:', error);
      }
      if (getRuntimeOwnerId() !== recoveryOwnerId || discoveryController.signal.aborted) return;
      const recoverableTasks = mergeRecoveryCandidates(localTasks, serverTasks);
      const now = Date.now();
      const recoverableEntries: RecoverableEntry[] = [];
      const claimedPromptNodeIds = new Set<string>();
      let recovered = 0;

      for (const task of recoverableTasks) {
        let node = findRecoveryPromptNode(activeCanvasSnapshotRef.current?.promptNodes || [], task);

        if (!node) {
          console.log(`[TaskRecovery] Found orphaned task: ${task.taskId}`);
          continue;
        }
        if (claimedPromptNodeIds.has(node.id)) continue;

        if (task.discoveredFromServer && node.jobId !== task.taskId) {
          if (node.jobId || !hydrateDiscoveredTask) continue;
          if (!isRecoveryActive(recoveryOwnerId, discoveryController.signal)) return;
          const hydratedNode = hydrateDiscoveredTask(node, task.taskId, recoveryOwnerId);
          if (!hydratedNode) continue;
          if (!isRecoveryActive(recoveryOwnerId, discoveryController.signal)) return;
          claimedPromptNodeIds.add(hydratedNode.id);
          node = hydratedNode;
        } else {
          claimedPromptNodeIds.add(node.id);
        }

        if (reason === 'online' && !task.discoveredFromServer && node.jobId === task.taskId) {
          continue;
        }

        if (activeRecoveryControllersRef.current.has(task.taskId)) {
          continue;
        }

        const lastRecoveredAt = lastRecoveredAtRef.current.get(task.taskId);
        if (lastRecoveredAt && now - lastRecoveredAt < RECOVERY_THROTTLE_MS) {
          continue;
        }

        lastRecoveredAtRef.current.set(task.taskId, now);
        recoverableEntries.push({ task, node });
      }

      const midjourneyGroups = new Map<string, Array<{ task: typeof recoverableTasks[number]; node: PromptNode }>>();
      recoverableEntries.forEach((entry) => {
        if (entry.task.taskType !== 'image' || entry.task.taskProviderType !== 'midjourney') {
          return;
        }

        const groupKey = entry.task.keySlotId || entry.task.providerLabel || entry.task.provider || 'midjourney';
        const group = midjourneyGroups.get(groupKey) || [];
        group.push(entry);
        midjourneyGroups.set(groupKey, group);
      });

      for (const group of midjourneyGroups.values()) {
        if (group.length < 2) continue;
        if (!isRecoveryActive(recoveryOwnerId, discoveryController.signal)) return;

        try {
          await checkTaskStatuses(
            group.map((entry) => entry.task.taskId),
            GenerationMode.IMAGE,
            { id: group[0].task.keySlotId },
            group[0].node.model
          );
        } catch (error) {
          console.warn('[TaskRecovery] Midjourney batch preflight failed:', error);
        }
      }

      for (const { task, node } of recoverableEntries) {
        if (!isRecoveryActive(recoveryOwnerId, discoveryController.signal)) return;
        recovered++;
        const controller = new AbortController();
        activeRecoveryControllersRef.current.set(task.taskId, controller);
        void resumeGenerationTask(node, task.taskId, pollTaskFn, {
          signal: controller.signal,
        }).catch((error) => {
          console.error('[TaskRecovery] Failed to resume task:', error);
        }).finally(() => {
          if (activeRecoveryControllersRef.current.get(task.taskId) === controller) {
            activeRecoveryControllersRef.current.delete(task.taskId);
          }
        });
      }

      if (isRecoveryActive(recoveryOwnerId, discoveryController.signal)) {
        setState({
          isLoading: false,
          recoveredCount: recovered,
          pendingCount: recoverableTasks.length,
        });
      }
    } catch (error) {
      if (isRecoveryActive(recoveryOwnerId, discoveryController.signal)) {
        console.error('[TaskRecovery] Failed to recover tasks:', error);
        setState(prev => ({ ...prev, isLoading: false }));
      }
    } finally {
      if (discoveryControllerRef.current === discoveryController) {
        discoveryControllerRef.current = null;
      }
      isRecoveringRef.current = false;
    }
  }, [canvasRecoveryKey, hydrateDiscoveredTask, pollTaskFn]);

  useEffect(() => {
    if (enabled) return undefined;
    discoveryControllerRef.current?.abort();
    abortRecoveryControllers(activeRecoveryControllersRef.current);
    return undefined;
  }, [enabled]);

  useEffect(() => () => {
    discoveryControllerRef.current?.abort();
    abortRecoveryControllers(activeRecoveryControllersRef.current);
  }, []);

  /**
   * 监听页面可见性和网络变化，自动恢复任务
   */
  useEffect(() => {
    if (typeof window === 'undefined' || !enabled) return;

    let started = false;
    let unsubscribeStartup: (() => void) | null = null;

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        void recoverTasks('visibility');
      }
    };

    const handleOnline = () => {
      void recoverTasks('online');
    };

    const startRecovery = () => {
      if (started || !isBackgroundStartupReady()) {
        return;
      }

      started = true;
      document.addEventListener('visibilitychange', handleVisibilityChange);
      window.addEventListener('online', handleOnline);

      void recoverTasks('initial');
      unsubscribeStartup?.();
      unsubscribeStartup = null;
    };

    startRecovery();

    if (!started) {
      unsubscribeStartup = subscribeStartupSnapshot(() => {
        startRecovery();
      });
    }

    return () => {
      unsubscribeStartup?.();
      if (started) {
        document.removeEventListener('visibilitychange', handleVisibilityChange);
        window.removeEventListener('online', handleOnline);
      }
    };
  }, [recoverTasks, enabled]);

  return {
    ...state,
    recoverTasks,
  };
}

/**
 * 保存任务到数据库（供其他组件使用）
 */
export async function persistTask(
  taskId: string,
  node: PromptNode,
  canvasId?: string
): Promise<void> {
  try {
    const keySlot = node.keySlotId ? keyManager.getKey(node.keySlotId) : null;
    const runtime = resolveProviderRuntime({
      provider: keySlot?.provider || node.provider,
      baseUrl: keySlot?.baseUrl,
      format: keySlot?.format,
      authMethod: keySlot?.authMethod,
      headerName: keySlot?.headerName,
      compatibilityMode: keySlot?.compatibilityMode,
      modelId: node.model,
    });
    const taskProviderType = detectTaskProviderType(node.model, runtime.strategyId);

    await saveTask({
      taskId,
      taskType: modeToTaskType(node.mode || GenerationMode.IMAGE),
      taskProviderType,
      prompt: node.prompt,
      model: node.model,
      provider: node.provider || keySlot?.provider,
      providerLabel: node.providerLabel || keySlot?.name,
      keySlotId: node.keySlotId || keySlot?.id,
      runtimeStrategyId: runtime.strategyId,
      aspectRatio: node.aspectRatio,
      imageSize: node.imageSize,
      canvasId: canvasId || 'default',
      promptNodeId: node.id,
    });

    console.log(`[TaskPersistence] Task saved: ${taskId}`);
  } catch (error) {
    console.error('[TaskPersistence] Failed to persist task:', error);
  }
}

/**
 * 标记任务完成
 */
export async function markTaskCompleted(
  taskId: string,
  resultUrls: string[],
  cost?: number,
  tokens?: number,
  costSource?: 'snapshot' | 'explicit' | 'stored' | 'estimated' | 'none',
  resultStorageIds?: Record<string, string>
): Promise<void> {
  try {
    const persistedUrls = resultUrls
      .map((url) => normalizePersistentResultUrl(url))
      .filter((url): url is string => !!url);

    const persistedStorageIds = resultStorageIds && typeof resultStorageIds === 'object'
      ? Object.fromEntries(
          Object.entries(resultStorageIds)
            .filter(([key, value]) => (
              String(key).trim().length > 0
              && typeof value === 'string'
              && value.trim().length > 0
            ))
            .map(([key, value]) => [String(key).trim(), value.trim()])
        )
      : undefined;

    await updateTaskStatus(taskId, 'completed', {
      resultUrls: persistedUrls,
      resultStorageIds: persistedStorageIds,
      cost,
      costSource,
      tokens,
    });
    console.log(`[TaskPersistence] Task completed: ${taskId}`);
  } catch (error) {
    console.error('[TaskPersistence] Failed to mark task completed:', error);
  }
}

/**
 * 标记任务失败
 */
export async function markTaskFailed(
  taskId: string,
  errorMessage: string
): Promise<void> {
  try {
    await updateTaskStatus(taskId, 'failed', { errorMessage });
    console.log(`[TaskPersistence] Task failed: ${taskId}`);
  } catch (error) {
    console.error('[TaskPersistence] Failed to mark task failed:', error);
  }
}
