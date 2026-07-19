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
