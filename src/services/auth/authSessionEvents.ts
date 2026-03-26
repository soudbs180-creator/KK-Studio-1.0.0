export const AUTH_SESSION_CHANGE_EVENT = 'kk-auth-session-changed';

export interface AuthSessionChangeDetail {
  hasSession: boolean;
  userId: string | null;
  accessToken?: string;
  isTempUser: boolean;
}

function canUseWindow(): boolean {
  return typeof window !== 'undefined';
}

export function emitAuthSessionChange(detail: AuthSessionChangeDetail): void {
  if (!canUseWindow()) {
    return;
  }

  window.dispatchEvent(
    new CustomEvent<AuthSessionChangeDetail>(AUTH_SESSION_CHANGE_EVENT, {
      detail,
    }),
  );
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
