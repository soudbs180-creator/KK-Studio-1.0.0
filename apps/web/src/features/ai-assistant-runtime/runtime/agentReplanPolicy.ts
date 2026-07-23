import type { AgentFailureClass, AgentStepResultDto } from '@kk/shared';
import type { AgentPlanStep, AssistantAction, AssistantPlan } from '../../ai-takeover/types.ts';
import {
  createAssistantPlanHash,
  createAssistantTargetSnapshotHash,
  type AssistantAuthorizationScopeSnapshot,
} from './AssistantExecutionContext.ts';
import {
  hasLocalAgentRunExecutionAuthority,
  type AgentRunRecord,
} from './AgentRunStore.ts';

export const MAX_AGENT_REPLANS = 3;

export interface AgentReplanRecoveryEvidence {
  failedJobIds: readonly string[];
  recoveredStepIds: readonly string[];
}

export type AgentReplanBlockReason =
  | 'server_projection'
  | 'run_cancelled'
  | 'run_not_active'
  | 'failure_not_retryable'
  | 'unsafe_failure_class'
  | 'recovery_incomplete'
  | 'scope_changed'
  | 'replan_limit_reached'
  | 'authoritative_baseline_unavailable'
  | 'planner_failed'
  | 'server_rejected_replacement'
  | 'local_state_changed';

export type AgentReplanDecision =
  | { allowed: true }
  | { allowed: false; reason: AgentReplanBlockReason };

export interface AgentReplanPolicyInput {
  record: AgentRunRecord;
  failure: AgentStepResultDto;
  failureClass?: AgentFailureClass;
  recovery: AgentReplanRecoveryEvidence;
  initialScope: AssistantAuthorizationScopeSnapshot;
  currentScope: AssistantAuthorizationScopeSnapshot;
}

const UNSAFE_FAILURE_CLASSES = new Set<AgentFailureClass>([
  'validation',
  'permission',
  'setup',
  'cancelled',
  'unknown',
]);

const sameScope = (
  left: AssistantAuthorizationScopeSnapshot,
  right: AssistantAuthorizationScopeSnapshot,
): boolean => createAssistantTargetSnapshotHash(left) === createAssistantTargetSnapshotHash(right);

/** Allows automatic replanning only when failure and live scope evidence are safe. */
export function evaluateAgentReplanPolicy(input: AgentReplanPolicyInput): AgentReplanDecision {
  if (!hasLocalAgentRunExecutionAuthority(input.record)) {
    return { allowed: false, reason: 'server_projection' };
  }
  if (input.record.status === 'cancelled' || input.failure.outcome === 'cancelled') {
    return { allowed: false, reason: 'run_cancelled' };
  }
  if (!['running', 'waiting_execution'].includes(input.record.status)) {
    return { allowed: false, reason: 'run_not_active' };
  }
  if (input.failureClass && UNSAFE_FAILURE_CLASSES.has(input.failureClass)) {
    return { allowed: false, reason: 'unsafe_failure_class' };
  }
  if (input.recovery.failedJobIds.length > 0) {
    return { allowed: false, reason: 'recovery_incomplete' };
  }
  if (!sameScope(input.initialScope, input.currentScope)) {
    return { allowed: false, reason: 'scope_changed' };
  }
  const retryable = input.failure.outcome === 'retryable_failure' && input.failure.retryable === true;
  const rolledBack = input.failure.outcome === 'rolled_back_failure'
    && input.recovery.recoveredStepIds.includes(input.failure.stepId);
  return retryable || rolledBack
    ? { allowed: true }
    : { allowed: false, reason: 'failure_not_retryable' };
}

export interface AgentReplacementPlanInput {
  runId: string;
  previousPlan: AssistantPlan;
  candidatePlan: AssistantPlan;
  completedStepIds: readonly string[];
  failedStepId: string;
  nextReplanCount: 1 | 2 | 3;
}

const actionFingerprint = (action: AssistantAction): string => createAssistantPlanHash(action);

function assignReplacementStepIds(input: AgentReplacementPlanInput): Map<string, string | null> {
  const previousSteps = input.previousPlan.steps || [];
  const candidateSteps = input.candidatePlan.steps || [];
  const completedIds = new Set(input.completedStepIds);
  const completedActions = new Set(previousSteps
    .filter((step) => completedIds.has(step.stepId))
    .map((step) => actionFingerprint(step.action)));
  const failedAction = previousSteps.find((step) => step.stepId === input.failedStepId)?.action;
  const failedFingerprint = failedAction ? actionFingerprint(failedAction) : '';
  const assignments = new Map<string, string | null>();
  let failedStepReused = false;
  let nextStepIndex = 0;
  for (const step of candidateSteps) {
    const fingerprint = actionFingerprint(step.action);
    if (!failedStepReused && failedFingerprint && fingerprint === failedFingerprint) {
      assignments.set(step.stepId, input.failedStepId);
      failedStepReused = true;
    } else if (completedActions.has(fingerprint)) {
      assignments.set(step.stepId, null);
    } else {
      nextStepIndex += 1;
      assignments.set(step.stepId, `${input.runId}:replan:${input.nextReplanCount}:step:${nextStepIndex}`);
    }
  }
  return assignments;
}

function projectReplacementSteps(
  candidateSteps: AgentPlanStep[],
  assignments: ReadonlyMap<string, string | null>,
): AgentPlanStep[] {
  return candidateSteps.flatMap((step) => {
    const stepId = assignments.get(step.stepId);
    if (!stepId) return [];
    const dependsOn = step.dependsOn.flatMap((dependency) => {
      const mapped = assignments.get(dependency);
      return mapped ? [mapped] : [];
    });
    return [{ ...step, stepId, dependsOn, idempotencyKey: stepId }];
  });
}

/** Rebases a Planner candidate without replaying completed work or changing a retry idempotency key. */
export function buildAgentReplacementPlan(input: AgentReplacementPlanInput): AssistantPlan {
  const candidateSteps = input.candidatePlan.steps || [];
  if (candidateSteps.length === 0) {
    throw new TypeError('Replacement Planner output must contain at least one normalized step.');
  }
  const assignments = assignReplacementStepIds(input);
  const steps = projectReplacementSteps(candidateSteps, assignments);
  if (steps.length === 0) {
    throw new TypeError('Replacement plan cannot consist only of already completed actions.');
  }
  return {
    ...input.candidatePlan,
    version: 2,
    id: `${input.runId}:plan:replan:${input.nextReplanCount}`,
    actions: steps.map((step) => step.action),
    steps,
    maxReplans: MAX_AGENT_REPLANS,
    requiresConfirmation: false,
    confirmation: undefined,
  };
}
