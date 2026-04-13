import assert from "node:assert/strict";
import { after, before, beforeEach, afterEach, describe, test } from "node:test";

import { createApiServer } from "../../apps/api/src/server.ts";
import type { ServerSupabasePersistenceProbe } from "../../apps/api/src/lib/server-supabase-config.ts";

function getBaseUrl(server: ReturnType<typeof createApiServer>): string {
  const address = server.address();
  if (!address || typeof address === "string") {
    throw new Error("Server did not expose a TCP port.");
  }

  return `http://127.0.0.1:${address.port}`;
}

const trackedEnvKeys = [
  "VITE_SUPABASE_URL",
  "SUPABASE_URL",
  "SUPABASE_SERVICE_ROLE_KEY",
  "SUPABASE_SECRET_KEY",
  "VITE_SUPABASE_ANON_KEY",
  "SUPABASE_ANON_KEY",
  "USER_API_ENCRYPTION_SECRET",
  "PROFILE_USER_APIS_ENCRYPTION_SECRET",
];

const originalEnv = new Map(trackedEnvKeys.map((key) => [key, process.env[key]]));
const originalConsoleWarn = console.warn;

function restoreTrackedEnv() {
  trackedEnvKeys.forEach((key) => {
    const originalValue = originalEnv.get(key);
    if (typeof originalValue === "string") {
      process.env[key] = originalValue;
    } else {
      delete process.env[key];
    }
  });
}

beforeEach(() => {
  console.warn = () => undefined;
});

afterEach(() => {
  console.warn = originalConsoleWarn;
});

function withMutedConsoleWarn<T>(callback: () => T): T {
  const originalWarn = console.warn;
  console.warn = () => undefined;
  try {
    return callback();
  } finally {
    console.warn = originalWarn;
  }
}

describe("api server persistence guards", () => {
  restoreTrackedEnv();
  process.env.VITE_SUPABASE_URL = "https://guard-ref.supabase.co";
  process.env.SUPABASE_URL = "https://guard-ref.supabase.co";
  process.env.VITE_SUPABASE_ANON_KEY = "publishable-anon";
  process.env.SUPABASE_ANON_KEY = "anon";
  delete process.env.SUPABASE_SERVICE_ROLE_KEY;
  delete process.env.SUPABASE_SECRET_KEY;
  delete process.env.USER_API_ENCRYPTION_SECRET;
  delete process.env.PROFILE_USER_APIS_ENCRYPTION_SECRET;

  const server = withMutedConsoleWarn(() => createApiServer(0, {
    allowDegradedPersistence: false,
    resolveAccessToken: (accessToken) => (
      accessToken === "guard-user-token"
        ? { userId: "guard-user-1", role: "user" }
        : undefined
    ),
    verifyTurnstileToken: async () => ({ success: true }),
  }));

  let baseUrl = "";

  before(async () => {
    if (!server.listening) {
      await new Promise<void>((resolve) => {
        server.once("listening", resolve);
      });
    }

    baseUrl = getBaseUrl(server);
  });

  after(async () => {
    await new Promise<void>((resolve, reject) => {
      server.close((error) => {
        if (error) {
          reject(error);
          return;
        }

        resolve();
      });
    });

    restoreTrackedEnv();
  });

  test("healthz reports degraded persistence blockers", async () => {
    const response = await fetch(`${baseUrl}/healthz`);
    assert.equal(response.status, 200);

    const payload = await response.json();
    assert.equal(payload.success, true);
    assert.equal(payload.data.status, "degraded");
    assert.equal(payload.data.config.canonicalPersistenceReady, false);
    assert.equal(payload.data.config.projectRefMatches, true);
    assert.equal(payload.data.runtime.allowDegradedPersistence, false);
    assert.equal(payload.data.runtime.criticalPersistence.authData.ready, false);
    assert.equal(payload.data.runtime.criticalPersistence.guestSessions.ready, true);
    assert.equal(payload.data.runtime.criticalPersistence.workspaceLayout.ready, false);
    assert.match(
      payload.data.runtime.blockers.join(","),
      /SUPABASE_SERVICE_ROLE_KEY_MISSING/,
    );
  });

  test("critical shared-data routes fail closed when canonical persistence is unavailable", async () => {
    const tempUserResponse = await fetch(`${baseUrl}/api/v1/auth/temp-users`, {
      method: "POST",
      headers: {
        "x-request-id": "req-guard-temp-user",
      },
    });
    assert.equal(tempUserResponse.status, 503);
    const tempUserPayload = await tempUserResponse.json();
    assert.equal(tempUserPayload.success, false);
    assert.equal(tempUserPayload.error.code, "SERVER_PERSISTENCE_REQUIRED");

    const layoutResponse = await fetch(`${baseUrl}/api/v1/workspaces/layout`, {
      headers: {
        authorization: "Bearer guard-user-token",
        "x-request-id": "req-guard-layout",
      },
    });
    assert.equal(layoutResponse.status, 503);
    const layoutPayload = await layoutResponse.json();
    assert.equal(layoutPayload.success, false);
    assert.equal(layoutPayload.error.code, "SERVER_PERSISTENCE_REQUIRED");

    const authDataResponse = await fetch(`${baseUrl}/api/v1/profile/user-apis/payload`, {
      method: "PUT",
      headers: {
        authorization: "Bearer guard-user-token",
        "content-type": "application/json",
        "x-request-id": "req-guard-auth-data",
      },
      body: JSON.stringify({
        version: 2,
        slots: [],
        providers: [],
        entries: [],
      }),
    });
    assert.equal(authDataResponse.status, 503);
    const authDataPayload = await authDataResponse.json();
    assert.equal(authDataPayload.success, false);
    assert.equal(authDataPayload.error.code, "SERVER_PERSISTENCE_REQUIRED");

    const rechargeResponse = await fetch(`${baseUrl}/api/v1/billing/submit-recharge`, {
      method: "POST",
      headers: {
        authorization: "Bearer guard-user-token",
        "content-type": "application/json",
        "x-request-id": "req-guard-recharge-submit",
      },
      body: JSON.stringify({
        amount: 20,
        currencyCode: "CNY",
        paymentChannel: "manual",
        transferReferenceLast4: "1234",
        note: "guarded submit",
      }),
    });
    assert.equal(rechargeResponse.status, 503);
    const rechargePayload = await rechargeResponse.json();
    assert.equal(rechargePayload.success, false);
    assert.equal(rechargePayload.error.code, "SERVER_PERSISTENCE_REQUIRED");
  });
});

