export const APP_STARTUP_STAGES = [
  'signed_out',
  'session_ready',
  'profile_ready',
  'workspace_ready',
  'background_ready',
] as const;

export type AppStartupStage = (typeof APP_STARTUP_STAGES)[number];

const startupStageRank = new Map<AppStartupStage, number>(
  APP_STARTUP_STAGES.map((stage, index) => [stage, index]),
);

export interface AppStartupSnapshot {
  stage: AppStartupStage;
  userId: string | null;
  updatedAt: number;
}

type StartupListener = (snapshot: AppStartupSnapshot) => void;

const startupListeners = new Set<StartupListener>();

let latestStartupSnapshot: AppStartupSnapshot = {
  stage: 'signed_out',
  userId: null,
  updatedAt: Date.now(),
};

function normalizeUserId(userId: string | null | undefined): string | null {
  const normalized = String(userId || '').trim();
  return normalized || null;
}

export function compareStartupStages(
  left: AppStartupStage,
  right: AppStartupStage,
): number {
  return (startupStageRank.get(left) || 0) - (startupStageRank.get(right) || 0);
}

export function isStartupStageReady(
  currentStage: AppStartupStage,
  requiredStage: AppStartupStage,
): boolean {
  return compareStartupStages(currentStage, requiredStage) >= 0;
}

export function clampStartupStage(
  requestedStage: AppStartupStage,
  fallbackStage: AppStartupStage,
): AppStartupStage {
  return startupStageRank.has(requestedStage) ? requestedStage : fallbackStage;
}

export function getLatestStartupSnapshot(): AppStartupSnapshot {
  return { ...latestStartupSnapshot };
}

export function setLatestStartupSnapshot(
  stage: AppStartupStage,
  userId?: string | null,
): void {
  latestStartupSnapshot = {
    stage: clampStartupStage(stage, 'signed_out'),
    userId: normalizeUserId(userId) ?? latestStartupSnapshot.userId,
    updatedAt: Date.now(),
  };

  const nextSnapshot = getLatestStartupSnapshot();
  startupListeners.forEach((listener) => {
    listener(nextSnapshot);
  });
}

export function subscribeStartupSnapshot(
  listener: StartupListener,
): () => void {
  startupListeners.add(listener);
  return () => {
    startupListeners.delete(listener);
  };
}
