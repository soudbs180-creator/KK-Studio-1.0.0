import { env } from "../../../../packages/shared/src/index.ts";
import { getSharedPostgresPool, hasPostgresConfig, type PostgresQueryable } from "./postgres.ts";

export interface ServerRuntimeConfig {
  userApiEncryptionSecret?: string;
  allowInsecureLocalTaskSigningFallback?: boolean;
  databaseConfigReady: boolean;
  blockers: string[];
}

export interface ServerRuntimeProbeCheck {
  ready: boolean;
  blocker?: string;
  message?: string;
}

export interface ServerRuntimePersistenceProbe {
  checkedAt: string;
  postgresConfigValid?: boolean;
  blockers: string[];
  checks: {
    authData: ServerRuntimeProbeCheck;
    guestSessions: ServerRuntimeProbeCheck;
    billing: ServerRuntimeProbeCheck;
    creditProviders: ServerRuntimeProbeCheck;
    workspaceLayout: ServerRuntimeProbeCheck;
  };
}

const transientProbeRetryAttempts = 3;
const transientProbeRetryDelayMs = 250;
const transientProbeFailurePatterns = [
  /\beconnreset\b/i,
  /\betimedout\b/i,
  /\beconnrefused\b/i,
  /\beai_again\b/i,
  /\btoo many clients\b/i,
  /\btimeout\b/i,
];

function normalizeOptionalEnvValue(value: unknown): string | undefined {
  const normalized = String(value || "").trim();
  return normalized ? normalized : undefined;
}

function dedupeStrings(values: Array<string | undefined>): string[] {
  return Array.from(new Set(values.filter((value): value is string => Boolean(value))));
}

function buildReadyProbeCheck(): ServerRuntimeProbeCheck {
  return { ready: true };
}

function buildFailedProbeCheck(blocker: string, message: string): ServerRuntimeProbeCheck {
  return {
    ready: false,
    blocker,
    message,
  };
}

function describeProbeErrorMessage(error: unknown): string {
  const message = error instanceof Error
    ? error.message
    : String((error as { message?: string } | null | undefined)?.message || error || "Unknown PostgreSQL probe failure.");
  return message.trim() || "Unknown PostgreSQL probe failure.";
}

