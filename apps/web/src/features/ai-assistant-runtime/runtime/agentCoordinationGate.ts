import type {
  AgentCoordinationAdmissionDto,
  AgentCoordinationMutationResultDto,
  AgentCoordinationPriority,
  AgentCoordinationRiskClass,
  AgentCoordinationRole,
  AgentCoordinationSnapshotDto,
} from '@kk/shared';
import type { AssistantPlan, SanitizedProjectContext } from '../../ai-takeover/types.ts';
import { kkWebApiClient } from '../../../services/api/kkApiClient.ts';
import { getRuntimeOwnerId } from '../../../services/auth/runtimeSessionProfile.ts';
import { toolRegistryInstance } from '../tools/ToolRegistry.ts';

export interface AgentCoordinationHandle {
  taskId: string;
  agentId: string;
  role: AgentCoordinationRole;
  version: number;
  epoch: number;
}

export interface AgentCoordinationAdmissionResult {
  required: boolean;
  allowed: boolean;
  reason?: string;
  handle?: AgentCoordinationHandle;
}

const CRITICAL_ACTIONS = new Set([
  'billing.debitCredits',
  'billing.refundCredits',
  'account.updateProfile',
  'project.delete',
]);

const getPlanActions = (plan: AssistantPlan) => (
  plan.steps && plan.steps.length > 0 ? plan.steps.map((step) => step.action) : plan.actions
);

function getAgentId(ownerId: string): string {
  try {
    const key = 'kk_agent_coordination_instance_id';
    const existing = sessionStorage.getItem(key);
    if (existing) return existing;
    const created = `web:${ownerId}:${Date.now()}:${Math.random().toString(36).slice(2, 8)}`;
    sessionStorage.setItem(key, created);
    return created;
  } catch {
    return `web:${ownerId}:ephemeral`;
  }
}

function classifyPlan(plan: AssistantPlan, context?: SanitizedProjectContext) {
  const actions = getPlanActions(plan);
  const controls = actions.map((action) => toolRegistryInstance.getTool(action.type)?.control);
  const mutationControls = controls.filter((control) => control?.effect === 'mutation');
  const actionTypes = actions.map((action) => action.type);
  const hasCriticalAction = actionTypes.some((actionType) => CRITICAL_ACTIONS.has(actionType));
  const hasExternalEffect = mutationControls.some((control) => (
    control?.impact.scope === 'external' || control?.impact.scope === 'account'
    || control?.cost.kind === 'credits' || control?.cost.kind === 'provider'
  ));
  const riskClass: AgentCoordinationRiskClass = hasCriticalAction
    ? 'critical'
    : hasExternalEffect ? 'high' : mutationControls.length > 0 ? 'medium' : 'low';
  const priority: AgentCoordinationPriority = riskClass === 'critical'
    ? 'critical'
    : plan.requiresConfirmation || riskClass === 'high' ? 'urgent' : 'normal';
  const canvasId = context?.runtime?.canvas.id || context?.canvas.id || 'active';
  const resourceKeys = new Set<string>();
  for (const control of mutationControls) {
    if (control?.impact.scope === 'canvas') resourceKeys.add(`canvas:${canvasId}`);
    if (control?.impact.scope === 'selection') resourceKeys.add(`selection:${canvasId}`);
    if (control?.impact.scope === 'workspace') resourceKeys.add('workspace');
    if (control?.impact.scope === 'account') resourceKeys.add('account');
    if (control?.impact.scope === 'external') resourceKeys.add('external');
  }
  return { mutation: mutationControls.length > 0, riskClass, priority, resourceKeys: [...resourceKeys] };
}

function maxRoundsFor(riskClass: AgentCoordinationRiskClass): number {
  return { low: 4, medium: 6, high: 8, critical: 12 }[riskClass];
}

function makeTaskId(runId: string, attemptKey: string): string {
  return `coord_${runId}_${attemptKey}`.replace(/[^a-zA-Z0-9_.:-]/g, '_').slice(0, 200);
}

