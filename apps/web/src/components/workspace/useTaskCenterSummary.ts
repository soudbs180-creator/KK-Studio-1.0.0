import React from 'react';

import { usePublicTaskProjections } from '../../features/tasks/usePublicTaskProjections.ts';
import { summarizeTaskCenterActivity, type TaskCenterSummary } from './taskCenterSummary';

/** Summarizes the shared public projection without exposing Run or Job internals to chrome. */
export function useTaskCenterSummary(): TaskCenterSummary {
  const tasks = usePublicTaskProjections();
  return React.useMemo(() => summarizeTaskCenterActivity(tasks), [tasks]);
}
