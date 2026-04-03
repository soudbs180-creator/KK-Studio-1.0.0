import { createClient } from "@supabase/supabase-js";

import { env } from "../../../../packages/shared/src/index.ts";

export interface ServerSupabaseConfig {
  supabaseUrl?: string;
  publicSupabaseUrl?: string;
  serviceRoleKey?: string;
  serviceRoleKeyStatus: "missing" | "placeholder" | "invalid" | "valid";
  authKey?: string;
  userApiEncryptionSecret?: string;
  usingPublicUrlFallback: boolean;
  supabaseProjectRef?: string;
  publicSupabaseProjectRef?: string;
  projectRefMatches?: boolean;
  blockers: string[];
}

export interface ServerSupabaseProbeCheck {
  ready: boolean;
  blocker?: string;
  message?: string;
}

export interface ServerSupabasePersistenceProbe {
  checkedAt: string;
  serviceRoleKeyValid?: boolean;
  blockers: string[];
  checks: {
    authData: ServerSupabaseProbeCheck;
    guestSessions: ServerSupabaseProbeCheck;
    billing: ServerSupabaseProbeCheck;
    creditProviders: ServerSupabaseProbeCheck;
    workspaceLayout: ServerSupabaseProbeCheck;
  };
}

const obviousPlaceholderPatterns = [
  /^replace-with-/i,
  /^your[-_]/i,
  /^changeme$/i,
  /^todo$/i,
  /^placeholder$/i,
];
const transientProbeRetryAttempts = 5;
const transientProbeRetryDelayMs = 250;
const transientProbeFailurePatterns = [
  /fetch failed/i,
  /network request failed/i,
  /\beconnreset\b/i,
  /\betimedout\b/i,
  /\benotfound\b/i,
  /\beai_again\b/i,
  /\beconnrefused\b/i,
];

function normalizeOptionalEnvValue(value: unknown): string | undefined {
  const normalized = String(value || "").trim();
  return normalized ? normalized : undefined;
}

function isObviousPlaceholder(value: string | undefined): boolean {
  if (!value) {
    return false;
  }

  return obviousPlaceholderPatterns.some((pattern) => pattern.test(value));
}

function decodeBase64UrlSegment(segment: string): string {
  const normalized = segment.replace(/-/g, "+").replace(/_/g, "/");
  const padding = normalized.length % 4 === 0
    ? ""
    : "=".repeat(4 - (normalized.length % 4));

  return Buffer.from(`${normalized}${padding}`, "base64").toString("utf8");
}

function describeServiceRoleKey(value: string | undefined): {
  status: ServerSupabaseConfig["serviceRoleKeyStatus"];
  value?: string;
  reason?: string;
  looksLikeDatabasePassword: boolean;
} {
  const normalized = String(value || "").trim();
  if (!normalized) {
    return {
      status: "missing",
      looksLikeDatabasePassword: false,
    };
  }

  if (isObviousPlaceholder(normalized)) {
    return {
      status: "placeholder",
      looksLikeDatabasePassword: false,
    };
  }

  if (normalized.startsWith("sb_secret_")) {
    return {
      status: "valid",
      value: normalized,
      looksLikeDatabasePassword: false,
    };
  }

  const segments = normalized.split(".");
  if (segments.length === 3) {
    try {
      const payload = JSON.parse(decodeBase64UrlSegment(segments[1]));
      if (payload?.role === "service_role") {
        return {
          status: "valid",
          value: normalized,
          looksLikeDatabasePassword: false,
        };
      }

      return {
        status: "invalid",
        reason: typeof payload?.role === "string"
          ? `JWT role is ${payload.role}`
          : "JWT is missing the service_role claim",
        looksLikeDatabasePassword: false,
      };
    } catch {
      return {
        status: "invalid",
        reason: "JWT payload could not be decoded",
        looksLikeDatabasePassword: false,
      };
    }
  }

  const looksLikeDatabasePassword = /^[a-f0-9]{32,}$/i.test(normalized);
  return {
    status: "invalid",
    reason: looksLikeDatabasePassword
      ? "looks like a database password, not a Supabase API key"
      : "unsupported key format",
    looksLikeDatabasePassword,
  };
}

