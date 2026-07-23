import { AgentRunDtoSchema, type AgentFailureClass, type AgentRunDto, type AgentStepResultDto } from '@kk/shared';
import type { AssistantPlan } from '../../ai-takeover/types.ts';
import { createAssistantPlanHash, type AssistantAuthorizationScopeSnapshot } from './AssistantExecutionContext.ts';
import type { AgentRunRecord, AgentRunStore } from './AgentRunStore.ts';
import {
  evaluateAgentReplanPolicy,
  MAX_AGENT_REPLANS,
  type AgentReplanBlockReason,
  type AgentReplanRecoveryEvidence,
} from './agentReplanPolicy.ts';

interface AgentReplanApiResponse {
  success: boolean;
  data?: {
    ok: boolean;
    stale?: boolean;
    data?: AgentRunDto;
  };
}

interface AgentReplanRequestOptions {
  expectedAuthSubject: string;
}

export interface AgentReplanTransport {
  upsertAgentRun: (
    input: AgentRunRecord,
    options: AgentReplanRequestOptions,
  ) => Promise<AgentReplanApiResponse>;
  getAgentRun: (
    runId: string,
    options: AgentReplanRequestOptions,
  ) => Promise<AgentReplanApiResponse>;
}

export interface CoordinateAgentReplanInput {
  ownerId: string;
  runId: string;
  failure: AgentStepResultDto;
  failureClass?: AgentFailureClass;
  recovery: AgentReplanRecoveryEvidence;
  initialScope: AssistantAuthorizationScopeSnapshot;
  captureCurrentScope: () => AssistantAuthorizationScopeSnapshot;
  getCurrentOwnerId: () => string;
  store: AgentRunStore;
  transport: AgentReplanTransport;
  createReplacementPlan: (nextReplanCount: 1 | 2 | 3) => Promise<AssistantPlan>;
}

export type CoordinateAgentReplanResult =
  | { outcome: 'accepted'; record: AgentRunRecord }
  | { outcome: 'blocked'; reason: AgentReplanBlockReason };

const parseAuthoritativeRun = (response: AgentReplanApiResponse): AgentRunDto | undefined => {
  if (!response.success || response.data?.ok !== true || !response.data.data) return undefined;
  const parsed = AgentRunDtoSchema.safeParse(response.data.data);
  return parsed.success ? parsed.data : undefined;
};

const sameRunIdentity = (snapshot: AgentRunDto, record: AgentRunRecord): boolean => (
  snapshot.id === record.id
  && snapshot.userMessage === record.userMessage
  && snapshot.intent === record.intent
  && snapshot.sessionId === record.sessionId
);

const isExactPlan = (snapshot: AgentRunDto, plan: AssistantPlan): boolean => (
  createAssistantPlanHash(snapshot.plan) === createAssistantPlanHash(plan)
);

const isExactBaseline = (snapshot: AgentRunDto, record: AgentRunRecord): boolean => (
  sameRunIdentity(snapshot, record)
  && isExactPlan(snapshot, record.plan as AssistantPlan)
  && snapshot.status === record.status
);

async function recoverRunByGet(
  input: CoordinateAgentReplanInput,
): Promise<AgentRunDto | undefined> {
  if (input.getCurrentOwnerId() !== input.ownerId) return undefined;
  try {
    return parseAuthoritativeRun(await input.transport.getAgentRun(
      input.runId,
      { expectedAuthSubject: input.ownerId },
    ));
  } catch {
    return undefined;
  }
}

async function establishAuthoritativeBaseline(
  input: CoordinateAgentReplanInput,
  record: AgentRunRecord,
): Promise<AgentRunDto | undefined> {
  let authoritative: AgentRunDto | undefined;
  try {
    authoritative = parseAuthoritativeRun(await input.transport.upsertAgentRun(
      record,
      { expectedAuthSubject: input.ownerId },
    ));
  } catch {
    authoritative = await recoverRunByGet(input);
  }
  if (!authoritative) authoritative = await recoverRunByGet(input);
  return authoritative && isExactBaseline(authoritative, record) ? authoritative : undefined;
}

const nextUpdatedAt = (...timestamps: string[]): string => {
  const latest = timestamps.reduce((maximum, value) => {
    const parsed = Date.parse(value);
    return Number.isFinite(parsed) ? Math.max(maximum, parsed) : maximum;
  }, Date.now());
  return new Date(latest + 1).toISOString();
};

