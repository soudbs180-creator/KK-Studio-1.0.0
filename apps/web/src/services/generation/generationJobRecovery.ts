import type { GenerationJobDto } from '@kk/shared';
import {
  GenerationJobObservationError,
  observeGenerationJob,
} from './generationJobEventClient.ts';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type ObserveJob = (
  jobId: string,
  options: { signal?: AbortSignal },
) => Promise<GenerationJobDto | null>;

export interface GenerationTaskRecoveryOptions {
  observeJob?: ObserveJob;
  signal?: AbortSignal;
}

export type GenerationTaskRecoveryOutcome = 'streamed' | 'polling' | 'cancelled';

function isStopped(error: unknown, signal?: AbortSignal): boolean {
  if (signal?.aborted) return true;
  return error instanceof GenerationJobObservationError
    && (error.code === 'OWNER_CHANGED' || error.code === 'ABORTED');
}

/** Uses the v3 SSE projection when possible and preserves the existing polling fallback. */
export async function resumeGenerationTask<TNode>(
  node: TNode,
  taskId: string,
  pollTask: (node: TNode, taskId: string) => Promise<void>,
  options: GenerationTaskRecoveryOptions = {},
): Promise<GenerationTaskRecoveryOutcome> {
  if (options.signal?.aborted) return 'cancelled';
  if (!UUID_PATTERN.test(taskId)) {
    await pollTask(node, taskId);
    return 'polling';
  }

  try {
    const observeJob = options.observeJob || observeGenerationJob;
    const terminalJob = await observeJob(taskId, { signal: options.signal });
    if (options.signal?.aborted) return 'cancelled';
    await pollTask(node, taskId);
    return terminalJob ? 'streamed' : 'polling';
  } catch (error) {
    if (isStopped(error, options.signal)) return 'cancelled';
    await pollTask(node, taskId);
    return 'polling';
  }
}
