import { useState, useEffect, useCallback, useRef } from 'react';
import type { PromptNode } from '../types';
import { GenerationMode } from '../types';
import {
  getPendingTasks,
  updateTaskStatus,
  modeToTaskType
} from '../services/persistence/taskPersistence';
import { useCanvas } from '../context/CanvasContext';

interface TaskRecoveryState {
  isLoading: boolean;
  recoveredCount: number;
  pendingCount: number;
}

type RecoveryReason = 'initial' | 'visibility' | 'online' | 'manual';

const RECOVERY_THROTTLE_MS = 30_000;

/**
 * 任务恢复 Hook
 * 在页面加载、回到前台和网络恢复后自动恢复进行中的任务
 */
export function useTaskRecovery(
  pollTaskFn: (node: PromptNode, taskId: string) => Promise<void>
) {
  const [state, setState] = useState<TaskRecoveryState>({
    isLoading: false,
    recoveredCount: 0,
    pendingCount: 0,
  });

  const { activeCanvas } = useCanvas();
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
      let recovered = 0;

      for (const task of recoverableTasks) {
        const node = activeCanvas?.promptNodes.find(
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
    if (typeof window === 'undefined') return;

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
  }, [recoverTasks]);

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
    const { saveTask } = await import('../services/persistence/taskPersistence');

    await saveTask({
      taskId,
      taskType: modeToTaskType(node.mode || GenerationMode.IMAGE),
      prompt: node.prompt,
      model: node.model,
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
  tokens?: number
): Promise<void> {
  try {
    await updateTaskStatus(taskId, 'completed', {
      resultUrls,
      cost,
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
