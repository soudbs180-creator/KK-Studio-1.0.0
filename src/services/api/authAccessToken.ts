import { supabase } from "../../lib/supabase.ts";
import { subscribeAuthSessionChange } from "../auth/authSessionEvents.ts";

const accessTokenStorageKey = "kk.api.access_token";
const ACCESS_TOKEN_SYNC_INTERVAL_MS = 4 * 60 * 1000;
const ACCESS_TOKEN_REFRESH_THRESHOLD_MS = 5 * 60 * 1000;
let inMemoryCompatibilityAccessToken: string | undefined;
let stopAccessTokenSessionSync: (() => void) | null = null;

function getSessionStorage(): Storage | undefined {
  if (typeof window === "undefined") {
    return undefined;
  }

  try {
    return window.sessionStorage;
  } catch {
    return undefined;
  }
}

function getLocalStorage(): Storage | undefined {
  if (typeof window === "undefined") {
    return undefined;
  }

  try {
    return window.localStorage;
  } catch {
    return undefined;
  }
}

function migrateLegacyLocalStorageToken(): string | undefined {
  const sessionStorage = getSessionStorage();
  const localStorage = getLocalStorage();
  const legacyToken = localStorage?.getItem(accessTokenStorageKey) || undefined;

  if (!legacyToken) {
    return undefined;
  }

  localStorage?.removeItem(accessTokenStorageKey);
  sessionStorage?.setItem(accessTokenStorageKey, legacyToken);
  inMemoryCompatibilityAccessToken = legacyToken;
  return legacyToken;
}

export function getStoredKkApiAccessToken(): string | undefined {
  const sessionStorage = getSessionStorage();
  const sessionToken = sessionStorage?.getItem(accessTokenStorageKey) || undefined;
  if (sessionToken) {
    inMemoryCompatibilityAccessToken = sessionToken;
    return sessionToken;
  }

  const migratedToken = migrateLegacyLocalStorageToken();
  if (migratedToken) {
    return migratedToken;
  }

  return inMemoryCompatibilityAccessToken;
}

export function setStoredKkApiAccessToken(token?: string) {
  const sessionStorage = getSessionStorage();
  const localStorage = getLocalStorage();

  if (!token) {
    inMemoryCompatibilityAccessToken = undefined;
    sessionStorage?.removeItem(accessTokenStorageKey);
    localStorage?.removeItem(accessTokenStorageKey);
    return;
  }

  inMemoryCompatibilityAccessToken = token;
  sessionStorage?.setItem(accessTokenStorageKey, token);
  localStorage?.removeItem(accessTokenStorageKey);
}

type SessionWithAccessToken = {
  access_token?: string | null;
  expires_at?: number | null;
};

export function shouldRefreshKkApiTokenSession(
  session: SessionWithAccessToken | null | undefined,
  nowMs = Date.now(),
): boolean {
  const expiresAtSeconds = Number(session?.expires_at || 0);
  if (!Number.isFinite(expiresAtSeconds) || expiresAtSeconds <= 0) {
    return false;
  }

  return expiresAtSeconds * 1000 - nowMs <= ACCESS_TOKEN_REFRESH_THRESHOLD_MS;
}

export async function syncStoredKkApiAccessTokenWithSupabaseSession(): Promise<string | undefined> {
  try {
    const { data } = await supabase.auth.getSession();
    let activeSession = data.session;

    if (shouldRefreshKkApiTokenSession(activeSession)) {
      const { data: refreshData, error: refreshError } = await supabase.auth.refreshSession();
      if (!refreshError && refreshData.session?.access_token) {
        activeSession = refreshData.session;
      }
    }

    const sessionAccessToken = activeSession?.access_token || undefined;
    if (sessionAccessToken) {
      if (sessionAccessToken !== getStoredKkApiAccessToken()) {
        setStoredKkApiAccessToken(sessionAccessToken);
      }
      return sessionAccessToken;
    }
  } catch {
    // Fall through to the stored compatibility token below.
  }

  return getStoredKkApiAccessToken();
}

export async function getPreferredKkApiAccessToken(): Promise<string | undefined> {
  return await syncStoredKkApiAccessTokenWithSupabaseSession();
}

export async function refreshPreferredKkApiAccessToken(): Promise<string | undefined> {
  try {
    const { data, error } = await supabase.auth.refreshSession();
    if (error) {
      return getStoredKkApiAccessToken();
    }

    const refreshedAccessToken = data.session?.access_token || undefined;
    if (refreshedAccessToken) {
      if (refreshedAccessToken !== getStoredKkApiAccessToken()) {
        setStoredKkApiAccessToken(refreshedAccessToken);
      }
      return refreshedAccessToken;
    }
  } catch {
    // Fall through to the stored compatibility token below.
  }

  return getStoredKkApiAccessToken();
}

export function startKkApiAccessTokenSessionSync(): () => void {
  if (typeof window === "undefined") {
    return () => {};
  }

  if (stopAccessTokenSessionSync) {
    return stopAccessTokenSessionSync;
  }

  const triggerSync = () => {
    void syncStoredKkApiAccessTokenWithSupabaseSession();
  };

  const handleWindowFocus = () => {
    triggerSync();
  };

  const handleVisibilityChange = () => {
    if (typeof document !== "undefined" && document.visibilityState === "visible") {
      triggerSync();
    }
  };

  const unsubscribe = subscribeAuthSessionChange((detail) => {
    if (!detail.hasSession || detail.isTempUser) {
      setStoredKkApiAccessToken(undefined);
      return;
    }

    if (detail.accessToken) {
      setStoredKkApiAccessToken(detail.accessToken);
    }

    triggerSync();
  });

  window.addEventListener("focus", handleWindowFocus);
  if (typeof document !== "undefined") {
    document.addEventListener("visibilitychange", handleVisibilityChange);
  }

  const intervalId = window.setInterval(triggerSync, ACCESS_TOKEN_SYNC_INTERVAL_MS);
  triggerSync();

  stopAccessTokenSessionSync = () => {
    window.clearInterval(intervalId);
    window.removeEventListener("focus", handleWindowFocus);
    if (typeof document !== "undefined") {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    }
    unsubscribe();
    stopAccessTokenSessionSync = null;
  };

  return stopAccessTokenSessionSync;
}
