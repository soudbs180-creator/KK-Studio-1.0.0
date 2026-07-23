import {
  AgentSessionDtoSchema,
  AgentSessionUpsertDtoSchema,
  type AgentSessionDto,
  type AgentSessionUpsertDto,
} from '@kk/shared';
import { kkWebApiClient } from '../../../services/api/kkApiClient.ts';
import { getRuntimeOwnerId } from '../../../services/auth/runtimeSessionProfile.ts';
import {
  createAssistantPlanHash,
  isAssistantConfirmationGrantFresh,
  type AssistantConfirmationGrant,
} from './AssistantExecutionContext.ts';
import {
  AgentSessionProjectionStore,
  agentSessionProjectionStore,
} from './agentSessionProjection.ts';

export type AgentSessionConfirmationRecord = AgentSessionDto['confirmations'][number];

interface AgentSessionConfirmationApiResponse {
  success: boolean;
  data?: { ok?: unknown; data?: unknown; stale?: unknown };
  error?: { code?: string };
}

export interface AgentSessionConfirmationWriteClient {
  getAgentSession(
    sessionId: string,
    options?: { expectedAuthSubject?: string; signal?: AbortSignal },
  ): Promise<AgentSessionConfirmationApiResponse>;
  upsertAgentSession(
    input: AgentSessionUpsertDto,
    options?: { expectedAuthSubject?: string; signal?: AbortSignal },
  ): Promise<AgentSessionConfirmationApiResponse>;
}

export interface PersistAgentSessionConfirmationRequest {
  sessionId: string;
  ownerId: string;
  grant: AssistantConfirmationGrant;
}

export interface PersistAgentSessionConfirmationOptions {
  client?: AgentSessionConfirmationWriteClient;
  store?: AgentSessionProjectionStore;
  getOwnerId?: () => string;
  signal?: AbortSignal;
  now?: number;
}

export type PersistAgentSessionConfirmationResult =
  | { ok: true; grant: AssistantConfirmationGrant; session: AgentSessionDto }
  | { ok: false; reason: 'local_only' | 'owner_changed' | 'session_unavailable'
      | 'invalid_session_response' | 'confirmation_capacity' | 'write_unavailable'
      | 'confirmation_not_authoritative' };

interface ConfirmationWriteContext {
  ownerId: string;
  client: AgentSessionConfirmationWriteClient;
  store: AgentSessionProjectionStore;
  getOwnerId: () => string;
  signal?: AbortSignal;
  now: number;
}

const normalizeOwnerId = (ownerId: string): string => String(ownerId || '').trim() || 'local_user';

function createConfirmationId(grant: AssistantConfirmationGrant, toolId: string): string {
  const fingerprint = createAssistantPlanHash({
    runId: grant.runId,
    planHash: grant.planHash,
    toolId,
    targetSnapshotHash: grant.targetSnapshotHash,
    quoteId: grant.quoteId,
    maxCostCredits: grant.maxCostCredits,
    expiresAt: grant.expiresAt,
  }).replace(/[^a-zA-Z0-9]/g, '');
  return `confirmation_${fingerprint}`.slice(0, 200);
}

/** Produces only the bounded metadata permitted in the authoritative Session DTO. */
export function createAgentSessionConfirmationRecords(
  grant: AssistantConfirmationGrant,
): AgentSessionConfirmationRecord[] {
  return Array.from(new Set(grant.toolNames.map((toolName) => String(toolName).trim()).filter(Boolean)))
    .sort()
    .map((toolId) => ({
      id: createConfirmationId(grant, toolId),
      status: 'granted' as const,
      planHash: grant.planHash,
      toolId,
      targetSnapshotHash: grant.targetSnapshotHash,
      quoteId: grant.quoteId,
      maxCostCredits: grant.maxCostCredits,
      expiresAt: grant.expiresAt,
      decidedAt: grant.grantedAt,
    }));
}

