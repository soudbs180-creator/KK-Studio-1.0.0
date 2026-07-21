import { z } from 'zod';

/** Capability Graph v1 使用固定判别类型，避免调用方用自由字符串推断节点语义。 */
export const CapabilityNodeTypeSchema = z.enum([
  'Actor',
  'Provider',
  'ProviderConnection',
  'Model',
  'Capability',
  'Asset',
  'Workflow',
  'Step',
  'Trigger',
  'Runtime',
  'Job',
  'Run',
  'ToolCall',
  'Verification',
  'Audit',
]);

export type CapabilityNodeType = z.infer<typeof CapabilityNodeTypeSchema>;

export const CapabilityNodeStatusSchema = z.enum([
  'connected',
  'available',
  'restricted',
  'offline',
  'error',
]);

export const CapabilityOwnerScopeSchema = z.enum(['global', 'user', 'workspace']);
export const CapabilityPermissionSchema = z.enum(['safe', 'confirm', 'dangerous', 'forbidden']);

const commonNodeFields = {
  id: z.string().min(1),
  status: CapabilityNodeStatusSchema,
  ownerScope: CapabilityOwnerScopeSchema,
  source: z.string().min(1),
  version: z.string().min(1),
  updatedAt: z.string().datetime(),
};

const ActorNodeSchema = z.object({
  ...commonNodeFields,
  type: z.literal('Actor'),
  actorId: z.string().min(1),
  actorKind: z.enum(['user', 'agent', 'system']),
}).strict();

const ProviderNodeSchema = z.object({
  ...commonNodeFields,
  type: z.literal('Provider'),
  providerId: z.string().min(1),
  displayName: z.string().min(1),
}).strict();

const ProviderConnectionNodeSchema = z.object({
  ...commonNodeFields,
  type: z.literal('ProviderConnection'),
  connectionId: z.string().uuid(),
  providerId: z.string().min(1),
  displayName: z.string().min(1),
  hasSecret: z.boolean(),
}).strict();

const ModelNodeSchema = z.object({
  ...commonNodeFields,
  type: z.literal('Model'),
  modelId: z.string().min(1),
  providerId: z.string().min(1),
  displayName: z.string().min(1),
}).strict();

const CapabilityNodeSchema = z.object({
  ...commonNodeFields,
  type: z.literal('Capability'),
  capabilityId: z.string().min(1),
  displayName: z.string().min(1),
  mediaType: z.enum(['image', 'video', 'audio', 'ppt', 'browser', 'data']).optional(),
}).strict();

const AssetNodeSchema = z.object({
  ...commonNodeFields,
  type: z.literal('Asset'),
  assetId: z.string().min(1),
  mediaType: z.enum(['image', 'video', 'audio', 'document', 'other']),
}).strict();

const WorkflowNodeSchema = z.object({
  ...commonNodeFields,
  type: z.literal('Workflow'),
  workflowId: z.string().min(1),
  displayName: z.string().min(1),
}).strict();

const StepNodeSchema = z.object({
  ...commonNodeFields,
  type: z.literal('Step'),
  stepId: z.string().min(1),
  displayName: z.string().min(1),
}).strict();

const TriggerNodeSchema = z.object({
  ...commonNodeFields,
  type: z.literal('Trigger'),
  triggerId: z.string().min(1),
  triggerKind: z.string().min(1),
}).strict();

const RuntimeNodeSchema = z.object({
  ...commonNodeFields,
  type: z.literal('Runtime'),
  runtimeId: z.string().min(1),
  runtimeKind: z.enum(['browser', 'control-plane', 'local']),
}).strict();

const JobNodeSchema = z.object({
  ...commonNodeFields,
  type: z.literal('Job'),
  jobId: z.string().uuid(),
}).strict();

const RunNodeSchema = z.object({
  ...commonNodeFields,
  type: z.literal('Run'),
  runId: z.string().min(1),
}).strict();

const ToolCallNodeSchema = z.object({
  ...commonNodeFields,
  type: z.literal('ToolCall'),
  toolCallId: z.string().min(1),
  toolId: z.string().min(1),
}).strict();

const VerificationNodeSchema = z.object({
  ...commonNodeFields,
  type: z.literal('Verification'),
  verificationId: z.string().min(1),
  result: z.enum(['pending', 'passed', 'failed']),
}).strict();

const AuditNodeSchema = z.object({
  ...commonNodeFields,
  type: z.literal('Audit'),
  auditId: z.string().min(1),
  eventType: z.string().min(1),
}).strict();

/** 所有节点必须通过 type 判别联合解析，未知字段与不完整类型都 fail closed。 */
export const CapabilityNodeDtoSchema = z.discriminatedUnion('type', [
  ActorNodeSchema,
  ProviderNodeSchema,
  ProviderConnectionNodeSchema,
  ModelNodeSchema,
  CapabilityNodeSchema,
  AssetNodeSchema,
  WorkflowNodeSchema,
  StepNodeSchema,
  TriggerNodeSchema,
  RuntimeNodeSchema,
  JobNodeSchema,
  RunNodeSchema,
  ToolCallNodeSchema,
  VerificationNodeSchema,
  AuditNodeSchema,
]);

export type CapabilityNodeDto = z.infer<typeof CapabilityNodeDtoSchema>;

export const CapabilityEdgeRelationSchema = z.enum([
  'owns',
  'connectsTo',
  'exposes',
  'binds',
  'supports',
  'routesVia',
  'runsOn',
  'contains',
  'produced',
  'consumed',
  'verifiedBy',
  'auditedBy',
]);

/** 边显式携带来源、权限和约束，防止 UI 或 Agent 猜测执行边界。 */
export const CapabilityEdgeDtoSchema = z.object({
  from: z.string().min(1),
  to: z.string().min(1),
  relation: CapabilityEdgeRelationSchema,
  status: z.enum(['active', 'disabled', 'degraded']),
  source: z.string().min(1),
  constraints: z.record(z.string(), z.unknown()).default({}),
  permissions: CapabilityPermissionSchema,
  version: z.string().min(1),
}).strict();

export type CapabilityEdgeDto = z.infer<typeof CapabilityEdgeDtoSchema>;

/** v1 snapshot 是当前唯一可接受的公共图版本，未知版本必须显式升级客户端。 */
export const CapabilityGraphSnapshotDtoSchema = z.object({
  version: z.literal('v1'),
  generatedAt: z.string().datetime(),
  nodes: z.array(CapabilityNodeDtoSchema),
  edges: z.array(CapabilityEdgeDtoSchema),
}).strict();

export type CapabilityGraphSnapshotDto = z.infer<typeof CapabilityGraphSnapshotDtoSchema>;
