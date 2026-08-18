import {
  STABLE_PUBLIC_TASK_ERROR_MAPPINGS,
  type AgentExecutionTarget,
  type PlatformUpdateStateDto,
  type PublicTaskAction,
  type PublicTaskErrorCode,
  type PublicTaskErrorProjectionDto,
  type PublicTaskPhase,
  type PublicTaskProjectionDto,
  type PublicTaskSafeAction,
  type PublicTaskTerminalOutcome,
} from '@kk/shared';
import type {
  GenerationBatchJob,
  GenerationErrorCategory,
} from '../ai-assistant-runtime/queue/DurableGenerationQueue.ts';
import type { AgentRunRecord } from '../ai-assistant-runtime/runtime/AgentRunStore.ts';
import { summarizeAgentRunCoverage } from '../ai-assistant-runtime/runtime/agentRunProgress.ts';

type GenerationTaskProjection = Extract<PublicTaskProjectionDto, { source: 'generation_job' }>;
type AgentTaskProjection = Extract<PublicTaskProjectionDto, { source: 'agent_run' }>;
type PairedTaskProjection = Extract<PublicTaskProjectionDto, { source: 'paired_command' }>;
type LocalTaskProjection = Extract<PublicTaskProjectionDto, { source: 'local_task' }>;
type AppUpdateTaskProjection = Extract<PublicTaskProjectionDto, { source: 'app_update' }>;

export type PublicTaskSourceStatus = Exclude<PublicTaskPhase, 'terminal'> | PublicTaskTerminalOutcome;

export interface PublicTaskErrorEvidence {
  code?: string;
  category?: string;
  retryable?: boolean;
  reconciliationRequired?: boolean;
  stepId?: string;
  providerId?: string;
  modelId?: string;
}

export interface PairedCommandTaskInput extends PublicTaskErrorEvidence {
  commandId: string;
  runId: string;
  status: PublicTaskSourceStatus;
  progress?: { completed: number; total: number };
  createdAt: string | number;
  updatedAt: string | number;
}

export interface LocalTaskInput extends PublicTaskErrorEvidence {
  id: string;
  status: PublicTaskSourceStatus;
  progress?: number;
  createdAt: string | number;
  updatedAt?: string | number;
  executionTarget?: AgentExecutionTarget;
}

const GENERATION_TASK_TITLES: Record<GenerationBatchJob['taskType'], string> = {
  image: '图像生成任务',
  video: '视频生成任务',
  audio: '音频生成任务',
};

const EXACT_ERROR_CODE_ALIASES: Record<string, PublicTaskErrorCode> = {
  REQUIRES_PAIRED_DESKTOP: 'requires_paired_desktop',
  CLOUD_AGENT_UNAVAILABLE: 'cloud_agent_unavailable',
  LOCAL_RUNTIME_UNAVAILABLE: 'local_runtime_unavailable',
  SETUP_REQUIRED: 'local_runtime_unavailable',
  CAPABILITY_UNAVAILABLE: 'local_runtime_unavailable',
  CONFIRMATION_EXPIRED: 'confirmation_expired',
  AMBIGUOUS_SIDE_EFFECT: 'ambiguous_side_effect',
  VALIDATION_FAILED: 'validation_failed',
  PERMISSION_REQUIRED: 'permission_required',
  CONNECTION_UNAVAILABLE: 'connection_unavailable',
  PROVIDER_FAILED: 'provider_failed',
  QUOTE_EXPIRED: 'quote_expired',
  QUOTE_NOT_FOUND: 'quote_expired',
  INSUFFICIENT_BALANCE: 'insufficient_balance',
  INSUFFICIENT_CREDITS: 'insufficient_balance',
  LEASE_LOST: 'lease_lost',
  WORKER_LEASE_LOST: 'lease_lost',
  UPDATE_BLOCKED: 'update_blocked',
  UNSUPPORTED_OPERATION: 'unsupported_operation',
  UNKNOWN_ERROR: 'unknown_error',
};

