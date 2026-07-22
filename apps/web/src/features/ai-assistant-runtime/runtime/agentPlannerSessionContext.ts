import {
  buildAgentPlannerSessionContext,
  type AgentPlannerSessionContext,
} from '../../ai-takeover/core/agentPlannerContext.ts';
import {
  AgentSessionProjectionStore,
  agentSessionProjectionStore,
} from './agentSessionProjection.ts';
import type { SanitizedProjectContext } from '../../ai-takeover/types.ts';

const MAX_SNAPSHOT_CLOCK_SKEW_MS = 5 * 60 * 1_000;

function resolveCompatibleSnapshot(
  sessionId: string,
  summaryUpdatedAt: string,
  store: AgentSessionProjectionStore,
  projectContext: SanitizedProjectContext | undefined,
  now: () => number,
) {
  if (!projectContext) return undefined;
  const snapshot = store.getContextSnapshot(sessionId);
  if (!snapshot || snapshot.sessionId !== sessionId) return undefined;
  const currentSurface = projectContext.runtime?.currentPage || projectContext.currentPage;
  const currentCanvasId = String(projectContext.runtime?.canvas.id || projectContext.canvas.id || '').trim();
  const capturedAt = Date.parse(snapshot.capturedAt);
  const summaryAt = Date.parse(summaryUpdatedAt);
  if (snapshot.activeSurface !== currentSurface) return undefined;
  if (snapshot.canvasId || currentCanvasId) {
    if (!snapshot.canvasId || !currentCanvasId || snapshot.canvasId !== currentCanvasId) return undefined;
  }
  if (!Number.isFinite(capturedAt) || !Number.isFinite(summaryAt) || capturedAt <= summaryAt) return undefined;
  if (capturedAt > now() + MAX_SNAPSHOT_CLOCK_SKEW_MS) return undefined;
  return snapshot;
}

/** Resolves only an exact, owner-scoped authoritative Session detail for Planner consumption. */
export function resolveAgentPlannerSessionContext(
  sessionId: string | undefined,
  store: AgentSessionProjectionStore = agentSessionProjectionStore,
  projectContext?: SanitizedProjectContext,
  now: () => number = Date.now,
): AgentPlannerSessionContext | undefined {
  const normalizedSessionId = String(sessionId || '').trim();
  if (!normalizedSessionId || normalizedSessionId.length > 200) return undefined;
  const session = store.getSession(normalizedSessionId);
  if (!session || session.sessionId !== normalizedSessionId) return undefined;
  const snapshot = resolveCompatibleSnapshot(
    normalizedSessionId,
    session.summary.updatedAt,
    store,
    projectContext,
    now,
  );
  return buildAgentPlannerSessionContext(session, snapshot);
}
