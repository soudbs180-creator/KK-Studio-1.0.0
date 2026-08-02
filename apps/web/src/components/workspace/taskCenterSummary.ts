import {
  summarizeAgentRunCoverage,
  type AgentRunCoverageInput,
} from '../../features/ai-assistant-runtime/runtime/agentRunProgress.ts';

export interface GenerationSummaryInput {
  status: string;
  progress?: { percent?: number };
  prompts: ReadonlyArray<{ status: string }>;
}

export interface AgentSummaryInput extends AgentRunCoverageInput {}

export interface TaskCenterSummary {
  activeCount: number;
  averageProgress: number;
  hasAttentionRequired: boolean;
}

const ACTIVE_GENERATION_STATUSES = new Set(['queued', 'running', 'paused']);
const ACTIVE_AGENT_STATUSES = new Set([
  'planning',
  'waiting_execution',
  'waiting_confirmation',
  'running',
  'paused',
]);

function generationProgress(job: GenerationSummaryInput): number {
  if (typeof job.progress?.percent === 'number') return job.progress.percent;
  if (job.prompts.length === 0) return 0;
  const settled = job.prompts.filter((prompt) => ['completed', 'failed'].includes(prompt.status)).length;
  return Math.round((settled / job.prompts.length) * 100);
}

function agentProgress(run: AgentSummaryInput): number {
  return summarizeAgentRunCoverage(run).progressPercent;
}

/** Projects the two authoritative task stores into compact chrome telemetry. */
export function summarizeTaskCenterActivity(
  jobs: readonly GenerationSummaryInput[],
  runs: readonly AgentSummaryInput[],
): TaskCenterSummary {
  const activeJobs = jobs.filter((job) => ACTIVE_GENERATION_STATUSES.has(job.status));
  const activeRuns = runs.filter((run) => ACTIVE_AGENT_STATUSES.has(run.status));
  const progressValues = [
    ...activeJobs.map(generationProgress),
    ...activeRuns.map(agentProgress),
  ];

  return {
    activeCount: progressValues.length,
    averageProgress: progressValues.length > 0
      ? Math.round(progressValues.reduce((sum, value) => sum + value, 0) / progressValues.length)
      : 0,
    hasAttentionRequired: activeRuns.some((run) => run.status === 'waiting_confirmation'),
  };
}
