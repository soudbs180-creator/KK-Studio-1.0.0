import { z } from "zod";

export type AssistantCollaborationMode = "direct" | "assist" | "takeover";

export const AssistantCollaborationModeSchema = z.enum(["direct", "assist", "takeover"]);

export type AssistantWorkspaceSurface =
  | "canvas"
  | "library"
  | "favorites"
  | "settings"
  | "agent"
  | "unknown";

export const AssistantWorkspaceSurfaceSchema = z.enum([
  "canvas",
  "library",
  "favorites",
  "settings",
  "agent",
  "unknown",
]);

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
  sessionId?: string;
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

export interface AgentRunSnapshotEventDto {
  runId: string;
  sequence: number;
  type: "run_snapshot";
  status: AgentRunStatus;
  runUpdatedAt: string;
  createdAt: string;
}

export interface AgentRunStepOutcomeEventDto {
  runId: string;
  sequence: number;
  type: "step_outcome";
  status: AgentRunStatus;
  runUpdatedAt: string;
  createdAt: string;
  step: Omit<AgentStepResultDto, "message">;
}

export type AgentRunEventDto = AgentRunSnapshotEventDto | AgentRunStepOutcomeEventDto;

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
  sessionId: z.string().min(1).max(200).optional(),
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

const AgentRunEventBaseDtoSchema = z.object({
  runId: z.string().min(1).max(200),
  sequence: z.number().int().positive(),
  status: AgentRunStatusSchema,
  runUpdatedAt: z.iso.datetime(),
  createdAt: z.iso.datetime(),
}).strict();

const AgentRunSnapshotEventDtoSchema = AgentRunEventBaseDtoSchema.extend({
  type: z.literal("run_snapshot"),
}).strict();

const AgentRunStepOutcomeEventDtoSchema = AgentRunEventBaseDtoSchema.extend({
  type: z.literal("step_outcome"),
  step: AgentStepResultDtoSchema.omit({ message: true }).strict(),
}).strict();

/** Keeps semantic event transport metadata-only through explicit, strict variants. */
export const AgentRunEventDtoSchema = z.discriminatedUnion("type", [
  AgentRunSnapshotEventDtoSchema,
  AgentRunStepOutcomeEventDtoSchema,
]);

/** Bounds one incremental replay page independently from the Run snapshot list. */
export const AgentRunEventListDtoSchema = z.array(AgentRunEventDtoSchema).max(100);

const AgentSessionAttachmentRefDtoSchema = z.object({
  assetId: z.string().min(1).max(200),
  kind: z.enum(["image", "document", "video", "audio"]),
  name: z.string().min(1).max(500),
  mimeType: z.string().max(200).optional(),
}).strict();

const AgentSessionMessageDtoSchema = z.object({
  id: z.string().min(1).max(200),
  role: z.enum(["user", "assistant", "system", "tool"]),
  content: z.string().max(16_000),
  createdAt: z.iso.datetime(),
  modelId: z.string().max(200).optional(),
  toolCallId: z.string().max(200).optional(),
  attachments: z.array(AgentSessionAttachmentRefDtoSchema).max(20).optional(),
}).strict();

const AgentSessionSummaryDtoSchema = z.object({
  text: z.string().max(32_000),
  coveredMessageCount: z.number().int().nonnegative().max(10_000),
  updatedAt: z.iso.datetime(),
}).strict();

const AgentSessionToolResultDtoSchema = z.object({
  id: z.string().min(1).max(200),
  toolName: z.string().min(1).max(200),
  outcome: AgentStepOutcomeSchema,
  outputSummary: z.string().max(4_000),
  createdAt: z.iso.datetime(),
}).strict();

const AgentSessionKnowledgeRefDtoSchema = z.object({
  documentId: z.string().min(1).max(200),
  title: z.string().min(1).max(500),
  excerpt: z.string().max(2_000).optional(),
  contentHash: z.string().max(200).optional(),
}).strict();

const AgentTokenBudgetDtoSchema = z.object({
  maxTokens: z.number().int().positive().max(2_000_000),
  usedTokens: z.number().int().nonnegative().max(2_000_000),
  reservedTokens: z.number().int().nonnegative().max(2_000_000),
}).strict().refine(
  (budget) => budget.usedTokens + budget.reservedTokens <= budget.maxTokens,
  { message: "usedTokens plus reservedTokens must not exceed maxTokens" },
);

const AgentSessionConfirmationDtoSchema = z.object({
  id: z.string().min(1).max(200),
  status: z.enum(["pending", "granted", "rejected", "expired"]),
  planHash: z.string().min(1).max(200),
  toolId: z.string().min(1).max(200),
  targetSnapshotHash: z.string().min(1).max(200),
  quoteId: z.string().max(200).optional(),
  maxCostCredits: z.number().int().nonnegative().optional(),
  expiresAt: z.iso.datetime(),
  decidedAt: z.iso.datetime().optional(),
}).strict();

