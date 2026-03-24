import type { EntityId, IdempotentRequestDto } from "./common.ts";
import type { GenerationTaskStatus } from "../enums/status.ts";

export type GenerationTaskType = "image" | "video" | "audio" | "document";

export interface CreateGenerationTaskRequestDto extends IdempotentRequestDto {
  workspaceId: EntityId;
  workflowId: EntityId;
  modelCode: string;
  taskType: GenerationTaskType;
  prompt: string;
  references?: EntityId[];
}

export interface GenerationResultDto {
  id: EntityId;
  assetId: EntityId;
  sequenceNo: number;
  metadata?: Record<string, unknown>;
}

export interface GenerationTaskDto {
  id: EntityId;
  workspaceId: EntityId;
  workflowId: EntityId;
  requesterId: EntityId;
  modelCode: string;
  taskType: GenerationTaskType;
  status: GenerationTaskStatus;
  prompt: string;
  references: EntityId[];
  idempotencyKey: string;
  createdAt: string;
  startedAt?: string;
  completedAt?: string;
  errorCode?: string;
  errorMessage?: string;
  results: GenerationResultDto[];
}
