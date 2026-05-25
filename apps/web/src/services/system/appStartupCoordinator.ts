export type AppStartupStage =
  | 'anonymous'
  | 'session_ready'
  | 'profile_ready'
  | 'workspace_ready'
  | 'background_ready';

export type AppStartupIssueCode =
  | 'KK_API_UNREACHABLE'
  | 'KK_API_PROFILE_UNAVAILABLE'
  | 'KK_API_DEGRADED'
  | 'KK_API_AUTH_REJECTED';

export interface AppStartupIssue {
  code: AppStartupIssueCode;
  message: string;
  severity: 'warning' | 'error';
}

export interface AppStartupSnapshot {
  stage: AppStartupStage;
  userId: string | null;
  issues: AppStartupIssue[];
  updatedAt: number;
}

type StartupListener = (snapshot: AppStartupSnapshot) => void;

const stageOrder: Record<AppStartupStage, number> = {
  anonymous: 0,
  session_ready: 1,
  profile_ready: 2,
  workspace_ready: 3,
  background_ready: 4,
};

const listeners = new Set<StartupListener>();

let snapshot: AppStartupSnapshot = {
  stage: 'anonymous',
  userId: null,
  issues: [],
  updatedAt: Date.now(),
};

function cloneIssues(issues: AppStartupIssue[]): AppStartupIssue[] {
  return issues.map((issue) => ({ ...issue }));
}

function emit(): void {
  const nextSnapshot = getAppStartupSnapshot();
  listeners.forEach((listener) => {
    listener(nextSnapshot);
  });
}

function normalizeUserId(userId: string | null | undefined): string | null {
  const normalized = String(userId || '').trim();
  return normalized || null;
}

export function getAppStartupSnapshot(): AppStartupSnapshot {
  return {
    ...snapshot,
    issues: cloneIssues(snapshot.issues),
  };
}

export function subscribeAppStartup(
  listener: StartupListener,
): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function resetAppStartup(userId?: string | null): void {
  snapshot = {
    stage: 'anonymous',
    userId: normalizeUserId(userId),
    issues: [],
    updatedAt: Date.now(),
  };
  emit();
}

export function setAppStartupStage(
  stage: AppStartupStage,
  options?: {
    userId?: string | null;
    issues?: AppStartupIssue[];
    replaceIssues?: boolean;
  },
): void {
  const nextUserId = normalizeUserId(options?.userId) ?? snapshot.userId;
  const nextStageOrder = stageOrder[stage];
  const currentStageOrder = snapshot.userId === nextUserId
    ? stageOrder[snapshot.stage]
    : stageOrder.anonymous;
  const resolvedStage = nextStageOrder >= currentStageOrder
    ? stage
    : snapshot.stage;

  const mergedIssues = options?.replaceIssues
    ? cloneIssues(options?.issues || [])
    : dedupeIssues([
        ...snapshot.issues,
        ...(options?.issues || []),
      ]);

  snapshot = {
    stage: resolvedStage,
    userId: nextUserId,
    issues: mergedIssues,
    updatedAt: Date.now(),
  };
  emit();
}

function dedupeIssues(issues: AppStartupIssue[]): AppStartupIssue[] {
  const seen = new Set<string>();
  const deduped: AppStartupIssue[] = [];

  issues.forEach((issue) => {
    const key = `${issue.code}|${issue.message}|${issue.severity}`;
    if (seen.has(key)) {
      return;
    }
    seen.add(key);
    deduped.push({ ...issue });
  });

  return deduped;
}

export function hasReachedAppStartupStage(
  stage: AppStartupStage,
  userId?: string | null,
): boolean {
  const expectedUserId = normalizeUserId(userId);
  if (expectedUserId && snapshot.userId && snapshot.userId !== expectedUserId) {
    return false;
  }

  return stageOrder[snapshot.stage] >= stageOrder[stage];
}

export async function waitForAppStartupStage(
  stage: AppStartupStage,
  options?: {
    timeoutMs?: number;
    userId?: string | null;
  },
): Promise<boolean> {
  if (hasReachedAppStartupStage(stage, options?.userId)) {
    return true;
  }

  const timeoutMs = Math.max(0, Number(options?.timeoutMs || 0));

  return await new Promise<boolean>((resolve) => {
    let timeoutId: ReturnType<typeof setTimeout> | null = null;
    let settled = false;

    const finish = (result: boolean) => {
      if (settled) {
        return;
      }
      settled = true;
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
      unsubscribe();
      resolve(result);
    };

    const unsubscribe = subscribeAppStartup((nextSnapshot) => {
      const expectedUserId = normalizeUserId(options?.userId);
      if (expectedUserId && nextSnapshot.userId && nextSnapshot.userId !== expectedUserId) {
        return;
      }

      if (stageOrder[nextSnapshot.stage] >= stageOrder[stage]) {
        finish(true);
      }
    });

    if (timeoutMs > 0) {
      timeoutId = setTimeout(() => finish(false), timeoutMs);
    }
  });
}
