import type { EntityId, IdempotentRequestDto } from "./common.ts";
import type { GenerationTaskStatus } from "../enums/status.ts";
import type { ProviderProtocolFamily } from "./model-catalog.ts";
import type { GenerationTelemetry } from "../../generation/types.ts";


export type GenerationTaskType = "image" | "video" | "audio" | "document";
export type GenerationMediaTaskType = Exclude<GenerationTaskType, "document">;
export type GenerationJobStatus =
  | "queued"
  | "running"
  | "paused"
  | "completed"
  | "completed_with_errors"
  | "failed"
  | "cancelled";
export type GenerationJobPhase =
  | "preparing"
  | "queued"
  | "uploading"
  | "provider_processing"
  | "storing"
  | "placing_on_canvas"
  | "completed"
  | "failed";

export interface GenerationPromptInputDto {
  id: EntityId;
  prompt: string;
  referenceAssetIds?: EntityId[];
  referenceImageNodeId?: EntityId;
}

export interface ImageGenerationJobParametersDto {
  taskType: "image";
  aspectRatio?: string;
  imageSize?: string;
  countPerPrompt?: number;
}

export interface VideoGenerationJobParametersDto {
  taskType: "video";
  durationSeconds: number;
  resolution?: string;
  aspectRatio?: string;
  generateAudio?: boolean;
  firstFrameAssetId?: EntityId;
  lastFrameAssetId?: EntityId;
  motion?: string;
}

export interface AudioGenerationJobParametersDto {
  taskType: "audio";
  durationSeconds?: number;
  voice?: string;
  lyrics?: string;
  genre?: string;
}

export type GenerationJobParametersDto =
  | ImageGenerationJobParametersDto
  | VideoGenerationJobParametersDto
  | AudioGenerationJobParametersDto;

export interface GenerationJobProgressDto {
  total: number;
  queued: number;
  running: number;
  completed: number;
  failed: number;
  percent: number;
  phase: GenerationJobPhase;
}

export interface GenerationJobOutputDto {
  itemId: EntityId;
  taskType: GenerationMediaTaskType;
  assetId?: EntityId;
  nodeId?: EntityId;
  promptNodeId?: EntityId;
  url?: string;
  storageId?: EntityId;
  mimeType?: string;
  providerTaskId?: string;
  durationMs?: number;
}

export interface GenerationJobItemDto {
  id: EntityId;
  prompt: string;
  referenceImageNodeId?: EntityId;
  status: "queued" | "running" | "completed" | "failed";
  retryCount: number;
  retryable?: boolean;
  error?: string;
  errorCategory?: string;
  providerTaskId?: string;
  outputs: GenerationJobOutputDto[];
}

export interface GenerationOutputGroupDto {
  groupId?: EntityId;
  label: string;
  color: string;
  includePromptNodes?: boolean;
  tags?: string[];
  nodeIds?: EntityId[];
}

export interface CreateGenerationBatchJobRequestDto extends IdempotentRequestDto {
  schemaVersion: 2;
  workspaceId: EntityId;
  modelCode: string;
  taskType: GenerationMediaTaskType;
  prompts: GenerationPromptInputDto[];
  parameters: GenerationJobParametersDto;
  concurrency?: number;
  outputGroup?: GenerationOutputGroupDto;
}

export interface GenerationBatchJobDto {
  schemaVersion: 2;
  id: EntityId;
  idempotencyKey: string;
  workspaceId: EntityId;
  modelCode: string;
  taskType: GenerationMediaTaskType;
  status: GenerationJobStatus;
  parameters: GenerationJobParametersDto;
  progress: GenerationJobProgressDto;
  outputs: GenerationJobOutputDto[];
  items: GenerationJobItemDto[];
  outputGroup?: GenerationOutputGroupDto;
  createdAt: string;
  updatedAt: string;
  leaseOwner?: string;
  leaseExpiresAt?: string;
}

export interface GenerationBatchJobListDto {
  jobs: GenerationBatchJobDto[];
  cursor?: string;
}

