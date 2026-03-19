import { supabase } from '../../lib/supabase';
import { GenerationMode } from '../../types';

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

/**
 * 保存任务到数据库
 */
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
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;

    const { data, error } = await supabase
      .from('generation_tasks')
      .upsert({
        user_id: user.id,
        task_id: params.taskId,
        task_type: params.taskType,
        status: 'pending',
        prompt: params.prompt,
        model: params.model,
        aspect_ratio: params.aspectRatio,
        image_size: params.imageSize,
        canvas_id: params.canvasId,
        prompt_node_id: params.promptNodeId,
      }, {
        onConflict: 'user_id,task_id'
      })
      .select()
      .single();

    if (error) {
      console.error('[TaskPersistence] Failed to save task:', error);
      return null;
    }

    return transformTask(data);
  } catch (error) {
    console.error('[TaskPersistence] Error saving task:', error);
    return null;
  }
}

/**
 * 更新任务状态
 */
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
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return false;

    const updateData: Record<string, unknown> = { status };
    
    if (updates?.resultUrls !== undefined) {
      updateData.result_urls = updates.resultUrls;
    }
    if (updates?.errorMessage !== undefined) {
      updateData.error_message = updates.errorMessage;
    }
    if (updates?.cost !== undefined) {
      updateData.cost = updates.cost;
    }
    if (updates?.tokens !== undefined) {
      updateData.tokens = updates.tokens;
    }
    
    if (status === 'completed' || status === 'failed') {
      updateData.completed_at = new Date().toISOString();
    }

    const { error } = await supabase
      .from('generation_tasks')
      .update(updateData)
      .eq('user_id', user.id)
      .eq('task_id', taskId);

    if (error) {
      console.error('[TaskPersistence] Failed to update task:', error);
      return false;
    }

    return true;
  } catch (error) {
    console.error('[TaskPersistence] Error updating task:', error);
    return false;
  }
}

/**
 * 获取用户的待处理任务
 */
export async function getPendingTasks(): Promise<PersistedTask[]> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return [];

    const { data, error } = await supabase
      .from('generation_tasks')
      .select('*')
      .eq('user_id', user.id)
      .in('status', ['pending', 'processing'])
      .order('created_at', { ascending: false });

    if (error) {
      console.error('[TaskPersistence] Failed to get pending tasks:', error);
      return [];
    }

    return (data || []).map(transformTask);
  } catch (error) {
    console.error('[TaskPersistence] Error getting pending tasks:', error);
    return [];
  }
}

/**
 * 获取所有任务（包括已完成）
 */
export async function getAllTasks(limit = 50): Promise<PersistedTask[]> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return [];

    const { data, error } = await supabase
      .from('generation_tasks')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      console.error('[TaskPersistence] Failed to get tasks:', error);
      return [];
    }

    return (data || []).map(transformTask);
  } catch (error) {
    console.error('[TaskPersistence] Error getting tasks:', error);
    return [];
  }
}

/**
 * 删除任务
 */
export async function deleteTask(taskId: string): Promise<boolean> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return false;

    const { error } = await supabase
      .from('generation_tasks')
      .delete()
      .eq('user_id', user.id)
      .eq('task_id', taskId);

    if (error) {
      console.error('[TaskPersistence] Failed to delete task:', error);
      return false;
    }

    return true;
  } catch (error) {
    console.error('[TaskPersistence] Error deleting task:', error);
    return false;
  }
}

/**
 * 清理已完成的任务（可选）
 */
export async function cleanupCompletedTasks(): Promise<number> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return 0;

    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const { error, count } = await supabase
      .from('generation_tasks')
      .delete({ count: 'exact' })
      .eq('user_id', user.id)
      .in('status', ['completed', 'failed'])
      .lt('created_at', thirtyDaysAgo.toISOString());

    if (error) {
      console.error('[TaskPersistence] Failed to cleanup tasks:', error);
      return 0;
    }

    return count || 0;
  } catch (error) {
    console.error('[TaskPersistence] Error cleaning up tasks:', error);
    return 0;
  }
}

/**
 * 转换数据库记录为前端类型
 */
function transformTask(data: any): PersistedTask {
  return {
    id: data.id,
    taskId: data.task_id,
    taskType: data.task_type,
    status: data.status,
    prompt: data.prompt,
    model: data.model,
    aspectRatio: data.aspect_ratio,
    imageSize: data.image_size,
    resultUrls: data.result_urls || [],
    errorMessage: data.error_message,
    cost: data.cost,
    tokens: data.tokens,
    canvasId: data.canvas_id,
    promptNodeId: data.prompt_node_id,
    createdAt: data.created_at,
    updatedAt: data.updated_at,
    completedAt: data.completed_at,
  };
}

/**
 * 将 GenerationMode 转换为 TaskType
 */
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
