import {
  getLatestAuthSessionChange,
  subscribeAuthSessionChange,
} from "../auth/authSessionEvents.ts";

const accessTokenStorageKey = "kk.api.access_token";
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

function syncFromLatestAuthSessionChange(): string | undefined {
  const latestSessionChange = getLatestAuthSessionChange();
  if (!latestSessionChange) {
    return getStoredKkApiAccessToken();
  }

  if (!latestSessionChange.hasSession || latestSessionChange.isTempUser) {
    setStoredKkApiAccessToken(undefined);
    return undefined;
  }

  if (latestSessionChange.accessToken) {
    setStoredKkApiAccessToken(latestSessionChange.accessToken);
    return latestSessionChange.accessToken;
  }

  return getStoredKkApiAccessToken();
}

export async function syncStoredKkApiAccessTokenWithSupabaseSession(): Promise<string | undefined> {
  return syncFromLatestAuthSessionChange();
}

export async function getPreferredKkApiAccessToken(): Promise<string | undefined> {
  return syncFromLatestAuthSessionChange();
}

export async function refreshPreferredKkApiAccessToken(): Promise<string | undefined> {
  return syncFromLatestAuthSessionChange();
}

export function startKkApiAccessTokenSessionSync(): () => void {
  if (typeof window === "undefined") {
    return () => {};
  }

  if (stopAccessTokenSessionSync) {
    return stopAccessTokenSessionSync;
  }

  const unsubscribe = subscribeAuthSessionChange((detail) => {
    if (!detail.hasSession || detail.isTempUser) {
      setStoredKkApiAccessToken(undefined);
      return;
    }

    if (detail.accessToken) {
      setStoredKkApiAccessToken(detail.accessToken);
    }
  });

  syncFromLatestAuthSessionChange();

  stopAccessTokenSessionSync = () => {
    unsubscribe();
    stopAccessTokenSessionSync = null;
  };

  return stopAccessTokenSessionSync;
}
