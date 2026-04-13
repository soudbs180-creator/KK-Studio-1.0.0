import { randomUUID } from "node:crypto";

import {
  GenerationTaskStatus,
  domainEventNames,
  type CreateGenerationTaskRequestDto,
  type EntityId,
  type GenerationResultDto,
  type GenerationTaskDto,
} from "../../../../../../packages/contracts/src/index.ts";

const generationStatusTransitions: Record<GenerationTaskStatus, GenerationTaskStatus[]> = {
  [GenerationTaskStatus.Queued]: [GenerationTaskStatus.Running, GenerationTaskStatus.Cancelled],
  [GenerationTaskStatus.Running]: [GenerationTaskStatus.Succeeded, GenerationTaskStatus.Failed],
  [GenerationTaskStatus.Succeeded]: [],
  [GenerationTaskStatus.Failed]: [GenerationTaskStatus.Refunded],
  [GenerationTaskStatus.Cancelled]: [],
  [GenerationTaskStatus.Refunded]: [],
};

export interface GenerationTaskContext {
  requesterId: EntityId;
  requestId?: string;
  now?: string;
}

export interface GenerationTaskTransitionPatch {
  errorCode?: string;
  errorMessage?: string;
  results?: GenerationResultDto[];
}

export function createGenerationTask(
  input: CreateGenerationTaskRequestDto,
  context: GenerationTaskContext,
): GenerationTaskDto {
  const createdAt = context.now || new Date().toISOString();
  return {
    id: randomUUID(),
    workspaceId: input.workspaceId,
    workflowId: input.workflowId,
    requesterId: context.requesterId,
    requestId: context.requestId,
    attemptId: input.attemptId,
    modelCode: input.modelCode,
    taskType: input.taskType,
    status: GenerationTaskStatus.Queued,
    prompt: input.prompt,
    references: input.references || [],
    idempotencyKey: input.idempotencyKey,
    createdAt,
    results: [],
  };
}

export function canTransitionGenerationTask(
  current: GenerationTaskStatus,
  next: GenerationTaskStatus,
): boolean {
  return generationStatusTransitions[current].includes(next);
}

export function transitionGenerationTask(
  task: GenerationTaskDto,
  nextStatus: GenerationTaskStatus,
  patch: GenerationTaskTransitionPatch = {},
  now: string = new Date().toISOString(),
): GenerationTaskDto {
  if (!canTransitionGenerationTask(task.status, nextStatus)) {
    throw new Error(`Invalid generation task transition: ${task.status} -> ${nextStatus}`);
  }

  return {
    ...task,
    status: nextStatus,
    startedAt: nextStatus === GenerationTaskStatus.Running ? now : task.startedAt,
    completedAt:
      nextStatus === GenerationTaskStatus.Succeeded
      || nextStatus === GenerationTaskStatus.Failed
      || nextStatus === GenerationTaskStatus.Refunded
        ? now
        : task.completedAt,
    errorCode: patch.errorCode ?? task.errorCode,
    errorMessage: patch.errorMessage ?? task.errorMessage,
    results: patch.results ?? task.results,
  };
}

export function normalizeLegacyGenerationStatus(
  legacyStatus: string | undefined,
): GenerationTaskStatus {
  switch (legacyStatus) {
    case "pending":
      return GenerationTaskStatus.Queued;
    case "processing":
      return GenerationTaskStatus.Running;
    case "completed":
      return GenerationTaskStatus.Succeeded;
    case "failed":
      return GenerationTaskStatus.Failed;
    default:
      return GenerationTaskStatus.Queued;
  }
}

export function buildGenerationTaskCreatedEvent(task: GenerationTaskDto) {
  return {
    name: domainEventNames.generationTaskCreated,
    aggregateId: task.id,
    occurredAt: task.createdAt,
    payload: {
      taskId: task.id,
      workflowId: task.workflowId,
      requesterId: task.requesterId,
      modelCode: task.modelCode,
    },
  };
}