describe("api server live Supabase probe guards", () => {
  restoreTrackedEnv();
  process.env.VITE_SUPABASE_URL = "https://guard-ref.supabase.co";
  process.env.SUPABASE_URL = "https://guard-ref.supabase.co";
  process.env.VITE_SUPABASE_ANON_KEY = "publishable-anon";
  process.env.SUPABASE_ANON_KEY = "anon";
  process.env.SUPABASE_SERVICE_ROLE_KEY = "sb_secret_invalid_probe";
  process.env.USER_API_ENCRYPTION_SECRET = "guard-encryption-secret";
  delete process.env.PROFILE_USER_APIS_ENCRYPTION_SECRET;

  const invalidProbe: ServerSupabasePersistenceProbe = {
    checkedAt: "2026-04-01T00:00:00.000Z",
    serviceRoleKeyValid: false,
    blockers: ["SUPABASE_SERVICE_ROLE_KEY_INVALID"],
    checks: {
      authData: { ready: false, blocker: "SUPABASE_SERVICE_ROLE_KEY_INVALID", message: "Invalid API key" },
      guestSessions: { ready: false, blocker: "SUPABASE_SERVICE_ROLE_KEY_INVALID", message: "Invalid API key" },
      billing: { ready: false, blocker: "SUPABASE_SERVICE_ROLE_KEY_INVALID", message: "Invalid API key" },
      creditProviders: { ready: false, blocker: "SUPABASE_SERVICE_ROLE_KEY_INVALID", message: "Invalid API key" },
      workspaceLayout: { ready: false, blocker: "SUPABASE_SERVICE_ROLE_KEY_INVALID", message: "Invalid API key" },
    },
  };

  const server = withMutedConsoleWarn(() => createApiServer(0, {
    allowDegradedPersistence: false,
    probeServerSupabasePersistence: async () => invalidProbe,
    resolveAccessToken: (accessToken) => (
      accessToken === "guard-user-token"
        ? { userId: "guard-user-1", role: "user" }
        : undefined
    ),
    verifyTurnstileToken: async () => ({ success: true }),
  }));

  let baseUrl = "";

  before(async () => {
    if (!server.listening) {
      await new Promise<void>((resolve) => {
        server.once("listening", resolve);
      });
    }

    baseUrl = getBaseUrl(server);
  });

  after(async () => {
    await new Promise<void>((resolve, reject) => {
      server.close((error) => {
        if (error) {
          reject(error);
          return;
        }

        resolve();
      });
    });

    restoreTrackedEnv();
  });

  test("healthz reports degraded persistence when the service-role probe fails", async () => {
    const response = await fetch(`${baseUrl}/healthz?probe=1`);
    assert.equal(response.status, 200);

    const payload = await response.json();
    assert.equal(payload.success, true);
    assert.equal(payload.data.status, "degraded");
    assert.equal(payload.data.config.hasServiceRoleKey, true);
    assert.equal(payload.data.config.hasValidServiceRoleKey, false);
    assert.equal(payload.data.config.canonicalPersistenceReady, false);
    assert.equal(payload.data.runtime.criticalPersistence.authData.ready, false);
    assert.match(payload.data.runtime.blockers.join(","), /SUPABASE_SERVICE_ROLE_KEY_INVALID/);
  });

  test("critical shared-data routes fail closed when the service-role probe fails", async () => {
    const tempUserResponse = await fetch(`${baseUrl}/api/v1/auth/temp-users`, {
      method: "POST",
      headers: {
        "x-request-id": "req-guard-invalid-temp-user",
      },
    });
    assert.equal(tempUserResponse.status, 503);
    const tempUserPayload = await tempUserResponse.json();
    assert.equal(tempUserPayload.success, false);
    assert.equal(tempUserPayload.error.code, "SERVER_PERSISTENCE_REQUIRED");

    const authDataResponse = await fetch(`${baseUrl}/api/v1/profile/key-manager-state`, {
      headers: {
        authorization: "Bearer guard-user-token",
        "x-request-id": "req-guard-invalid-auth-data",
      },
    });
    assert.equal(authDataResponse.status, 503);
    const authDataPayload = await authDataResponse.json();
    assert.equal(authDataPayload.success, false);
    assert.equal(authDataPayload.error.code, "SERVER_PERSISTENCE_REQUIRED");
  });
});

