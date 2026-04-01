import assert from "node:assert/strict";
import { afterEach, test } from "node:test";

import { supabase } from "../../src/lib/supabase.ts";
import {
  getPreferredKkApiAccessToken,
  getStoredKkApiAccessToken,
  refreshPreferredKkApiAccessToken,
  setStoredKkApiAccessToken,
  shouldRefreshKkApiTokenSession,
  syncStoredKkApiAccessTokenWithSupabaseSession,
} from "../../src/services/api/authAccessToken.ts";

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

function installBrowserStorage() {
  const sessionStorage = new MemoryStorage();
  const localStorage = new MemoryStorage();

  Object.defineProperty(globalThis, "window", {
    configurable: true,
    value: {
      sessionStorage,
      localStorage,
    },
  });

  return { sessionStorage, localStorage };
}

function restoreAuthMocks(
  originalGetSession: typeof supabase.auth.getSession,
  originalRefreshSession: typeof supabase.auth.refreshSession,
) {
  supabase.auth.getSession = originalGetSession;
  supabase.auth.refreshSession = originalRefreshSession;
}

afterEach(() => {
  setStoredKkApiAccessToken(undefined);
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

test("preferred KK API token uses the active Supabase session token and refreshes compatibility storage", async () => {
  const { sessionStorage, localStorage } = installBrowserStorage();
  const originalGetSession = supabase.auth.getSession;
  const originalRefreshSession = supabase.auth.refreshSession;

  setStoredKkApiAccessToken("compat-token");
  supabase.auth.getSession = async () =>
    ({
      data: {
        session: {
          access_token: "supabase-token",
        },
      },
      error: null,
    }) as Awaited<ReturnType<typeof originalGetSession>>;

  try {
    const token = await getPreferredKkApiAccessToken();

    assert.equal(token, "supabase-token");
    assert.equal(sessionStorage.getItem(ACCESS_TOKEN_STORAGE_KEY), "supabase-token");
    assert.equal(localStorage.getItem(ACCESS_TOKEN_STORAGE_KEY), null);
  } finally {
    restoreAuthMocks(originalGetSession, originalRefreshSession);
  }
});

test("preferred token falls back to the stored compatibility token when Supabase session lookup fails", async () => {
  const { sessionStorage } = installBrowserStorage();
  const originalGetSession = supabase.auth.getSession;
  const originalRefreshSession = supabase.auth.refreshSession;

  setStoredKkApiAccessToken("compat-token");
  supabase.auth.getSession = async () => {
    throw new Error("session unavailable");
  };

  try {
    const token = await getPreferredKkApiAccessToken();

    assert.equal(token, "compat-token");
    assert.equal(sessionStorage.getItem(ACCESS_TOKEN_STORAGE_KEY), "compat-token");
  } finally {
    restoreAuthMocks(originalGetSession, originalRefreshSession);
  }
});

test("refresh token falls back to the stored compatibility token when Supabase refresh fails", async () => {
  const { sessionStorage } = installBrowserStorage();
  const originalGetSession = supabase.auth.getSession;
  const originalRefreshSession = supabase.auth.refreshSession;

  setStoredKkApiAccessToken("compat-token");
  supabase.auth.refreshSession = async () =>
    ({
      data: {
        session: null,
      },
      error: new Error("refresh failed"),
    }) as Awaited<ReturnType<typeof originalRefreshSession>>;

  try {
    const token = await refreshPreferredKkApiAccessToken();

    assert.equal(token, "compat-token");
    assert.equal(sessionStorage.getItem(ACCESS_TOKEN_STORAGE_KEY), "compat-token");
  } finally {
    restoreAuthMocks(originalGetSession, originalRefreshSession);
  }
});

test("sync refreshes the Supabase session when the access token is close to expiry", async () => {
  const { sessionStorage } = installBrowserStorage();
  const originalGetSession = supabase.auth.getSession;
  const originalRefreshSession = supabase.auth.refreshSession;

  supabase.auth.getSession = async () =>
    ({
      data: {
        session: {
          access_token: "expiring-token",
          expires_at: Math.floor((Date.now() + 60_000) / 1000),
        },
      },
      error: null,
    }) as Awaited<ReturnType<typeof originalGetSession>>;

  supabase.auth.refreshSession = async () =>
    ({
      data: {
        session: {
          access_token: "fresh-token",
          expires_at: Math.floor((Date.now() + 3_600_000) / 1000),
        },
      },
      error: null,
    }) as Awaited<ReturnType<typeof originalRefreshSession>>;

  try {
    const token = await syncStoredKkApiAccessTokenWithSupabaseSession();

    assert.equal(token, "fresh-token");
    assert.equal(sessionStorage.getItem(ACCESS_TOKEN_STORAGE_KEY), "fresh-token");
  } finally {
    restoreAuthMocks(originalGetSession, originalRefreshSession);
  }
});

test("sync preserves the stored compatibility token when Supabase reports no active session", async () => {
  const { sessionStorage } = installBrowserStorage();
  const originalGetSession = supabase.auth.getSession;
  const originalRefreshSession = supabase.auth.refreshSession;

  setStoredKkApiAccessToken("compat-token");
  supabase.auth.getSession = async () =>
    ({
      data: {
        session: null,
      },
      error: null,
    }) as Awaited<ReturnType<typeof originalGetSession>>;

  try {
    const token = await syncStoredKkApiAccessTokenWithSupabaseSession();

    assert.equal(token, "compat-token");
    assert.equal(sessionStorage.getItem(ACCESS_TOKEN_STORAGE_KEY), "compat-token");
  } finally {
    restoreAuthMocks(originalGetSession, originalRefreshSession);
  }
});

test("refresh threshold helper only triggers near the session expiry window", () => {
  const nowMs = Date.now();

  assert.equal(
    shouldRefreshKkApiTokenSession({
      expires_at: Math.floor((nowMs + 60_000) / 1000),
    }, nowMs),
    true,
  );
  assert.equal(
    shouldRefreshKkApiTokenSession({
      expires_at: Math.floor((nowMs + 3_600_000) / 1000),
    }, nowMs),
    false,
  );
  assert.equal(shouldRefreshKkApiTokenSession(null, nowMs), false);
});
