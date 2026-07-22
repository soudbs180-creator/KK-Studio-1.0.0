import type { AgentSessionDto } from '@kk/shared';
import { agentSessionProjectionStore } from '../../../../features/ai-assistant-runtime/runtime/agentSessionProjection.ts';
import { AGENT_PLANNER_SYSTEM_RULES } from '../../../../features/ai-takeover/core/agentPlannerContext.ts';
export {
  AGENT_PLANNER_SYSTEM_RULES as CHAT_AGENT_SESSION_SYSTEM_RULES,
} from '../../../../features/ai-takeover/core/agentPlannerContext.ts';
import {
  writeChatAgentSession,
  type ChatAgentSessionWriteOptions,
} from './chatAgentSessionWriteCoordinator.ts';
import type { ChatSessionItem } from './chatSessionData.ts';

/** Local Chat evidence available when one Agent Run is about to be created. */
export interface ChatAgentRunSessionBindingRequest {
  session?: ChatSessionItem | null;
  collaborationMode: 'direct' | 'assist' | 'takeover';
  maxTokens: number;
}

/** Bounded owner-stable dependencies for the optional Session promotion attempt. */
export interface ChatAgentRunSessionBindingOptions extends ChatAgentSessionWriteOptions {
  now?: () => number;
  timeoutMs?: number;
}

function toIsoString(value: number | undefined): string | undefined {
  const timestamp = new Date(value ?? Number.NaN).getTime();
  return Number.isFinite(timestamp) ? new Date(timestamp).toISOString() : undefined;
}

function isReusableProjection(
  authoritative: AgentSessionDto,
  createdAt: string,
  updatedAt: string,
): boolean {
  return authoritative.createdAt === createdAt
    && Date.parse(authoritative.updatedAt) >= Date.parse(updatedAt);
}

function createBindingSignal(options: ChatAgentRunSessionBindingOptions): AbortSignal {
  const timeoutMs = Math.min(10_000, Math.max(1, Math.trunc(options.timeoutMs ?? 3_000)));
  const timeoutSignal = AbortSignal.timeout(timeoutMs);
  return options.signal ? AbortSignal.any([options.signal, timeoutSignal]) : timeoutSignal;
}

/** Returns a Session binding only after an exact creation match and authoritative detail hydration. */
export async function resolveChatAgentRunSessionId(
  request: ChatAgentRunSessionBindingRequest,
  options: ChatAgentRunSessionBindingOptions = {},
): Promise<string | undefined> {
  const session = request.session;
  if (!session || session.isTemp || !session.agentSummary) return undefined;
  const createdAt = toIsoString(session.createdAt);
  const updatedAt = toIsoString(session.updatedAt);
  const heartbeatAt = toIsoString((options.now || Date.now)());
  if (!createdAt || !updatedAt || !heartbeatAt) return undefined;
  const store = options.store || agentSessionProjectionStore;
  const authoritative = store.getSession(session.id);
  if (authoritative && authoritative.createdAt !== createdAt) return undefined;
  if (authoritative && isReusableProjection(authoritative, createdAt, updatedAt)) return session.id;
  const writeOptions: ChatAgentSessionWriteOptions = {
    ownerId: options.ownerId,
    getOwnerId: options.getOwnerId,
    client: options.client,
    store,
    signal: createBindingSignal(options),
  };
  const result = await writeChatAgentSession({
    session,
    collaborationMode: request.collaborationMode,
    maxTokens: request.maxTokens,
    systemRules: AGENT_PLANNER_SYSTEM_RULES,
    createdAt,
    heartbeatAt,
    approvedDocumentAttachmentIds: new Set<string>(),
  }, writeOptions);
  if (!result.ok) return undefined;
  const hydrated = store.getSession(session.id);
  return hydrated && isReusableProjection(hydrated, createdAt, updatedAt) ? session.id : undefined;
}
