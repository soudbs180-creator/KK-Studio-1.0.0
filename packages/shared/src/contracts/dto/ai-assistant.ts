import { z } from "zod";

export type AssistantCollaborationMode = "direct" | "assist" | "takeover";

export type AssistantWorkspaceSurface =
  | "canvas"
  | "library"
  | "favorites"
  | "settings"
  | "agent"
  | "unknown";

export type AgentRunStatus =
  | "planning"
  | "waiting_confirmation"
  | "waiting_execution"
  | "running"
  | "completed"
  | "completed_with_errors"
  | "failed"
  | "cancelled";

const AgentRunStatusSchema = z.enum([
  "planning",
  "waiting_confirmation",
  "waiting_execution",
  "running",
  "completed",
  "completed_with_errors",
  "failed",
  "cancelled",
]);

export type AgentStepOutcome =
  | "success"
  | "partial_success"
  | "retryable_failure"
  | "rolled_back_failure"
  | "cancelled";

export type AgentToolCallStatus =
  | "success"
  | "partial_success"
  | "retryable_failure"
  | "rolled_back"
  | "cancelled"
  | "failed"
  | "blocked"
  | "setup_required"
  | "verification_failed";

export type AgentFailureClass =
  | "validation"
  | "permission"
  | "setup"
  | "network"
  | "provider"
  | "verification"
  | "cancelled"
  | "unknown";

export interface AgentStepResultDto {
  stepId: string;
  toolName: string;
  outcome: AgentStepOutcome;
  verificationRule: "tool" | "queue_job" | "canvas_state" | "asset_manifest" | "none";
  message?: string;
  retryable: boolean;
  verifiedAt: string;
}

export interface AgentToolCallDto {
  id: string;
  runId: string;
  stepId?: string;
  toolName: string;
  inputSummary: string;
  outputSummary?: string;
  status: AgentToolCallStatus;
  outcome?: AgentStepOutcome;
  failureClass?: AgentFailureClass;
  errorCode?: string;
  retryable?: boolean;
  error?: string;
  startedAt: string;
  completedAt?: string;
  idempotencyKey?: string;
}

export interface AgentRunDto {
  id: string;
  userMessage: string;
  intent: string;
  plan: unknown;
  status: AgentRunStatus;
  toolCalls: AgentToolCallDto[];
  stepResults?: AgentStepResultDto[];
  createdAt: string;
  updatedAt: string;
  nextStep?: string;
  confirmationGrantedAt?: string;
  totalSteps?: number;
  completedStepIds?: string[];
  replanCount?: number;
}

export interface AgentRunEventDto {
  runId: string;
  sequence: number;
  type: "run_snapshot";
  status: AgentRunStatus;
  runUpdatedAt: string;
  createdAt: string;
}

export interface AgentRunEventQueryDto {
  afterSequence?: number;
}

const AgentStepOutcomeSchema = z.enum([
  "success",
  "partial_success",
  "retryable_failure",
  "rolled_back_failure",
  "cancelled",
]);

const AgentToolCallStatusSchema = z.enum([
  "success",
  "partial_success",
  "retryable_failure",
  "rolled_back",
  "cancelled",
  "failed",
  "blocked",
  "setup_required",
  "verification_failed",
]);

const AgentFailureClassSchema = z.enum([
  "validation",
  "permission",
  "setup",
  "network",
  "provider",
  "verification",
  "cancelled",
  "unknown",
]);

export const AgentStepResultDtoSchema = z.object({
  stepId: z.string().min(1).max(200),
  toolName: z.string().min(1).max(200),
  outcome: AgentStepOutcomeSchema,
  verificationRule: z.enum(["tool", "queue_job", "canvas_state", "asset_manifest", "none"]),
  message: z.string().optional(),
  retryable: z.boolean(),
  verifiedAt: z.iso.datetime(),
});

export const AgentToolCallDtoSchema = z.object({
  id: z.string().min(1).max(200),
  runId: z.string().min(1).max(200),
  stepId: z.string().max(200).optional(),
  toolName: z.string().min(1).max(200),
  inputSummary: z.string(),
  outputSummary: z.string().optional(),
  status: AgentToolCallStatusSchema,
  outcome: AgentStepOutcomeSchema.optional(),
  failureClass: AgentFailureClassSchema.optional(),
  errorCode: z.string().optional(),
  retryable: z.boolean().optional(),
  error: z.string().optional(),
  startedAt: z.iso.datetime(),
  completedAt: z.iso.datetime().optional(),
  idempotencyKey: z.string().optional(),
});

export const AgentRunDtoSchema = z.object({
  id: z.string().min(1).max(200),
  userMessage: z.string(),
  intent: z.string(),
  plan: z.unknown(),
  status: AgentRunStatusSchema,
  toolCalls: z.array(AgentToolCallDtoSchema),
  stepResults: z.array(AgentStepResultDtoSchema).optional(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
  nextStep: z.string().optional(),
  confirmationGrantedAt: z.iso.datetime().optional(),
  totalSteps: z.number().int().nonnegative().optional(),
  completedStepIds: z.array(z.string()).optional(),
  replanCount: z.number().int().nonnegative().optional(),
});

/** Validates the bounded server collection before it enters Web runtime state. */
export const AgentRunListDtoSchema = z.array(AgentRunDtoSchema).max(50);

/** Keeps the event log metadata-only so prompts, plans, and tool payloads cannot leak through replay. */
export const AgentRunEventDtoSchema = z.object({
  runId: z.string().min(1).max(200),
  sequence: z.number().int().positive(),
  type: z.literal("run_snapshot"),
  status: AgentRunStatusSchema,
  runUpdatedAt: z.iso.datetime(),
  createdAt: z.iso.datetime(),
}).strict();

/** Bounds one incremental replay page independently from the Run snapshot list. */
export const AgentRunEventListDtoSchema = z.array(AgentRunEventDtoSchema).max(100);

export type AssistantOwnerScope = "system" | "user" | "legacy";

export interface AgentKnowledgeChangeDto {
  id: string;
  title: string;
  summary: string;
  source: "runtime" | "user" | "import" | string;
  paths: string[];
  createdAt?: string;
}

export interface AgentKnowledgeDocumentDto {
  id: string;
  userId?: string;
  ownerScope: AssistantOwnerScope;
  source: string;
  path?: string;
  title: string;
  summary: string;
  contentHash?: string;
  updatedAt?: string;
}

export interface AgentKnowledgeSearchQueryDto {
  query?: string;
}

export interface AgentSkillDto {
  id: string;
  userId?: string;
  ownerScope?: AssistantOwnerScope;
  name: string;
  trigger: string;
  tools: string[];
  steps: string[];
  safety?: string[];
  validation?: string[];
  knowledgeUpdates?: string[];
  createdAt?: string;
  updatedAt: string;
}

export interface AgentSkillDeleteDto {
  name: string;
  updatedAt: string;
}

export interface AssistantApiResultDto<T> {
  ok: boolean;
  stale?: boolean;
  data?: T;
  deleted?: boolean;
  id?: string;
  authoritativeUpdatedAt?: string;
  authoritativeDeleted?: boolean;
}