export interface UpdateGenerationBatchJobRequestDto {
  status?: GenerationJobStatus;
  progress?: GenerationJobProgressDto;
  outputs?: GenerationJobOutputDto[];
  items?: GenerationJobItemDto[];
  leaseOwner: string;
  leaseExpiresAt?: string;
}

export type GenerationJobControlAction = "pause" | "resume" | "retry" | "cancel";

export interface ControlGenerationBatchJobRequestDto {
  action: GenerationJobControlAction;
}

export interface ClaimGenerationBatchJobRequestDto {
  leaseOwner: string;
  leaseSeconds?: number;
}
export type GenerationBillingStatus =
  | "pending"
  | "debited"
  | "settled"
  | "refund_pending"
  | "refunded"
  | "failed";

export type SecureProxyEndpointType = "openai" | "gemini" | "claude";
export type SecureProxyTaskStatus = "pending" | "success" | "failed";
export type SecureProxyAuthMethod = "header" | "query";

export interface SecureProxyUserRouteDto {
  kind: "key-slot";
  id: string;
}

export interface SecureProxyUserRouteConfigDto {
  routeId: string;
  provider: string;
  baseUrl: string;
  apiKey: string;
  format?: SecureProxyEndpointType | "auto";
  authMethod?: SecureProxyAuthMethod;
  headerName?: string;
  compatibilityMode?: "standard" | "chat";
}

export interface SecureProxyRouteSelectionDto {
  userRoute?: SecureProxyUserRouteDto;
  routeConfig?: SecureProxyUserRouteConfigDto;
}

export type SecureProxyRouteConfigDto = SecureProxyUserRouteConfigDto;