function resolveServiceRoleKey(): ReturnType<typeof describeServiceRoleKey> {
  const serviceRoleKey =
    normalizeOptionalEnvValue(env.get("SUPABASE_SERVICE_ROLE_KEY"))
    || normalizeOptionalEnvValue(env.get("SUPABASE_SECRET_KEY"));
  return describeServiceRoleKey(serviceRoleKey);
}

export function extractSupabaseProjectRef(url?: string): string | undefined {
  const normalized = String(url || "").trim();
  if (!normalized) {
    return undefined;
  }

  try {
    const hostname = new URL(normalized).hostname;
    const match = hostname.match(/^([^.]+)\.supabase\./i);
    return match ? match[1] : undefined;
  } catch {
    return undefined;
  }
}

function resolveBlockers(config: {
  supabaseUrl?: string;
  serviceRoleKey?: string;
  serviceRoleKeyStatus: ServerSupabaseConfig["serviceRoleKeyStatus"];
  projectRefMatches?: boolean;
}): string[] {
  const blockers: string[] = [];

  if (!config.supabaseUrl) {
    blockers.push("SUPABASE_URL_MISSING");
  }

  if (config.serviceRoleKeyStatus === "invalid") {
    blockers.push("SUPABASE_SERVICE_ROLE_KEY_INVALID");
  } else if (!config.serviceRoleKey) {
    blockers.push("SUPABASE_SERVICE_ROLE_KEY_MISSING");
  }

  if (config.projectRefMatches === false) {
    blockers.push("SUPABASE_PROJECT_REF_MISMATCH");
  }

  return blockers;
}

function dedupeStrings(values: Array<string | undefined>): string[] {
  return Array.from(new Set(values.filter((value): value is string => Boolean(value))));
}

function buildReadyProbeCheck(): ServerSupabaseProbeCheck {
  return { ready: true };
}

function buildFailedProbeCheck(blocker: string, message: string): ServerSupabaseProbeCheck {
  return {
    ready: false,
    blocker,
    message,
  };
}

function describeProbeErrorMessage(error: unknown): string {
  const message = error instanceof Error
    ? error.message
    : String((error as { message?: string } | null | undefined)?.message || error || "Unknown Supabase probe failure.");
  return message.trim() || "Unknown Supabase probe failure.";
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
  const normalizedMessage = describeProbeErrorMessage(error);
  const lower = normalizedMessage.toLowerCase();

  if (lower.includes("invalid api key") || lower.includes("invalid jwt") || lower.includes("jwt")) {
    return {
      blocker: "SUPABASE_SERVICE_ROLE_KEY_INVALID",
      message: normalizedMessage,
    };
  }

  return {
    blocker: fallbackBlocker,
    message: normalizedMessage,
  };
}