/** Makes elapsed grants explicit during the next owner-stable Session write. */
export function expireAgentSessionConfirmations(
  confirmations: AgentSessionConfirmationRecord[],
  now = Date.now(),
): AgentSessionConfirmationRecord[] {
  const decidedAt = new Date(now).toISOString();
  return confirmations.map((confirmation) => {
    if (!['pending', 'granted'].includes(confirmation.status)) return { ...confirmation };
    const expiresAt = Date.parse(confirmation.expiresAt);
    if (Number.isFinite(expiresAt) && expiresAt > now) return { ...confirmation };
    return { ...confirmation, status: 'expired', decidedAt };
  });
}

function sameConfirmationRecord(
  actual: AgentSessionConfirmationRecord,
  expected: AgentSessionConfirmationRecord,
): boolean {
  return actual.status === 'granted'
    && actual.planHash === expected.planHash
    && actual.toolId === expected.toolId
    && actual.targetSnapshotHash === expected.targetSnapshotHash
    && actual.quoteId === expected.quoteId
    && actual.maxCostCredits === expected.maxCostCredits
    && actual.expiresAt === expected.expiresAt
    && actual.decidedAt === expected.decidedAt;
}

/** Requires an exact owner-bound authoritative Session proof for every confirmed tool. */
export function doesAgentSessionAuthorizeConfirmation(
  session: AgentSessionDto | undefined,
  grant: AssistantConfirmationGrant | undefined,
  now = Date.now(),
): boolean {
  if (!session || !grant || !isAssistantConfirmationGrantFresh(grant, now)) return false;
  const proof = grant.sessionConfirmation;
  if (!proof || session.ownerId !== grant.ownerId || session.sessionId !== proof.sessionId) return false;
  const expected = createAgentSessionConfirmationRecords(grant);
  const expectedIds = expected.map((confirmation) => confirmation.id).sort();
  const proofIds = [...proof.confirmationIds].sort();
  if (expectedIds.length === 0 || expectedIds.join('\0') !== proofIds.join('\0')) return false;
  if (Date.parse(session.updatedAt) < Date.parse(proof.sessionUpdatedAt)) return false;
  return expected.every((confirmation) => {
    const authoritative = session.confirmations.find((candidate) => candidate.id === confirmation.id);
    return Boolean(authoritative && sameConfirmationRecord(authoritative, confirmation));
  });
}

function resolveWriteContext(
  request: PersistAgentSessionConfirmationRequest,
  options: PersistAgentSessionConfirmationOptions,
): ConfirmationWriteContext {
  const getOwnerId = options.getOwnerId || getRuntimeOwnerId;
  return {
    ownerId: normalizeOwnerId(request.ownerId),
    client: options.client || kkWebApiClient,
    store: options.store || agentSessionProjectionStore,
    getOwnerId,
    signal: options.signal,
    now: options.now ?? Date.now(),
  };
}

const ownerChanged = (context: ConfirmationWriteContext): boolean => (
  normalizeOwnerId(context.getOwnerId()) !== context.ownerId
);

async function readAuthoritativeSession(
  sessionId: string,
  context: ConfirmationWriteContext,
): Promise<AgentSessionDto | PersistAgentSessionConfirmationResult> {
  try {
    const response = await context.client.getAgentSession(sessionId, {
      expectedAuthSubject: context.ownerId,
      signal: context.signal,
    });
    if (ownerChanged(context) || (!response.success && response.error?.code === 'AUTH_SUBJECT_CHANGED')) {
      return { ok: false, reason: 'owner_changed' };
    }
    if (!response.success) return { ok: false, reason: 'session_unavailable' };
    const parsed = AgentSessionDtoSchema.safeParse(response.data?.data);
    if (response.data?.ok !== true || !parsed.success
      || parsed.data.ownerId !== context.ownerId || parsed.data.sessionId !== sessionId) {
      return { ok: false, reason: 'invalid_session_response' };
    }
    return parsed.data;
  } catch {
    return { ok: false, reason: 'session_unavailable' };
  }
}

