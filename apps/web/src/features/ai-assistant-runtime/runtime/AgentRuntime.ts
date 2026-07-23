import type {
  AgentPlanStep,
  AgentToolCallLog,
  AssistantAction,
  AssistantPlan,
  SanitizedProjectContext,
} from '../../ai-takeover/types.ts';
import type { AgentStepOutcome, AgentStepResultDto } from '@kk/shared';
import { LocalAssistantBrain } from '../../ai-takeover/core/localBrain.ts';
import { LLMBrain } from '../../ai-takeover/core/llmBrain.ts';
import { buildAgentContextSnapshotInput } from '../../ai-takeover/core/agentContextSnapshot.ts';
import {
  applyAgentPlannerReferenceContext,
  enforceAgentPlannerReferencePolicy,
} from '../../ai-takeover/core/agentPlannerReferencePolicy.ts';
import {
  applyAgentPlannerCapabilityContext,
  enforceAgentPlannerCapabilityPolicy,
  resolveAgentPlannerCapabilityContext,
} from '../../ai-takeover/core/agentPlannerCapabilityContext.ts';
import { agentPermissionPolicy } from './AgentPermissionPolicy.ts';
import {
  agentRunStore,
  hasLocalAgentRunExecutionAuthority,
  type AgentRunRecord,
} from './AgentRunStore.ts';
import { redactToolText, toolRegistryInstance } from '../tools/ToolRegistry.ts';
import { writeHandoff } from '../memory/handoffWriter.ts';
import { kkWebApiClient } from '../../../services/api/kkApiClient.ts';
import { getRuntimeOwnerId } from '../../../services/auth/runtimeSessionProfile.ts';
import {
  hydrateAgentRunProjection,
  type AgentRunHydrationResult,
} from './agentRunHydration.ts';
import { refreshAgentRunEventProjection } from './agentRunEventRecovery.ts';
import {
  agentSessionProjectionStore,
  hydrateAgentSessionProjection,
  type AgentSessionHydrationResult,
} from './agentSessionProjection.ts';
import { resolveAgentPlannerSessionContext } from './agentPlannerSessionContext.ts';
import {
  appendAgentContextSnapshotProjection,
  hydrateAgentContextSnapshotProjection,
} from './agentContextSnapshotProjection.ts';
import {
  durableGenerationQueue,
  type DurableGenerationQueue,
} from '../queue/DurableGenerationQueue.ts';
import type {
  AssistantAuthorizationScopeSnapshot,
  AssistantConfirmationGrant,
  AssistantExecutionContext,
  AssistantToolExecutionContext,
} from './AssistantExecutionContext.ts';
import {
  captureAssistantAuthorizationScope,
  createAssistantStepAuthorization,
  createRunStepIdempotencyKey,
  isAssistantConfirmationGrantFresh,
  sameAssistantStepAuthorizations,
} from './AssistantExecutionContext.ts';

const localBrain = new LocalAssistantBrain();
const llmBrain = new LLMBrain();
const MAX_AGENT_STEPS = 20;
const MAX_AUTO_REPLANS = 3;
const MAX_READ_ONLY_CONCURRENCY = 4;
const SNAPSHOT_HYDRATION_TIMEOUT_MS = 1_500;
const READ_ONLY_TOOLS = new Set([
  'knowledge.searchProject',
  'provider.getModelCapabilities',
  'generation.getJobStatus',
  'browser.getStatus',
]);

type GenerationPlanningQueue = Pick<DurableGenerationQueue, 'getJob' | 'getJobs'>;

let contextSnapshotSequence = 0;

function createContextSnapshotId(): string {
  if (typeof globalThis.crypto?.randomUUID === 'function') return globalThis.crypto.randomUUID();
  contextSnapshotSequence += 1;
  return `snapshot_${Date.now()}_${contextSnapshotSequence}`;
}

async function hydratePlannerContextSnapshot(sessionId: string | undefined, ownerId: string): Promise<void> {
  if (!sessionId) return;
  const abortController = new AbortController();
  const timeout = globalThis.setTimeout(() => abortController.abort(), SNAPSHOT_HYDRATION_TIMEOUT_MS);
  try {
    await hydrateAgentContextSnapshotProjection(sessionId, { ownerId, signal: abortController.signal });
  } finally {
    globalThis.clearTimeout(timeout);
  }
}

function appendCurrentContextSnapshot(
  sessionId: string | undefined,
  ownerId: string,
  context: SanitizedProjectContext,
): void {
  if (!sessionId) return;
  const input = buildAgentContextSnapshotInput(context, {
    snapshotId: createContextSnapshotId(),
    capturedAt: new Date().toISOString(),
    availableTools: toolRegistryInstance.getAllTools().map((tool) => tool.name).sort(),
  });
  if (!input) return;
  void appendAgentContextSnapshotProjection(sessionId, input, { ownerId });
}

const retryableFailedPromptIds = (job: ReturnType<GenerationPlanningQueue['getJob']>): string[] => (
  (job?.prompts || [])
    .filter((prompt) => prompt.status === 'failed' && prompt.retryable !== false)
    .map((prompt) => prompt.id)
    .sort()
);

