import type { PublicTaskProjectionDto } from '@kk/shared';
import { getPublicTaskProgressPercent } from '../../features/tasks/publicTaskProjection.ts';

export interface TaskCenterSummary {
  activeCount: number;
  averageProgress: number;
  hasAttentionRequired: boolean;
}

const ACTIVE_TASK_PHASES = new Set<PublicTaskProjectionDto['phase']>([
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
]);

/** Summarizes only safe public projections for compact desktop chrome telemetry. */
export function summarizeTaskCenterActivity(
  tasks: readonly PublicTaskProjectionDto[],
): TaskCenterSummary {
  const activeTasks = tasks.filter((task) => ACTIVE_TASK_PHASES.has(task.phase));
  const progressValues = activeTasks.map(getPublicTaskProgressPercent);

  return {
    activeCount: progressValues.length,
    averageProgress: progressValues.length > 0
      ? Math.round(progressValues.reduce((sum, value) => sum + value, 0) / progressValues.length)
      : 0,
    hasAttentionRequired: activeTasks.some((task) => [
      'waiting_confirmation',
      'waiting_for_device',
      'setup_required',
      'verification_required',
      'manual_reconcile',
    ].includes(task.phase)),
  };
}
