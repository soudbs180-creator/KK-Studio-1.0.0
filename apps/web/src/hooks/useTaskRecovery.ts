import { useState, useEffect, useCallback, useRef } from 'react';
import type { PromptNode, TaskProviderType } from '../types';
import { GenerationMode } from '../types';
import {
  getPendingTasks,
  saveTask,
  updateTaskStatus,
  modeToTaskType
} from '../services/persistence/taskPersistence';
import { keyManager } from '../services/auth/keyManager';
import { resolveProviderRuntime } from '../services/api/providerStrategy';
import { normalizePersistentResultUrl } from '../utils/imageResultPersistence';

interface TaskRecoveryState {
  isLoading: boolean;
  recoveredCount: number;
  pendingCount: number;
}

type RecoveryReason = 'initial' | 'visibility' | 'online' | 'manual';

const RECOVERY_THROTTLE_MS = 30_000;

type LlmServiceModule = typeof import('../services/llm/LLMService');

const checkTaskStatuses: LlmServiceModule['llmService']['checkTaskStatuses'] = async (...args) => {
  const { llmService: runtimeLlmService } = await import('../services/llm/LLMService');
  return runtimeLlmService.checkTaskStatuses(...args);
};

type TaskRecoveryCanvasSnapshot = {
  promptNodes?: PromptNode[];
} | null | undefined;

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

/**
 * 任务恢复 Hook
 * 在页面加载、回到前台和网络恢复后自动恢复进行中的任务
 */
export function useTaskRecovery(
  activeCanvas: TaskRecoveryCanvasSnapshot,
  pollTaskFn: (node: PromptNode, taskId: string) => Promise<void>,
  enabled = true,
) {
  const [state, setState] = useState<TaskRecoveryState>({
    isLoading: false,
    recoveredCount: 0,
    pendingCount: 0,
  });
  const isRecoveringRef = useRef(false);
  const lastRecoveredAtRef = useRef(new Map<string, number>());

  /**
   * 恢复数据库中的待处理任务
   */
  const recoverTasks = useCallback(async (reason: RecoveryReason = 'manual') => {
    if (isRecoveringRef.current) return;
    isRecoveringRef.current = true;

    setState(prev => ({ ...prev, isLoading: true }));

    try {
      const tasks = await getPendingTasks();
      const recoverableTasks = tasks.filter(
        task => task.status === 'pending' || task.status === 'processing'
      );
      const now = Date.now();
      const recoverableEntries: Array<{ task: typeof recoverableTasks[number]; node: PromptNode }> = [];
      let recovered = 0;

      for (const task of recoverableTasks) {
        const node = activeCanvas?.promptNodes?.find(
          n => n.jobId === task.taskId || n.id === task.promptNodeId
        );

        if (!node) {
          console.log(`[TaskRecovery] Found orphaned task: ${task.taskId}`);
          continue;
        }

        if (reason === 'online' && node.jobId === task.taskId) {
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
        recovered++;

        void pollTaskFn(node, task.taskId).catch((error) => {
          console.error('[TaskRecovery] Failed to restart polling:', error);
        });
      }

      setState({
        isLoading: false,
        recoveredCount: recovered,
        pendingCount: recoverableTasks.length,
      });
    } catch (error) {
      console.error('[TaskRecovery] Failed to recover tasks:', error);
      setState(prev => ({ ...prev, isLoading: false }));
    } finally {
      isRecoveringRef.current = false;
    }
  }, [activeCanvas, pollTaskFn]);

  /**
   * 监听页面可见性和网络变化，自动恢复任务
   */
  useEffect(() => {
    if (typeof window === 'undefined' || !enabled) return;

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        void recoverTasks('visibility');
      }
    };

    const handleOnline = () => {
      void recoverTasks('online');
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('online', handleOnline);

    void recoverTasks('initial');

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('online', handleOnline);
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
