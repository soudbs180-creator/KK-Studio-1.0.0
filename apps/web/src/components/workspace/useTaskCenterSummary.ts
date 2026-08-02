import React from 'react';

import {
  agentRunStore,
  durableGenerationQueue,
  type AgentRunRecord,
  type GenerationBatchJob,
} from '../../features/ai-assistant-runtime';
import { summarizeTaskCenterActivity, type TaskCenterSummary } from './taskCenterSummary';

/** Subscribes to existing stores without creating another task-state owner. */
export function useTaskCenterSummary(): TaskCenterSummary {
  const [jobs, setJobs] = React.useState<GenerationBatchJob[]>(() => durableGenerationQueue.getJobs());
  const [runs, setRuns] = React.useState<AgentRunRecord[]>(() => agentRunStore.listRuns());

  React.useEffect(() => durableGenerationQueue.subscribe(setJobs), []);
  React.useEffect(() => agentRunStore.subscribe(setRuns), []);

  return React.useMemo(() => summarizeTaskCenterActivity(jobs, runs), [jobs, runs]);
}
