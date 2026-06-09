import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

export const FRONTEND_ENV_RELATIVE_PATHS = [
  ".env",
  ".env.local",
];

export const API_ENV_RELATIVE_PATHS = [
  path.join("server", ".env"),
  path.join("server", ".env.local"),
];

export const PRIMARY_ENV_RELATIVE_PATHS = [
  ...FRONTEND_ENV_RELATIVE_PATHS,
  ...API_ENV_RELATIVE_PATHS,
];

export const FUNCTION_ENV_RELATIVE_PATHS = [];

export const IGNORED_LEGACY_ENV_RELATIVE_PATHS = [
  path.join("apps", "api", ".env"),
  path.join("apps", "api", ".env.local"),
];

const PLACEHOLDER_PATTERNS = [
  /^replace-with-/i,
  /^your[-_]/i,
  /^changeme$/i,
  /^todo$/i,
  /^placeholder$/i,
];

const SERVER_ONLY_ENV_KEYS = new Set([
  "DATABASE_URL",
  "PGHOST",
  "PGPORT",
  "PGDATABASE",
  "PGUSER",
  "PGPASSWORD",
  "PGSSL",
  "PGSSLMODE",
  "KK_API_SESSION_SIGNING_SECRET",
  "USER_API_ENCRYPTION_SECRET",
  "PROFILE_USER_APIS_ENCRYPTION_SECRET",
]);

const LEGACY_DATA_PROVIDER_ENV_PREFIXES = [
  "SUPABASE_",
  "VITE_SUPABASE_",
];

const SERVER_ONLY_ENV_PREFIXES = [
  "WECHAT_",
  "KK_INTERNAL_",
  "SYSTEM_PROXY_",
  "USER_ROUTE_PROXY_",
];

function toAbsolutePath(rootPath, relativePath) {
  return path.join(rootPath, relativePath);
}

function createSnapshot(rootPath, relativePath) {
  const filePath = toAbsolutePath(rootPath, relativePath);
  if (!fs.existsSync(filePath)) {
    return null;
  }

  return {
    filePath,
    relativePath,
    values: parseEnvFile(filePath),
  };
}

export function resolveRepoRoot(importMetaUrl) {
  return path.resolve(path.dirname(fileURLToPath(importMetaUrl)), "..");
}

export function isPlaceholder(value) {
  const normalized = String(value || "").trim();
  if (!normalized) {
    return false;
  }

  return PLACEHOLDER_PATTERNS.some((pattern) => pattern.test(normalized));
}

export function parseEnvFile(filePath) {
  if (!fs.existsSync(filePath)) {
    return {};
  }

  return fs
    .readFileSync(filePath, "utf8")
    .split(/\r?\n/)
    .reduce((accumulator, line) => {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) {
        return accumulator;
      }

      const separatorIndex = trimmed.indexOf("=");
      if (separatorIndex <= 0) {
        return accumulator;
      }

      const key = trimmed.slice(0, separatorIndex).trim();
      let value = trimmed.slice(separatorIndex + 1).trim();
      if (
        (value.startsWith("\"") && value.endsWith("\""))
        || (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
      }

      accumulator[key] = value;
      return accumulator;
    }, {});
}

export function summarizeValue(value) {
  if (!String(value || "").trim()) {
    return "<missing>";
  }

  if (isPlaceholder(value)) {
    return "<placeholder>";
  }

  return "<present>";
}

export function isServerOnlyEnvKey(key) {
  if (SERVER_ONLY_ENV_KEYS.has(key)) {
    return true;
  }

  return SERVER_ONLY_ENV_PREFIXES.some((prefix) => key.startsWith(prefix));
}

export function isLegacyDataProviderEnvKey(key) {
  return LEGACY_DATA_PROVIDER_ENV_PREFIXES.some((prefix) => key.startsWith(prefix));
}

function shouldHydrateFrontendEnvKey(key) {
  return !isServerOnlyEnvKey(key) && !isLegacyDataProviderEnvKey(key);
}