const isStableErrorCode = (
  code: PublicTaskErrorCode,
): code is keyof typeof STABLE_PUBLIC_TASK_ERROR_MAPPINGS => (
  Object.prototype.hasOwnProperty.call(STABLE_PUBLIC_TASK_ERROR_MAPPINGS, code)
);

const normalizeTimestamp = (value: string | number, field: string): string => {
  const timestamp = typeof value === 'number' ? value : Date.parse(value);
  if (!Number.isFinite(timestamp)) {
    throw new TypeError(`Cannot project a task with an invalid ${field} timestamp.`);
  }
  return new Date(timestamp).toISOString();
};

const clampProgress = (completed: number, total: number) => {
  const normalizedTotal = Math.max(1, Math.round(total));
  return {
    completed: Math.min(normalizedTotal, Math.max(0, Math.round(completed))),
    total: normalizedTotal,
  };
};

const normalizeMachineErrorCode = (code?: string): PublicTaskErrorCode | undefined => {
  const normalized = String(code || '').trim().toUpperCase();
  return normalized ? EXACT_ERROR_CODE_ALIASES[normalized] : undefined;
};

const codeForCategory = (category?: string): PublicTaskErrorCode => {
  switch (category) {
    case 'authentication':
    case 'setup': return 'local_runtime_unavailable';
    case 'billing': return 'insufficient_balance';
    case 'invalid_input':
    case 'validation': return 'validation_failed';
    case 'permission': return 'permission_required';
    case 'rate_limit':
    case 'network': return 'connection_unavailable';
    case 'provider_unavailable':
    case 'provider': return 'provider_failed';
    default: return 'unknown_error';
  }
};

interface ErrorProfile {
  category: PublicTaskErrorProjectionDto['category'];
  retryable: boolean;
  inputPreserved: boolean;
  billingMayHaveChanged: boolean;
  retryMayChargeAgain: boolean;
  safeActions: PublicTaskSafeAction[];
}

const standardErrorProfile = (
  code: PublicTaskErrorCode,
  retryable?: boolean,
): ErrorProfile => {
  if (code === 'validation_failed') return {
    category: 'validation', retryable: false, inputPreserved: true,
    billingMayHaveChanged: false, retryMayChargeAgain: false,
    safeActions: ['open_task_details', 'cancel'],
  };
  if (code === 'permission_required') return {
    category: 'permission_required', retryable: true, inputPreserved: true,
    billingMayHaveChanged: false, retryMayChargeAgain: false,
    safeActions: ['reauthorize', 'open_runtime_settings'],
  };
  if (code === 'connection_unavailable' || code === 'provider_failed') return {
    category: code, retryable: retryable !== false, inputPreserved: true,
    billingMayHaveChanged: false, retryMayChargeAgain: false,
    safeActions: ['retry', code === 'connection_unavailable' ? 'reconnect' : 'change_route'],
  };
  return remainingErrorProfile(code, retryable);
};

const remainingErrorProfile = (
  code: PublicTaskErrorCode,
  retryable?: boolean,
): ErrorProfile => {
  const profiles: Partial<Record<PublicTaskErrorCode, ErrorProfile>> = {
    quote_expired: { category: 'quote_expired', retryable: true, inputPreserved: true, billingMayHaveChanged: false, retryMayChargeAgain: false, safeActions: ['request_confirmation', 'open_task_details'] },
    insufficient_balance: { category: 'insufficient_balance', retryable: false, inputPreserved: true, billingMayHaveChanged: false, retryMayChargeAgain: false, safeActions: ['open_runtime_settings', 'open_task_details'] },
    lease_lost: { category: 'lease_lost', retryable: false, inputPreserved: true, billingMayHaveChanged: true, retryMayChargeAgain: true, safeActions: ['open_task_details', 'reconcile_manually'] },
    update_blocked: { category: 'update_blocked', retryable: true, inputPreserved: true, billingMayHaveChanged: false, retryMayChargeAgain: false, safeActions: ['open_recovery', 'open_task_details'] },
    unsupported_operation: { category: 'unsupported', retryable: false, inputPreserved: true, billingMayHaveChanged: false, retryMayChargeAgain: false, safeActions: ['change_execution_target', 'open_task_details'] },
    unknown_error: { category: 'unknown', retryable: retryable === true, inputPreserved: true, billingMayHaveChanged: false, retryMayChargeAgain: false, safeActions: retryable === true ? ['retry', 'open_task_details'] : ['open_task_details'] },
  };
  return profiles[code] || profiles.unknown_error!;
};