const AgentSessionCheckpointDtoSchema = z.object({
  id: z.string().min(1).max(200),
  label: z.string().min(1).max(500),
  runId: z.string().max(200).optional(),
  eventSequence: z.number().int().positive().optional(),
  createdAt: z.iso.datetime(),
}).strict();

/** Authoritative, owner-bound conversation state without embedded binary attachments. */
export const AgentSessionDtoSchema = z.object({
  sessionId: z.string().min(1).max(200),
  ownerId: z.string().min(1).max(200),
  collaborationMode: AssistantCollaborationModeSchema,
  messages: z.array(AgentSessionMessageDtoSchema).max(200),
  summary: AgentSessionSummaryDtoSchema,
  toolResults: z.array(AgentSessionToolResultDtoSchema).max(200),
  knowledgeRefs: z.array(AgentSessionKnowledgeRefDtoSchema).max(100),
  tokenBudget: AgentTokenBudgetDtoSchema,
  confirmations: z.array(AgentSessionConfirmationDtoSchema).max(100),
  checkpoints: z.array(AgentSessionCheckpointDtoSchema).max(100),
  lastHeartbeatAt: z.iso.datetime(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
}).strict();

/** Client write shape deliberately excludes ownerId; authentication supplies the owner. */
export const AgentSessionUpsertDtoSchema = AgentSessionDtoSchema.omit({ ownerId: true }).strict();

export type AgentSessionDto = z.infer<typeof AgentSessionDtoSchema>;
export type AgentSessionUpsertDto = z.infer<typeof AgentSessionUpsertDtoSchema>;

/** Bounded list projection avoids returning every message for every recent Session. */
export const AgentSessionListItemDtoSchema = AgentSessionDtoSchema.pick({
  sessionId: true,
  ownerId: true,
  collaborationMode: true,
  lastHeartbeatAt: true,
  createdAt: true,
  updatedAt: true,
}).extend({ messageCount: z.number().int().nonnegative() }).strict();

export const AgentSessionListDtoSchema = z.array(AgentSessionListItemDtoSchema).max(50);
export type AgentSessionListItemDto = z.infer<typeof AgentSessionListItemDtoSchema>;

const AgentCanvasSummaryDtoSchema = z.object({
  nodeCount: z.number().int().nonnegative().max(1_000_000),
  selectedNodeCount: z.number().int().nonnegative().max(1_000_000),
  generatedAssetCount: z.number().int().nonnegative().max(1_000_000),
}).strict();

const AgentViewportDtoSchema = z.object({
  x: z.number().finite(),
  y: z.number().finite(),
  width: z.number().finite().positive(),
  height: z.number().finite().positive(),
  zoom: z.number().finite().positive().max(100),
}).strict();

const AgentCanvasEventDtoSchema = z.object({
  id: z.string().min(1).max(200),
  type: z.enum([
    "selection_changed",
    "viewport_changed",
    "node_created",
    "node_updated",
    "node_deleted",
  ]),
  occurredAt: z.iso.datetime(),
}).strict();

const AgentInputBoxStateDtoSchema = z.object({
  hasText: z.boolean(),
  attachmentCount: z.number().int().nonnegative().max(20),
}).strict();

/** Metadata-only context capture; raw prompt text and attachment bytes are forbidden. */
export const AgentContextSnapshotInputDtoSchema = z.object({
  snapshotId: z.string().min(1).max(200),
  activeSurface: AssistantWorkspaceSurfaceSchema,
  canvasId: z.string().max(200).optional(),
  canvasSummary: AgentCanvasSummaryDtoSchema,
  selectedNodeIds: z.array(z.string().min(1).max(200)).max(200),
  viewport: AgentViewportDtoSchema,
  recentEvents: z.array(AgentCanvasEventDtoSchema).max(100),
  inputBox: AgentInputBoxStateDtoSchema.optional(),
  availableTools: z.array(z.string().min(1).max(200)).max(200),
  capturedAt: z.iso.datetime(),
}).strict();

export const AgentContextSnapshotDtoSchema = AgentContextSnapshotInputDtoSchema.extend({
  sessionId: z.string().min(1).max(200),
  sequence: z.number().int().positive(),
  createdAt: z.iso.datetime(),
}).strict();

export type AgentContextSnapshotInputDto = z.infer<typeof AgentContextSnapshotInputDtoSchema>;
export type AgentContextSnapshotDto = z.infer<typeof AgentContextSnapshotDtoSchema>;

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