function createReplacementRecord(
  record: AgentRunRecord,
  plan: AssistantPlan,
  authoritative: AgentRunDto,
  nextReplanCount: 1 | 2 | 3,
): AgentRunRecord {
  const transportPlan = JSON.parse(JSON.stringify(plan)) as AssistantPlan;
  const status = plan.requiresConfirmation ? 'waiting_confirmation' : 'waiting_execution';
  return {
    ...record,
    plan: transportPlan,
    status,
    confirmationGrantedAt: undefined,
    replanCount: nextReplanCount,
    totalSteps: plan.steps?.length || plan.actions.length,
    nextStep: plan.requiresConfirmation
      ? 'The replacement plan requires fresh user confirmation.'
      : 'The server accepted the replacement plan; execution may resume.',
    updatedAt: nextUpdatedAt(record.updatedAt, authoritative.updatedAt),
    backendSyncState: 'pending',
  };
}

const isExactReplacement = (
  snapshot: AgentRunDto,
  replacement: AgentRunRecord,
  expectedReplanCount: number,
): boolean => sameRunIdentity(snapshot, replacement)
  && isExactPlan(snapshot, replacement.plan as AssistantPlan)
  && snapshot.status === replacement.status
  && snapshot.replanCount === expectedReplanCount;

async function persistReplacement(
  input: CoordinateAgentReplanInput,
  replacement: AgentRunRecord,
  expectedReplanCount: 1 | 2 | 3,
): Promise<AgentRunDto | undefined> {
  let authoritative: AgentRunDto | undefined;
  try {
    authoritative = parseAuthoritativeRun(await input.transport.upsertAgentRun(
      replacement,
      { expectedAuthSubject: input.ownerId },
    ));
  } catch {
    authoritative = await recoverRunByGet(input);
  }
  if (!authoritative || !isExactReplacement(authoritative, replacement, expectedReplanCount)) {
    authoritative = await recoverRunByGet(input);
  }
  return authoritative && isExactReplacement(authoritative, replacement, expectedReplanCount)
    ? authoritative
    : undefined;
}

function evaluateLivePolicy(
  input: CoordinateAgentReplanInput,
  record: AgentRunRecord,
) {
  return evaluateAgentReplanPolicy({
    record,
    failure: input.failure,
    failureClass: input.failureClass,
    recovery: input.recovery,
    initialScope: input.initialScope,
    currentScope: input.captureCurrentScope(),
  });
}

/** Coordinates one owner-bound compare-and-swap replacement before any new tool may execute. */
export async function coordinateAgentReplan(
  input: CoordinateAgentReplanInput,
): Promise<CoordinateAgentReplanResult> {
  const initialRecord = input.store.getRunForOwner(input.ownerId, input.runId);
  if (!initialRecord) return { outcome: 'blocked', reason: 'local_state_changed' };
  const initialDecision = evaluateLivePolicy(input, initialRecord);
  if (!initialDecision.allowed) return { outcome: 'blocked', reason: initialDecision.reason };
  if (input.ownerId === 'local_user' || input.getCurrentOwnerId() !== input.ownerId) {
    return { outcome: 'blocked', reason: 'authoritative_baseline_unavailable' };
  }
  const authoritative = await establishAuthoritativeBaseline(input, initialRecord);
  if (!authoritative) return { outcome: 'blocked', reason: 'authoritative_baseline_unavailable' };
  const authoritativeCount = authoritative.replanCount;
  if (!Number.isInteger(authoritativeCount) || authoritativeCount! >= MAX_AGENT_REPLANS) {
    return { outcome: 'blocked', reason: 'replan_limit_reached' };
  }
  const nextReplanCount = (authoritativeCount! + 1) as 1 | 2 | 3;
  let plan: AssistantPlan;
  try {
    plan = await input.createReplacementPlan(nextReplanCount);
  } catch {
    return { outcome: 'blocked', reason: 'planner_failed' };
  }
  const currentRecord = input.store.getRunForOwner(input.ownerId, input.runId);
  if (!currentRecord || !isExactPlan(authoritative, currentRecord.plan as AssistantPlan)) {
    return { outcome: 'blocked', reason: 'local_state_changed' };
  }
  const liveDecision = evaluateLivePolicy(input, currentRecord);
  if (!liveDecision.allowed) return { outcome: 'blocked', reason: liveDecision.reason };
  if (input.getCurrentOwnerId() !== input.ownerId) {
    return { outcome: 'blocked', reason: 'scope_changed' };
  }
  const replacement = createReplacementRecord(currentRecord, plan, authoritative, nextReplanCount);
  const accepted = await persistReplacement(input, replacement, nextReplanCount);
  if (!accepted) return { outcome: 'blocked', reason: 'server_rejected_replacement' };
  if (input.getCurrentOwnerId() !== input.ownerId) {
    return { outcome: 'blocked', reason: 'scope_changed' };
  }
  const applied = input.store.applyAuthoritativeReplan(
    accepted,
    currentRecord.updatedAt,
    replacement.plan,
    replacement.nextStep,
  );
  return applied
    ? { outcome: 'accepted', record: applied }
    : { outcome: 'blocked', reason: 'local_state_changed' };
}
