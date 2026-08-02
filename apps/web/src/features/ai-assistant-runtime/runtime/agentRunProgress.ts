import type { AgentStepOutcome, AgentStepResultDto } from '@kk/shared';
import type { AgentPlanStep } from '../../ai-takeover/types.ts';

/** Safe run fields used to derive local progress without trusting remote plan content. */
export interface AgentRunCoverageInput {
  status: string;
  totalSteps?: number;
  completedStepIds?: readonly string[];
  stepResults?: readonly AgentStepResultDto[];
}

/** User-facing state derived from authoritative status and per-step evidence. */
export type AgentRunCoverageState =
  | 'empty'
  | 'pending'
  | 'in_progress'
  | 'partial'
  | 'completed'
  | 'failed'
  | 'cancelled';

export type AgentRunStepCoverageStatus =
  | 'completed'
  | 'partial_success'
  | 'retryable_failure'
  | 'rolled_back_failure'
  | 'cancelled'
  | 'pending'
  | 'blocked';

/** Normalized coverage state for one locally known or remotely projected step. */
export interface AgentRunStepCoverage {
  stepId: string;
  status: AgentRunStepCoverageStatus;
  outcome?: AgentStepOutcome;
}

/** Deterministic progress and recovery projection shared by runtime and Task Center. */
export interface AgentRunCoverageSummary {
  state: AgentRunCoverageState;
  totalSteps: number;
  processedSteps: number;
  completedSteps: number;
  partialSuccessSteps: number;
  failedSteps: number;
  retryableFailureSteps: number;
  rolledBackSteps: number;
  cancelledSteps: number;
  pendingSteps: number;
  blockedSteps: number;
  progressPercent: number;
  canRetry: boolean;
  readyStepIds: string[];
  blockedStepIds: string[];
  stepStatuses: AgentRunStepCoverage[];
  latestFailure?: AgentStepResultDto;
}

const FAILURE_STATUSES = new Set<AgentRunStepCoverageStatus>([
  'retryable_failure',
  'rolled_back_failure',
  'cancelled',
]);

const isFailureStatus = (status: AgentRunStepCoverageStatus): boolean => FAILURE_STATUSES.has(status);

const statusForOutcome = (outcome: AgentStepOutcome): AgentRunStepCoverageStatus => (
  outcome === 'success' ? 'completed' : outcome
);

type IndexedStepResult = { result: AgentStepResultDto; index: number };

const latestResultsByStepId = (
  results: readonly AgentStepResultDto[],
): Map<string, IndexedStepResult> => {
  const latest = new Map<string, IndexedStepResult>();
  results.forEach((result, index) => latest.set(result.stepId, { result, index }));
  return latest;
};

const uniquePlanSteps = (steps: readonly AgentPlanStep[]): AgentPlanStep[] => {
  const seen = new Set<string>();
  return steps.filter((step) => {
    if (seen.has(step.stepId)) return false;
    seen.add(step.stepId);
    return true;
  });
};

const createKnownStepStatusMap = (
  input: AgentRunCoverageInput,
  steps: readonly AgentPlanStep[],
  latestResults: Map<string, IndexedStepResult>,
): Map<string, AgentRunStepCoverageStatus> => {
  const completedIds = new Set(input.completedStepIds || []);
  return new Map(uniquePlanSteps(steps).map((step) => {
    const result = latestResults.get(step.stepId)?.result;
    const status = result
      ? statusForOutcome(result.outcome)
      : completedIds.has(step.stepId)
        ? 'completed'
        : 'pending';
    return [step.stepId, status];
  }));
};

const markBlockedDependencies = (
  steps: readonly AgentPlanStep[],
  statuses: Map<string, AgentRunStepCoverageStatus>,
): void => {
  let changed = true;
  while (changed) {
    changed = false;
    for (const step of steps) {
      if (statuses.get(step.stepId) !== 'pending') continue;
      const blockedByDependency = step.dependsOn.some((dependency) => {
        const dependencyStatus = statuses.get(dependency);
        return dependencyStatus === undefined
          || dependencyStatus === 'blocked'
          || (dependencyStatus !== undefined && isFailureStatus(dependencyStatus));
      });
      if (!blockedByDependency) continue;
      statuses.set(step.stepId, 'blocked');
      changed = true;
    }
  }
};

const createKnownStepStatuses = (
  input: AgentRunCoverageInput,
  steps: readonly AgentPlanStep[],
  latestResults: Map<string, IndexedStepResult>,
): AgentRunStepCoverage[] => {
  const knownSteps = uniquePlanSteps(steps);
  const statuses = createKnownStepStatusMap(input, knownSteps, latestResults);
  markBlockedDependencies(knownSteps, statuses);

  return knownSteps.map((step) => {
    const result = latestResults.get(step.stepId)?.result;
    return {
      stepId: step.stepId,
      status: statuses.get(step.stepId) || 'blocked',
      outcome: result?.outcome,
    };
  });
};

const createProjectionStepStatuses = (
  input: AgentRunCoverageInput,
  latestResults: Map<string, IndexedStepResult>,
): AgentRunStepCoverage[] => {
  const resultStepIds = [...latestResults.keys()];
  const completedIds = [...new Set(input.completedStepIds || [])];
  const stepIds = [...new Set([...resultStepIds, ...completedIds])].sort();
  return stepIds.map((stepId) => {
    const result = latestResults.get(stepId)?.result;
    return {
      stepId,
      status: result ? statusForOutcome(result.outcome) : 'completed',
      outcome: result?.outcome,
    };
  });
};

