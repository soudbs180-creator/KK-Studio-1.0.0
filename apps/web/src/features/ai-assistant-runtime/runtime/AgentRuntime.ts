import type {
  AgentPlanStep,
  AgentToolCallLog,
  AssistantAction,
  AssistantPlan,
  SanitizedProjectContext,
} from '../../ai-takeover/types.ts';
import { LocalAssistantBrain } from '../../ai-takeover/core/localBrain.ts';
import { LLMBrain } from '../../ai-takeover/core/llmBrain.ts';
import { agentPermissionPolicy } from './AgentPermissionPolicy.ts';
import { agentRunStore, type AgentRunRecord } from './AgentRunStore.ts';
import { toolRegistryInstance } from '../tools/ToolRegistry.ts';
import { writeHandoff } from '../memory/handoffWriter.ts';

const localBrain = new LocalAssistantBrain();
const llmBrain = new LLMBrain();
const MAX_AGENT_STEPS = 20;
const MAX_AUTO_REPLANS = 3;
const MAX_READ_ONLY_CONCURRENCY = 4;
const READ_ONLY_TOOLS = new Set([
  'knowledge.searchProject',
  'provider.getModelCapabilities',
  'generation.getJobStatus',
  'browser.getStatus',
]);

const isKnowledgeWrite = (action: AssistantAction) => action.type === 'knowledge.recordChange';

