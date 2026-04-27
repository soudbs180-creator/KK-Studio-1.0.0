import assert from "node:assert/strict";
import { after, before, beforeEach, afterEach, describe, test } from "node:test";

import { createApiServer } from "../../apps/api/src/server.ts";
import type { ServerRuntimePersistenceProbe } from "../../apps/api/src/lib/server-runtime-config.ts";

function getBaseUrl(server: ReturnType<typeof createApiServer>): string {
  const address = server.address();
  if (!address || typeof address === "string") {
    throw new Error("Server did not expose a TCP port.");
  }

  return `http://127.0.0.1:${address.port}`;
}

const trackedEnvKeys = [
  "DATABASE_URL",
  "PGHOST",
  "PGDATABASE",
  "PGUSER",
  "PGPASSWORD",
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
    assert.equal(payload.data.config.hasPostgresConfig, false);
    assert.equal("projectRefMatches" in payload.data.config, false);
    assert.equal("hasSupabaseUrl" in payload.data.config, false);
    assert.equal(payload.data.runtime.allowDegradedPersistence, false);
    assert.equal(payload.data.runtime.criticalPersistence.authData.ready, false);
    assert.equal(payload.data.runtime.criticalPersistence.guestSessions.ready, false);
    assert.equal(payload.data.runtime.criticalPersistence.workspaceLayout.ready, false);
    assert.match(
      payload.data.runtime.blockers.join(","),
      /USER_API_ENCRYPTION_SECRET_MISSING|POSTGRES_CONFIG_MISSING|AUTH_DATA_REPOSITORY_DEGRADED/,
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

describe("api server live PostgreSQL probe guards", () => {
  restoreTrackedEnv();
  process.env.PGHOST = "127.0.0.1";
  process.env.PGDATABASE = "kk_guard";
  process.env.PGUSER = "kk_guard";
  process.env.USER_API_ENCRYPTION_SECRET = "guard-encryption-secret";
  delete process.env.PROFILE_USER_APIS_ENCRYPTION_SECRET;

  const invalidProbe: ServerRuntimePersistenceProbe = {
    checkedAt: "2026-04-01T00:00:00.000Z",
    postgresConfigValid: false,
    blockers: ["POSTGRES_PROFILES_PROBE_FAILED"],
    checks: {
      authData: { ready: false, blocker: "POSTGRES_PROFILES_PROBE_FAILED", message: "profiles probe failed" },
      guestSessions: { ready: false, blocker: "POSTGRES_PROFILES_PROBE_FAILED", message: "profiles probe failed" },
      billing: { ready: false, blocker: "POSTGRES_PROFILES_PROBE_FAILED", message: "profiles probe failed" },
      creditProviders: { ready: false, blocker: "POSTGRES_PROFILES_PROBE_FAILED", message: "profiles probe failed" },
      workspaceLayout: { ready: false, blocker: "POSTGRES_PROFILES_PROBE_FAILED", message: "profiles probe failed" },
    },
  };

  const server = withMutedConsoleWarn(() => createApiServer(0, {
    allowDegradedPersistence: false,
    probeServerRuntimePersistence: async () => invalidProbe,
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

  test("healthz reports degraded persistence when the VPS database probe fails", async () => {
    const response = await fetch(`${baseUrl}/healthz?probe=1`);
    assert.equal(response.status, 200);

    const payload = await response.json();
    assert.equal(payload.success, true);
    assert.equal(payload.data.status, "degraded");
    assert.equal(payload.data.config.hasPostgresConfig, true);
    assert.equal(payload.data.config.hasValidPostgresConfig, false);
    assert.equal(payload.data.config.canonicalPersistenceReady, false);
    assert.equal(payload.data.runtime.criticalPersistence.authData.ready, false);
    assert.match(payload.data.runtime.blockers.join(","), /POSTGRES_PROFILES_PROBE_FAILED/);
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
  process.env.PGHOST = "127.0.0.1";
  process.env.PGDATABASE = "kk_guard";
  process.env.PGUSER = "kk_guard";
  process.env.USER_API_ENCRYPTION_SECRET = "guard-encryption-secret";
  delete process.env.PROFILE_USER_APIS_ENCRYPTION_SECRET;

  const scopedProbe: ServerRuntimePersistenceProbe = {
    checkedAt: "2026-04-01T00:00:00.000Z",
    postgresConfigValid: true,
    blockers: ["POSTGRES_TEMP_USERS_PROBE_FAILED"],
    checks: {
      authData: { ready: true },
      guestSessions: { ready: false, blocker: "POSTGRES_TEMP_USERS_PROBE_FAILED", message: "temp_users timed out" },
      billing: { ready: true },
      creditProviders: { ready: true },
      workspaceLayout: { ready: true },
    },
  };

  const server = withMutedConsoleWarn(() => createApiServer(0, {
    allowDegradedPersistence: false,
    probeServerRuntimePersistence: async () => scopedProbe,
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
    assert.match(
      payload.data.runtime.criticalPersistence.guestSessions.blockers.join(","),
      /POSTGRES_TEMP_USERS_PROBE_FAILED/,
    );
    assert.doesNotMatch(
      payload.data.runtime.criticalPersistence.authData.blockers.join(","),
      /POSTGRES_TEMP_USERS_PROBE_FAILED/,
    );
    assert.doesNotMatch(
      payload.data.runtime.criticalPersistence.billing.blockers.join(","),
      /POSTGRES_TEMP_USERS_PROBE_FAILED/,
    );
    assert.doesNotMatch(
      payload.data.runtime.criticalPersistence.creditProviders.blockers.join(","),
      /POSTGRES_TEMP_USERS_PROBE_FAILED/,
    );
  });
});

describe("api server healthz fast path", () => {
  restoreTrackedEnv();
  process.env.PGHOST = "127.0.0.1";
  process.env.PGDATABASE = "kk_guard";
  process.env.PGUSER = "kk_guard";
  process.env.USER_API_ENCRYPTION_SECRET = "guard-encryption-secret";
  delete process.env.PROFILE_USER_APIS_ENCRYPTION_SECRET;

  let probeCallCount = 0;
  const forcedProbe: ServerRuntimePersistenceProbe = {
    checkedAt: "2026-04-01T00:00:00.000Z",
    postgresConfigValid: false,
    blockers: ["POSTGRES_PROFILES_PROBE_FAILED"],
    checks: {
      authData: { ready: false, blocker: "POSTGRES_PROFILES_PROBE_FAILED", message: "profiles probe failed" },
      guestSessions: { ready: false, blocker: "POSTGRES_PROFILES_PROBE_FAILED", message: "profiles probe failed" },
      billing: { ready: false, blocker: "POSTGRES_PROFILES_PROBE_FAILED", message: "profiles probe failed" },
      creditProviders: { ready: false, blocker: "POSTGRES_PROFILES_PROBE_FAILED", message: "profiles probe failed" },
      workspaceLayout: { ready: false, blocker: "POSTGRES_PROFILES_PROBE_FAILED", message: "profiles probe failed" },
    },
  };

  const server = withMutedConsoleWarn(() => createApiServer(0, {
    allowDegradedPersistence: false,
    probeServerRuntimePersistence: async () => {
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

  test("plain healthz skips the live VPS probe until explicitly requested", async () => {
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
