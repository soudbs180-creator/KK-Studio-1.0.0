import {
  AgentSessionDtoSchema,
  type AgentSessionDto,
  type KkApiClient,
} from '@kk/shared';
import { kkWebApiClient } from '../../../../services/api/kkApiClient.ts';
import { getRuntimeOwnerId } from '../../../../services/auth/runtimeSessionProfile.ts';
import {
  AgentSessionProjectionStore,
  agentSessionProjectionStore,
} from '../../../../features/ai-assistant-runtime/runtime/agentSessionProjection.ts';
import {
  buildChatAgentContextPlan,
  type ChatAgentContextEntry,
  type ChatAgentContextPlan,
} from './chatAgentContextBudget.ts';
import {
  buildAgentSessionProjection,
  type ChatSessionProjectionFailure,
} from './chatAgentSessionProjection.ts';
import {
  resolveCanonicalChatAssets,
  type CanonicalChatAssetFailure,
} from './chatCanonicalAssetResolver.ts';
import type { ChatSessionItem } from './chatSessionData.ts';

/** Minimal typed transport used by the Chat Session write boundary. */
export type ChatAgentSessionWriteClient = Pick<
  KkApiClient,
  'createAsset' | 'getAgentSession' | 'listAssets' | 'upsertAgentSession'
>;

/** Explicit evidence required to promote one local Chat projection to an Agent Session. */
export interface ChatAgentSessionWriteRequest {
  session: ChatSessionItem;
  collaborationMode: 'direct' | 'assist' | 'takeover';
  maxTokens: number;
  systemRules: string;
  createdAt: string;
  heartbeatAt: string;
  approvedDocumentAttachmentIds: ReadonlySet<string>;
  toolResults?: ChatAgentContextEntry[];
  canvasSnapshots?: ChatAgentContextEntry[];
  knowledgeRefs?: ChatAgentContextEntry[];
}

/** Dependency overrides keep identity, transport and projection storage testable. */
export interface ChatAgentSessionWriteOptions {
  ownerId?: string;
  getOwnerId?: () => string;
  client?: ChatAgentSessionWriteClient;
  store?: AgentSessionProjectionStore;
  signal?: AbortSignal;
}

/** Stable success and fail-closed outcomes exposed to future ChatSidebar activation. */
export type ChatAgentSessionWriteResult =
  | {
    ok: true;
    outcome: 'written' | 'authoritative_stale';
    session: AgentSessionDto;
    contextPlan: ChatAgentContextPlan;
  }
  | {
    ok: false;
    reason: 'local_only' | 'owner_changed' | 'missing_summary' | 'invalid_context_plan'
      | 'session_unavailable' | 'invalid_session_response' | 'write_unavailable'
      | 'invalid_write_response';
  }
  | { ok: false; reason: 'asset_rejected'; detail: CanonicalChatAssetFailure }
  | { ok: false; reason: 'projection_rejected'; detail: ChatSessionProjectionFailure };

interface ResolvedWriteContext {
  ownerId: string;
  getOwnerId: () => string;
  client: ChatAgentSessionWriteClient;
  store: AgentSessionProjectionStore;
  signal?: AbortSignal;
}

type AuthoritativeReadResult =
  | { ok: true; session?: AgentSessionDto }
  | { ok: false; reason: 'owner_changed' | 'session_unavailable' | 'invalid_session_response' };

function normalizeOwnerId(ownerId: string): string {
  return String(ownerId || '').trim() || 'local_user';
}

function resolveWriteContext(options: ChatAgentSessionWriteOptions): ResolvedWriteContext {
  const getOwnerId = options.getOwnerId || getRuntimeOwnerId;
  return {
    ownerId: normalizeOwnerId(options.ownerId || getOwnerId()),
    getOwnerId,
    client: options.client || kkWebApiClient,
    store: options.store || agentSessionProjectionStore,
    signal: options.signal,
  };
}

function ownerChanged(context: ResolvedWriteContext): boolean {
  return normalizeOwnerId(context.getOwnerId()) !== context.ownerId;
}

async function readAuthoritativeSession(
  sessionId: string,
  context: ResolvedWriteContext,
): Promise<AuthoritativeReadResult> {
  try {
    const response = await context.client.getAgentSession(sessionId, {
      expectedAuthSubject: context.ownerId,
      signal: context.signal,
    });
    if (ownerChanged(context) || (!response.success && response.error.code === 'AUTH_SUBJECT_CHANGED')) {
      return { ok: false, reason: 'owner_changed' };
    }
    if (!response.success) {
      return response.error.code === 'HTTP_404'
        ? { ok: true }
        : { ok: false, reason: 'session_unavailable' };
    }
    if (response.data?.ok !== true) return { ok: false, reason: 'invalid_session_response' };
    const parsed = AgentSessionDtoSchema.safeParse(response.data.data);
    if (!parsed.success || parsed.data.ownerId !== context.ownerId || parsed.data.sessionId !== sessionId) {
      return { ok: false, reason: 'invalid_session_response' };
    }
    return { ok: true, session: parsed.data };
  } catch {
    return { ok: false, reason: 'session_unavailable' };
  }
}