const resolveErrorPhase = (
  code: PublicTaskErrorCode,
  requestedPhase: PublicTaskPhase,
): PublicTaskPhase => {
  if (isStableErrorCode(code)) return STABLE_PUBLIC_TASK_ERROR_MAPPINGS[code].publicPhase;
  if (code === 'permission_required' || code === 'insufficient_balance' || code === 'unsupported_operation') {
    return 'setup_required';
  }
  if (code === 'quote_expired') return 'waiting_confirmation';
  if (code === 'lease_lost') return 'manual_reconcile';
  return requestedPhase;
};

interface ErrorIdentity {
  runId?: string;
  jobId?: string;
  executionTarget?: AgentExecutionTarget;
  completedItemIds?: string[];
  incompleteItemIds?: string[];
}

const createTaskError = (
  code: PublicTaskErrorCode,
  requestedPhase: PublicTaskPhase,
  evidence: PublicTaskErrorEvidence,
  identity: ErrorIdentity,
): PublicTaskErrorProjectionDto => {
  const stable = isStableErrorCode(code) ? STABLE_PUBLIC_TASK_ERROR_MAPPINGS[code] : undefined;
  const profile = stable || standardErrorProfile(code, evidence.retryable);
  return {
    code,
    ...profile,
    publicPhase: resolveErrorPhase(code, requestedPhase),
    runId: identity.runId,
    jobId: identity.jobId,
    stepId: evidence.stepId,
    executionTarget: identity.executionTarget,
    providerId: evidence.providerId,
    modelId: evidence.modelId,
    completedItemIds: identity.completedItemIds,
    incompleteItemIds: identity.incompleteItemIds,
    safeActions: [...profile.safeActions],
  };
};

const phaseAndOutcome = (status: PublicTaskSourceStatus) => (
  ['completed', 'completed_with_errors', 'failed', 'cancelled'].includes(status)
    ? { phase: 'terminal' as const, terminalOutcome: status as PublicTaskTerminalOutcome }
    : { phase: status as Exclude<PublicTaskPhase, 'terminal'> }
);

const uniqueActions = (actions: PublicTaskAction[]): PublicTaskAction[] => [...new Set(actions)];

const generationActions = (
  phase: PublicTaskPhase,
  outcome: PublicTaskTerminalOutcome | undefined,
  retryable: boolean,
): PublicTaskAction[] => {
  if (phase === 'queued' || phase === 'running') return ['pause', 'cancel', 'open_task_details'];
  if (phase === 'paused') return ['resume', 'cancel', 'open_task_details'];
  if (phase === 'setup_required') return ['open_runtime_settings', 'open_task_details'];
  if (phase === 'manual_reconcile') return ['reconcile_manually', 'open_task_details'];
  if (phase === 'cancelling') return ['continue_waiting', 'open_task_details'];
  if (phase === 'terminal' && retryable && outcome !== 'cancelled') return ['retry', 'open_task_details'];
  return ['open_task_details'];
};

const generationBasePhase = (job: GenerationBatchJob) => {
  if (job.status === 'completed' || job.status === 'completed_with_errors'
    || job.status === 'failed' || job.status === 'cancelled') {
    return { phase: 'terminal' as const, terminalOutcome: job.status };
  }
  return { phase: job.status as 'queued' | 'running' | 'paused' };
};

const selectGenerationFailure = (job: GenerationBatchJob) => {
  const failures = job.prompts.filter((prompt) => prompt.status === 'failed');
  return failures.find((prompt) => prompt.reconciliationRequired)
    || failures.find((prompt) => prompt.errorCategory === 'authentication' || prompt.errorCategory === 'billing')
    || failures[failures.length - 1];
};