function mergeProbeChecks(...checks: ServerSupabaseProbeCheck[]): ServerSupabaseProbeCheck {
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
  execute: () => Promise<{ error: unknown }>,
  fallbackBlocker: string,
): Promise<ServerSupabaseProbeCheck> {
  let lastFailure: { blocker: string; message: string } | undefined;

  for (let attempt = 1; attempt <= transientProbeRetryAttempts; attempt += 1) {
    try {
      const result = await execute();
      if (!result.error) {
        return buildReadyProbeCheck();
      }

      const failure = normalizeProbeFailure(result.error, fallbackBlocker);
      lastFailure = failure;
      if (!isTransientProbeFailure(result.error) || attempt === transientProbeRetryAttempts) {
        return buildFailedProbeCheck(failure.blocker, failure.message);
      }
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

  return buildFailedProbeCheck(fallbackBlocker, "Unknown Supabase probe failure.");
}

async function probeTableAccess(
  client: any,
  table: string,
  column: string,
  fallbackBlocker: string,
): Promise<ServerSupabaseProbeCheck> {
  return runProbeCheckWithRetry(async () => {
    const { error } = await client
      .from(table)
      .select(column, { head: true })
      .limit(1);

    return { error };
  }, fallbackBlocker);
}

async function probeStorageAccess(
  client: any,
  bucket: string,
  fallbackBlocker: string,
): Promise<ServerSupabaseProbeCheck> {
  return runProbeCheckWithRetry(async () => {
    const { error } = await client.storage.from(bucket).list("", { limit: 1 });
    return { error };
  }, fallbackBlocker);
}

export function resolveServerSupabaseConfig(): ServerSupabaseConfig {
  const explicitSupabaseUrl = normalizeOptionalEnvValue(env.get("SUPABASE_URL"));
  const publicSupabaseUrl = normalizeOptionalEnvValue(env.get("VITE_SUPABASE_URL"));
  const resolvedSupabaseUrl = explicitSupabaseUrl || publicSupabaseUrl;
  const serviceRoleKey = resolveServiceRoleKey();
  const authKey =
    serviceRoleKey.value
    || normalizeOptionalEnvValue(env.get("SUPABASE_ANON_KEY"))
    || normalizeOptionalEnvValue(env.get("VITE_SUPABASE_ANON_KEY"));
  const userApiEncryptionSecret =
    normalizeOptionalEnvValue(env.get("USER_API_ENCRYPTION_SECRET"))
    || normalizeOptionalEnvValue(env.get("PROFILE_USER_APIS_ENCRYPTION_SECRET"));
  const supabaseProjectRef = extractSupabaseProjectRef(resolvedSupabaseUrl);
  const publicSupabaseProjectRef = extractSupabaseProjectRef(publicSupabaseUrl);
  const projectRefMatches = supabaseProjectRef && publicSupabaseProjectRef
    ? supabaseProjectRef === publicSupabaseProjectRef
    : undefined;

  return {
    supabaseUrl: resolvedSupabaseUrl,
    publicSupabaseUrl,
    serviceRoleKey: serviceRoleKey.value,
    serviceRoleKeyStatus: serviceRoleKey.status,
    authKey,
    userApiEncryptionSecret,
    usingPublicUrlFallback: !explicitSupabaseUrl && Boolean(publicSupabaseUrl),
    supabaseProjectRef,
    publicSupabaseProjectRef,
    projectRefMatches,
    blockers: resolveBlockers({
      supabaseUrl: resolvedSupabaseUrl,
      serviceRoleKey: serviceRoleKey.value,
      serviceRoleKeyStatus: serviceRoleKey.status,
      projectRefMatches,
    }),
  };
}

export async function probeServerSupabasePersistence(
  config: ServerSupabaseConfig,
): Promise<ServerSupabasePersistenceProbe> {
  const checkedAt = new Date().toISOString();
  const baseBlockers = resolveBlockers(config);

  if (baseBlockers.length > 0) {
    const primaryBlocker = baseBlockers[0] || "SUPABASE_SERVICE_ROLE_PROBE_FAILED";
    const failureMessage = primaryBlocker === "SUPABASE_URL_MISSING"
      ? "SUPABASE_URL is missing."
      : primaryBlocker === "SUPABASE_SERVICE_ROLE_KEY_MISSING"
        ? "SUPABASE_SERVICE_ROLE_KEY is missing."
        : primaryBlocker === "SUPABASE_SERVICE_ROLE_KEY_INVALID"
          ? "SUPABASE_SERVICE_ROLE_KEY is present but has an invalid format."
        : "SUPABASE_URL and VITE_SUPABASE_URL do not point at the same Supabase project.";
    const unavailableCheck = buildFailedProbeCheck(primaryBlocker, failureMessage);
    return {
      checkedAt,
      serviceRoleKeyValid: primaryBlocker === "SUPABASE_SERVICE_ROLE_KEY_MISSING" ? false : undefined,
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

  const client = createClient(config.supabaseUrl!, config.serviceRoleKey!, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  const authData = await probeTableAccess(
    client,
    "profiles",
    "id",
    "SUPABASE_PROFILES_PROBE_FAILED",
  );
  const guestSessions = await probeTableAccess(
    client,
    "temp_users",
    "id",
    "SUPABASE_TEMP_USERS_PROBE_FAILED",
  );
  const billing = mergeProbeChecks(
    await probeTableAccess(
      client,
      "user_credits",
      "user_id",
      "SUPABASE_USER_CREDITS_PROBE_FAILED",
    ),
    await probeTableAccess(
      client,
      "credit_transactions",
      "id",
      "SUPABASE_CREDIT_TRANSACTIONS_PROBE_FAILED",
    ),
  );
  const creditProviders = mergeProbeChecks(
    await probeTableAccess(
      client,
      "admin_credit_models",
      "id",
      "SUPABASE_ADMIN_CREDIT_MODELS_PROBE_FAILED",
    ),
    await probeTableAccess(
      client,
      "provider_pricing_cache",
      "provider_id",
      "SUPABASE_PROVIDER_PRICING_CACHE_PROBE_FAILED",
    ),
  );
  const workspaceLayout = await probeStorageAccess(
    client,
    "generated-images",
    "SUPABASE_WORKSPACE_STORAGE_PROBE_FAILED",
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
  const invalidKeyDetected = blockers.includes("SUPABASE_SERVICE_ROLE_KEY_INVALID");
  const anyCheckSucceeded = Object.values(checks).some((check) => check.ready);

  return {
    checkedAt,
    serviceRoleKeyValid: invalidKeyDetected ? false : anyCheckSucceeded ? true : undefined,
    blockers,
    checks,
  };
}

export function assertServerSupabaseConfigConsistency(config: ServerSupabaseConfig) {
  if (config.serviceRoleKeyStatus === "invalid") {
    throw new Error(
      "SUPABASE_SERVICE_ROLE_KEY is present but is not a valid Supabase service-role/secret key. "
      + "Use the service_role JWT or sb_secret key from Supabase Project Settings > API instead of the database password.",
    );
  }

  if (config.projectRefMatches === false) {
    throw new Error(
      `SUPABASE_URL project ref "${config.supabaseProjectRef || "unknown"}" `
      + `does not match VITE_SUPABASE_URL project ref "${config.publicSupabaseProjectRef || "unknown"}". `
      + "Point the local API and frontend env at the same Supabase project.",
    );
  }

  if (config.supabaseUrl && config.serviceRoleKey && !config.userApiEncryptionSecret) {
    throw new Error(
      "USER_API_ENCRYPTION_SECRET is required when canonical Supabase auth-data persistence is enabled. "
      + "Set USER_API_ENCRYPTION_SECRET (or PROFILE_USER_APIS_ENCRYPTION_SECRET) before starting the API server.",
    );
  }
}

export function summarizeServerSupabaseConfig(
  config: ServerSupabaseConfig,
  options: {
    persistenceProbe?: ServerSupabasePersistenceProbe;
  } = {},
) {
  const probe = options.persistenceProbe;
  const blockers = dedupeStrings([
    ...(Array.isArray(config.blockers) && config.blockers.length > 0
      ? [...config.blockers]
      : resolveBlockers(config)),
    ...(probe?.blockers || []),
  ]);

  return {
    hasSupabaseUrl: Boolean(config.supabaseUrl),
    hasServiceRoleKey: config.serviceRoleKeyStatus === "valid" || config.serviceRoleKeyStatus === "invalid",
    serviceRoleKeyStatus: config.serviceRoleKeyStatus,
    hasValidServiceRoleKey: probe
      ? probe.serviceRoleKeyValid === true
      : config.serviceRoleKeyStatus === "valid",
    hasAuthKey: Boolean(config.authKey),
    hasUserApiEncryptionSecret: Boolean(config.userApiEncryptionSecret),
    usingPublicUrlFallback: config.usingPublicUrlFallback,
    supabaseProjectRef: config.supabaseProjectRef,
    publicSupabaseProjectRef: config.publicSupabaseProjectRef,
    projectRefMatches: config.projectRefMatches,
    persistenceProbeCheckedAt: probe?.checkedAt,
    canonicalPersistenceReady: Boolean(
      config.supabaseUrl
      && config.serviceRoleKey
      && config.serviceRoleKeyStatus === "valid"
      && config.projectRefMatches !== false
      && (!probe || probe.blockers.length === 0)
    ),
    blockers,
  };
}