function createOwnerStableAssetApi(context: ResolvedWriteContext) {
  const options = { expectedAuthSubject: context.ownerId, signal: context.signal };
  return {
    listAssets: (input?: { limit?: number }) => context.client.listAssets(input, options),
    createAsset: (input: Parameters<ChatAgentSessionWriteClient['createAsset']>[0]) => (
      context.client.createAsset(input, options)
    ),
  };
}

async function resolveAssets(
  request: ChatAgentSessionWriteRequest,
  context: ResolvedWriteContext,
) {
  return resolveCanonicalChatAssets(request.session.messages, {
    api: createOwnerStableAssetApi(context),
    ownerId: context.ownerId,
    getOwnerId: context.getOwnerId,
    approvedDocumentAttachmentIds: request.approvedDocumentAttachmentIds,
  });
}

function buildContextPlan(request: ChatAgentSessionWriteRequest) {
  return buildChatAgentContextPlan({
    maxTokens: request.maxTokens,
    systemRules: request.systemRules,
    summary: request.session.agentSummary,
    messages: request.session.messages,
    toolResults: request.toolResults,
    canvasSnapshots: request.canvasSnapshots,
    knowledgeRefs: request.knowledgeRefs,
  });
}

async function commitSessionProjection(
  projection: ReturnType<typeof buildAgentSessionProjection> & { ok: true },
  contextPlan: ChatAgentContextPlan,
  context: ResolvedWriteContext,
): Promise<ChatAgentSessionWriteResult> {
  try {
    const response = await context.client.upsertAgentSession(projection.data, {
      expectedAuthSubject: context.ownerId,
      signal: context.signal,
    });
    if (ownerChanged(context) || (!response.success && response.error.code === 'AUTH_SUBJECT_CHANGED')) {
      return { ok: false, reason: 'owner_changed' };
    }
    if (!response.success) return { ok: false, reason: 'write_unavailable' };
    if (response.data?.ok !== true) return { ok: false, reason: 'invalid_write_response' };
    const parsed = AgentSessionDtoSchema.safeParse(response.data.data);
    if (!parsed.success
      || parsed.data.ownerId !== context.ownerId
      || parsed.data.sessionId !== projection.data.sessionId) {
      return { ok: false, reason: 'invalid_write_response' };
    }
    if (!context.store.storeOwnerSession(context.ownerId, parsed.data)) {
      return { ok: false, reason: 'owner_changed' };
    }
    return {
      ok: true,
      outcome: response.data.stale === true ? 'authoritative_stale' : 'written',
      session: parsed.data,
      contextPlan,
    };
  } catch {
    return { ok: false, reason: 'write_unavailable' };
  }
}

/** Writes one Chat Session only after every owner, Asset, budget and shared-schema gate passes. */
export async function writeChatAgentSession(
  request: ChatAgentSessionWriteRequest,
  options: ChatAgentSessionWriteOptions = {},
): Promise<ChatAgentSessionWriteResult> {
  const context = resolveWriteContext(options);
  if (context.ownerId === 'local_user') return { ok: false, reason: 'local_only' };
  if (ownerChanged(context)) return { ok: false, reason: 'owner_changed' };
  if (!request.session.agentSummary) return { ok: false, reason: 'missing_summary' };
  if (request.session.isTemp) {
    return { ok: false, reason: 'projection_rejected', detail: 'temporary_session' };
  }
  const contextPlan = buildContextPlan(request);
  if (!contextPlan.ok) return { ok: false, reason: 'invalid_context_plan' };
  const authoritative = await readAuthoritativeSession(request.session.id, context);
  if (!authoritative.ok) return authoritative;
  const assets = await resolveAssets(request, context);
  if (!assets.ok) return { ok: false, reason: 'asset_rejected', detail: assets.reason };
  const projection = buildAgentSessionProjection(request.session, {
    ownerId: context.ownerId,
    collaborationMode: request.collaborationMode,
    summary: request.session.agentSummary,
    tokenBudget: contextPlan.data.tokenBudget,
    canonicalAssetIds: assets.canonicalAssetIds,
    createdAt: request.createdAt,
    heartbeatAt: request.heartbeatAt,
    authoritativeBase: authoritative.session,
  });
  if (!projection.ok) return { ok: false, reason: 'projection_rejected', detail: projection.reason };
  return commitSessionProjection(projection, contextPlan.data, context);
}
