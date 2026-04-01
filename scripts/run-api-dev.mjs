import fs from "fs";
import path from "path";
import { fileURLToPath, pathToFileURL } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.join(__dirname, "..");
const obviousPlaceholderPatterns = [
  /^replace-with-/i,
  /^your[-_]/i,
  /^changeme$/i,
  /^todo$/i,
  /^你的/i,
  /^请填写/i,
];

function isObviousPlaceholder(value) {
  const normalized = String(value || "").trim();
  if (!normalized) {
    return false;
  }

  return obviousPlaceholderPatterns.some((pattern) => pattern.test(normalized));
}

function isLegacyFallbackSensitiveKey(key) {
  return key === "SUPABASE_SERVICE_ROLE_KEY" || key === "SUPABASE_SECRET_KEY";
}

function parseEnvFile(filePath) {
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
        (value.startsWith('"') && value.endsWith('"'))
        || (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
      }

      accumulator[key] = value;
      return accumulator;
    }, {});
}

function loadLocalEnv() {
  const protectedKeys = new Set(Object.keys(process.env));
  const primaryEnvFiles = [
    path.join(repoRoot, ".env"),
    path.join(repoRoot, ".env.local"),
    path.join(repoRoot, "apps", "api", ".env"),
    path.join(repoRoot, "apps", "api", ".env.local"),
  ];
  const legacyFallbackEnvFiles = [
    path.join(repoRoot, "server", ".env"),
    path.join(repoRoot, "server", ".env.local"),
  ];

  for (const filePath of primaryEnvFiles) {
    const values = parseEnvFile(filePath);
    for (const [key, value] of Object.entries(values)) {
      if (!protectedKeys.has(key)) {
        process.env[key] = value;
      }
    }
  }

  for (const filePath of legacyFallbackEnvFiles) {
    const values = parseEnvFile(filePath);
    for (const [key, value] of Object.entries(values)) {
      if (protectedKeys.has(key)) {
        continue;
      }

      if (isLegacyFallbackSensitiveKey(key) && isObviousPlaceholder(value)) {
        continue;
      }

      if (!String(process.env[key] || "").trim()) {
        process.env[key] = value;
      }
    }
  }
}

loadLocalEnv();

if (
  !String(process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY || "").trim()
  || isObviousPlaceholder(process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY)
) {
  console.warn(
    "[run-api-dev] SUPABASE_SERVICE_ROLE_KEY is missing or still using a placeholder. "
    + "The local API will fall back to in-memory repositories until a real service role key is configured."
  );
}

process.env.RUN_KK_API_SKELETON = process.env.RUN_KK_API_SKELETON || "true";
process.env.PORT = process.env.PORT || "3001";

const serverEntry = pathToFileURL(path.join(repoRoot, "apps", "api", "src", "server.ts")).href;
await import(serverEntry);