describe("api server capability-scoped persistence guards", () => {
  restoreTrackedEnv();
  process.env.VITE_SUPABASE_URL = "https://guard-ref.supabase.co";
  process.env.SUPABASE_URL = "https://guard-ref.supabase.co";
  process.env.VITE_SUPABASE_ANON_KEY = "publishable-anon";
  process.env.SUPABASE_ANON_KEY = "anon";
  process.env.SUPABASE_SERVICE_ROLE_KEY = "sb_secret_capability_probe";
  process.env.USER_API_ENCRYPTION_SECRET = "guard-encryption-secret";
  delete process.env.PROFILE_USER_APIS_ENCRYPTION_SECRET;

  const scopedProbe: ServerSupabasePersistenceProbe = {
    checkedAt: "2026-04-01T00:00:00.000Z",
    serviceRoleKeyValid: true,
    blockers: ["SUPABASE_TEMP_USERS_PROBE_FAILED"],
    checks: {
      authData: { ready: true },
      guestSessions: { ready: false, blocker: "SUPABASE_TEMP_USERS_PROBE_FAILED", message: "temp_users timed out" },
      billing: { ready: true },
      creditProviders: { ready: true },
      workspaceLayout: { ready: true },
    },
  };

  const server = withMutedConsoleWarn(() => createApiServer(0, {
    allowDegradedPersistence: false,
    probeServerSupabasePersistence: async () => scopedProbe,
    resolveAccessToken: (accessToken) => (
      accessToken === "guard-user-token"
        ? { userId: "guard-user-1", role: "user" }
        : undefined
    ),
    verifyTurnstileToken: async () => ({ success: true }),
  }));

  let baseUrl = "";

  before(async () => {
    if (!server.listening) {
      await new Promise<void>((resolve) => {
        server.once("listening", resolve);
      });
    }

    baseUrl = getBaseUrl(server);
  });

  after(async () => {
    await new Promise<void>((resolve, reject) => {
      server.close((error) => {
        if (error) {
          reject(error);
          return;
        }

        resolve();
      });
    });

    restoreTrackedEnv();
  });

  test("healthz keeps unrelated capabilities ready when only guest sessions probe fails", async () => {
    const response = await fetch(`${baseUrl}/healthz?probe=1`);
    assert.equal(response.status, 200);

    const payload = await response.json();
    assert.equal(payload.success, true);
    assert.equal(payload.data.status, "degraded");
    assert.equal(payload.data.runtime.criticalPersistence.guestSessions.ready, false);
    assert.equal(payload.data.runtime.criticalPersistence.authData.ready, true);
    assert.equal(payload.data.runtime.criticalPersistence.billing.ready, true);
    assert.equal(payload.data.runtime.criticalPersistence.creditProviders.ready, true);
    assert.deepEqual(
      payload.data.runtime.criticalPersistence.billing.blockers,
      [],
    );
    assert.deepEqual(
      payload.data.runtime.criticalPersistence.creditProviders.blockers,
      [],
    );
  });
});

