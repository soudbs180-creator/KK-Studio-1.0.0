import type {
  GeneratedImage,
  PromptCompletedTask,
  PromptGenerationMetadata,
  PromptNode,
} from '../types';

const pushUnique = (target: string[], value?: string | null) => {
  const normalized = typeof value === 'string' ? value.trim() : '';
  if (!normalized) return;
  if (!target.includes(normalized)) {
    target.push(normalized);
  }
};

export const normalizePersistentResultUrl = (value?: string | null): string | undefined => {
  const normalized = typeof value === 'string' ? value.trim() : '';
  if (!normalized) return undefined;
  if (normalized.startsWith('blob:')) return undefined;
  if (!/^https?:\/\//i.test(normalized)) return undefined;
  return normalized;
};

export const getPromptCompletedTasks = (
  node?: Pick<PromptNode, 'generationMetadata'> | null
): PromptCompletedTask[] => {
  const rawCompletedTasks = (node?.generationMetadata as PromptGenerationMetadata | undefined)?.completedTasks;
  if (!Array.isArray(rawCompletedTasks)) return [];

  return rawCompletedTasks.filter((task): task is PromptCompletedTask => (
    !!task
    && typeof task === 'object'
    && typeof (task as PromptCompletedTask).taskId === 'string'
    && (task as PromptCompletedTask).taskId.trim().length > 0
  ));
};

export const getCompletedTaskResultUrls = (task?: Partial<PromptCompletedTask> | null): string[] => {
  if (!Array.isArray(task?.resultUrls)) return [];

  const urls: string[] = [];
  task.resultUrls.forEach((candidate) => {
    pushUnique(urls, normalizePersistentResultUrl(candidate));
  });
  return urls;
};

export const buildTaskResultIdentity = (params: {
  taskId?: string | null;
  resultIndex?: number | null;
  url?: string | null;
}): string | undefined => {
  const taskId = typeof params.taskId === 'string' ? params.taskId.trim() : '';
  const normalizedUrl = normalizePersistentResultUrl(params.url);
  const hasResultIndex = typeof params.resultIndex === 'number' && Number.isFinite(params.resultIndex);

  if (taskId && hasResultIndex) {
    return `${taskId}::${params.resultIndex}`;
  }
  if (taskId && normalizedUrl) {
    return `${taskId}::${normalizedUrl}`;
  }
  if (normalizedUrl) {
    return normalizedUrl;
  }
  if (taskId) {
    return taskId;
  }
  return undefined;
};

export const buildImageResultIdentity = (
  image?: Partial<GeneratedImage> | null
): string | undefined => buildTaskResultIdentity({
  taskId: image?.sourceTaskId,
  resultIndex: image?.sourceResultIndex,
  url: image?.apiResultUrl || image?.originalUrl || image?.url,
});

export const getImageRecoveryCandidates = (
  image?: Partial<GeneratedImage> | null
): string[] => {
  const candidates: string[] = [];
  pushUnique(candidates, image?.originalUrl);
  pushUnique(candidates, normalizePersistentResultUrl(image?.apiResultUrl));
  pushUnique(candidates, image?.url);
  return candidates;
};

export const mergeCompletedTaskResults = (
  existing: PromptCompletedTask[] = [],
  incoming: PromptCompletedTask[] = []
): PromptCompletedTask[] => {
  if (!existing.length && !incoming.length) return [];

  const merged = new Map<string, PromptCompletedTask>();
  const order: string[] = [];

  const mergeTask = (task: PromptCompletedTask) => {
    const taskId = String(task.taskId || '').trim();
    if (!taskId) return;

    const normalizedUrls = getCompletedTaskResultUrls(task);
    const previous = merged.get(taskId);
    const nextTask: PromptCompletedTask = previous
      ? {
          ...previous,
          ...task,
          completedAt: Math.max(previous.completedAt || 0, task.completedAt || 0),
          resultUrls: Array.from(new Set([
            ...getCompletedTaskResultUrls(previous),
            ...normalizedUrls,
          ])),
        }
      : {
          ...task,
          taskId,
          resultUrls: normalizedUrls,
          completedAt: task.completedAt || Date.now(),
        };

    if (!merged.has(taskId)) {
      order.push(taskId);
    }
    merged.set(taskId, nextTask);
  };

  existing.forEach(mergeTask);
  incoming.forEach(mergeTask);

  return order
    .map((taskId) => merged.get(taskId))
    .filter((task): task is PromptCompletedTask => !!task);
};