export interface SecureProxyChatMessageDto {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface SecureProxyUsageDto {
  promptTokens?: number;
  completionTokens?: number;
  totalTokens?: number;
  cost?: number;
}

export type SecureProxyImageReferenceDto =
  | string
  | {
    data: string;
    mimeType: string;
  };

export interface SecureProxyTransportResultDto {
  success: boolean;
  error?: string | { message?: string; code?: string; [key: string]: unknown };
  deducted?: boolean;
  ledgerId?: string;
  balanceAfter?: number;
  refundApplied?: boolean;
  refundBalanceAfter?: number;
  endpointType?: SecureProxyEndpointType;
}

export interface SecureProxyChatRequestDto extends SecureProxyRouteSelectionDto {
  modelId: string;
  messages: SecureProxyChatMessageDto[];
  temperature?: number;
  maxTokens?: number;
  stream?: boolean;
  requestId?: string;
  attemptId?: string;
}

export interface SecureProxyChatTransportDto extends SecureProxyTransportResultDto {
  content?: string;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
}

export interface SecureProxyImageRequestDto extends SecureProxyRouteSelectionDto {
  modelId: string;
  prompt: string;
  aspectRatio?: string;
  imageSize?: string;
  imageCount?: number;
  referenceImages?: SecureProxyImageReferenceDto[];
  requestId?: string;
  attemptId?: string;
}

export interface SecureProxyImageTransportDto extends SecureProxyTransportResultDto {
  urls?: string[];
  usage?: SecureProxyUsageDto;
  taskId?: string;
  status?: SecureProxyTaskStatus;
  requestId?: string;
  attemptId?: string;
}

export interface SecureProxyVideoRequestDto extends SecureProxyRouteSelectionDto {
  modelId: string;
  prompt: string;
  aspectRatio?: string;
  resolution?: string;
  duration?: number;
  videoDuration?: string;
  imageUrl?: string;
  imageTailUrl?: string;
  requestId?: string;
  attemptId?: string;
}

export interface SecureProxyVideoTransportDto extends SecureProxyTransportResultDto {
  taskId?: string;
  status?: SecureProxyTaskStatus;
  url?: string;
  requestId?: string;
  attemptId?: string;
}

export interface SecureProxyAudioRequestDto extends SecureProxyRouteSelectionDto {
  modelId: string;
  prompt: string;
  requestId?: string;
  attemptId?: string;
}

export interface SecureProxyAudioTransportDto extends SecureProxyTransportResultDto {
  url?: string;
  usage?: SecureProxyUsageDto;
}

export interface SecureProxyTaskRequestDto {
  taskId: string;
}

export interface SecureProxyTaskTransportDto extends SecureProxyTransportResultDto {
  taskId?: string;
  status?: SecureProxyTaskStatus;
  url?: string;
  requestId?: string;
  attemptId?: string;
}

export interface SecureProxyDownloadTransportDto extends SecureProxyTransportResultDto {
  url?: string;
  requestId?: string;
  attemptId?: string;
}

export interface CreateGenerationTaskRequestDto extends IdempotentRequestDto {
  workspaceId: EntityId;
  workflowId: EntityId;
  modelCode: string;
  taskType: GenerationTaskType;
  prompt: string;
  attemptId?: string;
  references?: EntityId[];
}

export interface ListGenerationTasksQueryDto {
  statuses?: GenerationTaskStatus[];
  limit?: number;
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
  requestId?: string;
  attemptId?: string;
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
  billingStatus?: GenerationBillingStatus;
  ledgerTransactionId?: EntityId;
  refundTransactionId?: EntityId;
  creditAmount?: number;
  costUsd?: number;
  providerId?: string;
  protocolFamily?: ProviderProtocolFamily;
  usageSnapshot?: {
    promptTokens?: number;
    completionTokens?: number;
    totalTokens?: number;
    costUsd?: number;
    raw?: Record<string, unknown>;
  };
  telemetry?: GenerationTelemetry;
}

export interface GenerationTaskListDto {
  tasks: GenerationTaskDto[];
}

export interface UpdateGenerationTaskRequestDto {
  status?: GenerationTaskStatus;
  errorCode?: string;
  errorMessage?: string;
  results?: GenerationResultDto[];
  billingStatus?: GenerationBillingStatus;
  ledgerTransactionId?: EntityId;
  refundTransactionId?: EntityId;
  creditAmount?: number;
  costUsd?: number;
  providerId?: string;
  protocolFamily?: ProviderProtocolFamily;
  usageSnapshot?: GenerationTaskDto["usageSnapshot"];
  telemetry?: GenerationTelemetry;
}


export type SecureModelProxyMode =
  | "chat"
  | "image"
  | "video"
  | "audio"
  | "task_status"
  | "cancel_task"
  | "delete_task"
  | "download_task";

export type SecureModelProxyChatRequestDto = SecureProxyChatRequestDto;
export type SecureModelProxyImageRequestDto = SecureProxyImageRequestDto;
export type SecureModelProxyVideoRequestDto = SecureProxyVideoRequestDto;
export type SecureModelProxyAudioRequestDto = SecureProxyAudioRequestDto;

export type SecureModelProxyChatTransportDto = SecureProxyChatTransportDto;
export type SecureModelProxyImageTransportDto = SecureProxyImageTransportDto;
export type SecureModelProxyVideoTransportDto = SecureProxyVideoTransportDto;
export type SecureModelProxyAudioTransportDto = SecureProxyAudioTransportDto;
export type SecureModelProxyTaskTransportDto = SecureProxyTaskTransportDto;
export type SecureModelProxyDownloadTransportDto = SecureProxyDownloadTransportDto;

export type SecureModelProxyChatResponseDto = Omit<SecureProxyChatTransportDto, "success" | "error">;
export type SecureModelProxyImageResponseDto = Omit<SecureProxyImageTransportDto, "success" | "error">;
export type SecureModelProxyVideoResponseDto = Omit<SecureProxyVideoTransportDto, "success" | "error">;
export type SecureModelProxyAudioResponseDto = Omit<SecureProxyAudioTransportDto, "success" | "error">;
export type SecureModelProxyTaskStatusResponseDto = Omit<SecureProxyTaskTransportDto, "success" | "error">;
export type SecureModelProxyDownloadResponseDto = Omit<SecureProxyDownloadTransportDto, "success" | "error">;

export interface SecureModelProxyActionResponseDto {
  message?: string;
}
