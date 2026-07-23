import type { AgentPlanStep, AssistantAction, AssistantPlan } from '../../ai-takeover/types.ts';
import type { DurableGenerationQueue } from '../queue/DurableGenerationQueue.ts';
import { toolRegistryInstance } from '../tools/ToolRegistry.ts';
import { createRunStepIdempotencyKey } from './AssistantExecutionContext.ts';

export type AgentPlanningQueue = Pick<DurableGenerationQueue, 'getJob' | 'getJobs'>;

const retryableFailedPromptIds = (job: ReturnType<AgentPlanningQueue['getJob']>): string[] => (
  (job?.prompts || [])
    .filter((prompt) => prompt.status === 'failed' && prompt.retryable !== false)
    .map((prompt) => prompt.id)
    .sort()
);

const freezeRetryActionTarget = (
  action: AssistantAction,
  queue: AgentPlanningQueue,
): AssistantAction => {
  if (action.type !== 'generation.retryJob') return action;
  const payload = (action.payload || {}) as Record<string, unknown>;
  const explicitJobId = String(payload.jobId || '').trim();
  const job = explicitJobId
    ? queue.getJob(explicitJobId)
    : queue.getJobs()
        .filter((candidate) => candidate.status !== 'cancelled' && retryableFailedPromptIds(candidate).length > 0)
        .sort((left, right) => right.updatedAt - left.updatedAt || left.id.localeCompare(right.id))[0];
  if (!job) {
    throw new Error(explicitJobId
      ? `Generation retry target not found: ${explicitJobId}.`
      : 'Generation retry target not found: no retryable failed durable job.');
  }
  const expectedRetryablePromptIds = retryableFailedPromptIds(job);
  if (expectedRetryablePromptIds.length === 0) {
    throw new Error(`Generation job ${job.id} has no retryable failed items.`);
  }
  const { target: _dynamicTarget, ...frozenPayload } = payload;
  return {
    ...action,
    payload: {
      ...frozenPayload,
      jobId: job.id,
      expectedUpdatedAt: job.updatedAt,
      expectedRetryablePromptIds,
    },
  };
};

/** Freezes dynamic durable retry targets before a plan can be previewed or executed. */
export const freezeAgentPlanExecutionTargets = (
  plan: AssistantPlan,
  queue: AgentPlanningQueue,
): AssistantPlan => ({
  ...plan,
  actions: (plan.actions || []).map((action) => freezeRetryActionTarget(action, queue)),
  steps: (plan.steps || []).map((step) => ({
    ...step,
    action: freezeRetryActionTarget(step.action, queue),
  })),
});

const isKnowledgeWrite = (action: AssistantAction): boolean => action.type === 'knowledge.recordChange';

const verificationRuleForAction = (action: AssistantAction): AgentPlanStep['verification']['rule'] => {
  if (action.type.startsWith('generation.') || action.type === 'startGeneration' || action.type === 'startBatchGeneration') {
    return 'queue_job';
  }
  if (action.type.startsWith('canvas.') || action.type === 'locateCard') return 'canvas_state';
  if (action.type === 'assets.zipOriginals' || action.type === 'zipOutputs') return 'asset_manifest';
  return 'tool';
};

/** Normalizes legacy action arrays and explicit step graphs into one executable step contract. */
export const normalizeAgentPlanSteps = (plan: AssistantPlan): AgentPlanStep[] => {
  const sourceSteps = Array.isArray(plan.steps) && plan.steps.length > 0
    ? plan.steps.map((step, index) => ({
        ...step,
        stepId: step.stepId || `${plan.id}:step:${index + 1}`,
        dependsOn: Array.isArray(step.dependsOn) ? [...step.dependsOn] : [],
        idempotencyKey: step.idempotencyKey || `${plan.id}:step:${index + 1}`,
        verification: step.verification || {
          required: true,
          rule: verificationRuleForAction(step.action),
        },
      }))
    : [...(plan.actions || [])]
        .sort((left, right) => Number(isKnowledgeWrite(left)) - Number(isKnowledgeWrite(right)))
        .map((action, index) => ({
          stepId: `${plan.id}:step:${index + 1}`,
          action,
          dependsOn: index === 0 ? [] : [`${plan.id}:step:${index}`],
          idempotencyKey: `${plan.id}:${action.type}:${index + 1}`,
          verification: { required: true, rule: verificationRuleForAction(action) },
        }));
  const nonKnowledgeStepIds = sourceSteps
    .filter((step) => !isKnowledgeWrite(step.action))
    .map((step) => step.stepId);
  return sourceSteps.map((step) => isKnowledgeWrite(step.action)
    ? { ...step, dependsOn: Array.from(new Set([...step.dependsOn, ...nonKnowledgeStepIds])) }
    : step);
};

/** Rejects oversized graphs and invalid step identities or dependency references. */
export function validateAgentStepGraph(steps: AgentPlanStep[], maxSteps = 20): void {
  if (steps.length > maxSteps) throw new Error(`Agent plan exceeds the ${maxSteps}-step execution limit.`);
  const ids = new Set<string>();
  for (const step of steps) {
    if (ids.has(step.stepId)) throw new Error(`Duplicate agent stepId: ${step.stepId}`);
    ids.add(step.stepId);
  }
  for (const step of steps) {
    for (const dependency of step.dependsOn) {
      if (!ids.has(dependency)) throw new Error(`Unknown dependency ${dependency} for step ${step.stepId}`);
      if (dependency === step.stepId) throw new Error(`Step ${step.stepId} cannot depend on itself.`);
    }
  }
}

/** Replaces Planner-provided idempotency values with the Run/step execution identity. */
export const createAgentStepPayload = (step: AgentPlanStep, runId?: string): Record<string, unknown> => {
  const payload: Record<string, unknown> = { ...(step.action.payload || {}) };
  payload.idempotencyKey = runId
    ? createRunStepIdempotencyKey(runId, step.stepId)
    : step.idempotencyKey;
  return payload;
};

/** Validates every effective tool input before confirmation or execution begins. */
export function validateAgentPlanStepInputs(runId: string, steps: AgentPlanStep[]): void {
  for (const step of steps) {
    const tool = toolRegistryInstance.getTool(step.action.type);
    if (!tool) throw new TypeError(`Unknown Agent tool in plan: ${step.action.type}`);
    tool.inputValidator.parse(createAgentStepPayload(step, runId));
  }
}
