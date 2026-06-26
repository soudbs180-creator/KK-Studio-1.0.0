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
const refreshTokenStorageKey = "kk.api.refresh_token";
const browserCookieMaxAgeSeconds = 180 * 24 * 60 * 60;

let inMemoryCompatibilityAccessToken: string | undefined;
let inMemoryCompatibilityRefreshToken: string | undefined;
let stopAccessTokenSessionSync: (() => void) | null = null;
let hostedRefreshPromise: Promise<string | undefined> | null = null;

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

function readStorageItem(storage: Storage | undefined, key: string): string | undefined {
  try {
    return storage?.getItem(key) || undefined;
  } catch {
    return undefined;
  }
}

function writeStorageItem(storage: Storage | undefined, key: string, value: string): void {
  try {
    storage?.setItem(key, value);
  } catch {
    // 简体中文注释：部分移动浏览器在隐私模式下会暴露 storage 对象但禁止写入，失败时交给 cookie 与内存兜底。
  }
}

function removeStorageItem(storage: Storage | undefined, key: string): void {
  try {
    storage?.removeItem(key);
  } catch {
    // 简体中文注释：清理动作不应因为某个浏览器禁用 storage 而阻断退出登录。
  }
}

function readCookieItem(key: string): string | undefined {
  if (typeof document === "undefined" || typeof document.cookie !== "string") {
    return undefined;
  }

  const encodedKey = encodeURIComponent(key);
  const pair = document.cookie
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${encodedKey}=`));

  if (!pair) {
    return undefined;
  }

  try {
    return decodeURIComponent(pair.slice(encodedKey.length + 1)) || undefined;
  } catch {
    return undefined;
  }
}

function writeCookieItem(key: string, value: string): void {
  if (typeof document === "undefined") {
    return;
  }

  try {
    const isHttps = typeof window !== "undefined" && window.location?.protocol === "https:";
    const cookieSuffix = isHttps
      ? "; Secure; SameSite=None"
      : "; SameSite=Lax";
    document.cookie = `${encodeURIComponent(key)}=${encodeURIComponent(value)}; Max-Age=${browserCookieMaxAgeSeconds}; Path=/${cookieSuffix}`;
  } catch {
    // 简体中文注释：旧版 WebView 可能禁止写 cookie，仍保留内存快照供当前页面继续使用。
  }
}

function removeCookieItem(key: string): void {
  if (typeof document === "undefined") {
    return;
  }

  try {
    const secureSuffix = typeof window !== "undefined" && window.location?.protocol === "https:"
      ? "; Secure"
      : "";
    document.cookie = `${encodeURIComponent(key)}=; Max-Age=0; Path=/; SameSite=Lax${secureSuffix}`;
  } catch {
    // 简体中文注释：退出登录时尽力清理 cookie，失败也不能影响前端状态回落。
  }
}

function readMemoryToken(key: string): string | undefined {
  return key === refreshTokenStorageKey
    ? inMemoryCompatibilityRefreshToken
    : inMemoryCompatibilityAccessToken;
}

function writeMemoryToken(key: string, token?: string): void {
  if (key === refreshTokenStorageKey) {
    inMemoryCompatibilityRefreshToken = token;
    return;
  }

  inMemoryCompatibilityAccessToken = token;
}

function syncTokenToAllBrowserStores(key: string, token: string): string {
  writeMemoryToken(key, token);
  writeStorageItem(getSessionStorage(), key, token);
  writeStorageItem(getLocalStorage(), key, token);
  writeCookieItem(key, token);
  return token;
}

function readStoredBrowserToken(key: string): string | undefined {
  const token = readStorageItem(getSessionStorage(), key)
    || readStorageItem(getLocalStorage(), key)
    || readCookieItem(key)
    || readMemoryToken(key);

  return token ? syncTokenToAllBrowserStores(key, token) : undefined;
}

function setStoredBrowserToken(key: string, token?: string): void {
  if (!token) {
    writeMemoryToken(key, undefined);
    removeStorageItem(getSessionStorage(), key);
    removeStorageItem(getLocalStorage(), key);
    removeCookieItem(key);
    return;
  }

  syncTokenToAllBrowserStores(key, token);
}

export function getStoredKkApiAccessToken(): string | undefined {
  return readStoredBrowserToken(accessTokenStorageKey);
}

export function setStoredKkApiAccessToken(token?: string): void {
  setStoredBrowserToken(accessTokenStorageKey, token);
}

export function getStoredKkApiRefreshToken(): string | undefined {
  return readStoredBrowserToken(refreshTokenStorageKey);
}

export function setStoredKkApiRefreshToken(token?: string): void {
  setStoredBrowserToken(refreshTokenStorageKey, token);
}

export function clearStoredKkApiAuthTokens(): void {
  setStoredKkApiAccessToken(undefined);
  setStoredKkApiRefreshToken(undefined);
}

function syncFromLatestAuthSessionChange(): string | undefined {
  const latestSessionChange = getLatestAuthSessionChange();
  if (!latestSessionChange) {
    return getStoredKkApiAccessToken();
  }

  if (!latestSessionChange.hasSession || latestSessionChange.isTempUser) {
    clearStoredKkApiAuthTokens();
    return undefined;
  }

  if (latestSessionChange.refreshToken) {
    setStoredKkApiRefreshToken(latestSessionChange.refreshToken);
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

  const handleTokenRefreshed = (event: Event) => {
    const detail = (event as CustomEvent)?.detail;
    if (detail?.token) {
      setStoredKkApiAccessToken(detail.token);
    }
    if (detail?.refreshToken) {
      setStoredKkApiRefreshToken(detail.refreshToken);
    }
  };
  window.addEventListener("kk-api-token-refreshed", handleTokenRefreshed);

  const handleUnauthorized = () => {
    // 简体中文注释：监听自 api-client 抛出的 401 事件，通知 web 侧清理缓存并重置 hosted session 状态
    clearStoredKkApiAuthTokens();
    clearHostedSessionRuntime();
  };
  window.addEventListener("kk-api-unauthorized", handleUnauthorized);

  const unsubscribe = subscribeAuthSessionChange((detail) => {
    if (!detail.hasSession || detail.isTempUser) {
      clearStoredKkApiAuthTokens();
      return;
    }

    if (detail.refreshToken) {
      setStoredKkApiRefreshToken(detail.refreshToken);
    }

    if (detail.accessToken) {
      setStoredKkApiAccessToken(detail.accessToken);
    }
  });

  syncFromLatestAuthSessionChange();

  stopAccessTokenSessionSync = () => {
    window.removeEventListener("kk-api-token-refreshed", handleTokenRefreshed);
    window.removeEventListener("kk-api-unauthorized", handleUnauthorized);
    unsubscribe();
    stopAccessTokenSessionSync = null;
  };

  return stopAccessTokenSessionSync;
}