const generationError = (
  job: GenerationBatchJob,
  requestedPhase: PublicTaskPhase,
): PublicTaskErrorProjectionDto | undefined => {
  if (job.status === 'cancelled' || (job.status !== 'failed' && job.status !== 'completed_with_errors')) return undefined;
  const failed = selectGenerationFailure(job);
  const evidence: PublicTaskErrorEvidence = {
    category: failed?.errorCategory,
    retryable: failed?.retryable,
    reconciliationRequired: failed?.reconciliationRequired,
    modelId: job.options.modelId,
  };
  const code = evidence.reconciliationRequired
    ? 'ambiguous_side_effect'
    : codeForCategory(evidence.category);
  return createTaskError(code, requestedPhase, evidence, {
    jobId: job.id,
    completedItemIds: job.prompts.filter((prompt) => prompt.status === 'completed').map((prompt) => prompt.id),
    incompleteItemIds: job.prompts.filter((prompt) => prompt.status !== 'completed').map((prompt) => prompt.id),
  });
};

/** Read-only projection over DurableGenerationQueue; it never mutates or persists Job state. */
export function projectGenerationJobTask(job: GenerationBatchJob): GenerationTaskProjection {
  const baseState = generationBasePhase(job);
  const error = generationError(job, baseState.phase);
  const phase = error?.publicPhase || baseState.phase;
  const terminalOutcome = phase === 'terminal' ? baseState.terminalOutcome : undefined;
  const settled = job.progress.completed + job.progress.failed;
  const retryable = job.prompts.some((prompt) => prompt.status === 'failed' && prompt.retryable !== false);
  return {
    schemaVersion: 1,
    projectionId: `generation:${job.id}`,
    source: 'generation_job',
    jobId: job.id,
    phase,
    terminalOutcome,
    title: `${GENERATION_TASK_TITLES[job.taskType]} (${job.prompts.length} 项)`,
    allowedActions: generationActions(phase, terminalOutcome, retryable),
    progress: job.progress.total > 0 ? clampProgress(settled, job.progress.total) : undefined,
    error,
    createdAt: normalizeTimestamp(job.createdAt, 'generation createdAt'),
    updatedAt: normalizeTimestamp(job.updatedAt, 'generation updatedAt'),
  };
}

const latestAgentFailure = (run: AgentRunRecord): PublicTaskErrorEvidence | undefined => {
  const toolCall = [...run.toolCalls].reverse().find((call) => (
    Boolean(call.errorCode || call.failureClass)
    || ['failed', 'blocked', 'setup_required', 'verification_failed', 'retryable_failure'].includes(call.status)
  ));
  if (!toolCall) return undefined;
  return {
    code: toolCall.errorCode,
    category: toolCall.failureClass || (toolCall.status === 'setup_required' ? 'setup' : undefined),
    retryable: toolCall.retryable,
    stepId: toolCall.stepId,
  };
};

const agentError = (
  run: AgentRunRecord,
  requestedPhase: PublicTaskPhase,
): PublicTaskErrorProjectionDto | undefined => {
  if (run.status === 'cancelled' || run.status === 'completed') return undefined;
  const evidence = latestAgentFailure(run) || {};
  const code = run.status === 'waiting_for_device'
    ? 'requires_paired_desktop'
    : run.status === 'manual_reconcile'
      ? 'ambiguous_side_effect'
      : normalizeMachineErrorCode(evidence.code)
        || (run.status === 'failed' || run.status === 'completed_with_errors'
          ? codeForCategory(evidence.category)
          : undefined);
  if (!code) return undefined;
  return createTaskError(code, requestedPhase, evidence, {
    runId: run.id,
    executionTarget: run.executionTarget,
    completedItemIds: run.completedStepIds ? [...run.completedStepIds] : undefined,
    incompleteItemIds: run.stepResults
      ?.filter((step) => step.outcome !== 'success' && step.outcome !== 'partial_success')
      .map((step) => step.stepId),
  });
};

