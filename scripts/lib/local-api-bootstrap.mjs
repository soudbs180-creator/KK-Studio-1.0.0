import path from "path";
import { fileURLToPath, pathToFileURL } from "url";

import {
  applyPrimaryEnvToProcess,
  findSnapshotEntries,
  getEffectiveValue,
} from "./env-contract.mjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const defaultRepoRoot = path.join(__dirname, "..", "..");
const DEFAULT_JSON_BODY_MAX_BYTES = 1024 * 1024;
const DEFAULT_PROFILE_JSON_BODY_MAX_BYTES = 4 * 1024 * 1024;

function resolveEffectiveValue(snapshots, key) {
  const resolved = getEffectiveValue(snapshots, key);
  return {
    source: resolved?.source,
    value: String(resolved?.value || "").trim(),
  };
}

function formatSearchedFiles(snapshots, repoRoot) {
  return snapshots.searchedFiles.primary
    .map((filePath) => path.relative(repoRoot, filePath))
    .join(", ");
}

function parsePositiveInteger(rawValue, fallback) {
  const parsed = Number(rawValue);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function isTruthyValue(value) {
  const normalized = String(value || "").trim().toLowerCase();
  return normalized === "1"
    || normalized === "true"
    || normalized === "yes"
    || normalized === "on";
}

function applyLocalApiBodyLimitDefaults() {
  const explicitGlobalBodyLimit = String(process.env.KK_API_MAX_JSON_BODY_BYTES || "").trim();
  const explicitProfileBodyLimit = String(process.env.KK_API_PROFILE_MAX_JSON_BODY_BYTES || "").trim();
  const explicitKeyManagerBodyLimit = String(process.env.KK_API_KEY_MANAGER_MAX_JSON_BODY_BYTES || "").trim();

  const effectiveGlobalBodyLimit = parsePositiveInteger(
    explicitGlobalBodyLimit,
    DEFAULT_JSON_BODY_MAX_BYTES,
  );

  if (!explicitGlobalBodyLimit) {
    process.env.KK_API_MAX_JSON_BODY_BYTES = String(effectiveGlobalBodyLimit);
  }

  if (!explicitProfileBodyLimit && !explicitKeyManagerBodyLimit) {
    process.env.KK_API_PROFILE_MAX_JSON_BODY_BYTES = String(
      Math.max(effectiveGlobalBodyLimit, DEFAULT_PROFILE_JSON_BODY_MAX_BYTES),
    );
  }
}

export async function assertLocalApiConfig(options = {}) {
  const repoRoot = options.repoRoot || defaultRepoRoot;
  const snapshots = applyPrimaryEnvToProcess(repoRoot);
  const publicSnapshots = snapshots.frontendSnapshots;
  const apiSnapshots = snapshots.apiSnapshots;
  const databaseUrl = resolveEffectiveValue(apiSnapshots, "DATABASE_URL");
  const pgHost = resolveEffectiveValue(apiSnapshots, "PGHOST");
  const pgDatabase = resolveEffectiveValue(apiSnapshots, "PGDATABASE");
  const pgUser = resolveEffectiveValue(apiSnapshots, "PGUSER");
  const userApiEncryptionSecret =
    resolveEffectiveValue(apiSnapshots, "USER_API_ENCRYPTION_SECRET").value
    || resolveEffectiveValue(apiSnapshots, "PROFILE_USER_APIS_ENCRYPTION_SECRET").value;
  const misplacedRootServerEnv = findSnapshotEntries(publicSnapshots, [
    "DATABASE_URL",
    "PGHOST",
    "PGPORT",
    "PGDATABASE",
    "PGUSER",
    "PGPASSWORD",
    "PGSSL",
    "USER_API_ENCRYPTION_SECRET",
  ]);
  const problems = [];
  const hasPostgresConfig = Boolean(
    databaseUrl.value || (pgHost.value && pgDatabase.value && pgUser.value),
  );

  if (misplacedRootServerEnv.length > 0) {
    problems.push(
      "Root .env/.env.local contain server-only API values that local API startup ignores: "
      + `${misplacedRootServerEnv.map((entry) => `${entry.key} from ${entry.source}`).join(", ")}. `
      + "Move them into apps/api/.env.local.",
    );
  }

  if (!hasPostgresConfig) {
    problems.push(
      "DATABASE_URL is missing, or PGHOST/PGDATABASE/PGUSER are incomplete. "
      + "Copy apps/api/.env.local.example to apps/api/.env.local and set your VPS PostgreSQL connection.",
    );
  }

  if (!userApiEncryptionSecret) {
    problems.push(
      "USER_API_ENCRYPTION_SECRET is missing. Add it to apps/api/.env.local.",
    );
  }

  if (problems.length === 0) {
    const configModule = await import(
      pathToFileURL(path.join(repoRoot, "apps", "api", "src", "lib", "server-runtime-config.ts")).href
    );
    const persistenceProbe = await configModule.probeServerRuntimePersistence(
      configModule.resolveServerRuntimeConfig(),
    );
    if (persistenceProbe.postgresConfigValid === false || persistenceProbe.blockers.length > 0) {
      problems.push(
        "PostgreSQL persistence probe failed. "
        + `Probe blockers: ${persistenceProbe.blockers.join(", ") || "<none>"}.`,
      );
    }
  }

  if (problems.length > 0) {
    throw new Error(
      "[run-api-dev] Local API startup blocked because the VPS PostgreSQL config is incomplete.\n"
      + `${problems.map((problem) => `- ${problem}`).join("\n")}\n`
      + `Searched primary env files: ${formatSearchedFiles(snapshots, repoRoot)}`,
    );
  }
}

export function resolveLocalApiTurnstileVerifier(env = process.env) {
  if (!isTruthyValue(env.VITE_TURNSTILE_LOCAL_BYPASS)) {
    return undefined;
  }

  return async () => ({ success: true });
}

export async function startLocalApiServer(options = {}) {
  const repoRoot = options.repoRoot || defaultRepoRoot;
  const port = options.port ?? Number(process.env.PORT || 3001);
  const skipConfigCheck = options.skipConfigCheck === true;

  // The local-only bootstrap still needs the canonical env search order so
  // local auth and encrypted profile storage keep working without the full
  // server-side VPS PostgreSQL startup checks.
  applyPrimaryEnvToProcess(repoRoot);

  if (!skipConfigCheck) {
    await assertLocalApiConfig({ repoRoot });
  }

  process.env.RUN_KK_API_SKELETON = "false";
  process.env.PORT = String(port);
  applyLocalApiBodyLimitDefaults();

  const serverEntry = pathToFileURL(path.join(repoRoot, "apps", "api", "src", "server.ts")).href;
  const serverModule = await import(serverEntry);
  if (typeof serverModule.startApiServer !== "function") {
    throw new Error("apps/api/src/server.ts does not export startApiServer()");
  }

  const verifyTurnstileToken = resolveLocalApiTurnstileVerifier(process.env);
  const serverOptions = verifyTurnstileToken
    ? { verifyTurnstileToken }
    : undefined;

  return serverModule.startApiServer(port, serverOptions);
}