const verificationRuleForAction = (action: AssistantAction): AgentPlanStep['verification']['rule'] => {
  if (action.type.startsWith('generation.') || action.type === 'startGeneration' || action.type === 'startBatchGeneration') {
    return 'queue_job';
  }
  if (action.type.startsWith('canvas.') || action.type === 'locateCard') return 'canvas_state';
  if (action.type.startsWith('assets.') || action.type === 'zipOutputs') return 'asset_manifest';
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

const actionPayloadWithIdempotency = (step: AgentPlanStep) => {
  const payload = { ...((step.action as any).payload || {}) };
  if (!payload.idempotencyKey) payload.idempotencyKey = step.idempotencyKey;
  return payload;
};

export class AgentRuntime {
  async run(
    text: string,
    context: SanitizedProjectContext,
    modelId?: string,
  ): Promise<AgentRunRecord> {
    const localPlan = await localBrain.plan(text, context);
    let plan: AssistantPlan;
    plan = localPlan;
    if (context.settings.apiKeyStatus !== 'missing' && localPlan.intent === 'unknown') {
      try {
        plan = await llmBrain.plan(text, context, modelId);
      } catch (error) {
        console.warn('[AgentRuntime] Cloud planner failed; using LocalBrain.', error);
      }
    }

    let isBlocked = false;
    let blockReason = '';
    const plannedActions = Array.isArray(plan.steps) && plan.steps.length > 0
      ? plan.steps.map((step) => step.action)
      : plan.actions || [];
    const safeActions: AssistantAction[] = [];
    if (plannedActions.length > MAX_AGENT_STEPS) {
      isBlocked = true;
      blockReason = `Agent plan exceeds the ${MAX_AGENT_STEPS}-step execution limit.`;
    } else {
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
      plan.actions = safeActions;
      plan.version = 2;
      plan.maxReplans = MAX_AUTO_REPLANS;
      plan.steps = normalizePlanSteps(plan);
      validateStepGraph(plan.steps);
      const confirmation = agentPermissionPolicy.evaluateConfirmation(plan, context);
      if (confirmation.required) {
        plan.requiresConfirmation = true;
        plan.confirmation = confirmation;
      }
    }

    const record = agentRunStore.createRun(text, plan.intent, plan);
    if (isBlocked) {
      agentRunStore.updateRun(record.id, {
        status: 'failed',
        nextStep: `Safety policy blocked execution: ${blockReason}`,
      });
      void writeHandoff(agentRunStore.getRun(record.id)!);
    }
    this.syncRunToBackend(agentRunStore.getRun(record.id)!);
    return agentRunStore.getRun(record.id)!;
  }

  async executePendingRun(runId: string, executorContext: any): Promise<void> {
    const record = agentRunStore.getRun(runId);
    if (!record) throw new Error(`Agent run not found: ${runId}`);
    if (!['waiting_confirmation', 'waiting_execution', 'running'].includes(record.status)) return;

    const confirmationGranted = record.status === 'waiting_confirmation' || Boolean(record.confirmationGrantedAt);
    const plan = record.plan as AssistantPlan;
    const steps = normalizePlanSteps(plan);
    validateStepGraph(steps);
    const confirmToolNames = steps
      .filter((step) => {
        const permission = toolRegistryInstance.getTool(step.action.type)?.permission;
        return permission === 'confirm' || permission === 'dangerous';
      })
      .map((step) => step.action.type);
    const executionStartedAt = Date.now();
    const completed = new Set(record.completedStepIds || []);
    const pending = new Map(steps.filter((step) => !completed.has(step.stepId)).map((step) => [step.stepId, step]));

    agentRunStore.updateRun(runId, {
      status: 'running',
      confirmationGrantedAt: confirmationGranted ? record.confirmationGrantedAt || new Date().toISOString() : undefined,
      totalSteps: steps.length,
      completedStepIds: [...completed],
    });
    this.syncRunToBackend(agentRunStore.getRun(runId)!);

    const executeStep = async (step: AgentPlanStep) => {
      const payload = actionPayloadWithIdempotency(step);
      const output = await toolRegistryInstance.execute(step.action.type, payload, {
        ...executorContext,
        runId,
        stepId: step.stepId,
        confirmationGrant: {
          runId,
          confirmed: confirmationGranted,
          toolNames: confirmToolNames,
        },
      });
      if (output && typeof output === 'object' && (output as any).success === false) {
        throw new Error((output as any).message || `Tool ${step.action.type} did not complete successfully.`);
      }
      completed.add(step.stepId);
      pending.delete(step.stepId);
      agentRunStore.updateRun(runId, { completedStepIds: [...completed] });
    };

    try {
      while (pending.size > 0) {
        const ready = [...pending.values()].filter((step) => step.dependsOn.every((dependency) => completed.has(dependency)));
        if (ready.length === 0) throw new Error('Agent step graph contains a dependency cycle.');
        const readOnlyBatch = ready
          .filter((step) => READ_ONLY_TOOLS.has(step.action.type))
          .slice(0, MAX_READ_ONLY_CONCURRENCY);
        if (readOnlyBatch.length > 0) {
          await Promise.all(readOnlyBatch.map(executeStep));
        } else {
          await executeStep(ready[0]);
        }
      }

      const toolCalls = toolRegistryInstance.getLogs().filter((log) => (
        log.runId === runId && new Date(log.startedAt).getTime() >= executionStartedAt
      ));
      const updated = agentRunStore.updateRun(runId, {
        status: 'completed',
        toolCalls,
        completedStepIds: steps.map((step) => step.stepId),
      });
      void writeHandoff(updated);
    } catch (error: any) {
      const toolCalls: AgentToolCallLog[] = toolRegistryInstance.getLogs().filter((log) => (
        log.runId === runId && new Date(log.startedAt).getTime() >= executionStartedAt
      ));
      const updated = agentRunStore.updateRun(runId, {
        status: 'failed',
        toolCalls,
        completedStepIds: [...completed],
        nextStep: `Execution failed: ${error?.message || String(error)}`,
      });
      void writeHandoff(updated);
      throw error;
    } finally {
      this.syncRunToBackend(agentRunStore.getRun(runId)!);
    }
  }

  async cancelPendingRun(runId: string): Promise<void> {
    const record = agentRunStore.getRun(runId);
    if (!record) return;
    const updated = agentRunStore.updateRun(runId, { status: 'cancelled' });
    this.syncRunToBackend(updated);
    void writeHandoff(updated);
  }

  private async syncRunToBackend(record: AgentRunRecord) {
    try {
      const response = await fetch('/api/ai-assistant/runs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(record),
      });
      if (!response.ok || record.toolCalls.length === 0) return;
      await Promise.all(record.toolCalls.map((toolCall) => fetch('/api/ai-assistant/tool-calls', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(toolCall),
      })));
    } catch {
      // Local persistence remains authoritative while offline.
    }
  }
}

export const agentRuntimeInstance = new AgentRuntime();
