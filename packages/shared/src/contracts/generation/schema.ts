// 中文注释：统一媒体任务的运行时校验，供 API、Agent ToolRegistry 与队列共同复用。
import { z } from "zod";

export const GenerationMediaTaskTypeSchema = z.enum(["image", "video", "audio"]);
export const GenerationJobStatusSchema = z.enum([
  "queued",
  "running",
  "paused",
  "completed",
  "completed_with_errors",
  "failed",
  "cancelled",
]);

export const GenerationPromptInputSchema = z.object({
  id: z.string().min(1),
  prompt: z.string().trim().min(1).max(20_000),
  referenceAssetIds: z.array(z.string().min(1)).max(16).optional(),
  referenceImageNodeId: z.string().min(1).optional(),
});

export const ImageGenerationJobParametersSchema = z.object({
  taskType: z.literal("image"),
  aspectRatio: z.string().min(1).optional(),
  imageSize: z.string().min(1).optional(),
  countPerPrompt: z.number().int().min(1).max(10).optional(),
});

export const VideoGenerationJobParametersSchema = z.object({
  taskType: z.literal("video"),
  durationSeconds: z.number().int().min(1).max(60),
  resolution: z.string().min(1).optional(),
  aspectRatio: z.string().min(1).optional(),
  generateAudio: z.boolean().optional(),
  firstFrameAssetId: z.string().min(1).optional(),
  lastFrameAssetId: z.string().min(1).optional(),
  motion: z.string().trim().min(1).max(200).optional(),
});

export const AudioGenerationJobParametersSchema = z.object({
  taskType: z.literal("audio"),
  durationSeconds: z.number().int().min(1).max(600).optional(),
  voice: z.string().trim().min(1).max(200).optional(),
  lyrics: z.string().max(20_000).optional(),
  genre: z.string().trim().min(1).max(200).optional(),
});

export const GenerationJobParametersSchema = z.discriminatedUnion("taskType", [
  ImageGenerationJobParametersSchema,
  VideoGenerationJobParametersSchema,
  AudioGenerationJobParametersSchema,
]);

export const GenerationOutputGroupSchema = z.object({
  groupId: z.string().min(1).optional(),
  label: z.string().trim().min(1).max(200),
  color: z.string().min(1).max(100),
  includePromptNodes: z.boolean().optional(),
  tags: z.array(z.string().min(1).max(100)).max(32).optional(),
  nodeIds: z.array(z.string().min(1)).max(1_000).optional(),
});

export const CreateGenerationBatchJobRequestSchema = z.object({
  schemaVersion: z.literal(2),
  workspaceId: z.string().min(1),
  modelCode: z.string().min(1),
  taskType: GenerationMediaTaskTypeSchema,
  prompts: z.array(GenerationPromptInputSchema).min(1).max(100),
  parameters: GenerationJobParametersSchema,
  concurrency: z.number().int().min(1).max(8).optional(),
  outputGroup: GenerationOutputGroupSchema.optional(),
  idempotencyKey: z.string().min(1).max(255),
}).superRefine((value, context) => {
  if (value.parameters.taskType !== value.taskType) {
    context.addIssue({
      code: "custom",
      path: ["parameters", "taskType"],
      message: "parameters.taskType 必须与 taskType 一致",
    });
  }
  const maxItems = value.taskType === "video" ? 20 : value.taskType === "audio" ? 50 : 100;
  if (value.prompts.length > maxItems) {
    context.addIssue({
      code: "too_big",
      maximum: maxItems,
      inclusive: true,
      origin: "array",
      path: ["prompts"],
      message: `${value.taskType} 批量任务最多允许 ${maxItems} 项`,
    });
  }
});

export const GenerationJobProgressSchema = z.object({
  total: z.number().int().min(0),
  queued: z.number().int().min(0),
  running: z.number().int().min(0),
  completed: z.number().int().min(0),
  failed: z.number().int().min(0),
  percent: z.number().int().min(0).max(100),
  phase: z.enum(["preparing", "queued", "uploading", "provider_processing", "storing", "placing_on_canvas", "completed", "failed"]),
});

