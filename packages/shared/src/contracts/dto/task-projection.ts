import { z } from 'zod';
import { AgentExecutionTargetSchema } from './execution-authority.ts';

export const PublicTaskPhaseSchema = z.enum([
  'queued',
  'planning',
  'waiting_confirmation',
  'waiting_for_device',
  'setup_required',
  'waiting_execution',
  'running',
  'pausing',
  'paused',
  'retrying',
  'verifying',
  'verification_required',
  'manual_reconcile',
  'cancelling',
  'terminal',
]);
export type PublicTaskPhase = z.infer<typeof PublicTaskPhaseSchema>;

export const PublicTaskTerminalOutcomeSchema = z.enum([
  'completed',
  'completed_with_errors',
  'failed',
  'cancelled',
]);
export type PublicTaskTerminalOutcome = z.infer<typeof PublicTaskTerminalOutcomeSchema>;

export const PublicTaskActionSchema = z.enum([
  'cancel',
  'retry',
  'pause',
  'resume',
  'confirm',
  'refresh_capabilities',
  'refresh_target',
  'open_pairing',
  'open_runtime_settings',
  'open_task_details',
  'reconcile_manually',
  'change_execution_target',
  'install_update',
  'continue_waiting',
  'cancel_update',
  'force_exit',
]);
export type PublicTaskAction = z.infer<typeof PublicTaskActionSchema>;

export const PublicTaskErrorCategorySchema = z.enum([
  'validation',
  'permission_required',
  'confirmation_expired',
  'setup_required',
  'connection_unavailable',
  'provider_failed',
  'quote_expired',
  'insufficient_balance',
  'lease_lost',
  'ambiguous_outcome',
  'update_blocked',
  'unsupported',
  'unknown',
]);
export type PublicTaskErrorCategory = z.infer<typeof PublicTaskErrorCategorySchema>;

export const PublicTaskErrorCodeSchema = z.enum([
  'requires_paired_desktop',
  'cloud_agent_unavailable',
  'local_runtime_unavailable',
  'confirmation_expired',
  'ambiguous_side_effect',
  'validation_failed',
  'permission_required',
  'connection_unavailable',
  'provider_failed',
  'quote_expired',
  'insufficient_balance',
  'lease_lost',
  'update_blocked',
  'unsupported_operation',
  'unknown_error',
]);
export type PublicTaskErrorCode = z.infer<typeof PublicTaskErrorCodeSchema>;

export const PublicTaskSafeActionSchema = z.enum([
  'retry',
  'refresh_capabilities',
  'refresh_target',
  'request_confirmation',
  'open_pairing',
  'open_runtime_settings',
  'open_task_details',
  'reconcile_manually',
  'change_execution_target',
  'change_route',
  'reconnect',
  'reauthorize',
  'cancel',
  'open_recovery',
]);
export type PublicTaskSafeAction = z.infer<typeof PublicTaskSafeActionSchema>;

/** Stable semantics are presentation-independent and shared across every surface. */
export const STABLE_PUBLIC_TASK_ERROR_MAPPINGS = {
  requires_paired_desktop: {
    category: 'setup_required',
    publicPhase: 'waiting_for_device',
    retryable: true,
    inputPreserved: true,
    billingMayHaveChanged: false,
    retryMayChargeAgain: false,
    safeActions: ['refresh_capabilities', 'open_pairing'],
  },
  cloud_agent_unavailable: {
    category: 'unsupported',
    publicPhase: 'setup_required',
    retryable: false,
    inputPreserved: true,
    billingMayHaveChanged: false,
    retryMayChargeAgain: false,
    safeActions: ['refresh_capabilities', 'change_execution_target'],
  },
  local_runtime_unavailable: {
    category: 'setup_required',
    publicPhase: 'setup_required',
    retryable: true,
    inputPreserved: true,
    billingMayHaveChanged: false,
    retryMayChargeAgain: false,
    safeActions: ['retry', 'open_runtime_settings'],
  },
  confirmation_expired: {
    category: 'confirmation_expired',
    publicPhase: 'waiting_confirmation',
    retryable: true,
    inputPreserved: true,
    billingMayHaveChanged: false,
    retryMayChargeAgain: false,
    safeActions: ['refresh_target', 'request_confirmation'],
  },
  ambiguous_side_effect: {
    category: 'ambiguous_outcome',
    publicPhase: 'manual_reconcile',
    retryable: false,
    inputPreserved: true,
    billingMayHaveChanged: true,
    retryMayChargeAgain: true,
    safeActions: ['open_task_details', 'reconcile_manually'],
  },
} as const;

type StablePublicTaskErrorCode = keyof typeof STABLE_PUBLIC_TASK_ERROR_MAPPINGS;

const isStableErrorCode = (code: string): code is StablePublicTaskErrorCode => (
  Object.prototype.hasOwnProperty.call(STABLE_PUBLIC_TASK_ERROR_MAPPINGS, code)
);

const arraysEqual = (left: readonly string[], right: readonly string[]): boolean => (
  left.length === right.length && left.every((value, index) => value === right[index])
);

