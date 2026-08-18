import type {
  PublicTaskAction,
  PublicTaskProjectionDto,
} from '@kk/shared';
import {
  agentRunStore,
  agentRuntimeInstance,
  durableGenerationQueue,
  type AgentRunRecord,
  type GenerationBatchJob,
} from '../ai-assistant-runtime/index.ts';
import {
  projectAgentRunTask,
  projectGenerationJobTask,
} from './publicTaskProjection.ts';

export type PublicTaskProjectionListener = (tasks: PublicTaskProjectionDto[]) => void;

const sortNewestFirst = (
  left: PublicTaskProjectionDto,
  right: PublicTaskProjectionDto,
): number => Date.parse(right.createdAt) - Date.parse(left.createdAt);

const projectStoreSnapshots = (
  jobs: readonly GenerationBatchJob[],
  runs: readonly AgentRunRecord[],
): PublicTaskProjectionDto[] => [
  ...jobs.map(projectGenerationJobTask),
  ...runs.map(projectAgentRunTask),
].sort(sortNewestFirst);

/** Returns a safe, read-only projection without exposing either authoritative store. */
export const getPublicTaskProjections = (): PublicTaskProjectionDto[] => (
  projectStoreSnapshots(durableGenerationQueue.getJobs(), agentRunStore.listRuns())
);

/** Subscribes to both stores but emits only strict public DTOs. */
export const subscribePublicTaskProjections = (
  listener: PublicTaskProjectionListener,
): (() => void) => {
  let jobs = durableGenerationQueue.getJobs();
  let runs = agentRunStore.listRuns();
  const emit = () => listener(projectStoreSnapshots(jobs, runs));
  const unsubscribeJobs = durableGenerationQueue.subscribe((nextJobs) => {
    jobs = nextJobs;
    emit();
  });
  const unsubscribeRuns = agentRunStore.subscribe((nextRuns) => {
    runs = nextRuns;
    emit();
  });
  return () => {
    unsubscribeJobs();
    unsubscribeRuns();
  };
};

const dispatchGenerationAction = (
  jobId: string,
  action: PublicTaskAction,
): boolean => {
  if (action === 'pause') durableGenerationQueue.pauseJob(jobId);
  else if (action === 'resume') durableGenerationQueue.resumeJob(jobId);
  else if (action === 'retry') durableGenerationQueue.retryFailedPrompts(jobId);
  else if (action === 'cancel') durableGenerationQueue.cancelJob(jobId);
  else return false;
  return true;
};

const resolveCurrentTaskProjection = (
  task: PublicTaskProjectionDto,
): PublicTaskProjectionDto | undefined => {
  if (task.source === 'generation_job') {
    const job = durableGenerationQueue.getJob(task.jobId);
    return job ? projectGenerationJobTask(job) : undefined;
  }
  if (task.source === 'agent_run') {
    const run = agentRunStore.getRun(task.runId);
    return run ? projectAgentRunTask(run) : undefined;
  }
  return undefined;
};

/** A public DTO is only an identifier; current Store state remains the action authority. */
export const isPublicTaskActionCurrentlyAllowed = (
  requestedTask: PublicTaskProjectionDto,
  action: PublicTaskAction,
  currentTask: PublicTaskProjectionDto | undefined,
): boolean => Boolean(
  currentTask
  && currentTask.source === requestedTask.source
  && currentTask.projectionId === requestedTask.projectionId
  && currentTask.allowedActions.includes(action)
);

/** Routes an allowed public action by stable identity; the DTO grants no authority itself. */
export const dispatchPublicTaskAction = async (
  task: PublicTaskProjectionDto,
  action: PublicTaskAction,
): Promise<boolean> => {
  const currentTask = resolveCurrentTaskProjection(task);
  if (!isPublicTaskActionCurrentlyAllowed(task, action, currentTask)) return false;
  if (task.source === 'generation_job') {
    return dispatchGenerationAction(task.jobId, action);
  }
  if (task.source === 'agent_run' && action === 'cancel') {
    await agentRuntimeInstance.cancelPendingRun(task.runId);
    return true;
  }
  return false;
};

/** Archives presentation history without changing active task execution. */
export const archivePublicTaskProjection = (task: PublicTaskProjectionDto): boolean => {
  if (task.phase !== 'terminal') return false;
  if (task.source === 'generation_job') return durableGenerationQueue.archiveJob(task.jobId);
  if (task.source === 'agent_run') return agentRunStore.archiveRun(task.runId);
  return false;
};

/** Clears only finished records from the existing authoritative stores. */
export const archiveFinishedPublicTaskProjections = (): void => {
  durableGenerationQueue.archiveFinishedJobs();
  agentRunStore.archiveFinishedRuns();
};