describe("api server healthz fast path", () => {
  restoreTrackedEnv();
  process.env.VITE_SUPABASE_URL = "https://guard-ref.supabase.co";
  process.env.SUPABASE_URL = "https://guard-ref.supabase.co";
  process.env.VITE_SUPABASE_ANON_KEY = "publishable-anon";
  process.env.SUPABASE_ANON_KEY = "anon";
  process.env.SUPABASE_SERVICE_ROLE_KEY = "sb_secret_fast_health";
  process.env.USER_API_ENCRYPTION_SECRET = "guard-encryption-secret";
  delete process.env.PROFILE_USER_APIS_ENCRYPTION_SECRET;

  let probeCallCount = 0;
  const forcedProbe: ServerSupabasePersistenceProbe = {
    checkedAt: "2026-04-01T00:00:00.000Z",
    serviceRoleKeyValid: false,
    blockers: ["SUPABASE_SERVICE_ROLE_KEY_INVALID"],
    checks: {
      authData: { ready: false, blocker: "SUPABASE_SERVICE_ROLE_KEY_INVALID", message: "Invalid API key" },
      guestSessions: { ready: false, blocker: "SUPABASE_SERVICE_ROLE_KEY_INVALID", message: "Invalid API key" },
      billing: { ready: false, blocker: "SUPABASE_SERVICE_ROLE_KEY_INVALID", message: "Invalid API key" },
      creditProviders: { ready: false, blocker: "SUPABASE_SERVICE_ROLE_KEY_INVALID", message: "Invalid API key" },
      workspaceLayout: { ready: false, blocker: "SUPABASE_SERVICE_ROLE_KEY_INVALID", message: "Invalid API key" },
    },
  };

  const server = withMutedConsoleWarn(() => createApiServer(0, {
    allowDegradedPersistence: false,
    probeServerSupabasePersistence: async () => {
      probeCallCount += 1;
      return forcedProbe;
    },
    verifyTurnstileToken: async () => ({ success: true }),
  }));

  let baseUrl = "";

  before(async () => {
    if (!server.listening) {
      await new Promise<void>((resolve) => {
        server.once("listening", resolve);
      });
    }

    baseUrl = getBaseUrl(server);
  });

  after(async () => {
    await new Promise<void>((resolve, reject) => {
      server.close((error) => {
        if (error) {
          reject(error);
          return;
        }

        resolve();
      });
    });

    restoreTrackedEnv();
  });

  test("plain healthz skips the live Supabase probe until explicitly requested", async () => {
    const fastResponse = await fetch(`${baseUrl}/healthz`);
    assert.equal(fastResponse.status, 200);

    const fastPayload = await fastResponse.json();
    assert.equal(fastPayload.success, true);
    assert.equal(probeCallCount, 0);
    assert.equal(fastPayload.data.config.persistenceProbeCheckedAt, undefined);

    const forcedResponse = await fetch(`${baseUrl}/healthz?probe=1`);
    assert.equal(forcedResponse.status, 200);

    const forcedPayload = await forcedResponse.json();
    assert.equal(forcedPayload.success, true);
    assert.equal(probeCallCount, 1);
    assert.equal(forcedPayload.data.config.persistenceProbeCheckedAt, forcedProbe.checkedAt);
    assert.equal(forcedPayload.data.status, "degraded");
  });
});