const agentActions = (phase: PublicTaskPhase): PublicTaskAction[] => {
  if (phase === 'waiting_confirmation') return ['confirm', 'cancel', 'open_task_details'];
  if (phase === 'waiting_for_device') return ['refresh_capabilities', 'open_pairing', 'cancel', 'open_task_details'];
  if (phase === 'waiting_execution' || phase === 'running') return ['cancel', 'open_task_details'];
  if (phase === 'verification_required' || phase === 'manual_reconcile') return ['reconcile_manually', 'open_task_details'];
  if (phase === 'setup_required') return ['open_runtime_settings', 'open_task_details'];
  return ['open_task_details'];
};

/** Read-only projection over AgentRunStore; remote Runs remain projection-only. */
export function projectAgentRunTask(run: AgentRunRecord): AgentTaskProjection {
  const baseState = phaseAndOutcome(run.status);
  const error = agentError(run, baseState.phase);
  const phase = error?.publicPhase || baseState.phase;
  const coverage = summarizeAgentRunCoverage(run);
  return {
    schemaVersion: 1,
    projectionId: `agent:${run.id}`,
    source: 'agent_run',
    runId: run.id,
    phase,
    terminalOutcome: phase === 'terminal' ? baseState.terminalOutcome : undefined,
    title: 'AI 助手任务',
    executionTarget: run.executionTarget,
    allowedActions: agentActions(phase),
    progress: coverage.totalSteps > 0
      ? clampProgress(coverage.processedSteps, coverage.totalSteps)
      : undefined,
    error,
    createdAt: normalizeTimestamp(run.createdAt, 'Agent Run createdAt'),
    updatedAt: normalizeTimestamp(run.updatedAt, 'Agent Run updatedAt'),
  };
}

const sourceError = (
  input: PublicTaskErrorEvidence,
  phase: PublicTaskPhase,
  identity: ErrorIdentity,
  failed: boolean,
): PublicTaskErrorProjectionDto | undefined => {
  const code = input.reconciliationRequired
    ? 'ambiguous_side_effect'
    : normalizeMachineErrorCode(input.code)
      || (failed ? codeForCategory(input.category) : undefined);
  return code ? createTaskError(code, phase, input, identity) : undefined;
};

/** Projects one paired command lease without treating the projection as execution authority. */
export function projectPairedCommandTask(input: PairedCommandTaskInput): PairedTaskProjection {
  const baseState = phaseAndOutcome(input.status);
  const error = input.status === 'waiting_for_device'
    ? createTaskError('requires_paired_desktop', baseState.phase, input, {
      runId: input.runId, executionTarget: 'paired-desktop',
    })
    : sourceError(input, baseState.phase, {
      runId: input.runId, executionTarget: 'paired-desktop',
    }, input.status === 'failed');
  const phase = error?.publicPhase || baseState.phase;
  return {
    schemaVersion: 1,
    projectionId: `paired:${input.commandId}`,
    source: 'paired_command',
    commandId: input.commandId,
    runId: input.runId,
    phase,
    terminalOutcome: phase === 'terminal' ? baseState.terminalOutcome : undefined,
    title: '配对桌面任务',
    executionTarget: 'paired-desktop',
    allowedActions: agentActions(phase),
    progress: input.progress ? clampProgress(input.progress.completed, input.progress.total) : undefined,
    error,
    createdAt: normalizeTimestamp(input.createdAt, 'paired command createdAt'),
    updatedAt: normalizeTimestamp(input.updatedAt, 'paired command updatedAt'),
  };
}

const localActions = (
  phase: PublicTaskPhase,
  retryable: boolean,
): PublicTaskAction[] => {
  if (phase === 'running' || phase === 'queued') return ['pause', 'cancel', 'open_task_details'];
  if (phase === 'paused') return ['resume', 'cancel', 'open_task_details'];
  if (phase === 'cancelling') return ['continue_waiting', 'open_task_details'];
  if (phase === 'setup_required') return ['open_runtime_settings', 'open_task_details'];
  if (phase === 'manual_reconcile') return ['reconcile_manually', 'open_task_details'];
  if (phase === 'terminal' && retryable) return ['retry', 'open_task_details'];
  return ['open_task_details'];
};