function buildSessionWrite(
  session: AgentSessionDto,
  grant: AssistantConfirmationGrant,
  context: ConfirmationWriteContext,
): AgentSessionUpsertDto | PersistAgentSessionConfirmationResult {
  const additions = createAgentSessionConfirmationRecords(grant);
  const replacementIds = new Set(additions.map((confirmation) => confirmation.id));
  const retained = expireAgentSessionConfirmations(session.confirmations, context.now)
    .filter((confirmation) => !replacementIds.has(confirmation.id));
  if (retained.length + additions.length > 100) return { ok: false, reason: 'confirmation_capacity' };
  const currentUpdatedAt = Date.parse(session.updatedAt);
  const updatedAt = new Date(Math.max(context.now, currentUpdatedAt + 1)).toISOString();
  const { ownerId: _ownerId, ...input } = {
    ...session,
    confirmations: [...retained, ...additions],
    lastHeartbeatAt: updatedAt,
    updatedAt,
  };
  const parsed = AgentSessionUpsertDtoSchema.safeParse(input);
  return parsed.success ? parsed.data : { ok: false, reason: 'confirmation_not_authoritative' };
}

function attachSessionProof(
  grant: AssistantConfirmationGrant,
  session: AgentSessionDto,
): AssistantConfirmationGrant {
  return {
    ...grant,
    sessionConfirmation: {
      sessionId: session.sessionId,
      confirmationIds: createAgentSessionConfirmationRecords(grant).map((record) => record.id),
      sessionUpdatedAt: session.updatedAt,
    },
  };
}

async function commitConfirmationWrite(
  input: AgentSessionUpsertDto,
  grant: AssistantConfirmationGrant,
  context: ConfirmationWriteContext,
): Promise<PersistAgentSessionConfirmationResult> {
  if (ownerChanged(context)) return { ok: false, reason: 'owner_changed' };
  try {
    const response = await context.client.upsertAgentSession(input, {
      expectedAuthSubject: context.ownerId,
      signal: context.signal,
    });
    if (ownerChanged(context) || (!response.success && response.error?.code === 'AUTH_SUBJECT_CHANGED')) {
      return { ok: false, reason: 'owner_changed' };
    }
    if (!response.success) return { ok: false, reason: 'write_unavailable' };
    const parsed = AgentSessionDtoSchema.safeParse(response.data?.data);
    if (response.data?.ok !== true || !parsed.success
      || parsed.data.ownerId !== context.ownerId || parsed.data.sessionId !== input.sessionId) {
      return { ok: false, reason: 'confirmation_not_authoritative' };
    }
    const confirmedGrant = attachSessionProof(grant, parsed.data);
    if (!doesAgentSessionAuthorizeConfirmation(parsed.data, confirmedGrant, context.now)) {
      return { ok: false, reason: 'confirmation_not_authoritative' };
    }
    if (!context.store.storeOwnerSession(context.ownerId, parsed.data)) {
      return { ok: false, reason: 'owner_changed' };
    }
    return { ok: true, grant: confirmedGrant, session: parsed.data };
  } catch {
    return { ok: false, reason: 'write_unavailable' };
  }
}

/** Persists a bound grant and accepts only the exact authoritative response as proof. */
export async function persistAgentSessionConfirmationGrant(
  request: PersistAgentSessionConfirmationRequest,
  options: PersistAgentSessionConfirmationOptions = {},
): Promise<PersistAgentSessionConfirmationResult> {
  const context = resolveWriteContext(request, options);
  if (context.ownerId === 'local_user') return { ok: false, reason: 'local_only' };
  if (ownerChanged(context) || request.grant.ownerId !== context.ownerId) {
    return { ok: false, reason: 'owner_changed' };
  }
  if (!isAssistantConfirmationGrantFresh(request.grant, context.now)) {
    return { ok: false, reason: 'confirmation_not_authoritative' };
  }
  const authoritative = await readAuthoritativeSession(request.sessionId, context);
  if ('ok' in authoritative) return authoritative;
  const input = buildSessionWrite(authoritative, request.grant, context);
  if ('ok' in input) return input;
  return commitConfirmationWrite(input, request.grant, context);
}