const freezeRetryActionTarget = (
  action: AssistantAction,
  queue: GenerationPlanningQueue,
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

const freezePlanExecutionTargets = (
  plan: AssistantPlan,
  queue: GenerationPlanningQueue,
): AssistantPlan => ({
  ...plan,
  actions: (plan.actions || []).map((action) => freezeRetryActionTarget(action, queue)),
  steps: (plan.steps || []).map((step) => ({
    ...step,
    action: freezeRetryActionTarget(step.action, queue),
  })),
});

const isKnowledgeWrite = (action: AssistantAction) => action.type === 'knowledge.recordChange';

const verificationRuleForAction = (action: AssistantAction): AgentPlanStep['verification']['rule'] => {
  if (action.type.startsWith('generation.') || action.type === 'startGeneration' || action.type === 'startBatchGeneration') {
    return 'queue_job';
  }
  if (action.type.startsWith('canvas.') || action.type === 'locateCard') return 'canvas_state';
  if (action.type === 'assets.zipOriginals' || action.type === 'zipOutputs') return 'asset_manifest';
  return 'tool';
};

const normalizePlanSteps = (plan: AssistantPlan): AgentPlanStep[] => {
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
        .map((action, index, actions) => ({
          stepId: `${plan.id}:step:${index + 1}`,
          action,
          dependsOn: index === 0 ? [] : [`${plan.id}:step:${index}`],
          idempotencyKey: `${plan.id}:${action.type}:${index + 1}`,
          verification: {
            required: true,
            rule: verificationRuleForAction(action),
          },
        }));

  const nonKnowledgeStepIds = sourceSteps
    .filter((step) => !isKnowledgeWrite(step.action))
    .map((step) => step.stepId);
  return sourceSteps.map((step) => isKnowledgeWrite(step.action)
    ? { ...step, dependsOn: Array.from(new Set([...step.dependsOn, ...nonKnowledgeStepIds])) }
    : step);
};

const validateStepGraph = (steps: AgentPlanStep[]) => {
  if (steps.length > MAX_AGENT_STEPS) {
    throw new Error(`Agent plan exceeds the ${MAX_AGENT_STEPS}-step execution limit.`);
  }
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
};

const actionPayloadWithIdempotency = (step: AgentPlanStep, runId?: string) => {
  const payload: Record<string, unknown> = { ...(step.action.payload || {}) };
  payload.idempotencyKey = runId
    ? createRunStepIdempotencyKey(runId, step.stepId)
    : step.idempotencyKey;
  return payload;
};

const createPlanStepAuthorizations = (
  runId: string,
  plan: AssistantPlan,
  steps: AgentPlanStep[],
  context: AssistantExecutionContext,
  authorizationScope?: AssistantAuthorizationScopeSnapshot,
) => steps.map((step) => createAssistantStepAuthorization({
  runId,
  stepId: step.stepId,
  toolName: step.action.type,
  input: actionPayloadWithIdempotency(step, runId),
  context: { ...context, runId, planId: plan.id, stepId: step.stepId },
  authorizationScope,
}));

const validatePlanStepInputs = (runId: string, steps: AgentPlanStep[]): void => {
  for (const step of steps) {
    const tool = toolRegistryInstance.getTool(step.action.type);
    if (!tool) throw new TypeError(`Unknown Agent tool in plan: ${step.action.type}`);
    tool.inputValidator.parse(actionPayloadWithIdempotency(step, runId));
  }
};

export interface AgentPlanStepVerificationResult extends AgentStepResultDto {}

type AgentPlanVerificationLog = Pick<AgentToolCallLog, 'status'> & Partial<AgentToolCallLog>;

const outputRecord = (output: unknown): Record<string, unknown> => (
  output && typeof output === 'object' ? output as Record<string, unknown> : {}
);

const resolveStepOutcomeFromEvidence = (
  output: unknown,
  toolLog?: AgentPlanVerificationLog,
): AgentStepOutcome | undefined => {
  const result = outputRecord(output);
  const executionOutcome = String(result.executionOutcome || '').toLowerCase();
  const toolStatus = toolLog?.status;
  if (executionOutcome === 'cancelled' || toolStatus === 'cancelled') return 'cancelled';
  if (executionOutcome === 'rolled_back' || executionOutcome === 'rolled_back_failure' || toolStatus === 'rolled_back') {
    return 'rolled_back_failure';
  }
  if (executionOutcome === 'completed_with_errors' || executionOutcome === 'partial_success' || toolStatus === 'partial_success') {
    return 'partial_success';
  }
  if (
    executionOutcome === 'retryable_failure'
    || toolStatus === 'retryable_failure'
    || toolLog?.retryable === true
  ) return 'retryable_failure';
  return undefined;
};

const buildStepVerificationResult = (
  step: AgentPlanStep,
  outcome: AgentStepOutcome,
  message?: string,
  retryable = outcome === 'retryable_failure',
): AgentPlanStepVerificationResult => ({
  stepId: step.stepId,
  toolName: step.action.type,
  outcome,
  verificationRule: step.verification.rule,
  message: message ? redactToolText(message) : undefined,
  retryable,
  verifiedAt: new Date().toISOString(),
});

/**
 * 消费 Planner 写入的语义验证规则。ToolRegistry.verify 是工具内校验，
 * 本函数进一步确认队列、画布或导出目标真的达成。
 */
export async function verifyAgentPlanStep(
  step: AgentPlanStep,
  output: unknown,
  context: AssistantToolExecutionContext,
  toolLog?: AgentPlanVerificationLog,
): Promise<AgentPlanStepVerificationResult> {
  const declaredOutcome = resolveStepOutcomeFromEvidence(output, toolLog);
  if (declaredOutcome && declaredOutcome !== 'partial_success') {
    return buildStepVerificationResult(
      step,
      declaredOutcome,
      `Tool reported ${declaredOutcome.replace(/_/g, ' ')}.`,
      declaredOutcome === 'retryable_failure',
    );
  }
  const declaredPartial = declaredOutcome === 'partial_success';

  if (toolLog && !['success', 'partial_success'].includes(toolLog.status)) {
    return buildStepVerificationResult(
      step,
      toolLog.failureClass === 'cancelled' ? 'cancelled' : 'retryable_failure',
      toolLog.error || `Tool log ended with ${toolLog.status}.`,
      Boolean(toolLog.retryable),
    );
  }

  if (!step.verification.required || step.verification.rule === 'none') {
    return buildStepVerificationResult(
      step,
      declaredPartial ? 'partial_success' : 'success',
      'Plan-level verification was not required.',
      false,
    );
  }

  const result = outputRecord(output);
  switch (step.verification.rule) {
    case 'tool':
      return toolLog?.status === 'success' || toolLog?.status === 'partial_success'
        ? buildStepVerificationResult(
            step,
            declaredPartial || toolLog.status === 'partial_success' ? 'partial_success' : 'success',
            'Tool verification passed.',
            false,
          )
        : buildStepVerificationResult(step, 'retryable_failure', 'Required tool verification evidence is missing.', false);

    case 'queue_job': {
      const outputId = String(result.id || result.jobId || '');
      const runtimeIdempotencyKey = context.runId && context.stepId
        ? createRunStepIdempotencyKey(context.runId, context.stepId)
        : step.idempotencyKey;
      const queueJob = outputId
        ? context.generationQueue?.getJob(outputId)
        : context.generationQueue?.getJobs().find((job) => job.idempotencyKey === runtimeIdempotencyKey);
      const jobStatus = String(queueJob?.status || '').toLowerCase();
      const jobId = queueJob?.id;
      if (!queueJob || !jobId || !jobStatus) {
        return buildStepVerificationResult(step, 'retryable_failure', 'No durable queue job matched the plan step.', true);
      }
      if (step.action.type === 'generation.getJobStatus') {
        return buildStepVerificationResult(
          step,
          declaredPartial ? 'partial_success' : 'success',
          `Queue job ${jobId} status was read as ${jobStatus}.`,
          false,
        );
      }
      if (step.action.type === 'generation.cancelJob' && jobStatus === 'cancelled') {
        return buildStepVerificationResult(
          step,
          declaredPartial ? 'partial_success' : 'success',
          `Queue job ${jobId} is durably cancelled.`,
          false,
        );
      }
      if (step.action.type === 'generation.pauseJob' && jobStatus !== 'paused') {
        return buildStepVerificationResult(step, 'retryable_failure', `Queue job ${jobId} did not enter the paused state.`, true);
      }
      if (step.action.type === 'generation.resumeJob' && !['queued', 'running'].includes(jobStatus)) {
        return buildStepVerificationResult(step, 'retryable_failure', `Queue job ${jobId} did not enter a runnable state.`, true);
      }
      if (jobStatus === 'completed_with_errors') {
        return buildStepVerificationResult(step, 'partial_success', `Queue job ${jobId || ''} completed with failed items.`, false);
      }
      if (['queued', 'running', 'paused', 'completed'].includes(jobStatus)) {
        return buildStepVerificationResult(
          step,
          declaredPartial ? 'partial_success' : 'success',
          `Queue job ${jobId} is durably ${jobStatus}.`,
          false,
        );
      }
      return buildStepVerificationResult(step, 'retryable_failure', 'No durable queue job matched the plan step.', true);
    }

    case 'canvas_state': {
      const runtimeState = context.getCanvasRuntimeState?.() || context.canvasRuntimeState;
      const activeCanvas = context.getActiveCanvas?.() || context.activeCanvas;
      const baseline = context.verificationBaseline;
      const currentRevision = Number(runtimeState?.canvas?.lastModified ?? activeCanvas?.lastModified ?? 0);
      const revisionChanged = Number.isFinite(currentRevision)
        && Number.isFinite(Number(baseline?.canvasRevision))
        && currentRevision !== Number(baseline?.canvasRevision);
      const previousEvents = new Set(baseline?.recentEventIds || []);
      const hasFreshEvent = Boolean(runtimeState?.recentEvents?.some((event: { id: string }) => !previousEvents.has(event.id)));
      const toolEffect = toolRegistryInstance.getTool(step.action.type)?.control.effect;
      const hasTargetEvidence = typeof result.nodeId === 'string'
        || (Array.isArray(result.nodeIds) && result.nodeIds.length > 0)
        || Number(result.selectedCount || result.affectedCount || result.createdCount || result.updatedCount || 0) > 0;
      if (toolEffect === 'read' || toolEffect === 'navigation') {
        if (runtimeState || Object.keys(result).length > 0) {
          return buildStepVerificationResult(
            step,
            declaredPartial ? 'partial_success' : 'success',
            'Fresh canvas state was read without requiring a mutation.',
            false,
          );
        }
      } else if (revisionChanged || hasFreshEvent || hasTargetEvidence) {
        return buildStepVerificationResult(
          step,
          declaredPartial ? 'partial_success' : 'success',
          'Fresh canvas evidence confirms the completed mutation.',
          false,
        );
      }
      return buildStepVerificationResult(step, 'retryable_failure', 'Canvas mutation produced no fresh revision, event, or target evidence.', false);
    }

    case 'asset_manifest': {
      const manifest = result.manifest && typeof result.manifest === 'object' && !Array.isArray(result.manifest)
        ? result.manifest as Record<string, unknown>
        : undefined;
      const manifestItems = Array.isArray(manifest?.items) ? manifest.items : undefined;
      const manifestFailedItems = Array.isArray(manifest?.failedItems) ? manifest.failedItems : undefined;
      const outputItems = Array.isArray(result.items) ? result.items : undefined;
      const outputFailedItems = Array.isArray(result.failedItems) ? result.failedItems : undefined;
      const items = manifestItems && manifestFailedItems ? manifestItems : outputItems && outputFailedItems ? outputItems : undefined;
      const failedItems = manifestItems && manifestFailedItems
        ? manifestFailedItems
        : outputItems && outputFailedItems
          ? outputFailedItems
          : undefined;
      const count = Number(result.count ?? result.successCount ?? manifest?.count ?? items?.length ?? 0);
      const failedCount = Number(result.failedCount ?? manifest?.failedCount ?? failedItems?.length ?? 0);
      const hasStructuredManifest = Boolean(items && failedItems);
      const countsMatchManifest = hasStructuredManifest
        && Number.isInteger(count)
        && Number.isInteger(failedCount)
        && count >= 0
        && failedCount >= 0
        && count === items?.length
        && failedCount === failedItems?.length;
      if (!countsMatchManifest) {
        return buildStepVerificationResult(step, 'retryable_failure', 'Export completed without a consistent structured asset manifest.', false);
      }
      if (failedCount > 0 && count <= 0) {
        return buildStepVerificationResult(step, 'retryable_failure', `All ${failedCount} asset export item(s) failed.`, true);
      }
      if (count > 0 && failedCount > 0) {
        return buildStepVerificationResult(step, 'partial_success', `Export manifest contains ${failedCount} failed item(s).`, false);
      }
      if (count > 0) {
        return buildStepVerificationResult(
          step,
          declaredPartial ? 'partial_success' : 'success',
          'Export manifest was produced.',
          false,
        );
      }
      return buildStepVerificationResult(step, 'retryable_failure', 'Export completed without a verifiable asset manifest.', false);
    }
  }
}

class AgentStepVerificationError extends Error {
  readonly result: AgentPlanStepVerificationResult;

  constructor(result: AgentPlanStepVerificationResult) {
    super(result.message || `Agent step ${result.stepId} ended with ${result.outcome}.`);
    this.name = 'AgentStepVerificationError';
    this.result = result;
  }
}

interface AgentRecoveryTarget {
  sourceStepId: string;
  cancelToolName: string;
  jobId: string;
}

interface AgentRecoveryReport {
  failedJobIds: string[];
  recoveredStepIds: string[];
}

/** A Run created by this planner has a locally validated, executable plan shape. */
export type PlannedAgentRunRecord = Omit<AgentRunRecord, 'plan'> & { plan: AssistantPlan };

export class AgentRuntime {
  private readonly runAbortControllers = new Map<string, AbortController>();
  private readonly runExecutions = new Map<string, Promise<void>>();
  private readonly runExecutionContexts = new Map<string, AssistantExecutionContext>();
  private readonly runRecoveryTargets = new Map<string, Map<string, AgentRecoveryTarget>>();
  private readonly runStartedStepIds = new Map<string, Set<string>>();
  private readonly runSyncChains = new Map<string, Promise<void>>();
  private readonly pendingRunSyncs = new Map<string, AgentRunRecord>();
  private readonly planningGenerationQueue: GenerationPlanningQueue;
  private activeRunSyncOwnerId = agentRunStore.getOwnerScopeId();
  private hydratedRunSyncOwnerId = '';
  private runHydration?: { ownerId: string; promise: Promise<AgentRunHydrationResult> };
  private sessionHydration?: { ownerId: string; promise: Promise<AgentSessionHydrationResult> };

  constructor(planningGenerationQueue: GenerationPlanningQueue = durableGenerationQueue) {
    this.planningGenerationQueue = planningGenerationQueue;
    if (typeof window !== 'undefined') {
      window.addEventListener('online', () => {
        void this.requestRunHydration();
        void this.requestSessionHydration();
      });
      queueMicrotask(() => {
        if (typeof navigator === 'undefined' || navigator.onLine !== false) {
          void this.requestRunHydration();
          void this.requestSessionHydration();
        }
      });
    }
  }

  async run(
    text: string,
    context: SanitizedProjectContext,
    modelId?: string,
    sessionId?: string,
  ): Promise<PlannedAgentRunRecord> {
    const planningOwnerId = getRuntimeOwnerId();
    const capabilityContextPromise = resolveAgentPlannerCapabilityContext(planningOwnerId);
    await hydratePlannerContextSnapshot(sessionId, planningOwnerId);
    const capabilityContext = await capabilityContextPromise;
    const sessionContext = resolveAgentPlannerSessionContext(sessionId, agentSessionProjectionStore, context);
    const validatedSessionId = sessionContext?.sessionId;
    appendCurrentContextSnapshot(validatedSessionId, planningOwnerId, context);
    const referenceContext = applyAgentPlannerReferenceContext(text, context, sessionContext);
    const plannerContext = applyAgentPlannerCapabilityContext(referenceContext, capabilityContext);
    const localPlan = await localBrain.plan(text, plannerContext, sessionContext);
    if (getRuntimeOwnerId() !== planningOwnerId) {
      throw new Error('Agent planning stopped because the authenticated owner changed.');
    }
    let plan: AssistantPlan;
    plan = localPlan;
    if (context.settings.apiKeyStatus !== 'missing' && localPlan.intent === 'unknown') {
      try {
        plan = await llmBrain.plan(text, plannerContext, modelId, sessionContext);
      } catch (error) {
        console.warn(
          '[AgentRuntime] Cloud planner failed; using LocalBrain.',
          redactToolText(error instanceof Error ? error.message : String(error)),
        );
      }
    }
    if (getRuntimeOwnerId() !== planningOwnerId) {
      throw new Error('Agent planning stopped because the authenticated owner changed.');
    }
    plan = enforceAgentPlannerReferencePolicy(text, plan, context, sessionContext);
    plan = enforceAgentPlannerCapabilityPolicy(plan, capabilityContext);

    let isBlocked = false;
    let blockReason = '';
    try {
      plan = freezePlanExecutionTargets(plan, this.planningGenerationQueue);
    } catch (error) {
      isBlocked = true;
      blockReason = redactToolText(error instanceof Error ? error.message : String(error));
    }
    const plannedActions = Array.isArray(plan.steps) && plan.steps.length > 0
      ? plan.steps.map((step) => step.action)
      : plan.actions || [];
    const safeActions: AssistantAction[] = [];
    if (!isBlocked && plannedActions.length > MAX_AGENT_STEPS) {
      isBlocked = true;
      blockReason = `Agent plan exceeds the ${MAX_AGENT_STEPS}-step execution limit.`;
    } else if (!isBlocked) {
      for (const action of plannedActions) {
        const safetyCheck = agentPermissionPolicy.evaluateSafety(action);
        if (!safetyCheck.allowed) {
          isBlocked = true;
          blockReason = safetyCheck.reason || 'The requested action is blocked by the safety policy.';
          break;
        }
        safeActions.push(action);
      }
    }

    if (!isBlocked) {
      plan.actions = safeActions;
      plan.version = 2;
      plan.maxReplans = MAX_AUTO_REPLANS;
      plan.steps = normalizePlanSteps(plan);
      try {
        validateStepGraph(plan.steps);
        validatePlanStepInputs(plan.id, plan.steps);
      } catch (error) {
        isBlocked = true;
        blockReason = redactToolText(error instanceof Error ? error.message : String(error));
      }
    }

    if (isBlocked) {
      plan = {
        ...plan,
        reply: `Safety policy blocked this plan.\n${blockReason}`,
        actions: [],
        steps: [],
        requiresConfirmation: false,
        confirmation: undefined,
      };
    } else {
      const confirmation = agentPermissionPolicy.evaluateConfirmation(plan, plannerContext);
      if (confirmation.required) {
        plan.requiresConfirmation = true;
        plan.confirmation = confirmation;
      }
    }

    const record = agentRunStore.createRun(text, plan.intent, plan, validatedSessionId);
    if (isBlocked) {
      agentRunStore.updateRun(record.id, {
        status: 'failed',
        nextStep: `Safety policy blocked execution: ${blockReason}`,
      });
      void writeHandoff(agentRunStore.getRun(record.id)!, planningOwnerId);
    }
    this.syncRunToBackend(agentRunStore.getRun(record.id)!);
    return agentRunStore.getRun(record.id)! as PlannedAgentRunRecord;
  }

  createConfirmationGrant(
    runId: string,
    confirmedPlanSnapshot: AssistantPlan,
    context: AssistantExecutionContext,
    authorizationScope?: AssistantAuthorizationScopeSnapshot,
  ): AssistantConfirmationGrant {
    const steps = normalizePlanSteps(confirmedPlanSnapshot);
    validateStepGraph(steps);
    validatePlanStepInputs(runId, steps);
    const scope = authorizationScope || captureAssistantAuthorizationScope(context);
    return {
      runId,
      planId: confirmedPlanSnapshot.id,
      ownerId: scope.ownerId,
      confirmed: true,
      toolNames: Array.from(new Set(steps.map((step) => step.action.type))),
      authorizationScope: scope,
      authorizedSteps: createPlanStepAuthorizations(runId, confirmedPlanSnapshot, steps, context, scope),
      grantedAt: new Date().toISOString(),
      source: 'user',
    };
  }

  executePendingRun(runId: string, executorContext: AssistantExecutionContext): Promise<void> {
    const existingExecution = this.runExecutions.get(runId);
    if (existingExecution) return existingExecution;

    this.runExecutionContexts.set(runId, executorContext);
    this.runRecoveryTargets.set(runId, new Map());
    this.runStartedStepIds.set(runId, new Set(agentRunStore.getRun(runId)?.completedStepIds || []));
    const execution = this.executePendingRunInternal(runId, executorContext);
    this.runExecutions.set(runId, execution);
    void execution.finally(() => {
      if (this.runExecutions.get(runId) === execution) {
        this.runExecutions.delete(runId);
      }
      if (this.runExecutionContexts.get(runId) === executorContext) {
        this.runExecutionContexts.delete(runId);
      }
      this.runRecoveryTargets.delete(runId);
      this.runStartedStepIds.delete(runId);
    }).catch(() => undefined);
    return execution;
  }

  private registerRecoveryTarget(
    runId: string,
    step: AgentPlanStep,
    output: unknown,
    executorContext: AssistantExecutionContext,
  ): void {
    const cancelToolName = toolRegistryInstance.getTool(step.action.type)?.control.recovery.cancelToolName;
    if (!cancelToolName) return;
    const result = outputRecord(output);
    const jobId = String(result.jobId || result.id || '').trim();
    if (!jobId) return;
    const queueJob = executorContext.generationQueue.getJob(jobId);
    const expectedIdempotencyKey = createRunStepIdempotencyKey(runId, step.stepId);
    if (!queueJob || queueJob.idempotencyKey !== expectedIdempotencyKey) return;
    const targets = this.runRecoveryTargets.get(runId) || new Map<string, AgentRecoveryTarget>();
    targets.set(`${cancelToolName}:${jobId}`, {
      sourceStepId: step.stepId,
      cancelToolName,
      jobId,
    });
    this.runRecoveryTargets.set(runId, targets);
  }

  private async cancelRecoverableResources(
    runId: string,
    steps: AgentPlanStep[],
    executorContext: AssistantExecutionContext,
  ): Promise<AgentRecoveryReport> {
    const targets = new Map(this.runRecoveryTargets.get(runId) || []);
    const queueJobs = executorContext.generationQueue.getJobs();

    for (const step of steps) {
      const cancelToolName = toolRegistryInstance.getTool(step.action.type)?.control.recovery.cancelToolName;
      if (!cancelToolName || !this.runStartedStepIds.get(runId)?.has(step.stepId)) continue;
      const effectivePayload = actionPayloadWithIdempotency(step, runId);
      const idempotencyKey = String(effectivePayload.idempotencyKey || '').trim();
      if (!idempotencyKey) continue;
      for (const job of queueJobs) {
        if (job.idempotencyKey !== idempotencyKey) continue;
        targets.set(`${cancelToolName}:${job.id}`, {
          sourceStepId: step.stepId,
          cancelToolName,
          jobId: job.id,
        });
      }
    }

    const failedJobIds: string[] = [];
    const recoveredStepIds = new Set<string>();
    for (const [targetKey, target] of targets) {
      const queueJob = executorContext.generationQueue.getJob(target.jobId);
      if (queueJob && ['completed', 'completed_with_errors', 'failed', 'cancelled'].includes(queueJob.status)) {
        this.runRecoveryTargets.get(runId)?.delete(targetKey);
        continue;
      }

      try {
        if (target.cancelToolName !== 'generation.cancelJob') {
          throw new Error(`Unsupported recovery tool: ${target.cancelToolName}`);
        }
        executorContext.generationQueue.cancelJob(target.jobId);
        const recoveredJob = executorContext.generationQueue.getJob(target.jobId);
        if (recoveredJob && !['completed', 'completed_with_errors', 'failed', 'cancelled'].includes(recoveredJob.status)) {
          throw new Error(`Recovery tool left generation job ${target.jobId} in ${recoveredJob.status}.`);
        }
        recoveredStepIds.add(target.sourceStepId);
        this.runRecoveryTargets.get(runId)?.delete(targetKey);
      } catch {
        failedJobIds.push(target.jobId);
      }
    }

    if (failedJobIds.length > 0) {
      executorContext.notify.warning(
        'Agent recovery left unfinished resources',
        `Generation job(s) still require manual cancellation: ${failedJobIds.join(', ')}`,
      );
    }
    return { failedJobIds, recoveredStepIds: [...recoveredStepIds] };
  }

  private async executePendingRunInternal(runId: string, executorContext: AssistantExecutionContext): Promise<void> {
    const executionOwnerId = getRuntimeOwnerId();
    const getOwnedRun = () => agentRunStore.getRunForOwner(executionOwnerId, runId);
    const updateOwnedRun = (updates: Partial<AgentRunRecord>) => (
      agentRunStore.updateRunForOwner(executionOwnerId, runId, updates)
    );
    const record = getOwnedRun();
    if (!record) throw new Error(`Agent run not found: ${runId}`);
    if (!hasLocalAgentRunExecutionAuthority(record)) {
      throw new Error(`Agent run is a server projection and cannot execute in this browser: ${runId}`);
    }
    if (!['waiting_confirmation', 'waiting_execution', 'running'].includes(record.status)) return;

    const plan = record.plan as AssistantPlan;
    const steps = normalizePlanSteps(plan);
    validateStepGraph(steps);
    validatePlanStepInputs(runId, steps);
    const explicitGrant = executorContext.confirmationGrant;
    const expectedAuthorizations = createPlanStepAuthorizations(runId, plan, steps, executorContext);
    const confirmationGranted = explicitGrant?.confirmed === true
      && explicitGrant.runId === runId
      && explicitGrant.source === 'user'
      && explicitGrant.ownerId === executionOwnerId
      && explicitGrant.planId === plan.id
      && isAssistantConfirmationGrantFresh(explicitGrant)
      && sameAssistantStepAuthorizations(explicitGrant.authorizedSteps, expectedAuthorizations);
    const confirmedAuthorizationScope = confirmationGranted ? explicitGrant!.authorizationScope : undefined;
    const confirmationRequired = plan.requiresConfirmation === true || record.status === 'waiting_confirmation';
    if (confirmationRequired && !confirmationGranted) {
      if (record.status !== 'waiting_confirmation') {
        updateOwnedRun({
          status: 'waiting_confirmation',
          confirmationGrantedAt: undefined,
          nextStep: 'Explicit user confirmation must be renewed before execution can resume.',
        });
      }
      throw new Error(`Explicit user confirmation is required for agent run: ${runId}`);
    }
    const executionStartedAt = Date.now();
    const authorizedSelection = confirmedAuthorizationScope
      ? [...confirmedAuthorizationScope.selectedNodeIds]
      : [...(executorContext.getSelectedNodeIds?.() || executorContext.selectedNodeIds || [])];
    const authorizedCanvasId = confirmedAuthorizationScope
      ? confirmedAuthorizationScope.canvasId
      : String(executorContext.getActiveCanvas?.()?.id || executorContext.activeCanvas?.id || '');
    const completed = new Set(record.completedStepIds || []);
    const stepResults = [...(record.stepResults || [])];
    const pending = new Map(steps.filter((step) => !completed.has(step.stepId)).map((step) => [step.stepId, step]));
    const abortController = new AbortController();
    this.runAbortControllers.set(runId, abortController);

    const runningRecord = updateOwnedRun({
      status: 'running',
      confirmationGrantedAt: confirmationGranted ? explicitGrant?.grantedAt : record.confirmationGrantedAt,
      totalSteps: steps.length,
      completedStepIds: [...completed],
      stepResults,
    });
    this.syncRunToBackend(runningRecord);

    const assertLiveExecutionScope = (step: AgentPlanStep): void => {
      if (abortController.signal.aborted) {
        throw new AgentStepVerificationError(buildStepVerificationResult(
          step,
          'cancelled',
          'Agent run was cancelled.',
          false,
        ));
      }
      if (getRuntimeOwnerId() !== executionOwnerId) {
        abortController.abort('owner_changed');
        throw new AgentStepVerificationError(buildStepVerificationResult(
          step,
          'cancelled',
          'Agent run stopped because the authenticated owner changed.',
          false,
        ));
      }
      const currentCanvasId = String(
        executorContext.getActiveCanvas?.()?.id || executorContext.activeCanvas?.id || '',
      );
      if (authorizedCanvasId && currentCanvasId !== authorizedCanvasId) {
        abortController.abort('canvas_changed');
        throw new AgentStepVerificationError(buildStepVerificationResult(
          step,
          'cancelled',
          'Agent run stopped because the active canvas changed after authorization.',
          false,
        ));
      }
    };

    const executeStep = async (step: AgentPlanStep) => {
      const payload = actionPayloadWithIdempotency(step, runId);
      const baselineState = executorContext.getCanvasRuntimeState?.() || executorContext.canvasRuntimeState;
      const baselineCanvas = executorContext.getActiveCanvas?.() || executorContext.activeCanvas;
      const stepContext: AssistantExecutionContext = {
        ...executorContext,
        runId,
        planId: plan.id,
        stepId: step.stepId,
        executionOwnerId,
        selectedNodeIds: authorizedSelection,
        getSelectedNodeIds: () => [...authorizedSelection],
        signal: abortController.signal,
        verificationBaseline: {
          canvasRevision: Number(baselineState?.canvas?.lastModified ?? baselineCanvas?.lastModified ?? 0),
          recentEventIds: (baselineState?.recentEvents || []).map((event) => event.id),
        },
        confirmationGrant: confirmationGranted ? explicitGrant : undefined,
      };

      let output: unknown;
      try {
        assertLiveExecutionScope(step);
        this.runStartedStepIds.get(runId)?.add(step.stepId);
        output = await toolRegistryInstance.execute(step.action.type, payload, stepContext);
        assertLiveExecutionScope(step);
        this.registerRecoveryTarget(runId, step, output, executorContext);
      } catch (error) {
        if (error instanceof AgentStepVerificationError) {
          stepResults.push(error.result);
          updateOwnedRun({ stepResults: [...stepResults] });
          throw error;
        }
        if (getRuntimeOwnerId() !== executionOwnerId) throw error;
        const toolLog = [...toolRegistryInstance.getLogs(executionOwnerId)].reverse().find((log) => (
          log.runId === runId && log.stepId === step.stepId
        ));
        const verification = await verifyAgentPlanStep(step, undefined, stepContext, toolLog || {
          status: abortController.signal.aborted ? 'cancelled' : 'failed',
          error: error instanceof Error ? error.message : String(error),
          retryable: false,
        });
        stepResults.push(verification);
        updateOwnedRun({ stepResults: [...stepResults] });
        throw new AgentStepVerificationError(verification);
      }

      const toolLog = [...toolRegistryInstance.getLogs(executionOwnerId)].reverse().find((log) => (
        log.runId === runId && log.stepId === step.stepId
      ));
      assertLiveExecutionScope(step);
      const verification = await verifyAgentPlanStep(step, output, stepContext, toolLog);
      stepResults.push(verification);
      updateOwnedRun({ stepResults: [...stepResults] });
      if (verification.outcome !== 'success' && verification.outcome !== 'partial_success') {
        throw new AgentStepVerificationError(verification);
      }

      completed.add(step.stepId);
      pending.delete(step.stepId);
      updateOwnedRun({
        completedStepIds: [...completed],
        stepResults: [...stepResults],
      });
    };

    try {
      while (pending.size > 0) {
        const ready = [...pending.values()].filter((step) => step.dependsOn.every((dependency) => completed.has(dependency)));
        if (ready.length === 0) throw new Error('Agent step graph contains a dependency cycle.');
        const readOnlyBatch = ready
          .filter((step) => READ_ONLY_TOOLS.has(step.action.type))
          .slice(0, MAX_READ_ONLY_CONCURRENCY);
        if (readOnlyBatch.length > 0) {
          const results = await Promise.allSettled(readOnlyBatch.map(executeStep));
          const rejected = results.find((result): result is PromiseRejectedResult => result.status === 'rejected');
          if (rejected) throw rejected.reason;
        } else {
          await executeStep(ready[0]);
        }
      }

      if (abortController.signal.aborted || getOwnedRun()?.status === 'cancelled') {
        throw new AgentStepVerificationError(buildStepVerificationResult(
          steps.find((step) => !completed.has(step.stepId)) || steps[steps.length - 1],
          'cancelled',
          'Agent run was cancelled before terminal completion.',
          false,
        ));
      }

      const toolCalls = toolRegistryInstance.getLogs(executionOwnerId).filter((log) => (
        log.runId === runId && new Date(log.startedAt).getTime() >= executionStartedAt
      ));
      const updated = updateOwnedRun({
        status: stepResults.some((result) => result.outcome === 'partial_success')
          ? 'completed_with_errors'
          : 'completed',
        toolCalls,
        stepResults,
        completedStepIds: steps.map((step) => step.stepId),
      });
      void writeHandoff(updated, executionOwnerId);
    } catch (error: unknown) {
      const verificationResult = error instanceof AgentStepVerificationError ? error.result : undefined;
      const ownerChanged = getRuntimeOwnerId() !== executionOwnerId;
      const cancelled = abortController.signal.aborted
        || ownerChanged
        || verificationResult?.outcome === 'cancelled'
        || getOwnedRun()?.status === 'cancelled';
      const recovery = ownerChanged
        ? { failedJobIds: [], recoveredStepIds: [] }
        : await this.cancelRecoverableResources(runId, steps, executorContext);
      if (!cancelled && recovery.recoveredStepIds.length > 0) {
        for (const recoveredStepId of recovery.recoveredStepIds) {
          const recoveredStep = steps.find((step) => step.stepId === recoveredStepId);
          if (!recoveredStep) continue;
          const resultIndex = stepResults.findIndex((result) => result.stepId === recoveredStepId);
          const rolledBackResult = buildStepVerificationResult(
            recoveredStep,
            'rolled_back_failure',
            'Step failed verification and its recoverable side effect was cancelled.',
            false,
          );
          if (resultIndex >= 0) stepResults[resultIndex] = rolledBackResult;
          else stepResults.push(rolledBackResult);
          completed.delete(recoveredStepId);
        }
      }
      const toolCalls: AgentToolCallLog[] = toolRegistryInstance.getLogs(executionOwnerId).filter((log) => (
        log.runId === runId && new Date(log.startedAt).getTime() >= executionStartedAt
      ));
      const safeExecutionError = redactToolText(error instanceof Error ? error.message : String(error));
      const updated = updateOwnedRun({
        status: cancelled ? 'cancelled' : 'failed',
        toolCalls,
        stepResults,
        completedStepIds: [...completed],
        nextStep: ownerChanged
          ? 'Execution stopped because the authenticated owner changed; no further tools or recovery actions were run.'
          : cancelled
          ? recovery.failedJobIds.length > 0
            ? `Execution cancelled, but generation job(s) still require manual cancellation: ${recovery.failedJobIds.join(', ')}`
            : 'Execution and recoverable generation jobs were cancelled by the user.'
          : recovery.failedJobIds.length > 0
            ? `Execution failed; generation job(s) still require manual cancellation: ${recovery.failedJobIds.join(', ')}`
            : recovery.recoveredStepIds.length > 0
              ? `Execution failed and recoverable side effects were cancelled: ${safeExecutionError}`
              : `Execution failed: ${safeExecutionError}`,
      });
      void writeHandoff(updated, executionOwnerId);
      throw error;
    } finally {
      if (this.runAbortControllers.get(runId) === abortController) {
        this.runAbortControllers.delete(runId);
      }
      const finalRecord = getOwnedRun();
      if (finalRecord && getRuntimeOwnerId() === executionOwnerId) {
        this.syncRunToBackend(finalRecord);
      }
    }
  }

  async cancelPendingRun(runId: string): Promise<void> {
    const cancellationOwnerId = agentRunStore.getOwnerScopeId();
    const record = agentRunStore.getRunForOwner(cancellationOwnerId, runId);
    if (!record) return;
    if (!['waiting_confirmation', 'waiting_execution', 'running'].includes(record.status)) return;
    const activeController = this.runAbortControllers.get(runId);
    const executorContext = this.runExecutionContexts.get(runId);
    activeController?.abort();
    let updated = agentRunStore.updateRunForOwner(cancellationOwnerId, runId, {
      status: 'cancelled',
      nextStep: 'Cancelling the Agent run and any recoverable generation jobs.',
    });
    this.syncRunToBackend(updated);
    if (executorContext) {
      const steps = normalizePlanSteps(record.plan as AssistantPlan);
      const recovery = await this.cancelRecoverableResources(runId, steps, executorContext);
      updated = agentRunStore.updateRunForOwner(cancellationOwnerId, runId, {
        nextStep: recovery.failedJobIds.length > 0
          ? `Execution cancelled, but generation job(s) still require manual cancellation: ${recovery.failedJobIds.join(', ')}`
          : 'Execution and currently known recoverable generation jobs were cancelled by the user.',
      });
      this.syncRunToBackend(updated);
    }
    if (!activeController) {
      void writeHandoff(updated, cancellationOwnerId);
    }
  }

  private syncRunToBackend(record: AgentRunRecord): void {
    const ownerId = this.ensureRunSyncOwner();
    const restoredRunIds = this.restorePendingRunSyncsFromStore(ownerId);
    if (ownerId === 'local_user') return;
    const ownedRecord = agentRunStore.getRun(record.id);
    if (!ownedRecord) return;
    const snapshot = JSON.parse(JSON.stringify(ownedRecord)) as AgentRunRecord;
    const pending = this.pendingRunSyncs.get(snapshot.id);
    if (!pending || pending.updatedAt <= snapshot.updatedAt) {
      this.pendingRunSyncs.set(snapshot.id, snapshot);
    }

    for (const runId of new Set([...restoredRunIds, snapshot.id])) {
      if (this.hydratedRunSyncOwnerId === ownerId) this.scheduleRunSync(runId, ownerId);
    }
    if (this.hydratedRunSyncOwnerId !== ownerId) void this.requestRunHydration();
  }

  private ensureRunSyncOwner(): string {
    const ownerId = agentRunStore.getOwnerScopeId();
    if (ownerId !== this.activeRunSyncOwnerId) {
      this.activeRunSyncOwnerId = ownerId;
      this.pendingRunSyncs.clear();
      this.runSyncChains.clear();
      this.hydratedRunSyncOwnerId = '';
    }
    return ownerId;
  }

  private restorePendingRunSyncsFromStore(ownerId = this.ensureRunSyncOwner()): string[] {
    if (ownerId !== this.activeRunSyncOwnerId) return [];
    const restoredRunIds: string[] = [];
    for (const record of agentRunStore.listRuns()) {
      if (record.backendSyncState === 'synced') continue;
      const snapshot = JSON.parse(JSON.stringify(record)) as AgentRunRecord;
      const pending = this.pendingRunSyncs.get(snapshot.id);
      if (!pending || pending.updatedAt <= snapshot.updatedAt) {
        this.pendingRunSyncs.set(snapshot.id, snapshot);
      }
      restoredRunIds.push(snapshot.id);
    }
    return restoredRunIds;
  }

  private scheduleRunSync(runId: string, ownerId: string): void {
    const previous = this.runSyncChains.get(runId) || Promise.resolve();
    const task = previous
      .catch(() => undefined)
      .then(() => this.flushRunSync(runId, ownerId));
    this.runSyncChains.set(runId, task);
    void task.finally(() => {
      if (this.runSyncChains.get(runId) === task) {
        this.runSyncChains.delete(runId);
      }
    }).catch(() => undefined);
  }

  private flushPendingRunSyncs(ownerId = this.ensureRunSyncOwner()): void {
    this.restorePendingRunSyncsFromStore(ownerId);
    if (ownerId === 'local_user') return;
    for (const runId of this.pendingRunSyncs.keys()) {
      this.scheduleRunSync(runId, ownerId);
    }
  }

  private async restoreRunProjection(ownerId: string): Promise<AgentRunHydrationResult> {
    const needsInitialHydration = this.hydratedRunSyncOwnerId !== ownerId;
    let initialResult: AgentRunHydrationResult = {
      outcome: ownerId === 'local_user' ? 'local_only' : 'hydrated',
      runCount: 0,
    };
    if (needsInitialHydration) {
      initialResult = await hydrateAgentRunProjection({ ownerId });
      if (ownerId !== this.ensureRunSyncOwner()) return { outcome: 'owner_changed', runCount: 0 };
      if (!['hydrated', 'local_only'].includes(initialResult.outcome)) return initialResult;
      this.hydratedRunSyncOwnerId = ownerId;
    }
    this.flushPendingRunSyncs(ownerId);
    if (ownerId === 'local_user') return initialResult;
    const recovery = await refreshAgentRunEventProjection({ ownerId });
    if (ownerId !== this.ensureRunSyncOwner() || recovery.outcome === 'owner_changed') {
      return { outcome: 'owner_changed', runCount: 0 };
    }
    const outcome = recovery.outcome === 'invalid_payload' ? 'invalid_payload'
      : recovery.outcome === 'unavailable' ? 'unavailable'
        : 'hydrated';
    return { outcome, runCount: initialResult.runCount + recovery.refreshedRunCount };
  }

  requestRunHydration(): Promise<AgentRunHydrationResult> {
    const ownerId = this.ensureRunSyncOwner();
    if (this.runHydration?.ownerId === ownerId) return this.runHydration.promise;
    const promise = this.restoreRunProjection(ownerId)
      .finally(() => {
        if (this.runHydration?.promise === promise) this.runHydration = undefined;
      });
    this.runHydration = { ownerId, promise };
    return promise;
  }

  /** Refreshes the owner-qualified Session list without merging it into local Chat history. */
  requestSessionHydration(): Promise<AgentSessionHydrationResult> {
    const ownerId = getRuntimeOwnerId();
    if (this.sessionHydration?.ownerId === ownerId) return this.sessionHydration.promise;
    const promise = hydrateAgentSessionProjection({ ownerId })
      .finally(() => {
        if (this.sessionHydration?.promise === promise) this.sessionHydration = undefined;
      });
    this.sessionHydration = { ownerId, promise };
    return promise;
  }

  requestPendingRunSync(): void {
    void this.requestRunHydration();
  }

  private async flushRunSync(runId: string, ownerId: string): Promise<void> {
    if (ownerId === 'local_user' || ownerId !== this.ensureRunSyncOwner()) return;
    const record = this.pendingRunSyncs.get(runId);
    if (!record) return;
    try {
      const response = await kkWebApiClient.upsertAgentRun(record, { expectedAuthSubject: ownerId });
      if (!response.success || response.data?.ok !== true) return;
      const toolResponses = await Promise.all(
        (record.toolCalls || []).map((toolCall) => kkWebApiClient.recordAgentToolCall(
          toolCall,
          { expectedAuthSubject: ownerId },
        )),
      );
      if (toolResponses.some((toolResponse) => !toolResponse.success || toolResponse.data?.ok !== true)) return;
      if (ownerId !== this.ensureRunSyncOwner()) return;
      if (this.pendingRunSyncs.get(runId)?.updatedAt !== record.updatedAt) return;
      if (response.data.stale) {
        const authoritative = response.data.data;
        if (!authoritative) return;
        if (!agentRunStore.applyAuthoritativeRun(authoritative, record.updatedAt)) return;
        this.pendingRunSyncs.delete(runId);
        return;
      }
      this.pendingRunSyncs.delete(runId);
      agentRunStore.markBackendSynced(runId, record.updatedAt);
    } catch {
      // AgentRunStore keeps the owner-scoped pending marker across reloads for the next retry.
    }
  }
}

export const agentRuntimeInstance = new AgentRuntime();
