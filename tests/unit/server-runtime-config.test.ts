import assert from "node:assert/strict";
import { after, test } from "node:test";

import {
  assertServerRuntimeConfigConsistency,
  probeServerRuntimePersistence,
  type ServerRuntimePersistenceProbe,
  resolveServerRuntimeConfig,
  summarizeServerRuntimeConfig,
} from "../../apps/api/src/lib/server-runtime-config.ts";
import { getSharedPostgresPool, resolvePostgresConfig, resetSharedPostgresPoolForTests } from "../../apps/api/src/lib/postgres.ts";

const trackedEnvKeys = [
  "DATABASE_URL",
  "PGHOST",
  "PGDATABASE",
  "PGUSER",
  "PGPASSWORD",
  "PGSSL",
  "PGSSLMODE",
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

after(async () => {
  restoreTrackedEnv();
  await resetSharedPostgresPoolForTests();
});

test("server runtime config summarizes VPS PostgreSQL persistence", () => {
  resetEnv({
    PGHOST: "127.0.0.1",
    PGDATABASE: "kk_runtime",
    PGUSER: "kk_runtime",
    USER_API_ENCRYPTION_SECRET: "encryption-secret",
  });

  const config = resolveServerRuntimeConfig();
  const summary = summarizeServerRuntimeConfig(config);

  assert.equal(summary.hasPostgresConfig, true);
  assert.equal(summary.databaseConfigStatus, "valid");
  assert.equal(summary.canonicalPersistenceReady, true);
  assert.equal("supabaseProjectRef" in summary, false);
  assert.equal("publicSupabaseProjectRef" in summary, false);
  assert.equal("projectRefMatches" in summary, false);
  assert.equal("hasSupabaseUrl" in summary, false);
  assert.equal("hasServiceRoleKey" in summary, false);
  assert.deepEqual(summary.blockers, []);
});

test("server runtime config exposes no legacy Supabase auth fields in VPS mode", () => {
  resetEnv({
    PGHOST: "127.0.0.1",
    PGDATABASE: "kk_runtime",
    PGUSER: "kk_runtime",
  });

  const config = resolveServerRuntimeConfig();

  assert.equal("supabaseUrl" in config, false);
  assert.equal("publicSupabaseUrl" in config, false);
  assert.equal("authKey" in config, false);
  assert.equal("serviceRoleKey" in config, false);
  assert.equal("serviceRoleKeyStatus" in config, false);
});

test("server runtime config ignores legacy Supabase env when PostgreSQL is configured", () => {
  resetEnv({
    PGHOST: "127.0.0.1",
    PGDATABASE: "kk_runtime",
    PGUSER: "kk_runtime",
    USER_API_ENCRYPTION_SECRET: "encryption-secret",
  });
  process.env.VITE_SUPABASE_URL = "https://frontend-ref.supabase.co";
  process.env.SUPABASE_URL = "https://server-ref.supabase.co";

  const config = resolveServerRuntimeConfig();
  const summary = summarizeServerRuntimeConfig(config);
  assert.equal("projectRefMatches" in summary, false);
  assert.equal("supabaseUrl" in config, false);
  assert.deepEqual(summary.blockers, []);
  assert.doesNotThrow(() => assertServerRuntimeConfigConsistency(config));
});

test("PostgreSQL DATABASE_URL uses SSL automatically for public VPS hosts", () => {
  resetEnv({
    DATABASE_URL: "postgres://kkstudio_app:password@db.example.com:5432/kkstudio",
    USER_API_ENCRYPTION_SECRET: "encryption-secret",
  });

  const config = resolvePostgresConfig();

  assert.deepEqual(config?.ssl, { rejectUnauthorized: false });
});

test("server runtime config requires an auth-data encryption secret for canonical persistence", () => {
  resetEnv({
    PGHOST: "127.0.0.1",
    PGDATABASE: "kk_runtime",
    PGUSER: "kk_runtime",
  });

  const config = resolveServerRuntimeConfig();
  assert.throws(
    () => assertServerRuntimeConfigConsistency(config),
    /USER_API_ENCRYPTION_SECRET is required/,
  );
});

test("server runtime config marks canonical persistence unavailable when the VPS probe fails", () => {
  resetEnv({
    PGHOST: "127.0.0.1",
    PGDATABASE: "kk_runtime",
    PGUSER: "kk_runtime",
    USER_API_ENCRYPTION_SECRET: "encryption-secret",
  });

  const config = resolveServerRuntimeConfig();
  const probe: ServerRuntimePersistenceProbe = {
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
  const summary = summarizeServerRuntimeConfig(config, { persistenceProbe: probe });

  assert.equal(summary.hasPostgresConfig, true);
  assert.equal(summary.hasValidPostgresConfig, false);
  assert.equal(summary.canonicalPersistenceReady, false);
  assert.match(summary.blockers.join(","), /POSTGRES_PROFILES_PROBE_FAILED/);
});

test("server runtime config reports PostgreSQL as missing when only legacy Supabase keys are present", () => {
  resetEnv({});
  process.env.VITE_SUPABASE_URL = "https://aligned-ref.supabase.co";
  process.env.SUPABASE_URL = "https://aligned-ref.supabase.co";
  process.env.SUPABASE_SERVICE_ROLE_KEY = "7a7075ba2eca945cefd23178ecbfb7b835a87497beaa7d21712bacfed3a263b7";

  const config = resolveServerRuntimeConfig();
  const summary = summarizeServerRuntimeConfig(config);

  assert.equal("serviceRoleKey" in config, false);
  assert.equal(summary.hasPostgresConfig, false);
  assert.equal(summary.hasValidPostgresConfig, false);
  assert.match(summary.blockers.join(","), /POSTGRES_CONFIG_MISSING/);
  assert.throws(
    () => assertServerRuntimeConfigConsistency(config),
    /PostgreSQL configuration is unavailable/,
  );
});

test("server runtime config retries transient PostgreSQL failures during the live probe", async () => {
  resetEnv({
    PGHOST: "127.0.0.1",
    PGDATABASE: "kk_runtime",
    PGUSER: "kk_runtime",
    USER_API_ENCRYPTION_SECRET: "encryption-secret",
  });

  let profileAttempts = 0;
  await resetSharedPostgresPoolForTests();
  const pool = getSharedPostgresPool() as any;
  const originalQuery = pool.query.bind(pool);
  pool.query = async (sql: string) => {
    if (String(sql).includes("from profiles")) {
      profileAttempts += 1;
      if (profileAttempts === 1) {
        throw new Error("ECONNRESET");
      }
    }

    return { rows: [] };
  };

  const config = resolveServerRuntimeConfig();
  const probe = await probeServerRuntimePersistence(config);

  assert.equal(profileAttempts, 2);
  assert.deepEqual(probe.blockers, []);
  assert.equal(probe.checks.authData.ready, true);
  assert.equal(probe.checks.guestSessions.ready, true);
  assert.equal(probe.checks.billing.ready, true);
  assert.equal(probe.checks.creditProviders.ready, true);
  assert.equal(probe.checks.workspaceLayout.ready, true);
  pool.query = originalQuery;
  await resetSharedPostgresPoolForTests();
});