function isTransientProbeFailure(error: unknown): boolean {
  const message = describeProbeErrorMessage(error);
  return transientProbeFailurePatterns.some((pattern) => pattern.test(message));
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function normalizeProbeFailure(
  error: unknown,
  fallbackBlocker: string,
): { blocker: string; message: string } {
  return {
    blocker: fallbackBlocker,
    message: describeProbeErrorMessage(error),
  };
}

function mergeProbeChecks(...checks: ServerRuntimeProbeCheck[]): ServerRuntimeProbeCheck {
  const failedChecks = checks.filter((check) => !check.ready);
  if (failedChecks.length === 0) {
    return buildReadyProbeCheck();
  }

  return buildFailedProbeCheck(
    dedupeStrings(failedChecks.map((check) => check.blocker)).join(","),
    failedChecks.map((check) => check.message).filter(Boolean).join("; "),
  );
}

async function runProbeCheckWithRetry(
  execute: () => Promise<void>,
  fallbackBlocker: string,
): Promise<ServerRuntimeProbeCheck> {
  let lastFailure: { blocker: string; message: string } | undefined;

  for (let attempt = 1; attempt <= transientProbeRetryAttempts; attempt += 1) {
    try {
      await execute();
      return buildReadyProbeCheck();
    } catch (error) {
      const failure = normalizeProbeFailure(error, fallbackBlocker);
      lastFailure = failure;
      if (!isTransientProbeFailure(error) || attempt === transientProbeRetryAttempts) {
        return buildFailedProbeCheck(failure.blocker, failure.message);
      }
    }

    await delay(transientProbeRetryDelayMs * attempt);
  }

  if (lastFailure) {
    return buildFailedProbeCheck(lastFailure.blocker, lastFailure.message);
  }

  return buildFailedProbeCheck(fallbackBlocker, "Unknown PostgreSQL probe failure.");
}

async function probeQueryAccess(
  queryable: PostgresQueryable,
  sql: string,
  fallbackBlocker: string,
): Promise<ServerRuntimeProbeCheck> {
  return runProbeCheckWithRetry(async () => {
    await queryable.query(sql);
  }, fallbackBlocker);
}

function resolveBlockers(config: {
  databaseConfigReady: boolean;
}): string[] {
  return config.databaseConfigReady ? [] : ["POSTGRES_CONFIG_MISSING"];
}

export function resolveServerRuntimeConfig(): ServerRuntimeConfig {
  const databaseConfigReady = hasPostgresConfig();
  const userApiEncryptionSecret =
    normalizeOptionalEnvValue(env.get("USER_API_ENCRYPTION_SECRET"))
    || normalizeOptionalEnvValue(env.get("PROFILE_USER_APIS_ENCRYPTION_SECRET"));

  return {
    userApiEncryptionSecret,
    databaseConfigReady,
    blockers: resolveBlockers({ databaseConfigReady }),
  };
}

export async function probeServerRuntimePersistence(
  config: ServerRuntimeConfig,
): Promise<ServerRuntimePersistenceProbe> {
  const checkedAt = new Date().toISOString();
  const baseBlockers = resolveBlockers(config);

  if (baseBlockers.length > 0) {
    const unavailableCheck = buildFailedProbeCheck(
      "POSTGRES_CONFIG_MISSING",
      "PostgreSQL configuration is unavailable.",
    );
    return {
      checkedAt,
      postgresConfigValid: false,
      blockers: baseBlockers,
      checks: {
        authData: unavailableCheck,
        guestSessions: unavailableCheck,
        billing: unavailableCheck,
        creditProviders: unavailableCheck,
        workspaceLayout: unavailableCheck,
      },
    };
  }

  const queryable = getSharedPostgresPool();
  const authData = await probeQueryAccess(
    queryable,
    "select id from profiles limit 1",
    "POSTGRES_PROFILES_PROBE_FAILED",
  );
  const guestSessions = await probeQueryAccess(
    queryable,
    "select id from temp_users limit 1",
    "POSTGRES_TEMP_USERS_PROBE_FAILED",
  );
  const billing = mergeProbeChecks(
    await probeQueryAccess(
      queryable,
      "select user_id from user_credits limit 1",
      "POSTGRES_USER_CREDITS_PROBE_FAILED",
    ),
    await probeQueryAccess(
      queryable,
      "select id from credit_transactions limit 1",
      "POSTGRES_CREDIT_TRANSACTIONS_PROBE_FAILED",
    ),
  );
  const creditProviders = mergeProbeChecks(
    await probeQueryAccess(
      queryable,
      "select id from admin_credit_models limit 1",
      "POSTGRES_ADMIN_CREDIT_MODELS_PROBE_FAILED",
    ),
    await probeQueryAccess(
      queryable,
      "select provider_id from provider_pricing_cache limit 1",
      "POSTGRES_PROVIDER_PRICING_CACHE_PROBE_FAILED",
    ),
  );
  const workspaceLayout = mergeProbeChecks(
    await probeQueryAccess(
      queryable,
      "select user_id from workspace_layouts limit 1",
      "POSTGRES_WORKSPACE_LAYOUTS_PROBE_FAILED",
    ),
    await probeQueryAccess(
      queryable,
      "select user_id from workspace_cloud_images limit 1",
      "POSTGRES_WORKSPACE_CLOUD_IMAGES_PROBE_FAILED",
    ),
  );
  const checks = {
    authData,
    guestSessions,
    billing,
    creditProviders,
    workspaceLayout,
  };
  const blockers = dedupeStrings([
    ...baseBlockers,
    ...Object.values(checks).map((check) => check.blocker),
  ]);

  return {
    checkedAt,
    postgresConfigValid: blockers.length === 0,
    blockers,
    checks,
  };
}

export function assertServerRuntimeConfigConsistency(config: ServerRuntimeConfig) {
  if (!config.databaseConfigReady) {
    throw new Error(
      "PostgreSQL configuration is unavailable. Set DATABASE_URL or PGHOST/PGDATABASE/PGUSER before starting the API server.",
    );
  }

  if (!config.userApiEncryptionSecret) {
    throw new Error(
      "USER_API_ENCRYPTION_SECRET is required before starting the API server.",
    );
  }
}

export function summarizeServerRuntimeConfig(
  config: ServerRuntimeConfig,
  options: {
    persistenceProbe?: ServerRuntimePersistenceProbe;
  } = {},
) {
  const probe = options.persistenceProbe;
  const structuralBlockers =
    Array.isArray(config.blockers) && config.blockers.length > 0
      ? [...config.blockers]
      : resolveBlockers(config);
  const blockers = dedupeStrings([
    ...structuralBlockers,
    ...(probe?.blockers || []),
  ]);

  return {
    hasPostgresConfig: config.databaseConfigReady,
    databaseConfigStatus: config.databaseConfigReady ? "valid" : "missing",
    hasValidPostgresConfig: probe
      ? probe.postgresConfigValid === true
      : config.databaseConfigReady,
    hasAuthKey: false,
    hasUserApiEncryptionSecret: Boolean(config.userApiEncryptionSecret),
    persistenceProbeCheckedAt: probe?.checkedAt,
    canonicalConfigReady: config.databaseConfigReady,
    canonicalPersistenceReady: config.databaseConfigReady && (!probe || probe.blockers.length === 0),
    structuralBlockers,
    blockers,
  };
}
