import {
  GenerationJobListDtoV3Schema,
  type GenerationJobDto,
  type KkApiClient,
} from '@kk/shared';
import { kkWebApiClient } from '../api/kkApiClient.ts';
import { getRuntimeOwnerId } from '../auth/runtimeSessionProfile.ts';
import type { PersistedTask, TaskType } from '../persistence/taskPersistence.ts';

const AUTO_OBSERVABLE_STATUSES = new Set(['submitted', 'running']);

type PendingJobClient = Pick<KkApiClient, 'listPendingGenerationV3Jobs'>;

export interface GenerationJobDiscoveryOptions {
  client?: PendingJobClient;
  getOwnerId?: () => string;
  signal?: AbortSignal;
}

export interface GenerationJobRecoveryCandidate extends PersistedTask {
  discoveredFromServer: boolean;
  promptNodeCandidateIds: string[];
}

export class GenerationJobDiscoveryError extends Error {
  readonly code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = 'GenerationJobDiscoveryError';
    this.code = code;
  }
}

function assertDiscoveryActive(ownerId: string, options: GenerationJobDiscoveryOptions): void {
  if (options.signal?.aborted) {
    throw new GenerationJobDiscoveryError('ABORTED', 'Generation Job discovery was aborted.');
  }
  if ((options.getOwnerId || getRuntimeOwnerId)() !== ownerId) {
    throw new GenerationJobDiscoveryError('OWNER_CHANGED', 'Generation Job owner changed during discovery.');
  }
}

function readPayloadString(payload: Record<string, unknown> | undefined, key: string): string | undefined {
  const value = payload?.[key];
  if (typeof value !== 'string') return undefined;
  const normalized = value.trim();
  return normalized || undefined;
}

function deriveAttemptNodeId(requestId?: string): string | undefined {
  const match = requestId?.match(/^(.+):([0-9]+)$/);
  const candidate = match?.[1]?.trim();
  return candidate || undefined;
}

function uniqueNodeIds(values: Array<string | undefined>): string[] {
  const normalized = values
    .map((value) => value?.trim())
    .filter((value): value is string => Boolean(value));
  return Array.from(new Set(normalized));
}

function derivePromptNodeCandidateIds(job: GenerationJobDto): string[] {
  return uniqueNodeIds(job.items.flatMap((item) => [
    item.canvasNodeId,
    readPayloadString(item.payload, 'promptNodeId'),
    deriveAttemptNodeId(readPayloadString(item.payload, 'requestId')),
  ]));
}

function resolveTaskType(job: GenerationJobDto): TaskType {
  for (const item of job.items) {
    const mediaType = readPayloadString(item.payload, 'mediaType');
    if (mediaType === 'video' || mediaType === 'audio') return mediaType;
    if (mediaType === 'image') return mediaType;
  }
  return 'image';
}

function mapJobToRecoveryCandidate(job: GenerationJobDto): GenerationJobRecoveryCandidate {
  const promptNodeCandidateIds = derivePromptNodeCandidateIds(job);
  const payload = job.items.find((item) => item.payload)?.payload;
  return {
    id: `server_${job.jobId}`,
    taskId: job.jobId,
    taskType: resolveTaskType(job),
    status: 'processing',
    prompt: readPayloadString(payload, 'prompt'),
    model: job.model,
    provider: job.provider,
    promptNodeId: promptNodeCandidateIds[0],
    promptNodeCandidateIds,
    discoveredFromServer: true,
    createdAt: job.createdAt,
    updatedAt: job.updatedAt,
  };
}

/** Discovers auto-observable owner-scoped Generation v3 Jobs. */
export async function discoverPendingGenerationJobs(
  options: GenerationJobDiscoveryOptions = {},
): Promise<GenerationJobRecoveryCandidate[]> {
  const ownerId = (options.getOwnerId || getRuntimeOwnerId)();
  assertDiscoveryActive(ownerId, options);
  const client = options.client || kkWebApiClient;
  const response = await client.listPendingGenerationV3Jobs({
    expectedAuthSubject: ownerId,
    signal: options.signal,
  });
  assertDiscoveryActive(ownerId, options);
  if (!response.success) {
    throw new GenerationJobDiscoveryError(response.error.code, response.error.message);
  }
  const parsed = GenerationJobListDtoV3Schema.safeParse(response.data);
  if (!parsed.success) {
    throw new GenerationJobDiscoveryError('INVALID_PROJECTION', 'Generation Job list failed validation.');
  }
  if (parsed.data.jobs.some((job) => job.ownerId !== ownerId)) {
    throw new GenerationJobDiscoveryError('OWNER_MISMATCH', 'Generation Job list contained another owner.');
  }
  return parsed.data.jobs
    .filter((job) => AUTO_OBSERVABLE_STATUSES.has(job.status))
    .map(mapJobToRecoveryCandidate);
}

function localTaskCandidate(task: PersistedTask): GenerationJobRecoveryCandidate {
  return {
    ...task,
    discoveredFromServer: false,
    promptNodeCandidateIds: uniqueNodeIds([task.promptNodeId]),
  };
}

/** Merges server discovery into owner-local metadata without duplicating Job IDs. */
export function mergeRecoveryCandidates(
  localTasks: PersistedTask[],
  serverTasks: GenerationJobRecoveryCandidate[],
): GenerationJobRecoveryCandidate[] {
  const merged = localTasks.map(localTaskCandidate);
  const indexByTaskId = new Map(merged.map((task, index) => [task.taskId, index]));
  for (const serverTask of serverTasks) {
    const existingIndex = indexByTaskId.get(serverTask.taskId);
    if (existingIndex === undefined) {
      indexByTaskId.set(serverTask.taskId, merged.length);
      merged.push(serverTask);
      continue;
    }
    const localTask = merged[existingIndex];
    merged[existingIndex] = {
      ...serverTask,
      ...localTask,
      discoveredFromServer: true,
      promptNodeCandidateIds: uniqueNodeIds([
        localTask.promptNodeId,
        ...serverTask.promptNodeCandidateIds,
      ]),
    };
  }
  return merged;
}

/** Finds an already-synchronized Prompt node, preferring its authoritative Job ID. */
export function findRecoveryPromptNode<
  TNode extends { id: string; jobId?: string; billingAttemptId?: string }
>(
  nodes: TNode[],
  task: GenerationJobRecoveryCandidate,
): TNode | undefined {
  const jobMatch = nodes.find((node) => node.jobId === task.taskId);
  if (jobMatch) return jobMatch;
  const candidateIds = new Set(task.promptNodeCandidateIds);
  return nodes.find((node) => (
    candidateIds.has(node.id)
    || Boolean(node.billingAttemptId && candidateIds.has(node.billingAttemptId))
  ));
}