export const PublicTaskErrorProjectionDtoSchema = z.object({
  code: PublicTaskErrorCodeSchema,
  category: PublicTaskErrorCategorySchema,
  publicPhase: PublicTaskPhaseSchema,
  retryable: z.boolean(),
  inputPreserved: z.boolean(),
  billingMayHaveChanged: z.boolean(),
  retryMayChargeAgain: z.boolean(),
  safeActions: z.array(PublicTaskSafeActionSchema).max(8),
  runId: z.string().min(1).max(200).optional(),
  jobId: z.string().min(1).max(200).optional(),
  stepId: z.string().min(1).max(200).optional(),
  executionTarget: AgentExecutionTargetSchema.optional(),
  providerId: z.string().min(1).max(200).optional(),
  modelId: z.string().min(1).max(200).optional(),
  completedItemIds: z.array(z.string().min(1).max(200)).max(1000).optional(),
  incompleteItemIds: z.array(z.string().min(1).max(200)).max(1000).optional(),
}).strict().superRefine((error, context) => {
  if (!isStableErrorCode(error.code)) return;
  const expected = STABLE_PUBLIC_TASK_ERROR_MAPPINGS[error.code];
  const scalarFields = [
    'category',
    'publicPhase',
    'retryable',
    'inputPreserved',
    'billingMayHaveChanged',
    'retryMayChargeAgain',
  ] as const;
  for (const field of scalarFields) {
    if (error[field] !== expected[field]) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: [field],
        message: `${error.code} must use its stable ${field} mapping.`,
      });
    }
  }
  if (!arraysEqual(error.safeActions, expected.safeActions)) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['safeActions'],
      message: `${error.code} must use its stable safe-action mapping.`,
    });
  }
});
export type PublicTaskErrorProjectionDto = z.infer<typeof PublicTaskErrorProjectionDtoSchema>;

const PublicTaskProgressDtoSchema = z.object({
  completed: z.number().int().nonnegative(),
  total: z.number().int().positive(),
}).strict().refine((progress) => progress.completed <= progress.total, {
  message: 'Completed task work cannot exceed total work.',
});

const PublicTaskProjectionBaseShape = {
  schemaVersion: z.literal(1),
  projectionId: z.string().min(1).max(200),
  phase: PublicTaskPhaseSchema,
  terminalOutcome: PublicTaskTerminalOutcomeSchema.optional(),
  title: z.string().min(1).max(500),
  executionTarget: AgentExecutionTargetSchema.optional(),
  allowedActions: z.array(PublicTaskActionSchema).max(12),
  progress: PublicTaskProgressDtoSchema.optional(),
  error: PublicTaskErrorProjectionDtoSchema.optional(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
};

const GenerationJobTaskProjectionDtoSchema = z.object({
  ...PublicTaskProjectionBaseShape,
  source: z.literal('generation_job'),
  jobId: z.string().min(1).max(200),
}).strict();

const AgentRunTaskProjectionDtoSchema = z.object({
  ...PublicTaskProjectionBaseShape,
  source: z.literal('agent_run'),
  runId: z.string().min(1).max(200),
}).strict();

const PairedCommandTaskProjectionDtoSchema = z.object({
  ...PublicTaskProjectionBaseShape,
  source: z.literal('paired_command'),
  commandId: z.string().min(1).max(200),
  runId: z.string().min(1).max(200),
}).strict();

const LocalTaskProjectionDtoSchema = z.object({
  ...PublicTaskProjectionBaseShape,
  source: z.literal('local_task'),
  localTaskId: z.string().min(1).max(200),
}).strict();

const AppUpdateTaskProjectionDtoSchema = z.object({
  ...PublicTaskProjectionBaseShape,
  source: z.literal('app_update'),
  updateId: z.string().min(1).max(200),
  targetVersion: z.string().min(1).max(120),
}).strict();

export const PublicTaskProjectionDtoSchema = z.discriminatedUnion('source', [
  GenerationJobTaskProjectionDtoSchema,
  AgentRunTaskProjectionDtoSchema,
  PairedCommandTaskProjectionDtoSchema,
  LocalTaskProjectionDtoSchema,
  AppUpdateTaskProjectionDtoSchema,
]).superRefine((task, context) => {
  const isTerminal = task.phase === 'terminal';
  if (isTerminal !== Boolean(task.terminalOutcome)) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['terminalOutcome'],
      message: 'Terminal outcome must exist only when public phase is terminal.',
    });
  }
  if (task.error && task.error.publicPhase !== task.phase) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['error', 'publicPhase'],
      message: 'Task phase must match its structured error projection.',
    });
  }
  if (task.error?.runId && 'runId' in task && task.error.runId !== task.runId) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['error', 'runId'],
      message: 'Error Run identity must match its task source.',
    });
  }
  if (task.error?.jobId && 'jobId' in task && task.error.jobId !== task.jobId) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['error', 'jobId'],
      message: 'Error Job identity must match its task source.',
    });
  }
});

export const PublicTaskProjectionListDtoSchema = z.array(PublicTaskProjectionDtoSchema).max(500);
export type PublicTaskProjectionDto = z.infer<typeof PublicTaskProjectionDtoSchema>;
