import assert from "node:assert/strict";
import { afterEach, describe, test } from "node:test";

import {
  getStoredKkApiRefreshToken,
  getPreferredKkApiAccessToken,
  getStoredKkApiAccessToken,
  setStoredKkApiRefreshToken,
  refreshPreferredKkApiAccessToken,
  setStoredKkApiAccessToken,
  syncStoredKkApiAccessTokenWithHostedSession,
} from "../../apps/web/src/services/api/authAccessToken.ts";
import { emitAuthSessionChange } from "../../apps/web/src/services/auth/authSessionEvents.ts";

const ACCESS_TOKEN_STORAGE_KEY = "kk.api.access_token";
const originalFetch = globalThis.fetch;

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

describe("auth access token compatibility storage", () => {
  afterEach(() => {
    setStoredKkApiAccessToken(undefined);
    setStoredKkApiRefreshToken(undefined);
    emitAuthSessionChange({
      hasSession: false,
      userId: null,
      accessToken: undefined,
      refreshToken: undefined,
      isTempUser: false,
    });
    globalThis.fetch = originalFetch;
    delete (globalThis as typeof globalThis & { window?: unknown }).window;
  });

  test("stored localStorage token is mirrored into session storage for phone browser reload recovery", () => {
    const { sessionStorage, localStorage } = installBrowserStorage();
    localStorage.setItem(ACCESS_TOKEN_STORAGE_KEY, "legacy-token");

    const token = getStoredKkApiAccessToken();

    assert.equal(token, "legacy-token");
    assert.equal(sessionStorage.getItem(ACCESS_TOKEN_STORAGE_KEY), "legacy-token");
    assert.equal(localStorage.getItem(ACCESS_TOKEN_STORAGE_KEY), "legacy-token");
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
    assert.equal(localStorage.getItem(ACCESS_TOKEN_STORAGE_KEY), "kkapi-token");
  });

  test("refresh token is stored durably and submitted when hosted cookie refresh needs a fallback", async () => {
    const { sessionStorage, localStorage } = installBrowserStorage("https://app.example.com");
    let refreshBody: { refreshToken?: string } | undefined;

    globalThis.fetch = async (_input, init) => {
      refreshBody = JSON.parse(String(init?.body || "{}"));
      return new Response(JSON.stringify({
        success: true,
        data: {
          accessToken: "fresh-access-token",
          refreshToken: "fresh-refresh-token",
          expiresIn: 3600,
          sessionExpiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
          profile: {
            id: "user-1",
            email: "fresh@example.com",
            nickname: "Fresh User",
            role: "user",
            status: "active",
            createdAt: new Date(0).toISOString(),
            updatedAt: new Date(0).toISOString(),
          },
        },
        meta: {
          requestId: "req-refresh-with-token",
          timestamp: new Date().toISOString(),
        },
      }), {
        status: 200,
        headers: {
          "content-type": "application/json",
        },
      });
    };

    setStoredKkApiRefreshToken("stored-refresh-token");

    const token = await refreshPreferredKkApiAccessToken();

    assert.equal(refreshBody?.refreshToken, "stored-refresh-token");
    assert.equal(token, "fresh-access-token");
    assert.equal(getStoredKkApiRefreshToken(), "fresh-refresh-token");
    assert.equal(sessionStorage.getItem(ACCESS_TOKEN_STORAGE_KEY), "fresh-access-token");
    assert.equal(localStorage.getItem(ACCESS_TOKEN_STORAGE_KEY), "fresh-access-token");
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
    const { sessionStorage } = installBrowserStorage("https://app.example.com");
    globalThis.fetch = async () => new Response(JSON.stringify({
      success: true,
      data: {
        accessToken: "refreshed-token",
        expiresIn: 3600,
        sessionExpiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        profile: {
          id: "user-1",
          email: "refreshed@example.com",
          nickname: "Refreshed User",
          role: "user",
          status: "active",
          createdAt: new Date(0).toISOString(),
          updatedAt: new Date(0).toISOString(),
        },
      },
      meta: {
        requestId: "req-refresh-hosted-session",
        timestamp: new Date().toISOString(),
      },
    }), {
      status: 200,
      headers: {
        "content-type": "application/json",
      },
    });

    setStoredKkApiAccessToken("compat-token");
    emitAuthSessionChange({
      hasSession: true,
      userId: "user-1",
      accessToken: undefined,
      refreshToken: undefined,
      isTempUser: false,
    });

    const token = await refreshPreferredKkApiAccessToken();

    assert.equal(token, "refreshed-token");
    assert.equal(sessionStorage.getItem(ACCESS_TOKEN_STORAGE_KEY), "refreshed-token");
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

    const token = await syncStoredKkApiAccessTokenWithHostedSession();

    assert.equal(token, "expiring-token");
    assert.equal(sessionStorage.getItem(ACCESS_TOKEN_STORAGE_KEY), "expiring-token");
  });

  test("sync preserves the stored compatibility token when runtime auth state does not provide a new access token", async () => {
    const { sessionStorage } = installBrowserStorage("https://app.example.com");
    globalThis.fetch = async () => new Response(JSON.stringify({
      success: true,
      data: {
        accessToken: "restored-from-cookie",
        expiresIn: 3600,
        sessionExpiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        profile: {
          id: "user-1",
          email: "cookie@example.com",
          nickname: "Cookie User",
          role: "user",
          status: "active",
          createdAt: new Date(0).toISOString(),
          updatedAt: new Date(0).toISOString(),
        },
      },
      meta: {
        requestId: "req-sync-hosted-session",
        timestamp: new Date().toISOString(),
      },
    }), {
      status: 200,
      headers: {
        "content-type": "application/json",
      },
    });

    setStoredKkApiAccessToken("compat-token");
    emitAuthSessionChange({
      hasSession: true,
      userId: "user-1",
      accessToken: undefined,
      refreshToken: undefined,
      isTempUser: false,
    });

    const token = await syncStoredKkApiAccessTokenWithHostedSession();

    assert.equal(token, "restored-from-cookie");
    assert.equal(sessionStorage.getItem(ACCESS_TOKEN_STORAGE_KEY), "restored-from-cookie");
  });

  test("concurrent refresh requests resolve the same runtime token", async () => {
    const { sessionStorage } = installBrowserStorage("https://app.example.com");
    let fetchCalls = 0;

    globalThis.fetch = async () => {
      fetchCalls += 1;
      return new Response(JSON.stringify({
        success: true,
        data: {
          accessToken: "fresh-token",
          expiresIn: 3600,
          sessionExpiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
          profile: {
            id: "user-1",
            email: "fresh@example.com",
            nickname: "Fresh User",
            role: "user",
            status: "active",
            createdAt: new Date(0).toISOString(),
            updatedAt: new Date(0).toISOString(),
          },
        },
        meta: {
          requestId: "req-concurrent-refresh",
          timestamp: new Date().toISOString(),
        },
      }), {
        status: 200,
        headers: {
          "content-type": "application/json",
        },
      });
    };

    const firstRefresh = refreshPreferredKkApiAccessToken();
    const secondRefresh = refreshPreferredKkApiAccessToken();
    const [firstToken, secondToken] = await Promise.all([firstRefresh, secondRefresh]);

    assert.equal(firstToken, "fresh-token");
    assert.equal(secondToken, "fresh-token");
    assert.equal(sessionStorage.getItem(ACCESS_TOKEN_STORAGE_KEY), "fresh-token");
    assert.equal(fetchCalls, 1);
  });
});
