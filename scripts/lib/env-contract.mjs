import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

export const FRONTEND_ENV_RELATIVE_PATHS = [
  ".env",
  ".env.local",
];

export const API_ENV_RELATIVE_PATHS = [
  path.join("apps", "api", ".env"),
  path.join("apps", "api", ".env.local"),
];

export const PRIMARY_ENV_RELATIVE_PATHS = [
  ...FRONTEND_ENV_RELATIVE_PATHS,
  ...API_ENV_RELATIVE_PATHS,
];

export const FUNCTION_ENV_RELATIVE_PATHS = [
  path.join("supabase", ".env.functions.local"),
];

export const IGNORED_LEGACY_ENV_RELATIVE_PATHS = [
  path.join("server", ".env"),
  path.join("server", ".env.local"),
];

const PLACEHOLDER_PATTERNS = [
  /^replace-with-/i,
  /^your[-_]/i,
  /^changeme$/i,
  /^todo$/i,
  /^placeholder$/i,
];

function decodeBase64UrlSegment(segment) {
  const normalized = String(segment || "").replace(/-/g, "+").replace(/_/g, "/");
  const padding = normalized.length % 4 === 0
    ? ""
    : "=".repeat(4 - (normalized.length % 4));

  return Buffer.from(`${normalized}${padding}`, "base64").toString("utf8");
}

const SERVER_ONLY_ENV_KEYS = new Set([
  "SUPABASE_URL",
  "SUPABASE_SERVICE_ROLE_KEY",
  "SUPABASE_SECRET_KEY",
  "SUPABASE_ANON_KEY",
  "USER_API_ENCRYPTION_SECRET",
  "PROFILE_USER_APIS_ENCRYPTION_SECRET",
]);

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

export function describeSupabaseServerKey(value) {
  const normalized = String(value || "").trim();
  if (!normalized) {
    return {
      status: "missing",
      value: normalized,
      kind: "missing",
      looksLikeDatabasePassword: false,
      reason: "missing",
    };
  }

  if (isPlaceholder(normalized)) {
    return {
      status: "placeholder",
      value: normalized,
      kind: "placeholder",
      looksLikeDatabasePassword: false,
      reason: "placeholder",
    };
  }

  if (normalized.startsWith("sb_secret_")) {
    return {
      status: "valid",
      value: normalized,
      kind: "secret",
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
          kind: "legacy-service-role-jwt",
          looksLikeDatabasePassword: false,
        };
      }

      return {
        status: "invalid",
        value: normalized,
        kind: "jwt",
        looksLikeDatabasePassword: false,
        reason: typeof payload?.role === "string"
          ? `JWT role is ${payload.role}`
          : "JWT is missing the service_role claim",
      };
    } catch {
      return {
        status: "invalid",
        value: normalized,
        kind: "jwt",
        looksLikeDatabasePassword: false,
        reason: "JWT payload could not be decoded",
      };
    }
  }

  const looksLikeDatabasePassword = /^[a-f0-9]{32,}$/i.test(normalized);
  return {
    status: "invalid",
    value: normalized,
    kind: looksLikeDatabasePassword ? "database-password-like" : "unknown",
    looksLikeDatabasePassword,
    reason: looksLikeDatabasePassword
      ? "looks like a database password, not a Supabase API key"
      : "unsupported key format",
  };
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
      if (isServerOnlyEnvKey(key)) {
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

export function extractSupabaseProjectRef(url) {
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

export function compareSupabaseProjectRefs(publicUrl, serverUrl) {
  const publicProjectRef = extractSupabaseProjectRef(publicUrl);
  const serverProjectRef = extractSupabaseProjectRef(serverUrl);
  const matches = publicProjectRef && serverProjectRef
    ? publicProjectRef === serverProjectRef
    : undefined;

  return {
    publicProjectRef,
    serverProjectRef,
    matches,
  };
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

export function findIgnoredLegacySecrets(ignoredSnapshots, keys) {
  return findSnapshotEntries(ignoredSnapshots, keys);
}
