import path from "path";
import { fileURLToPath, pathToFileURL } from "url";

import {
  applyPrimaryEnvToProcess,
  compareSupabaseProjectRefs,
  describeSupabaseServerKey,
  findIgnoredLegacySecrets,
  findSnapshotEntries,
  getEffectiveValue,
  isPlaceholder,
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
  const supabaseUrl = resolveEffectiveValue(apiSnapshots, "SUPABASE_URL");
  const publicSupabaseUrl = resolveEffectiveValue(publicSnapshots, "VITE_SUPABASE_URL");
  const rawServiceRoleKey =
    resolveEffectiveValue(apiSnapshots, "SUPABASE_SERVICE_ROLE_KEY").value
    || resolveEffectiveValue(apiSnapshots, "SUPABASE_SECRET_KEY").value;
  const serviceRoleKey = describeSupabaseServerKey(rawServiceRoleKey);
  const projectRefs = compareSupabaseProjectRefs(publicSupabaseUrl.value, supabaseUrl.value);
  const misplacedRootServerEnv = findSnapshotEntries(publicSnapshots, [
    "SUPABASE_URL",
    "SUPABASE_SERVICE_ROLE_KEY",
    "SUPABASE_SECRET_KEY",
    "SUPABASE_ANON_KEY",
    "USER_API_ENCRYPTION_SECRET",
  ]);
  const ignoredLegacySecrets = findIgnoredLegacySecrets(snapshots.ignoredSnapshots, [
    "SUPABASE_SERVICE_ROLE_KEY",
    "SUPABASE_SECRET_KEY",
  ]).filter((entry) => !isPlaceholder(entry.value));
  const problems = [];

  if (misplacedRootServerEnv.length > 0) {
    problems.push(
      "Root .env/.env.local contain server-only API values that local API startup ignores: "
      + `${misplacedRootServerEnv.map((entry) => `${entry.key} from ${entry.source}`).join(", ")}. `
      + "Move them into apps/api/.env.local.",
    );
  }

  if (!supabaseUrl.value) {
    problems.push(
      "SUPABASE_URL is missing. Add it to apps/api/.env.local.",
    );
  }

  if (!serviceRoleKey.value || isPlaceholder(serviceRoleKey.value)) {
    const ignoredLegacyHint = ignoredLegacySecrets.length > 0
      ? ` Ignored legacy entries still exist in ${ignoredLegacySecrets.map((entry) => entry.source).join(", ")}.`
      : "";
    problems.push(
      "SUPABASE_SERVICE_ROLE_KEY is missing or still using a placeholder. "
      + "Copy apps/api/.env.local.example to apps/api/.env.local and set a real service role key."
      + ignoredLegacyHint,
    );
  }

  if (serviceRoleKey.status === "invalid") {
    const invalidKeyHint = serviceRoleKey.looksLikeDatabasePassword
      ? " The current value looks like a database password copied from the connection string, not the service-role/secret API key."
      : "";
    problems.push(
      "SUPABASE_SERVICE_ROLE_KEY is present but not a valid Supabase service-role/secret key. "
      + "Copy the service_role JWT or sb_secret key from Supabase Project Settings > API into apps/api/.env.local."
      + invalidKeyHint,
    );
  }

  if (projectRefs.matches === false) {
    problems.push(
      `SUPABASE_URL (${projectRefs.serverProjectRef}) does not match VITE_SUPABASE_URL `
      + `(${projectRefs.publicProjectRef}). Point both to the same Supabase project.`,
    );
  }

  if (problems.length === 0) {
    const configModule = await import(
      pathToFileURL(path.join(repoRoot, "apps", "api", "src", "lib", "server-supabase-config.ts")).href
    );
    const persistenceProbe = await configModule.probeServerSupabasePersistence(
      configModule.resolveServerSupabaseConfig(),
    );
    if (persistenceProbe.serviceRoleKeyValid === false || persistenceProbe.blockers.length > 0) {
      problems.push(
        "SUPABASE_SERVICE_ROLE_KEY did not pass the canonical Supabase probe. "
        + `Probe blockers: ${persistenceProbe.blockers.join(", ") || "<none>"}.`,
      );
    }
  }

  if (problems.length > 0) {
    throw new Error(
      "[run-api-dev] Local API startup blocked because the canonical Supabase config is incomplete.\n"
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
  // server-side Supabase persistence path.
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