const resolveCoverageState = (
  input: AgentRunCoverageInput,
  summary: Pick<AgentRunCoverageSummary, 'totalSteps' | 'processedSteps' | 'pendingSteps' | 'blockedSteps' | 'failedSteps'>,
): AgentRunCoverageState => {
  if (input.status === 'cancelled') return 'cancelled';
  if (input.status === 'failed') return 'failed';
  if (
    input.status === 'completed'
    && summary.failedSteps === 0
    && summary.pendingSteps === 0
    && summary.blockedSteps === 0
  ) {
    return 'completed';
  }
  if (input.status === 'completed_with_errors') return 'partial';
  if (summary.totalSteps === 0) return 'empty';
  if (summary.processedSteps === 0 && input.status !== 'running') return 'pending';
  return 'in_progress';
};

interface CoverageCounts {
  processedSteps: number;
  completedSteps: number;
  partialSuccessSteps: number;
  failedSteps: number;
  retryableFailureSteps: number;
  rolledBackSteps: number;
  cancelledSteps: number;
  pendingSteps: number;
  blockedSteps: number;
}

const countCoverageStatuses = (
  stepStatuses: readonly AgentRunStepCoverage[],
  totalSteps: number,
): CoverageCounts => {
  const counts: CoverageCounts = {
    processedSteps: 0,
    completedSteps: 0,
    partialSuccessSteps: 0,
    failedSteps: 0,
    retryableFailureSteps: 0,
    rolledBackSteps: 0,
    cancelledSteps: 0,
    pendingSteps: 0,
    blockedSteps: 0,
  };
  for (const step of stepStatuses) {
    if (step.status === 'completed' || step.status === 'partial_success') counts.completedSteps += 1;
    if (step.status === 'partial_success') counts.partialSuccessSteps += 1;
    if (step.status === 'retryable_failure') counts.retryableFailureSteps += 1;
    if (step.status === 'rolled_back_failure') counts.rolledBackSteps += 1;
    if (step.status === 'cancelled') counts.cancelledSteps += 1;
    if (step.status === 'pending') counts.pendingSteps += 1;
    if (step.status === 'blocked') counts.blockedSteps += 1;
  }
  counts.failedSteps = counts.retryableFailureSteps + counts.rolledBackSteps + counts.cancelledSteps;
  counts.pendingSteps = Math.max(
    counts.pendingSteps,
    totalSteps - counts.completedSteps - counts.failedSteps - counts.blockedSteps,
  );
  counts.processedSteps = Math.min(totalSteps, counts.completedSteps + counts.failedSteps);
  return counts;
};

const readyStepIdsFor = (
  stepStatuses: readonly AgentRunStepCoverage[],
  steps: readonly AgentPlanStep[],
): string[] => {
  const statusByStepId = new Map(stepStatuses.map((step) => [step.stepId, step.status]));
  const planByStepId = new Map(uniquePlanSteps(steps).map((step) => [step.stepId, step]));
  return stepStatuses
    .filter((step) => step.status === 'pending')
    .filter((step) => {
      const planStep = planByStepId.get(step.stepId);
      return planStep?.dependsOn.every((dependency) => {
        const dependencyStatus = statusByStepId.get(dependency);
        return dependencyStatus === 'completed' || dependencyStatus === 'partial_success';
      }) ?? false;
    })
    .map((step) => step.stepId);
};

const latestFailureFor = (
  latestResults: Map<string, IndexedStepResult>,
  stepStatuses: readonly AgentRunStepCoverage[],
  hasPlan: boolean,
): AgentStepResultDto | undefined => {
  const knownStepIds = new Set(stepStatuses.map((step) => step.stepId));
  let latestFailure: IndexedStepResult | undefined;
  for (const candidate of latestResults.values()) {
    const isFailure = candidate.result.outcome !== 'success'
      && candidate.result.outcome !== 'partial_success';
    if ((!hasPlan || knownStepIds.has(candidate.result.stepId)) && isFailure) {
      if (!latestFailure || candidate.index > latestFailure.index) latestFailure = candidate;
    }
  }
  return latestFailure?.result;
};

/**
 * Derives a deterministic coverage view without trusting remote plan content.
 * The optional step graph is used only for locally validated execution.
 */
export function summarizeAgentRunCoverage(
  input: AgentRunCoverageInput,
  steps: readonly AgentPlanStep[] = [],
): AgentRunCoverageSummary {
  const results = input.stepResults || [];
  const latestResults = latestResultsByStepId(results);
  const stepStatuses = steps.length > 0
    ? createKnownStepStatuses(input, steps, latestResults)
    : createProjectionStepStatuses(input, latestResults);
  const totalSteps = Math.max(
    0,
    Number.isFinite(Number(input.totalSteps)) ? Number(input.totalSteps) : 0,
    stepStatuses.length,
  );
  const counts = countCoverageStatuses(stepStatuses, totalSteps);
  const readyStepIds = steps.length > 0 ? readyStepIdsFor(stepStatuses, steps) : [];
  const blockedStepIds = stepStatuses
    .filter((step) => step.status === 'blocked')
    .map((step) => step.stepId);
  const latestFailure = latestFailureFor(latestResults, stepStatuses, steps.length > 0);
  const state = resolveCoverageState(input, {
    totalSteps,
    ...counts,
  });

  return {
    state,
    totalSteps,
    ...counts,
    progressPercent: totalSteps > 0 ? Math.round((counts.processedSteps / totalSteps) * 100) : 0,
    canRetry: counts.retryableFailureSteps > 0,
    readyStepIds,
    blockedStepIds,
    stepStatuses,
    latestFailure,
  };
}
