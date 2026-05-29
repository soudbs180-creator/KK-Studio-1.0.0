import assert from "node:assert/strict";
import { afterEach, test } from "node:test";

import {
  getStoredKkApiAccessToken,
  setStoredKkApiAccessToken,
  setStoredKkApiRefreshToken,
} from "../../apps/web/src/services/api/authAccessToken.ts";
import {
  logoutHostedSessionFromServer,
  restoreHostedSessionFromServer,
} from "../../apps/web/src/services/auth/kkApiSessionBootstrap.ts";
import {
  createDefaultRuntimeAuthState,
  getLatestRuntimeAuthState,
  persistRuntimeAuthState,
  updateRuntimeAuthStateFromProfile,
} from "../../apps/web/src/services/auth/runtimeAuthState.ts";

class MemoryStorage implements Storage {
  private readonly store = new Map<string, string>();

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

const profile = {
  id: "11111111-1111-1111-1111-111111111111",
  email: "restored@example.com",
  nickname: "restored",
  role: "user",
  status: "active",
  createdAt: new Date(0).toISOString(),
  updatedAt: new Date(0).toISOString(),
} as const;

const originalFetch = globalThis.fetch;

function installHostedWindow(origin = "https://app.example.com") {
  const sessionStorage = new MemoryStorage();
  const localStorage = new MemoryStorage();

  Object.defineProperty(globalThis, "window", {
    configurable: true,
    value: {
      sessionStorage,
      localStorage,
      location: { origin },
      addEventListener() {},
      removeEventListener() {},
      dispatchEvent() {
        return true;
      },
      setTimeout,
      clearTimeout,
    },
  });

  return { sessionStorage, localStorage };
}

afterEach(() => {
  globalThis.fetch = originalFetch;
  setStoredKkApiAccessToken(undefined);
  setStoredKkApiRefreshToken(undefined);
  persistRuntimeAuthState(createDefaultRuntimeAuthState());
  delete (globalThis as typeof globalThis & { window?: unknown }).window;
});

test("hosted startup restores a session from the server cookie even when no access token is cached", async () => {
  installHostedWindow();

  globalThis.fetch = async () => new Response(JSON.stringify({
    success: true,
    data: {
      accessToken: "restored-token",
      expiresIn: 3600,
      sessionExpiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      profile,
    },
    meta: {
      requestId: "req-hosted-bootstrap",
      timestamp: new Date().toISOString(),
    },
  }), {
    status: 200,
    headers: {
      "content-type": "application/json",
    },
  });

  const restored = await restoreHostedSessionFromServer();

  assert.equal(restored?.accessToken, "restored-token");
  assert.equal(getStoredKkApiAccessToken(), "restored-token");
  assert.equal(getLatestRuntimeAuthState().user?.email, "restored@example.com");
});

test("hosted logout clears the cached runtime session after calling the server", async () => {
  installHostedWindow();
  const requests: string[] = [];

  setStoredKkApiAccessToken("session-to-clear");
  updateRuntimeAuthStateFromProfile(profile);

  globalThis.fetch = async (input) => {
    requests.push(String(input));
    return new Response(JSON.stringify({
      success: true,
      data: {
        revoked: true,
      },
      meta: {
        requestId: "req-hosted-logout",
        timestamp: new Date().toISOString(),
      },
    }), {
      status: 200,
      headers: {
        "content-type": "application/json",
      },
    });
  };

  await logoutHostedSessionFromServer();

  assert.match(requests[0] || "", /\/api\/v1\/auth\/logout$/);
  assert.equal(getStoredKkApiAccessToken(), undefined);
  assert.equal(getLatestRuntimeAuthState().user, null);
});
