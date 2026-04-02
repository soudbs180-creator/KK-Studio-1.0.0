import assert from "node:assert/strict";
import { after, before, describe, test } from "node:test";

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
];

const originalEnv = new Map(trackedEnvKeys.map((key) => [key, process.env[key]]));

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

describe("api server persistence guards", () => {
  restoreTrackedEnv();
  process.env.VITE_SUPABASE_URL = "https://guard-ref.supabase.co";
  process.env.SUPABASE_URL = "https://guard-ref.supabase.co";
  process.env.VITE_SUPABASE_ANON_KEY = "publishable-anon";
  process.env.SUPABASE_ANON_KEY = "anon";
  delete process.env.SUPABASE_SERVICE_ROLE_KEY;
  delete process.env.SUPABASE_SECRET_KEY;

  const server = createApiServer(0, {
    allowDegradedPersistence: false,
    resolveAccessToken: (accessToken) => (
      accessToken === "guard-user-token"
        ? { userId: "guard-user-1", role: "user" }
        : undefined
    ),
    verifyTurnstileToken: async () => ({ success: true }),
  });

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
    assert.equal(payload.data.runtime.criticalPersistence.guestSessions.ready, false);
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
  });
});

describe("api server live Supabase probe guards", () => {
  restoreTrackedEnv();
  process.env.VITE_SUPABASE_URL = "https://guard-ref.supabase.co";
  process.env.SUPABASE_URL = "https://guard-ref.supabase.co";
  process.env.VITE_SUPABASE_ANON_KEY = "publishable-anon";
  process.env.SUPABASE_ANON_KEY = "anon";
  process.env.SUPABASE_SERVICE_ROLE_KEY = "sb_secret_invalid_probe";

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

  const server = createApiServer(0, {
    allowDegradedPersistence: false,
    probeServerSupabasePersistence: async () => invalidProbe,
    resolveAccessToken: (accessToken) => (
      accessToken === "guard-user-token"
        ? { userId: "guard-user-1", role: "user" }
        : undefined
    ),
    verifyTurnstileToken: async () => ({ success: true }),
  });

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
    const response = await fetch(`${baseUrl}/healthz`);
    assert.equal(response.status, 200);

    const payload = await response.json();
    assert.equal(payload.success, true);
    assert.equal(payload.data.status, "degraded");
    assert.equal(payload.data.config.hasServiceRoleKey, true);
    assert.equal(payload.data.config.hasValidServiceRoleKey, false);
    assert.equal(payload.data.config.canonicalPersistenceReady, false);
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
  });
});
