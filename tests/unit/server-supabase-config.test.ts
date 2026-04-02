import assert from "node:assert/strict";
import { after, test } from "node:test";

import {
  assertServerSupabaseConfigConsistency,
  type ServerSupabasePersistenceProbe,
  resolveServerSupabaseConfig,
  summarizeServerSupabaseConfig,
} from "../../apps/api/src/lib/server-supabase-config.ts";

const trackedEnvKeys = [
  "VITE_SUPABASE_URL",
  "SUPABASE_URL",
  "SUPABASE_SERVICE_ROLE_KEY",
  "SUPABASE_SECRET_KEY",
  "SUPABASE_ANON_KEY",
  "VITE_SUPABASE_ANON_KEY",
  "USER_API_ENCRYPTION_SECRET",
  "PROFILE_USER_APIS_ENCRYPTION_SECRET",
];

const originalEnv = new Map(trackedEnvKeys.map((key) => [key, process.env[key]]));
const originalFetch = globalThis.fetch;

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

function resetEnv(overrides: Record<string, string | undefined>) {
  restoreTrackedEnv();
  trackedEnvKeys.forEach((key) => {
    delete process.env[key];
  });

  Object.entries(overrides).forEach(([key, value]) => {
    if (typeof value === "string") {
      process.env[key] = value;
    } else {
      delete process.env[key];
    }
  });
}

after(() => {
  restoreTrackedEnv();
  globalThis.fetch = originalFetch;
});

test("server supabase config summarizes aligned canonical persistence", () => {
  resetEnv({
    VITE_SUPABASE_URL: "https://aligned-ref.supabase.co",
    SUPABASE_URL: "https://aligned-ref.supabase.co",
    SUPABASE_SERVICE_ROLE_KEY: "sb_secret_test_key",
    VITE_SUPABASE_ANON_KEY: "publishable-anon",
    USER_API_ENCRYPTION_SECRET: "encryption-secret",
  });

  const config = resolveServerSupabaseConfig();
  const summary = summarizeServerSupabaseConfig(config);

  assert.equal(summary.supabaseProjectRef, "aligned-ref");
  assert.equal(summary.publicSupabaseProjectRef, "aligned-ref");
  assert.equal(summary.projectRefMatches, true);
  assert.equal(summary.serviceRoleKeyStatus, "valid");
  assert.equal(summary.canonicalPersistenceReady, true);
  assert.deepEqual(summary.blockers, []);
});

test("server supabase config detects project ref mismatch and throws a readable error", () => {
  resetEnv({
    VITE_SUPABASE_URL: "https://frontend-ref.supabase.co",
    SUPABASE_URL: "https://server-ref.supabase.co",
    SUPABASE_SERVICE_ROLE_KEY: "sb_secret_test_key",
  });

  const config = resolveServerSupabaseConfig();
  const summary = summarizeServerSupabaseConfig(config);
  assert.equal(summary.projectRefMatches, false);
  assert.match(summary.blockers.join(","), /SUPABASE_PROJECT_REF_MISMATCH/);
  assert.throws(
    () => assertServerSupabaseConfigConsistency(config),
    /does not match VITE_SUPABASE_URL project ref/,
  );
});

test("server supabase config marks canonical persistence unavailable when the live probe fails", () => {
  resetEnv({
    VITE_SUPABASE_URL: "https://aligned-ref.supabase.co",
    SUPABASE_URL: "https://aligned-ref.supabase.co",
    SUPABASE_SERVICE_ROLE_KEY: "service-role-secret",
  });

  const config = resolveServerSupabaseConfig();
  const probe: ServerSupabasePersistenceProbe = {
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
  const summary = summarizeServerSupabaseConfig(config, { persistenceProbe: probe });

  assert.equal(summary.hasServiceRoleKey, true);
  assert.equal(summary.hasValidServiceRoleKey, false);
  assert.equal(summary.canonicalPersistenceReady, false);
  assert.match(summary.blockers.join(","), /SUPABASE_SERVICE_ROLE_KEY_INVALID/);
});

test("server supabase config rejects keys that look like database passwords", () => {
  resetEnv({
    VITE_SUPABASE_URL: "https://aligned-ref.supabase.co",
    SUPABASE_URL: "https://aligned-ref.supabase.co",
    SUPABASE_SERVICE_ROLE_KEY: "7a7075ba2eca945cefd23178ecbfb7b835a87497beaa7d21712bacfed3a263b7",
  });

  const config = resolveServerSupabaseConfig();
  const summary = summarizeServerSupabaseConfig(config);

  assert.equal(config.serviceRoleKey, undefined);
  assert.equal(config.serviceRoleKeyStatus, "invalid");
  assert.equal(summary.hasServiceRoleKey, true);
  assert.equal(summary.hasValidServiceRoleKey, false);
  assert.match(summary.blockers.join(","), /SUPABASE_SERVICE_ROLE_KEY_INVALID/);
  assert.throws(
    () => assertServerSupabaseConfigConsistency(config),
    /not a valid Supabase service-role\/secret key/,
  );
});

test("server supabase config retries transient fetch failures during the live probe", async () => {
  resetEnv({
    VITE_SUPABASE_URL: "https://aligned-ref.supabase.co",
    SUPABASE_URL: "https://aligned-ref.supabase.co",
    SUPABASE_SERVICE_ROLE_KEY: "sb_secret_test_key",
    VITE_SUPABASE_ANON_KEY: "publishable-anon",
    USER_API_ENCRYPTION_SECRET: "encryption-secret",
  });

  let profileAttempts = 0;
  globalThis.fetch = async (input: RequestInfo | URL) => {
    const url = String(input);

    if (url.includes("/rest/v1/profiles")) {
      profileAttempts += 1;
      if (profileAttempts === 1) {
        throw new TypeError("fetch failed");
      }

      return new Response(null, {
        status: 200,
        headers: {
          "content-type": "application/json",
          "content-range": "0-0/*",
        },
      });
    }

    if (url.includes("/rest/v1/")) {
      return new Response(null, {
        status: 200,
        headers: {
          "content-type": "application/json",
          "content-range": "0-0/*",
        },
      });
    }

    if (url.includes("/storage/v1/object/list/generated-images")) {
      return new Response("[]", {
        status: 200,
        headers: {
          "content-type": "application/json",
        },
      });
    }

    throw new Error(`Unexpected fetch url in Supabase probe test: ${url}`);
  };

  const { probeServerSupabasePersistence } = await import("../../apps/api/src/lib/server-supabase-config.ts");
  const config = resolveServerSupabaseConfig();
  const probe = await probeServerSupabasePersistence(config);

  assert.equal(profileAttempts, 2);
  assert.deepEqual(probe.blockers, []);
  assert.equal(probe.checks.authData.ready, true);
  assert.equal(probe.checks.guestSessions.ready, true);
  assert.equal(probe.checks.billing.ready, true);
  assert.equal(probe.checks.creditProviders.ready, true);
  assert.equal(probe.checks.workspaceLayout.ready, true);

  globalThis.fetch = originalFetch;
});
