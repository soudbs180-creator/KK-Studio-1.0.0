import assert from "node:assert/strict";
import { afterEach, test } from "node:test";

import {
  getPreferredKkApiAccessToken,
  getStoredKkApiAccessToken,
  refreshPreferredKkApiAccessToken,
  setStoredKkApiAccessToken,
  syncStoredKkApiAccessTokenWithSupabaseSession,
} from "../../src/services/api/authAccessToken.ts";
import { emitAuthSessionChange } from "../../src/services/auth/authSessionEvents.ts";

const ACCESS_TOKEN_STORAGE_KEY = "kk.api.access_token";

class MemoryStorage implements Storage {
  private store = new Map<string, string>();

  get length(): number {
    return this.store.size;
  }

  clear(): void {
    this.store.clear();
  }

  getItem(key: string): string | null {
    return this.store.has(key) ? this.store.get(key)! : null;
  }

  key(index: number): string | null {
    return Array.from(this.store.keys())[index] ?? null;
  }

  removeItem(key: string): void {
    this.store.delete(key);
  }

  setItem(key: string, value: string): void {
    this.store.set(key, value);
  }
}

function installBrowserStorage(origin?: string) {
  const sessionStorage = new MemoryStorage();
  const localStorage = new MemoryStorage();

  Object.defineProperty(globalThis, "window", {
    configurable: true,
    value: {
      sessionStorage,
      localStorage,
      location: origin ? { origin } : undefined,
    },
  });

  return { sessionStorage, localStorage };
}

afterEach(() => {
  setStoredKkApiAccessToken(undefined);
  emitAuthSessionChange({
    hasSession: false,
    userId: null,
    accessToken: undefined,
    refreshToken: undefined,
    isTempUser: false,
  });
  delete (globalThis as typeof globalThis & { window?: unknown }).window;
});

test("legacy localStorage token is migrated into session storage and cleared locally", () => {
  const { sessionStorage, localStorage } = installBrowserStorage();
  localStorage.setItem(ACCESS_TOKEN_STORAGE_KEY, "legacy-token");

  const token = getStoredKkApiAccessToken();

  assert.equal(token, "legacy-token");
  assert.equal(sessionStorage.getItem(ACCESS_TOKEN_STORAGE_KEY), "legacy-token");
  assert.equal(localStorage.getItem(ACCESS_TOKEN_STORAGE_KEY), null);
});

test("preferred KK API token follows the latest runtime auth session event and refreshes compatibility storage", async () => {
  const { sessionStorage, localStorage } = installBrowserStorage();

  setStoredKkApiAccessToken("compat-token");
  emitAuthSessionChange({
    hasSession: true,
    userId: "user-1",
    accessToken: "kkapi-token",
    refreshToken: "refresh-token",
    isTempUser: false,
  });

  const token = await getPreferredKkApiAccessToken();

  assert.equal(token, "kkapi-token");
  assert.equal(sessionStorage.getItem(ACCESS_TOKEN_STORAGE_KEY), "kkapi-token");
  assert.equal(localStorage.getItem(ACCESS_TOKEN_STORAGE_KEY), null);
});

test("local runtime stores the KK API token durably so refresh recovery keeps the user signed in", () => {
  const { sessionStorage, localStorage } = installBrowserStorage("http://127.0.0.1:3000");

  setStoredKkApiAccessToken("local-runtime-token");
  sessionStorage.clear();

  const token = getStoredKkApiAccessToken();

  assert.equal(token, "local-runtime-token");
  assert.equal(localStorage.getItem(ACCESS_TOKEN_STORAGE_KEY), "local-runtime-token");
  assert.equal(sessionStorage.getItem(ACCESS_TOKEN_STORAGE_KEY), "local-runtime-token");
});

test("preferred token falls back to the stored compatibility token when runtime auth state has no access token", async () => {
  const { sessionStorage } = installBrowserStorage();

  setStoredKkApiAccessToken("compat-token");
  emitAuthSessionChange({
    hasSession: true,
    userId: "user-1",
    accessToken: undefined,
    refreshToken: undefined,
    isTempUser: false,
  });

  const token = await getPreferredKkApiAccessToken();

  assert.equal(token, "compat-token");
  assert.equal(sessionStorage.getItem(ACCESS_TOKEN_STORAGE_KEY), "compat-token");
});

test("refresh token falls back to the stored compatibility token when runtime auth state has no access token", async () => {
  const { sessionStorage } = installBrowserStorage();

  setStoredKkApiAccessToken("compat-token");
  emitAuthSessionChange({
    hasSession: true,
    userId: "user-1",
    accessToken: undefined,
    refreshToken: undefined,
    isTempUser: false,
  });

  const token = await refreshPreferredKkApiAccessToken();

  assert.equal(token, "compat-token");
  assert.equal(sessionStorage.getItem(ACCESS_TOKEN_STORAGE_KEY), "compat-token");
});

test("sync keeps the current runtime session token without any proactive refresh step", async () => {
  const { sessionStorage } = installBrowserStorage();
  emitAuthSessionChange({
    hasSession: true,
    userId: "user-1",
    accessToken: "expiring-token",
    refreshToken: undefined,
    isTempUser: false,
  });

  const token = await syncStoredKkApiAccessTokenWithSupabaseSession();

  assert.equal(token, "expiring-token");
  assert.equal(sessionStorage.getItem(ACCESS_TOKEN_STORAGE_KEY), "expiring-token");
});

test("sync preserves the stored compatibility token when runtime auth state does not provide a new access token", async () => {
  const { sessionStorage } = installBrowserStorage();

  setStoredKkApiAccessToken("compat-token");
  emitAuthSessionChange({
    hasSession: true,
    userId: "user-1",
    accessToken: undefined,
    refreshToken: undefined,
    isTempUser: false,
  });

  const token = await syncStoredKkApiAccessTokenWithSupabaseSession();

  assert.equal(token, "compat-token");
  assert.equal(sessionStorage.getItem(ACCESS_TOKEN_STORAGE_KEY), "compat-token");
});

test("concurrent refresh requests resolve the same runtime token", async () => {
  const { sessionStorage } = installBrowserStorage();
  emitAuthSessionChange({
    hasSession: true,
    userId: "user-1",
    accessToken: "fresh-token",
    refreshToken: "refresh-token",
    isTempUser: false,
  });

  const firstRefresh = refreshPreferredKkApiAccessToken();
  const secondRefresh = refreshPreferredKkApiAccessToken();
  const [firstToken, secondToken] = await Promise.all([firstRefresh, secondRefresh]);

  assert.equal(firstToken, "fresh-token");
  assert.equal(secondToken, "fresh-token");
  assert.equal(sessionStorage.getItem(ACCESS_TOKEN_STORAGE_KEY), "fresh-token");
});