export const GenerationJobOutputSchema = z.object({
  itemId: z.string().min(1),
  taskType: GenerationMediaTaskTypeSchema,
  assetId: z.string().min(1).optional(),
  nodeId: z.string().min(1).optional(),
  promptNodeId: z.string().min(1).optional(),
  url: z.string().min(1).optional(),
  storageId: z.string().min(1).optional(),
  mimeType: z.string().min(1).optional(),
  providerTaskId: z.string().min(1).optional(),
  durationMs: z.number().int().min(0).optional(),
});

export const GenerationJobItemSchema = z.object({
  id: z.string().min(1),
  prompt: z.string().min(1).max(20_000),
  referenceImageNodeId: z.string().min(1).optional(),
  status: z.enum(["queued", "running", "completed", "failed"]),
  retryCount: z.number().int().min(0).max(100),
  retryable: z.boolean().optional(),
  error: z.string().max(20_000).optional(),
  errorCategory: z.string().max(100).optional(),
  providerTaskId: z.string().max(500).optional(),
  outputs: z.array(GenerationJobOutputSchema).max(100),
});

export const UpdateGenerationBatchJobRequestSchema = z.object({
  status: GenerationJobStatusSchema.optional(),
  progress: GenerationJobProgressSchema.optional(),
  outputs: z.array(GenerationJobOutputSchema).max(1_000).optional(),
  items: z.array(GenerationJobItemSchema).max(100).optional(),
  leaseOwner: z.string().min(1).max(255),
  leaseExpiresAt: z.string().datetime().optional(),
});

export const ControlGenerationBatchJobRequestSchema = z.object({
  action: z.enum(["pause", "resume", "retry", "cancel"]),
});

export const ClaimGenerationBatchJobRequestSchema = z.object({
  leaseOwner: z.string().min(1).max(255),
  leaseSeconds: z.number().int().min(15).max(300).default(60),
});

export const GenerationJobControlInputSchema = z.object({
  jobId: z.string().min(1),
});

export const GenerationRetryJobInputSchema = z.object({
  jobId: z.string().min(1),
  expectedUpdatedAt: z.number().int().nonnegative(),
  expectedRetryablePromptIds: z.array(z.string().min(1)).min(1).max(100)
    .transform((ids) => Array.from(new Set(ids)).sort()),
});

export const StartGenerationToolInputSchema = z.object({
  prompt: z.string().trim().min(1).max(20_000),
  count: z.number().int().min(1).max(100).optional(),
  aspectRatio: z.string().min(1).optional(),
  referenceImageNodeId: z.string().min(1).optional(),
  mode: GenerationMediaTaskTypeSchema.optional(),
  options: z.record(z.string(), z.unknown()).optional(),
  idempotencyKey: z.string().min(1).max(255).optional(),
});

export const CreateImageBatchJobToolInputSchema = z.object({
  prompts: z.array(z.object({
    id: z.string().min(1).optional(),
    prompt: z.string().trim().min(1).max(20_000),
    referenceImageNodeId: z.string().min(1).optional(),
  })).min(1).max(100),
  options: z.record(z.string(), z.unknown()).optional(),
  idempotencyKey: z.string().min(1).max(255).optional(),
});

export const CreateVideoJobToolInputSchema = z.object({
  prompt: z.string().trim().min(1).max(20_000),
  modelId: z.string().min(1).optional(),
  referenceImageNodeId: z.string().min(1).optional(),
  durationSeconds: z.number().int().min(1).max(60).default(4),
  resolution: z.string().min(1).optional(),
  aspectRatio: z.string().min(1).optional(),
  generateAudio: z.boolean().optional(),
  firstFrameAssetId: z.string().min(1).optional(),
  lastFrameAssetId: z.string().min(1).optional(),
  motion: z.string().trim().min(1).max(200).optional(),
  idempotencyKey: z.string().min(1).optional(),
});

export const CreateAudioJobToolInputSchema = z.object({
  prompt: z.string().trim().min(1).max(20_000),
  modelId: z.string().min(1).optional(),
  durationSeconds: z.number().int().min(1).max(600).optional(),
  voice: z.string().trim().min(1).max(200).optional(),
  lyrics: z.string().max(20_000).optional(),
  genre: z.string().trim().min(1).max(200).optional(),
  idempotencyKey: z.string().min(1).optional(),
});
