export const AUTH_SESSION_CHANGE_EVENT = 'kk-auth-session-changed';
export const AUTH_SESSION_INVALIDATION_REQUEST_EVENT = 'kk-auth-session-invalidation-request';

export interface AuthSessionChangeDetail {
  hasSession: boolean;
  userId: string | null;
  accessToken?: string;
  refreshToken?: string;
  isTempUser: boolean;
}

let latestAuthSessionChangeDetail: AuthSessionChangeDetail | null = null;

function canUseWindow(): boolean {
  return typeof window !== 'undefined';
}

export function emitAuthSessionChange(detail: AuthSessionChangeDetail): void {
  latestAuthSessionChangeDetail = {
    ...detail,
    userId: detail.userId ? String(detail.userId) : null,
    accessToken: detail.accessToken ? String(detail.accessToken) : undefined,
    refreshToken: detail.refreshToken ? String(detail.refreshToken) : undefined,
    isTempUser: detail.isTempUser === true,
    hasSession: detail.hasSession === true,
  };

  if (!canUseWindow()) {
    return;
  }

  window.dispatchEvent(
    new CustomEvent<AuthSessionChangeDetail>(AUTH_SESSION_CHANGE_EVENT, {
      detail: latestAuthSessionChangeDetail,
    }),
  );
}

export function getLatestAuthSessionChange(): AuthSessionChangeDetail | null {
  return latestAuthSessionChangeDetail
    ? { ...latestAuthSessionChangeDetail }
    : null;
}

export function requestAuthSessionInvalidation(reason: string): void {
  if (!canUseWindow()) {
    return;
  }

  const normalizedReason = String(reason || '').trim();
  window.dispatchEvent(
    new CustomEvent<string>(AUTH_SESSION_INVALIDATION_REQUEST_EVENT, {
      detail: normalizedReason,
    }),
  );
}

export function subscribeAuthSessionInvalidationRequest(
  listener: (reason: string) => void,
): () => void {
  if (!canUseWindow()) {
    return () => {};
  }

  const handler = (event: Event) => {
    const detail = (event as CustomEvent<string>).detail;
    listener(String(detail || '').trim());
  };

  window.addEventListener(AUTH_SESSION_INVALIDATION_REQUEST_EVENT, handler as EventListener);
  return () => {
    window.removeEventListener(AUTH_SESSION_INVALIDATION_REQUEST_EVENT, handler as EventListener);
  };
}

export function subscribeAuthSessionChange(
  listener: (detail: AuthSessionChangeDetail) => void,
): () => void {
  if (!canUseWindow()) {
    return () => {};
  }

  const handler = (event: Event) => {
    const detail = (event as CustomEvent<AuthSessionChangeDetail>).detail;
    if (!detail) {
      return;
    }
    listener(detail);
  };

  window.addEventListener(AUTH_SESSION_CHANGE_EVENT, handler as EventListener);
  return () => {
    window.removeEventListener(AUTH_SESSION_CHANGE_EVENT, handler as EventListener);
  };
}

export async function waitForAuthSessionChange(
  predicate: (detail: AuthSessionChangeDetail) => boolean,
  timeoutMs = 1500,
): Promise<AuthSessionChangeDetail | null> {
  if (!canUseWindow()) {
    return null;
  }

  return await new Promise<AuthSessionChangeDetail | null>((resolve) => {
    let settled = false;

    const cleanup = () => {
      if (settled) {
        return;
      }
      settled = true;
      window.clearTimeout(timeoutId);
      unsubscribe();
    };

    const unsubscribe = subscribeAuthSessionChange((detail) => {
      if (!predicate(detail)) {
        return;
      }

      cleanup();
      resolve(detail);
    });

    const timeoutId = window.setTimeout(() => {
      cleanup();
      resolve(null);
    }, Math.max(0, timeoutMs));
  });
}