/** Projects legacy event tasks while leaving their session-only owner unchanged. */
export function projectLocalTask(input: LocalTaskInput): LocalTaskProjection {
  const baseState = phaseAndOutcome(input.status);
  const error = sourceError(input, baseState.phase, {
    executionTarget: input.executionTarget,
  }, input.status === 'failed' || input.status === 'completed_with_errors');
  const phase = error?.publicPhase || baseState.phase;
  const retryable = error?.retryable ?? (input.status === 'failed');
  return {
    schemaVersion: 1,
    projectionId: `local:${input.id}`,
    source: 'local_task',
    localTaskId: input.id,
    phase,
    terminalOutcome: phase === 'terminal' ? baseState.terminalOutcome : undefined,
    title: '本地任务',
    executionTarget: input.executionTarget,
    allowedActions: localActions(phase, retryable),
    progress: input.progress === undefined ? undefined : clampProgress(input.progress, 100),
    error,
    createdAt: normalizeTimestamp(input.createdAt, 'local task createdAt'),
    updatedAt: normalizeTimestamp(input.updatedAt ?? input.createdAt, 'local task updatedAt'),
  };
}

const UPDATE_PHASES: Record<PlatformUpdateStateDto['phase'], PublicTaskSourceStatus> = {
  idle: 'queued',
  checking: 'running',
  available: 'waiting_confirmation',
  downloading: 'running',
  ready: 'waiting_confirmation',
  draining: 'pausing',
  installing: 'running',
  relaunching: 'running',
  health_verifying: 'verifying',
  healthy: 'completed',
  degraded: 'completed_with_errors',
  recovery: 'manual_reconcile',
};

const UPDATE_ACTIONS: Record<PlatformUpdateStateDto['safeActions'][number], PublicTaskAction> = {
  retry_check: 'retry',
  continue_waiting: 'continue_waiting',
  cancel_update: 'cancel_update',
  force_exit: 'force_exit',
  open_task_details: 'open_task_details',
  open_recovery: 'open_task_details',
};

/** Projects updater state without granting install or process-lifecycle authority. */
export function projectAppUpdateTask(
  updateId: string,
  state: PlatformUpdateStateDto,
  createdAt: string | number,
): AppUpdateTaskProjection {
  const baseState = phaseAndOutcome(UPDATE_PHASES[state.phase]);
  const error = state.phase === 'recovery' || state.blockedReasonCode
    ? createTaskError('update_blocked', baseState.phase, { retryable: true }, {})
    : undefined;
  const phase = error?.publicPhase || baseState.phase;
  const installAction = state.phase === 'available' || state.phase === 'ready'
    ? ['install_update' as const]
    : [];
  return {
    schemaVersion: 1,
    projectionId: `update:${updateId}`,
    source: 'app_update',
    updateId,
    targetVersion: state.targetVersion || state.currentVersion,
    phase,
    terminalOutcome: phase === 'terminal' ? baseState.terminalOutcome : undefined,
    title: `KK Studio ${state.targetVersion || state.currentVersion} update`,
    allowedActions: uniqueActions([
      ...installAction,
      ...state.safeActions.map((action) => UPDATE_ACTIONS[action]),
      'open_task_details',
    ]),
    progress: state.progressPercent === undefined
      ? (state.phase === 'healthy' || state.phase === 'degraded' ? { completed: 100, total: 100 } : undefined)
      : clampProgress(state.progressPercent, 100),
    error,
    createdAt: normalizeTimestamp(createdAt, 'app update createdAt'),
    updatedAt: normalizeTimestamp(state.updatedAt, 'app update updatedAt'),
  };
}

/** Stable progress helper consumed by Task Center chrome and tray. */
export function getPublicTaskProgressPercent(task: PublicTaskProjectionDto): number {
  if (!task.progress) return task.phase === 'terminal' ? 100 : 0;
  return Math.round((task.progress.completed / task.progress.total) * 100);
}

export const getPublicTaskDisplayStatus = (
  task: PublicTaskProjectionDto,
): PublicTaskPhase | PublicTaskTerminalOutcome => task.terminalOutcome || task.phase;
