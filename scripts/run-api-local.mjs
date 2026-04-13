import path from "path";
import { fileURLToPath, pathToFileURL } from "url";

import { applyPrimaryEnvToProcess } from "./lib/env-contract.mjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.join(__dirname, "..");
const DEFAULT_JSON_BODY_MAX_BYTES = 1024 * 1024;
const DEFAULT_PROFILE_JSON_BODY_MAX_BYTES = 4 * 1024 * 1024;
const defaultLocalUserId = "local-user";

function parsePositiveInteger(rawValue, fallback) {
  const parsed = Number(rawValue);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
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

async function startLocalOnlyApiServer() {
  applyPrimaryEnvToProcess(repoRoot);

  if (process.argv.includes("--check")) {
    return;
  }

  const port = Number(process.env.PORT || 3001);
  process.env.RUN_KK_API_SKELETON = "false";
  process.env.PORT = String(port);
  process.env.KKAI_LOCAL_ONLY = "true";
  applyLocalApiBodyLimitDefaults();

  const serverModule = await import(
    pathToFileURL(path.join(repoRoot, "apps", "api", "src", "server.ts")).href
  );

  if (typeof serverModule.startApiServer !== "function") {
    throw new Error("apps/api/src/server.ts does not export startApiServer()");
  }

  await serverModule.startApiServer(port, {
    allowDegradedPersistence: true,
    localOnlyUser: {
      userId: process.env.KKAI_LOCAL_USER_ID || defaultLocalUserId,
    },
  });
}

await startLocalOnlyApiServer();