function shouldHydrateApiEnvKey(key) {
  return !isLegacyDataProviderEnvKey(key);
}

export function collectEnvSnapshots(rootPath, options = {}) {
  const includeFunctionEnv = options.includeFunctionEnv === true;
  const frontendSnapshots = FRONTEND_ENV_RELATIVE_PATHS
    .map((relativePath) => createSnapshot(rootPath, relativePath))
    .filter(Boolean);
  const apiSnapshots = API_ENV_RELATIVE_PATHS
    .map((relativePath) => createSnapshot(rootPath, relativePath))
    .filter(Boolean);
  const functionSnapshots = includeFunctionEnv
    ? FUNCTION_ENV_RELATIVE_PATHS
      .map((relativePath) => createSnapshot(rootPath, relativePath))
      .filter(Boolean)
    : [];
  const ignoredSnapshots = IGNORED_LEGACY_ENV_RELATIVE_PATHS
    .map((relativePath) => createSnapshot(rootPath, relativePath))
    .filter(Boolean);

  return {
    frontendSnapshots,
    apiSnapshots,
    primarySnapshots: [...frontendSnapshots, ...apiSnapshots],
    functionSnapshots,
    ignoredSnapshots,
    activeSnapshots: [...frontendSnapshots, ...apiSnapshots, ...functionSnapshots],
    searchedFiles: {
      frontend: FRONTEND_ENV_RELATIVE_PATHS.map((relativePath) => toAbsolutePath(rootPath, relativePath)),
      api: API_ENV_RELATIVE_PATHS.map((relativePath) => toAbsolutePath(rootPath, relativePath)),
      primary: PRIMARY_ENV_RELATIVE_PATHS.map((relativePath) => toAbsolutePath(rootPath, relativePath)),
      function: includeFunctionEnv
        ? FUNCTION_ENV_RELATIVE_PATHS.map((relativePath) => toAbsolutePath(rootPath, relativePath))
        : [],
      ignoredLegacy: IGNORED_LEGACY_ENV_RELATIVE_PATHS.map((relativePath) => toAbsolutePath(rootPath, relativePath)),
    },
  };
}

export function applyPrimaryEnvToProcess(rootPath, options = {}) {
  const preserveExisting = options.preserveExisting !== false;
  const snapshots = collectEnvSnapshots(rootPath, options);
  const protectedKeys = preserveExisting ? new Set(Object.keys(process.env)) : new Set();

  for (const snapshot of snapshots.frontendSnapshots) {
    for (const [key, value] of Object.entries(snapshot.values)) {
      if (!shouldHydrateFrontendEnvKey(key)) {
        continue;
      }

      if (preserveExisting && protectedKeys.has(key)) {
        continue;
      }

      process.env[key] = value;
    }
  }

  for (const snapshot of snapshots.apiSnapshots) {
    for (const [key, value] of Object.entries(snapshot.values)) {
      if (!shouldHydrateApiEnvKey(key)) {
        continue;
      }

      if (preserveExisting && protectedKeys.has(key)) {
        continue;
      }

      process.env[key] = value;
    }
  }

  return snapshots;
}

export function getEffectiveValue(snapshots, key, options = {}) {
  const processEnv = options.processEnv || process.env;
  const processValue = String(processEnv[key] || "").trim();
  if (processValue) {
    return {
      source: "process.env",
      value: processValue,
    };
  }

  for (let index = snapshots.length - 1; index >= 0; index -= 1) {
    const snapshot = snapshots[index];
    if (Object.prototype.hasOwnProperty.call(snapshot.values, key)) {
      return {
        source: snapshot.relativePath,
        value: snapshot.values[key],
      };
    }
  }

  return null;
}

export function findSnapshotEntries(snapshots, keys) {
  return snapshots.flatMap((snapshot) => keys
    .filter((key) => Object.prototype.hasOwnProperty.call(snapshot.values, key))
    .map((key) => ({
      key,
      source: snapshot.relativePath,
      value: snapshot.values[key],
    })));
}
