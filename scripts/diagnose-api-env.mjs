import fs from "fs";
import path from "path";

const repoRoot = path.join(path.dirname(new URL(import.meta.url).pathname), "..");
const rootPath = repoRoot.replace(/^\/([a-zA-Z]):/, "$1:");

const envFiles = [
  path.join(rootPath, ".env"),
  path.join(rootPath, ".env.local"),
  path.join(rootPath, "apps", "api", ".env"),
  path.join(rootPath, "apps", "api", ".env.local"),
  path.join(rootPath, "server", ".env"),
  path.join(rootPath, "server", ".env.local"),
];

const placeholderPatterns = [
  /^replace-with-/i,
  /^your[-_]/i,
  /^changeme$/i,
  /^todo$/i,
  /^你的/i,
  /^请填写/i,
];

function isPlaceholder(value) {
  const normalized = String(value || "").trim();
  if (!normalized) return false;
  return placeholderPatterns.some((pattern) => pattern.test(normalized));
}

function parseEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return {};

  return fs
    .readFileSync(filePath, "utf8")
    .split(/\r?\n/)
    .reduce((acc, line) => {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) return acc;
      const separatorIndex = trimmed.indexOf("=");
      if (separatorIndex <= 0) return acc;
      const key = trimmed.slice(0, separatorIndex).trim();
      let value = trimmed.slice(separatorIndex + 1).trim();
      if (
        (value.startsWith('"') && value.endsWith('"'))
        || (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
      }
      acc[key] = value;
      return acc;
    }, {});
}

function summarizeValue(value) {
  if (!String(value || "").trim()) return "<empty>";
  if (isPlaceholder(value)) return "<placeholder>";
  return "<present>";
}

function summarizeFile(filePath, keys) {
  if (!fs.existsSync(filePath)) return null;
  const values = parseEnvFile(filePath);
  const output = {};
  keys.forEach((key) => {
    if (Object.prototype.hasOwnProperty.call(values, key)) {
      output[key] = summarizeValue(values[key]);
    }
  });
  return output;
}

async function fetchHealth() {
  const baseUrl = process.env.VITE_KK_API_BASE_URL || "http://127.0.0.1:3001";
  const url = `${baseUrl.replace(/\/+$/, "")}/healthz`;
  try {
    const response = await fetch(url, { method: "GET" });
    if (!response.ok) {
      return { ok: false, message: `HTTP ${response.status}` };
    }
    const body = await response.json();
    return { ok: true, data: body?.data || null };
  } catch (error) {
    return { ok: false, message: error?.message || "fetch failed" };
  }
}

async function run() {
  const keys = [
    "SUPABASE_URL",
    "SUPABASE_SERVICE_ROLE_KEY",
    "SUPABASE_SECRET_KEY",
    "SUPABASE_ANON_KEY",
    "USER_API_ENCRYPTION_SECRET",
    "VITE_KK_API_BASE_URL",
  ];

  console.log("[diagnose-api-env] Env file summary:");
  envFiles.forEach((filePath) => {
    const summary = summarizeFile(filePath, keys);
    if (!summary) return;
    console.log(`- ${filePath}`);
    Object.entries(summary).forEach(([key, value]) => {
      console.log(`  ${key}=${value}`);
    });
  });

  const health = await fetchHealth();
  console.log("[diagnose-api-env] /healthz:");
  if (!health.ok) {
    console.log(`- unreachable: ${health.message}`);
    return;
  }

  const config = health.data?.config || {};
  const repos = health.data?.repositories || {};
  const persistence = health.data?.persistence || {};
  console.log(`- hasServiceRoleKey: ${Boolean(config.hasServiceRoleKey)}`);
  console.log(`- hasUserApiEncryptionSecret: ${Boolean(config.hasUserApiEncryptionSecret)}`);
  console.log(`- repositories.authData: ${repos.authData || "unknown"}`);
  console.log(`- repositories.creditAccounts: ${repos.creditAccounts || "unknown"}`);
  console.log(`- repositories.creditProviders: ${repos.creditProviders || "unknown"}`);
  console.log(`- persistence.userApiKeys: ${Boolean(persistence.userApiKeys)}`);
  console.log(`- persistence.credits: ${Boolean(persistence.credits)}`);
}

run();
