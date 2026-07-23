import type { AgentStepResultDto, AssistantCollaborationMode } from '@kk/shared';
import type { AssistantPlan, SanitizedProjectContext } from '../../ai-takeover/types.ts';
import { LLMBrain } from '../../ai-takeover/core/llmBrain.ts';
import {
  applyAgentPlannerReferenceContext,
  enforceAgentPlannerReferencePolicy,
} from '../../ai-takeover/core/agentPlannerReferencePolicy.ts';
import {
  applyAgentPlannerCapabilityContext,
  enforceAgentPlannerCapabilityPolicy,
  resolveAgentPlannerCapabilityContext,
} from '../../ai-takeover/core/agentPlannerCapabilityContext.ts';
import { getRuntimeOwnerId } from '../../../services/auth/runtimeSessionProfile.ts';
import { agentPermissionPolicy } from './AgentPermissionPolicy.ts';
import type { AgentRunRecord } from './AgentRunStore.ts';
import { agentSessionProjectionStore } from './agentSessionProjection.ts';
import { resolveAgentPlannerSessionContext } from './agentPlannerSessionContext.ts';
import {
  freezeAgentPlanExecutionTargets,
  normalizeAgentPlanSteps,
  validateAgentPlanStepInputs,
  validateAgentStepGraph,
  type AgentPlanningQueue,
} from './agentPlanCompiler.ts';
import { buildAgentReplacementPlan } from './agentReplanPolicy.ts';

const replanBrain = new LLMBrain();
const MAX_AGENT_STEPS = 20;

interface AgentReplanPlannerResult {
  candidatePlan: AssistantPlan;
  plannerContext: SanitizedProjectContext;
}

export interface CreateAgentReplanInput {
  record: AgentRunRecord;
  failure: AgentStepResultDto;
  freshContext: SanitizedProjectContext;
  ownerId: string;
  nextReplanCount: 1 | 2 | 3;
  collaborationMode: AssistantCollaborationMode;
  planningQueue: AgentPlanningQueue;
}

async function requestCandidate(input: CreateAgentReplanInput): Promise<AgentReplanPlannerResult> {
  if (input.freshContext.settings.apiKeyStatus === 'missing') {
    throw new Error('Bounded replanning requires an available cloud Planner.');
  }
  const capabilityContext = await resolveAgentPlannerCapabilityContext(input.ownerId);
  const sessionContext = resolveAgentPlannerSessionContext(
    input.record.sessionId,
    agentSessionProjectionStore,
    input.freshContext,
  );
  const referenceContext = applyAgentPlannerReferenceContext(
    input.record.userMessage,
    input.freshContext,
    sessionContext,
  );
  const plannerContext = applyAgentPlannerCapabilityContext(referenceContext, capabilityContext);
  let candidatePlan = await replanBrain.replan({
    originalUserInstruction: input.record.userMessage,
    previousPlan: input.record.plan as AssistantPlan,
    completedStepIds: input.record.completedStepIds || [],
    failure: {
      stepId: input.failure.stepId,
      toolName: input.failure.toolName,
      outcome: input.failure.outcome === 'rolled_back_failure' ? 'rolled_back_failure' : 'retryable_failure',
      verificationRule: input.failure.verificationRule,
    },
  }, plannerContext, input.freshContext.settings.selectedModel, sessionContext);
  if (getRuntimeOwnerId() !== input.ownerId) throw new Error('Agent owner changed during replanning.');
  candidatePlan = enforceAgentPlannerReferencePolicy(
    input.record.userMessage,
    candidatePlan,
    input.freshContext,
    sessionContext,
  );
  return {
    candidatePlan: enforceAgentPlannerCapabilityPolicy(candidatePlan, capabilityContext),
    plannerContext,
  };
}

function compileCandidate(
  input: CreateAgentReplanInput,
  plannerResult: AgentReplanPlannerResult,
): AssistantPlan {
  const frozenCandidate = freezeAgentPlanExecutionTargets(
    plannerResult.candidatePlan,
    input.planningQueue,
  );
  frozenCandidate.steps = normalizeAgentPlanSteps(frozenCandidate);
  let plan = buildAgentReplacementPlan({
    runId: input.record.id,
    previousPlan: input.record.plan as AssistantPlan,
    candidatePlan: frozenCandidate,
    completedStepIds: input.record.completedStepIds || [],
    failedStepId: input.failure.stepId,
    nextReplanCount: input.nextReplanCount,
  });
  for (const step of plan.steps || []) {
    const safetyCheck = agentPermissionPolicy.evaluateSafety(step.action);
    if (!safetyCheck.allowed) {
      throw new Error(safetyCheck.reason || 'Replacement plan was blocked by the safety policy.');
    }
  }
  validateAgentStepGraph(plan.steps || [], MAX_AGENT_STEPS);
  validateAgentPlanStepInputs(input.record.id, plan.steps || []);
  const confirmation = agentPermissionPolicy.evaluateConfirmation(plan, plannerResult.plannerContext);
  if (confirmation.required) return { ...plan, requiresConfirmation: true, confirmation };
  if (input.collaborationMode !== 'assist') return plan;
  plan = {
    ...plan,
    requiresConfirmation: true,
    confirmation: {
      title: 'AI 辅助建议已更新',
      summary: plan.reply || '执行失败后已生成新的安全计划。',
      confirmText: '执行新计划',
      cancelText: '暂不执行',
    },
  };
  return plan;
}

/** Produces one fully revalidated replacement plan from fresh owner-bound context. */
export async function createAgentReplan(input: CreateAgentReplanInput): Promise<AssistantPlan> {
  return compileCandidate(input, await requestCandidate(input));
}