/** Admits mutation plans through the server control plane and blocks unsafe high-risk fallbacks. */
export async function admitAgentPlan(
  runId: string,
  plan: AssistantPlan,
  context: SanitizedProjectContext | undefined,
  attemptKey: string,
): Promise<AgentCoordinationAdmissionResult> {
  const ownerId = getRuntimeOwnerId();
  const classification = classifyPlan(plan, context);
  if (!classification.mutation) return { required: false, allowed: true };
  if (ownerId === 'local_user') {
    const blocked = classification.riskClass === 'high' || classification.riskClass === 'critical';
    return {
      required: true,
      allowed: !blocked,
      reason: blocked ? 'High-risk Agent mutations require an authenticated coordination authority.' : undefined,
    };
  }
  const input: AgentCoordinationAdmissionDto = {
    taskId: makeTaskId(runId, attemptKey),
    runId,
    agentId: getAgentId(ownerId),
    role: 'executor',
    riskClass: classification.riskClass,
    priority: classification.priority,
    resourceKeys: classification.resourceKeys,
    maxRounds: maxRoundsFor(classification.riskClass),
    idempotencyKey: `coordination:${runId}:${attemptKey}`,
  };
  const response = await kkWebApiClient.admitAgentCoordinationTask(input, { expectedAuthSubject: ownerId });
  const outcome = response.success && response.data?.ok === true ? response.data.data : undefined;
  if (!outcome) return { required: true, allowed: false, reason: 'Coordination admission was unavailable.' };
  if (outcome.accepted && !outcome.data) {
    return { required: true, allowed: false, reason: 'Coordination admission returned no authoritative snapshot.' };
  }
  return {
    required: true,
    allowed: outcome.accepted,
    reason: outcome.reason,
    handle: outcome.accepted ? toHandle(outcome.data!) : undefined,
  };
}

function toHandle(snapshot: AgentCoordinationSnapshotDto): AgentCoordinationHandle {
  return {
    taskId: snapshot.taskId,
    agentId: snapshot.agentId,
    role: snapshot.role,
    version: snapshot.version,
    epoch: snapshot.epoch,
  };
}

async function mutateCoordination(
  handle: AgentCoordinationHandle,
  nextState: 'running' | 'completed' | 'failed' | 'cancelled',
  reason?: string,
): Promise<AgentCoordinationMutationResultDto> {
  const ownerId = getRuntimeOwnerId();
  const response = await kkWebApiClient.transitionAgentCoordinationTask(handle.taskId, {
    expectedVersion: handle.version,
    expectedEpoch: handle.epoch,
    agentId: handle.agentId,
    role: handle.role,
    nextState,
    reason,
    idempotencyKey: `${handle.taskId}:${nextState}:${handle.version}`,
  }, { expectedAuthSubject: ownerId });
  const outcome = response.success && response.data?.ok === true ? response.data.data : undefined;
  if (outcome?.outcome === 'accepted' && outcome.data) {
    handle.version = outcome.data.version;
    handle.epoch = outcome.data.epoch;
  }
  return outcome || { outcome: 'rejected', reason: 'Coordination transition was unavailable.' };
}

/** Changes the authoritative task state and returns false on a stale or fenced command. */
export async function transitionAgentPlan(
  handle: AgentCoordinationHandle,
  nextState: 'running' | 'completed' | 'failed' | 'cancelled',
  reason?: string,
): Promise<boolean> {
  const result = await mutateCoordination(handle, nextState, reason);
  return result.outcome === 'accepted';
}

/** Renews the claim lease and aborts local execution when the authority is lost. */
export function startAgentCoordinationHeartbeat(
  handle: AgentCoordinationHandle,
  onLeaseLost: () => void,
): () => void {
  if (getRuntimeOwnerId() === 'local_user') return () => {};
  let stopped = false;
  let inFlight = false;
  const timer = setInterval(() => {
    if (stopped || inFlight) return;
    inFlight = true;
    const ownerId = getRuntimeOwnerId();
    void kkWebApiClient.heartbeatAgentCoordinationTask(handle.taskId, {
      expectedVersion: handle.version,
      expectedEpoch: handle.epoch,
      agentId: handle.agentId,
      role: handle.role,
      idempotencyKey: `${handle.taskId}:heartbeat:${handle.version}`,
    }, { expectedAuthSubject: ownerId }).then((response) => {
      const outcome = response.success && response.data?.ok === true ? response.data.data : undefined;
      if (outcome?.outcome !== 'accepted' || !outcome.data) {
        stopped = true;
        clearInterval(timer);
        onLeaseLost();
      }
      else {
        handle.version = outcome.data.version;
        handle.epoch = outcome.data.epoch;
      }
    }).catch(() => {
      stopped = true;
      clearInterval(timer);
      onLeaseLost();
    }).finally(() => {
      inFlight = false;
    });
  }, 20_000);
  return () => {
    stopped = true;
    clearInterval(timer);
  };
}
