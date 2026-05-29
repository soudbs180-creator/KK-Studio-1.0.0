import {
  getLatestAuthSessionChange,
  subscribeAuthSessionChange,
} from "../auth/authSessionEvents.ts";
import {
  applyHostedSessionToRuntime,
  clearHostedSessionRuntime,
  refreshHostedSessionFromServer,
  restoreHostedSessionFromServer,
} from "../auth/kkApiSessionBootstrap.ts";

const accessTokenStorageKey = "kk.api.access_token";
let inMemoryCompatibilityAccessToken: string | undefined;
let stopAccessTokenSessionSync: (() => void) | null = null;
let hostedRefreshPromise: Promise<string | undefined> | null = null;

function normalizeHostname(value: unknown): string | undefined {
  const normalized = typeof value === "string" ? value.trim().toLowerCase().replace(/^\[|\]$/g, "") : "";
  return normalized || undefined;
}

function isLoopbackHostname(hostname: string | undefined): boolean {
  const normalized = normalizeHostname(hostname);
  return normalized === "localhost"
    || normalized === "::1"
    || Boolean(normalized && normalized.startsWith("127."));
}

function isPrivateNetworkHostname(hostname: string | undefined): boolean {
  const normalized = normalizeHostname(hostname);
  return Boolean(
    normalized
    && (
      /^10\./.test(normalized)
      || /^192\.168\./.test(normalized)
      || /^172\.(1[6-9]|2\d|3[0-1])\./.test(normalized)
    )
  );
}

function shouldPersistAccessTokenDurably(): boolean {
  // 简体中文：为保证用户在任何域名/公网 IP 下刷新或重新打开页面均不需要重新登录，一律在 localStorage 中持久化 Access Token
  return true;
}

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

function syncDurableTokenIntoSession(token: string | undefined): string | undefined {
  if (!token) {
    return undefined;
  }

  const sessionStorage = getSessionStorage();
  if (sessionStorage?.getItem(accessTokenStorageKey) !== token) {
    sessionStorage?.setItem(accessTokenStorageKey, token);
  }
  inMemoryCompatibilityAccessToken = token;
  return token;
}

export function getStoredKkApiAccessToken(): string | undefined {
  const sessionStorage = getSessionStorage();
  const localStorage = getLocalStorage();

  if (shouldPersistAccessTokenDurably()) {
    const durableToken = localStorage?.getItem(accessTokenStorageKey)
      || sessionStorage?.getItem(accessTokenStorageKey)
      || undefined;
    if (durableToken) {
      localStorage?.setItem(accessTokenStorageKey, durableToken);
      return syncDurableTokenIntoSession(durableToken);
    }
  } else {
    const sessionToken = sessionStorage?.getItem(accessTokenStorageKey) || undefined;
    if (sessionToken) {
      inMemoryCompatibilityAccessToken = sessionToken;
      return sessionToken;
    }

    const migratedToken = migrateLegacyLocalStorageToken();
    if (migratedToken) {
      return migratedToken;
    }
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
  if (shouldPersistAccessTokenDurably()) {
    localStorage?.setItem(accessTokenStorageKey, token);
  } else {
    localStorage?.removeItem(accessTokenStorageKey);
  }
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

function isHostedSessionAuthFailureCode(code: unknown): boolean {
  const normalizedCode = String(code || "").trim().toUpperCase();
  return normalizedCode === "AUTH_REQUIRED"
    || normalizedCode === "HTTP_401"
    || normalizedCode === "HTTP_403"
    || normalizedCode === "SESSION_REAUTH_REQUIRED";
}

export async function syncStoredKkApiAccessTokenWithHostedSession(): Promise<string | undefined> {
  const latestSessionChange = getLatestAuthSessionChange();
  if (
    latestSessionChange?.hasSession
    && !latestSessionChange.isTempUser
    && !String(latestSessionChange.accessToken || "").trim()
  ) {
    const restoredSession = await restoreHostedSessionFromServer();
    return restoredSession?.accessToken || getStoredKkApiAccessToken();
  }

  const currentToken = syncFromLatestAuthSessionChange();
  if (currentToken) {
    return currentToken;
  }

  const restoredSession = await restoreHostedSessionFromServer();
  return restoredSession?.accessToken;
}

export async function getPreferredKkApiAccessToken(): Promise<string | undefined> {
  return syncFromLatestAuthSessionChange();
}

export async function refreshPreferredKkApiAccessToken(): Promise<string | undefined> {
  if (hostedRefreshPromise) {
    return hostedRefreshPromise;
  }

  hostedRefreshPromise = refreshHostedSessionFromServer()
    .then((response) => {
      if (!response.success) {
        if (isHostedSessionAuthFailureCode(response.error?.code)) {
          clearHostedSessionRuntime();
          return undefined;
        }

        return getStoredKkApiAccessToken();
      }

      applyHostedSessionToRuntime(response.data);
      return response.data.accessToken;
    })
    .finally(() => {
      hostedRefreshPromise = null;
    });

  return hostedRefreshPromise;
}

export function startKkApiAccessTokenSessionSync(): () => void {
  if (typeof window === "undefined") {
    return () => {};
  }

  if (stopAccessTokenSessionSync) {
    return stopAccessTokenSessionSync;
  }

  // 中文注释：监听底层的Token滑动刷新派发事件并覆盖内存与缓存Token，实现前端全状态同步
  const handleTokenRefreshed = (event: Event) => {
    const detail = (event as CustomEvent)?.detail;
    if (detail?.token) {
      setStoredKkApiAccessToken(detail.token);
    }
  };
  window.addEventListener("kk-api-token-refreshed", handleTokenRefreshed);

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
    window.removeEventListener("kk-api-token-refreshed", handleTokenRefreshed);
    unsubscribe();
    stopAccessTokenSessionSync = null;
  };

  return stopAccessTokenSessionSync;
}
