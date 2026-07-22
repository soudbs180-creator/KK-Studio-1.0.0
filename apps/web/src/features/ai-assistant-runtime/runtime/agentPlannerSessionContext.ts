import {
  buildAgentPlannerSessionContext,
  type AgentPlannerSessionContext,
} from '../../ai-takeover/core/agentPlannerContext.ts';
import {
  AgentSessionProjectionStore,
  agentSessionProjectionStore,
} from './agentSessionProjection.ts';

/** Resolves only an exact, owner-scoped authoritative Session detail for Planner consumption. */
export function resolveAgentPlannerSessionContext(
  sessionId: string | undefined,
  store: AgentSessionProjectionStore = agentSessionProjectionStore,
): AgentPlannerSessionContext | undefined {
  const normalizedSessionId = String(sessionId || '').trim();
  if (!normalizedSessionId || normalizedSessionId.length > 200) return undefined;
  const session = store.getSession(normalizedSessionId);
  if (!session || session.sessionId !== normalizedSessionId) return undefined;
  return buildAgentPlannerSessionContext(session);
}
