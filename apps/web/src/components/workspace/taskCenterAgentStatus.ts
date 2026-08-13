import type { AgentRunStatus } from '@kk/shared';

export type TaskCenterAgentActivityStatus =
  | 'queued'
  | 'waiting_confirmation'
  | 'running'
  | 'completed'
  | 'completed_with_errors'
  | 'failed'
  | 'cancelled';

/** Keeps the existing Task Center display stable while covering every Run state. */
export const TASK_CENTER_AGENT_STATUS_BY_RUN_STATUS = {
  planning: 'queued',
  waiting_confirmation: 'waiting_confirmation',
  waiting_for_device: 'queued',
  waiting_execution: 'queued',
  running: 'running',
  verifying: 'running',
  verification_required: 'waiting_confirmation',
  manual_reconcile: 'failed',
  completed: 'completed',
  completed_with_errors: 'completed_with_errors',
  failed: 'failed',
  cancelled: 'cancelled',
} as const satisfies Record<AgentRunStatus, TaskCenterAgentActivityStatus>;

export const mapAgentRunStatusToTaskCenterStatus = (
  status: AgentRunStatus,
): TaskCenterAgentActivityStatus => TASK_CENTER_AGENT_STATUS_BY_RUN_STATUS[status];
