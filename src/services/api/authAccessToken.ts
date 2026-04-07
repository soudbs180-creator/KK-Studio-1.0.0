import { supabase } from "../../lib/supabase.ts";
import { subscribeAuthSessionChange } from "../auth/authSessionEvents.ts";
import {
  getLatestStartupSnapshot,
  isStartupStageReady,
  subscribeStartupSnapshot,
} from "../system/appStartup.ts";

const accessTokenStorageKey = "kk.api.access_token";
const ACCESS_TOKEN_SYNC_INTERVAL_MS = 4 * 60 * 1000;
let inMemoryCompatibilityAccessToken: string | undefined;
let stopAccessTokenSessionSync: (() => void) | null = null;
let refreshAccessTokenPromise: Promise<string | undefined> | null = null;

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

export async function syncStoredKkApiAccessTokenWithSupabaseSession(): Promise<string | undefined> {
  try {
    // Treat background sync as a read-only path. Eager refreshes here can create
    // refresh-token rotation churn when many tabs or requests ask for a token at once.
    const { data } = await supabase.auth.getSession();
    const sessionAccessToken = data.session?.access_token || undefined;
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
  if (refreshAccessTokenPromise) {
    return refreshAccessTokenPromise;
  }

  // Collapse concurrent 401 retry paths onto a single refresh so we don't
  // serially rotate the refresh token several times in the same burst.
  refreshAccessTokenPromise = (async () => {
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
  })().finally(() => {
    refreshAccessTokenPromise = null;
  });

  return refreshAccessTokenPromise;
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
      return;
    }

    triggerSync();
  });

  let syncListenersAttached = false;
  let intervalId: number | null = null;

  const attachSyncListeners = () => {
    if (syncListenersAttached) {
      return;
    }

    syncListenersAttached = true;
    window.addEventListener("focus", handleWindowFocus);
    if (typeof document !== "undefined") {
      document.addEventListener("visibilitychange", handleVisibilityChange);
    }
    intervalId = window.setInterval(triggerSync, ACCESS_TOKEN_SYNC_INTERVAL_MS);
    triggerSync();
  };

  const detachSyncListeners = () => {
    if (!syncListenersAttached) {
      return;
    }

    syncListenersAttached = false;
    if (intervalId !== null) {
      window.clearInterval(intervalId);
      intervalId = null;
    }
    window.removeEventListener("focus", handleWindowFocus);
    if (typeof document !== "undefined") {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    }
  };

  const unsubscribeStartup = subscribeStartupSnapshot((snapshot) => {
    if (isStartupStageReady(snapshot.stage, "profile_ready")) {
      attachSyncListeners();
      return;
    }

    detachSyncListeners();
  });

  if (isStartupStageReady(getLatestStartupSnapshot().stage, "profile_ready")) {
    attachSyncListeners();
  }

  stopAccessTokenSessionSync = () => {
    detachSyncListeners();
    unsubscribeStartup();
    unsubscribe();
    stopAccessTokenSessionSync = null;
  };

  return stopAccessTokenSessionSync;
}
