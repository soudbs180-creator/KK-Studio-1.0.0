import { z } from "zod";

export const AgentCoordinationRoleSchema = z.enum([
  "coordinator",
  "planner",
  "executor",
  "verifier",
  "compensator",
  "observer",
]);
export type AgentCoordinationRole = z.infer<typeof AgentCoordinationRoleSchema>;

export const AgentCoordinationRiskClassSchema = z.enum(["low", "medium", "high", "critical"]);
export type AgentCoordinationRiskClass = z.infer<typeof AgentCoordinationRiskClassSchema>;

export const AgentCoordinationPrioritySchema = z.enum([
  "background",
  "normal",
  "urgent",
  "critical",
]);
export type AgentCoordinationPriority = z.infer<typeof AgentCoordinationPrioritySchema>;

export const AgentCoordinationStateSchema = z.enum([
  "admitted",
  "queued",
  "running",
  "blocked",
  "awaiting_approval",
  "compensating",
  "completed",
  "failed",
  "cancelled",
  "fenced",
]);
export type AgentCoordinationState = z.infer<typeof AgentCoordinationStateSchema>;

const ResourceKeySchema = z.string().min(1).max(200);

export const AgentCoordinationAdmissionDtoSchema = z.object({
  taskId: z.string().min(1).max(200),
  runId: z.string().min(1).max(200).optional(),
  sessionId: z.string().min(1).max(200).optional(),
  agentId: z.string().min(1).max(200),
  role: AgentCoordinationRoleSchema,
  riskClass: AgentCoordinationRiskClassSchema,
  priority: AgentCoordinationPrioritySchema,
  resourceKeys: z.array(ResourceKeySchema).max(50),
  maxRounds: z.number().int().min(1).max(32),
  idempotencyKey: z.string().min(1).max(255),
  deadlineAt: z.iso.datetime().optional(),
}).strict();
export type AgentCoordinationAdmissionDto = z.infer<typeof AgentCoordinationAdmissionDtoSchema>;

export const AgentCoordinationClaimDtoSchema = z.object({
  resourceKey: ResourceKeySchema,
  agentId: z.string().min(1).max(200),
  role: AgentCoordinationRoleSchema,
  leaseExpiresAt: z.iso.datetime(),
}).strict();
export type AgentCoordinationClaimDto = z.infer<typeof AgentCoordinationClaimDtoSchema>;

export const AgentCoordinationSnapshotDtoSchema = z.object({
  taskId: z.string().min(1).max(200),
  ownerId: z.string().min(1).max(200),
  clusterId: z.string().min(1).max(100),
  runId: z.string().min(1).max(200).optional(),
  sessionId: z.string().min(1).max(200).optional(),
  agentId: z.string().min(1).max(200),
  role: AgentCoordinationRoleSchema,
  riskClass: AgentCoordinationRiskClassSchema,
  priority: AgentCoordinationPrioritySchema,
  state: AgentCoordinationStateSchema,
  version: z.number().int().positive(),
  epoch: z.number().int().positive(),
  round: z.number().int().nonnegative(),
  maxRounds: z.number().int().min(1).max(32),
  policyVersion: z.string().min(1).max(100),
  resourceClaims: z.array(AgentCoordinationClaimDtoSchema).max(50),
  compensationRequired: z.boolean(),
  deadlockDetected: z.boolean(),
  conflictCount: z.number().int().nonnegative(),
  staleCommandCount: z.number().int().nonnegative(),
  leaseLossCount: z.number().int().nonnegative(),
  compensationCount: z.number().int().nonnegative(),
  deadlineAt: z.iso.datetime().optional(),
  lastEventAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
}).strict();
export type AgentCoordinationSnapshotDto = z.infer<typeof AgentCoordinationSnapshotDtoSchema>;

export const AgentCoordinationAdmissionResultDtoSchema = z.object({
  accepted: z.boolean(),
  reason: z.string().max(500).optional(),
  data: AgentCoordinationSnapshotDtoSchema.optional(),
}).strict();
export type AgentCoordinationAdmissionResultDto = z.infer<typeof AgentCoordinationAdmissionResultDtoSchema>;

export const AgentCoordinationTransitionDtoSchema = z.object({
  expectedVersion: z.number().int().positive(),
  expectedEpoch: z.number().int().positive(),
  agentId: z.string().min(1).max(200),
  role: AgentCoordinationRoleSchema,
  nextState: AgentCoordinationStateSchema,
  idempotencyKey: z.string().min(1).max(255),
  reason: z.string().max(500).optional(),
}).strict();
export type AgentCoordinationTransitionDto = z.infer<typeof AgentCoordinationTransitionDtoSchema>;

export const AgentCoordinationHeartbeatDtoSchema = z.object({
  expectedVersion: z.number().int().positive(),
  expectedEpoch: z.number().int().positive(),
  agentId: z.string().min(1).max(200),
  role: AgentCoordinationRoleSchema,
  idempotencyKey: z.string().min(1).max(255),
}).strict();
export type AgentCoordinationHeartbeatDto = z.infer<typeof AgentCoordinationHeartbeatDtoSchema>;

export const AgentCoordinationMutationResultDtoSchema = z.object({
  outcome: z.enum(["accepted", "rejected"]),
  reason: z.string().max(500).optional(),
  data: AgentCoordinationSnapshotDtoSchema.optional(),
}).strict();
export type AgentCoordinationMutationResultDto = z.infer<typeof AgentCoordinationMutationResultDtoSchema>;

export const AgentCoordinationMetricsDtoSchema = z.object({
  windowStartAt: z.iso.datetime(),
  windowEndAt: z.iso.datetime(),
  totalTasks: z.number().int().nonnegative(),
  activeTasks: z.number().int().nonnegative(),
  terminalTasks: z.number().int().nonnegative(),
  completedTasks: z.number().int().nonnegative(),
  completionRate: z.number().min(0).max(1),
  conflictTasks: z.number().int().nonnegative(),
  conflictRate: z.number().min(0).max(1),
  deadlockCount: z.number().int().nonnegative(),
  staleCommandCount: z.number().int().nonnegative(),
  leaseLossCount: z.number().int().nonnegative(),
  compensationCount: z.number().int().nonnegative(),
  averageRounds: z.number().nonnegative(),
}).strict();
export type AgentCoordinationMetricsDto = z.infer<typeof AgentCoordinationMetricsDtoSchema>;

export const AgentCoordinationEventDtoSchema = z.object({
  taskId: z.string().min(1).max(200),
  sequence: z.number().int().positive(),
  eventType: z.enum([
    "admitted",
    "queued",
    "transitioned",
    "heartbeat",
    "fenced",
    "compensating",
    "released",
    "deadlock_detected",
    "lease_expired",
  ]),
  state: AgentCoordinationStateSchema,
  epoch: z.number().int().positive(),
  version: z.number().int().positive(),
  reason: z.string().max(500).optional(),
  createdAt: z.iso.datetime(),
}).strict();
export type AgentCoordinationEventDto = z.infer<typeof AgentCoordinationEventDtoSchema>;

export const AgentCoordinationEventListDtoSchema = z.array(AgentCoordinationEventDtoSchema).max(100);
