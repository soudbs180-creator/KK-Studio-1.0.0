import fs from "fs";
import path from "path";
import { spawnSync } from "child_process";

import {
  collectEnvSnapshots,
  findSnapshotEntries,
  getEffectiveValue,
  isPlaceholder,
  resolveRepoRoot,
} from "./lib/env-contract.mjs";

const repoRoot = resolveRepoRoot(import.meta.url);
const rootPath = repoRoot;

const hostedFrontendRequired = [
  "VITE_KK_API_BASE_URL",
];

const hostedFrontendRecommended = [
  "VITE_AUTH_REDIRECT_ORIGIN",
  "VITE_TURNSTILE_ENABLED",
  "VITE_TURNSTILE_SITE_KEY",
];

const hostedFrontendOptional = [
  "VITE_PUBLIC_API_BASE_URL",
  "VITE_PAYMENT_GATEWAY_URL",
];

const hostedFrontendForbidden = [
  { key: "VITE_ENABLE_LEGACY_WEB_API_FALLBACK", mode: "enabled-flag" },
  { key: "VITE_SUPABASE_URL", mode: "present" },
  { key: "VITE_SUPABASE_ANON_KEY", mode: "present" },
  { key: "VITE_TURNSTILE_LOCAL_BYPASS", mode: "enabled-flag" },
];

const hostedApiRequired = [
  "DATABASE_URL",
  "GEMINI_API_KEY",
  "OPENAI_API_KEY",
  "PASSWORD_SALT",
  "JWT_SECRET",
  "KK_API_SESSION_SIGNING_SECRET",
  "USER_API_ENCRYPTION_SECRET",
  "RESEND_API_KEY",
  "PASSWORD_RESET_EMAIL_FROM",
  "PASSWORD_RESET_TOKEN_SECRET",
  "GOOGLE_OAUTH_CLIENT_ID",
  "GOOGLE_OAUTH_CLIENT_SECRET",
  "GOOGLE_OAUTH_REDIRECT_URI",
  "GOOGLE_STATE_SIGNING_SECRET",
  "GOOGLE_ALLOWED_REDIRECT_ORIGINS",
  "WECHAT_OPEN_APP_ID",
  "WECHAT_OPEN_APP_SECRET",
  "WECHAT_OPEN_REDIRECT_URI",
  "WECHAT_STATE_SIGNING_SECRET",
  "WECHAT_ALLOWED_REDIRECT_ORIGINS",
  "STRIPE_SECRET_KEY",
  "STRIPE_WEBHOOK_SECRET",
];

const hostedApiRecommended = [
  "WECHAT_DEFAULT_REDIRECT_URL",
  "KK_INTERNAL_ROUTE_PROXY_SECRET",
  "SYSTEM_PROXY_TASK_SECRET",
  "USER_ROUTE_PROXY_TASK_SECRET",
  "KK_PRIMARY_ADMIN_USER_ID",
];

const hostedApiPasswordResetPublicOriginEnv = [
  "PUBLIC_APP_URL",
  "KK_PUBLIC_APP_URL",
  "WEB_PUBLIC_URL",
];

const hostedApiRequiredMigrations = [
  "migrations/013_password_reset_tokens.sql",
];

const DISABLED_ENV_FLAG_VALUES = new Set(["0", "false", "no", "off"]);
const VERCEL_PROJECT_ID_ENV = "VERCEL_PROJECT_ID";
const VERCEL_ORG_ID_ENV = "VERCEL_ORG_ID";
const VERCEL_PROJECT_NAME_ENV = "VERCEL_PROJECT_NAME";
const VERCEL_TOKEN_ENV = "VERCEL_TOKEN";

function isEnabledEnvFlag(value) {
  const normalized = String(value || "").trim().toLowerCase();
  return Boolean(normalized) && !DISABLED_ENV_FLAG_VALUES.has(normalized);
}

function readProcessEnvValue(key) {
  const value = String(process.env[key] || "").trim();
  if (!value || isPlaceholder(value)) {
    return "";
  }

  return value;
}

function formatStatus(sourceRecord) {
  if (!sourceRecord) return "<missing>";
  if (isPlaceholder(sourceRecord.value)) {
    return `<placeholder from ${sourceRecord.source}>`;
  }
  if (!isConfiguredEnvRecord(sourceRecord)) return "<missing>";
  return `<present from ${sourceRecord.source}>`;
}

function isConfiguredEnvRecord(sourceRecord) {
  const value = String(sourceRecord?.value || "").trim();
  return Boolean(value) && !isPlaceholder(sourceRecord.value);
}

function isForbiddenFrontendEnvActive(rule, sourceRecord) {
  if (!sourceRecord || !String(sourceRecord.value || "").trim()) {
    return false;
  }

  if (rule.mode === "enabled-flag") {
    return isEnabledEnvFlag(sourceRecord.value);
  }

  return true;
}

function formatForbiddenFrontendStatus(rule, sourceRecord) {
  if (!sourceRecord) {
    return "<not set>";
  }

  if (rule.mode === "enabled-flag" && !isEnabledEnvFlag(sourceRecord.value)) {
    return `<disabled in ${sourceRecord.source}>`;
  }

  return `<present in ${sourceRecord.source}>`;
}

function runCommand(command, args) {
  if (process.platform === "win32") {
    const escaped = [command, ...args]
      .map((part) => {
        const value = String(part);
        if (!/[\s"]/u.test(value)) {
          return value;
        }
        return `"${value.replace(/"/g, '\\"')}"`;
      })
      .join(" ");

    return spawnSync("cmd.exe", ["/d", "/s", "/c", escaped], {
      cwd: rootPath,
      encoding: "utf8",
      shell: false,
    });
  }

  return spawnSync(command, args, {
    cwd: rootPath,
    encoding: "utf8",
    shell: false,
  });
}

function inspectCommandAvailability(command, args = ["--version"], fallback) {
  const attempts = [
    { label: command, command, args },
  ];

  if (fallback) {
    attempts.push(fallback);
  }

  for (const attempt of attempts) {
    const result = runCommand(attempt.command, attempt.args);
    if (!result.error && result.status === 0) {
      return {
        available: true,
        detail: `${attempt.label}: ${((result.stdout || result.stderr || "").trim().split(/\r?\n/)[0] || "available")}`,
      };
    }
  }

  const lastAttempt = attempts[attempts.length - 1];
  const lastResult = runCommand(lastAttempt.command, lastAttempt.args);
  return {
    available: false,
    detail: (lastResult.error && lastResult.error.message) || lastResult.stderr.trim() || "not available",
  };
}

function inspectPackageRunner() {
  const result = runCommand("npm", ["--version"]);
  if (result.error || result.status !== 0) {
    return {
      available: false,
      detail: (result.error && result.error.message) || result.stderr.trim() || "not available",
    };
  }

  return {
    available: true,
    detail: `npm: ${((result.stdout || result.stderr || "").trim().split(/\r?\n/)[0] || "available")}`,
  };
}

function inspectAuthenticatedAccess(primary, fallback) {
  const attempts = [primary];
  if (fallback) {
    attempts.push(fallback);
  }

  for (const attempt of attempts) {
    const result = runCommand(attempt.command, attempt.args);
    if (!result.error && result.status === 0) {
      return {
        authenticated: true,
        detail: `${attempt.label}: authenticated`,
      };
    }
  }

  const finalAttempt = attempts[attempts.length - 1];
  const finalResult = runCommand(finalAttempt.command, finalAttempt.args);
  return {
    authenticated: false,
    detail: (finalResult.error && finalResult.error.message) || finalResult.stderr.trim() || "not authenticated",
  };
}

function readVercelProjectFromEnv() {
  const projectId = readProcessEnvValue(VERCEL_PROJECT_ID_ENV);
  const orgId = readProcessEnvValue(VERCEL_ORG_ID_ENV);
  const projectName = readProcessEnvValue(VERCEL_PROJECT_NAME_ENV);
  if (!projectId && !orgId && !projectName) {
    return null;
  }

  return {
    source: "process.env",
    projectId,
    orgId,
    projectName,
  };
}

function readVercelProject() {
  const projectFile = path.join(rootPath, ".vercel", "project.json");
  if (!fs.existsSync(projectFile)) {
    return readVercelProjectFromEnv();
  }

  try {
    const parsed = JSON.parse(fs.readFileSync(projectFile, "utf8"));
    return {
      source: ".vercel/project.json",
      filePath: projectFile,
      projectId: parsed.projectId || "",
      orgId: parsed.orgId || "",
      projectName: parsed.projectName || "",
    };
  } catch (error) {
    return {
      source: ".vercel/project.json",
      filePath: projectFile,
      parseError: error instanceof Error ? error.message : "invalid json",
    };
  }
}

function getVercelAuthArgs(baseArgs) {
  const token = readProcessEnvValue(VERCEL_TOKEN_ENV);
  if (!token) {
    return baseArgs;
  }

  return [...baseArgs, "--token", token];
}

function getVercelAuthLabel(baseLabel) {
  const token = readProcessEnvValue(VERCEL_TOKEN_ENV);
  return token ? `${baseLabel} --token $${VERCEL_TOKEN_ENV}` : baseLabel;
}

function formatVercelProjectValue(project, value) {
  if (!value) {
    return "<missing>";
  }

  if (project.source === "process.env") {
    return "<present from process.env>";
  }

  return value;
}

function printSection(title) {
  console.log(`\n[release:hosted:check] ${title}`);
}

function printKeyStatuses(title, snapshots, keys) {
  printSection(title);
  keys.forEach((key) => {
    console.log(`- ${key}: ${formatStatus(getEffectiveValue(snapshots, key))}`);
  });
}

function pushMissingEnvChecks(remoteChecks, label, snapshots, keys) {
  keys.forEach((key) => {
    const value = getEffectiveValue(snapshots, key);
    if (!isConfiguredEnvRecord(value)) {
      remoteChecks.push(`${label} ${key} is missing or still a placeholder in the local snapshot. Confirm it in the runtime environment before deploying.`);
    }
  });
}

function hasEffectiveEnvValue(snapshots, key) {
  const value = getEffectiveValue(snapshots, key);
  return isConfiguredEnvRecord(value);
}

function pushPasswordResetPublicOriginCheck(remoteChecks, snapshots) {
  if (hostedApiPasswordResetPublicOriginEnv.some((key) => hasEffectiveEnvValue(snapshots, key))) {
    return;
  }

  remoteChecks.push(`Hosted API password reset public app URL env is missing in the local snapshot. Confirm one of ${hostedApiPasswordResetPublicOriginEnv.join(", ")} exists in the VPS runtime environment before deploying.`);
}

function pushRequiredMigrationChecks(blockers, remoteChecks) {
  hostedApiRequiredMigrations.forEach((migrationPath) => {
    const absolutePath = path.join(rootPath, migrationPath);
    if (!fs.existsSync(absolutePath)) {
      blockers.push(`Required hosted database migration ${migrationPath} is missing from the repository.`);
      return;
    }

    remoteChecks.push(`Confirm VPS PostgreSQL has applied ${migrationPath} before deploying the hosted password reset confirmation flow.`);
  });
}

function isRemoteHttpUrl(value) {
  try {
    const url = new URL(String(value || "").trim());
    return url.protocol === "http:"
      && !["localhost", "127.0.0.1", "::1"].includes(url.hostname);
  } catch {
    return false;
  }
}

function isLoopbackHostname(hostname) {
  const normalized = String(hostname || "").trim().toLowerCase().replace(/^\[|\]$/g, "");
  return normalized === "localhost"
    || normalized === "::1"
    || normalized.startsWith("127.");
}

function isPrivateNetworkHostname(hostname) {
  const normalized = String(hostname || "").trim().toLowerCase().replace(/^\[|\]$/g, "");
  return Boolean(
    normalized
    && (
      /^10\./.test(normalized)
      || /^192\.168\./.test(normalized)
      || /^172\.(1[6-9]|2\d|3[0-1])\./.test(normalized)
      || /^100\.(6[4-9]|[7-9]\d|1[0-1]\d|12[0-7])\./.test(normalized)
      || /^169\.254\./.test(normalized)
      || normalized === "0.0.0.0"
      || normalized === "::"
      || /^fe[89ab]/i.test(normalized)
      || /^f[cd]/i.test(normalized)
    ),
  );
}

function isLocalOrPrivateApiBaseUrl(value) {
  try {
    const url = new URL(String(value || "").trim());
    return isLoopbackHostname(url.hostname) || isPrivateNetworkHostname(url.hostname);
  } catch {
    return false;
  }
}

function isSameOriginApiBaseUrl(value) {
  const normalized = String(value || "").trim().toLowerCase();
  return normalized === "proxy"
    || normalized === "self"
    || normalized === "relative"
    || normalized === "/"
    || (normalized.startsWith("/") && !normalized.startsWith("//"));
}

function isHttpsApiBaseUrl(value) {
  try {
    return new URL(String(value || "").trim()).protocol === "https:";
  } catch {
    return false;
  }
}

function pushUnsafeHostedApiBaseUrlBlocker(blockers, key, sourceRecord) {
  if (!sourceRecord) {
    return;
  }

  if (isLocalOrPrivateApiBaseUrl(sourceRecord.value)) {
    blockers.push(`Hosted frontend ${key} must point at HTTPS, same-origin, or a deployed VPS API. Current local snapshot via ${sourceRecord.source} points at a local/private API URL.`);
    return;
  }

  if (isRemoteHttpUrl(sourceRecord.value)) {
    blockers.push(`Hosted frontend ${key} must be HTTPS or same-origin. Current local snapshot via ${sourceRecord.source} points at remote HTTP.`);
    return;
  }

  if (!isSameOriginApiBaseUrl(sourceRecord.value) && !isHttpsApiBaseUrl(sourceRecord.value)) {
    blockers.push(`Hosted frontend ${key} must point at HTTPS, same-origin, or a deployed VPS API. Current local snapshot via ${sourceRecord.source} is not a valid hosted API base URL.`);
  }
}

function run() {
  const snapshots = collectEnvSnapshots(rootPath, { includeFunctionEnv: false });
  const frontendSnapshots = snapshots.frontendSnapshots;
  const localApiSnapshots = snapshots.apiSnapshots;
  const vercelProject = readVercelProject();
  const vercelCli = inspectCommandAvailability("vercel", ["--version"], {
    label: "npx vercel",
    command: "npx",
    args: ["vercel", "--version"],
  });
  const vercelAuth = inspectAuthenticatedAccess(
    {
      label: getVercelAuthLabel("vercel whoami"),
      command: "vercel",
      args: getVercelAuthArgs(["whoami"]),
    },
    {
      label: getVercelAuthLabel("npx vercel whoami"),
      command: "npx",
      args: ["vercel", ...getVercelAuthArgs(["whoami"])],
    },
  );
  const packageRunner = inspectPackageRunner();

  printSection("Local Snapshot");
  console.log(`- repo: ${rootPath}`);
  console.log(`- frontend env files: ${frontendSnapshots.length}`);
  frontendSnapshots.forEach((snapshot) => {
    console.log(`  * ${snapshot.relativePath}`);
  });
  console.log(`- local API env files: ${localApiSnapshots.length}`);
  localApiSnapshots.forEach((snapshot) => {
    console.log(`  * ${snapshot.relativePath}`);
  });
  console.log(`- ignored legacy env files: ${snapshots.ignoredSnapshots.length}`);
  snapshots.ignoredSnapshots.forEach((snapshot) => {
    console.log(`  * ${snapshot.relativePath}`);
  });

  printSection("Tooling");
  console.log(`- vercel CLI: ${vercelCli.available ? vercelCli.detail : `missing (${vercelCli.detail})`}`);
  console.log(`- package runner: ${packageRunner.available ? packageRunner.detail : `missing (${packageRunner.detail})`}`);

  printSection("Remote Access");
  console.log(`- vercel auth: ${vercelAuth.authenticated ? vercelAuth.detail : `missing (${vercelAuth.detail})`}`);

  printSection("Vercel Project");
  if (!vercelProject) {
    console.log("- project metadata: <missing>");
  } else if (vercelProject.parseError) {
    console.log(`- .vercel/project.json: parse error (${vercelProject.parseError})`);
  } else {
    console.log(`- source: ${vercelProject.source || ".vercel/project.json"}`);
    console.log(`- projectName: ${formatVercelProjectValue(vercelProject, vercelProject.projectName)}`);
    console.log(`- projectId: ${formatVercelProjectValue(vercelProject, vercelProject.projectId)}`);
    console.log(`- orgId: ${formatVercelProjectValue(vercelProject, vercelProject.orgId)}`);
  }

  printKeyStatuses("Hosted Frontend Required Env", frontendSnapshots, hostedFrontendRequired);
  printKeyStatuses("Hosted Frontend Recommended Env", frontendSnapshots, hostedFrontendRecommended);
  printKeyStatuses("Hosted Frontend Optional Env", frontendSnapshots, hostedFrontendOptional);
  printKeyStatuses("Hosted API Required Env", localApiSnapshots, hostedApiRequired);
  printKeyStatuses("Hosted API Recommended Env", localApiSnapshots, hostedApiRecommended);
  printKeyStatuses("Hosted API Password Reset Public Origin Env", localApiSnapshots, hostedApiPasswordResetPublicOriginEnv);

  printSection("Hosted API Required Migrations");
  hostedApiRequiredMigrations.forEach((migrationPath) => {
    const status = fs.existsSync(path.join(rootPath, migrationPath)) ? "<present>" : "<missing>";
    console.log(`- ${migrationPath}: ${status}`);
  });

  printSection("Hosted Frontend Forbidden Env");
  hostedFrontendForbidden.forEach((rule) => {
    const value = getEffectiveValue(frontendSnapshots, rule.key);
    console.log(`- ${rule.key}: ${formatForbiddenFrontendStatus(rule, value)}`);
  });

  const blockers = [];
  const remoteChecks = [];
  const warnings = [];
  if (!vercelProject || vercelProject.parseError || !vercelProject.projectId || !vercelProject.orgId) {
    blockers.push("Vercel project metadata is incomplete. Run `vercel link` or provide `VERCEL_ORG_ID` and `VERCEL_PROJECT_ID` before releasing.");
  }
  if (!vercelCli.available && !packageRunner.available) {
    blockers.push("Vercel CLI is unavailable on this machine and npm is not available as a package runner.");
  }
  if (!vercelAuth.authenticated) {
    blockers.push("Vercel authentication is unavailable. Run `vercel login` or provide `VERCEL_TOKEN` before releasing.");
  }

  pushMissingEnvChecks(remoteChecks, "Hosted frontend env", frontendSnapshots, hostedFrontendRequired);
  pushMissingEnvChecks(remoteChecks, "Hosted API env", localApiSnapshots, hostedApiRequired);
  pushPasswordResetPublicOriginCheck(remoteChecks, localApiSnapshots);
  pushRequiredMigrationChecks(blockers, remoteChecks);

  hostedFrontendForbidden.forEach((rule) => {
    const value = getEffectiveValue(frontendSnapshots, rule.key);
    if (isForbiddenFrontendEnvActive(rule, value)) {
      blockers.push(`Hosted frontend forbidden env ${rule.key} is present in the local snapshot via ${value.source}. Use a clean hosted build environment and do not copy local/dev bypass flags into Vercel.`);
    }
  });
  pushUnsafeHostedApiBaseUrlBlocker(
    blockers,
    "VITE_KK_API_BASE_URL",
    getEffectiveValue(frontendSnapshots, "VITE_KK_API_BASE_URL"),
  );
  pushUnsafeHostedApiBaseUrlBlocker(
    blockers,
    "VITE_PUBLIC_API_BASE_URL",
    getEffectiveValue(frontendSnapshots, "VITE_PUBLIC_API_BASE_URL"),
  );
  const misplacedRootServerEnv = findSnapshotEntries(frontendSnapshots, [
    "DATABASE_URL",
    "GEMINI_API_KEY",
    "OPENAI_API_KEY",
    "PASSWORD_SALT",
    "JWT_SECRET",
    "KK_API_SESSION_SIGNING_SECRET",
    "USER_API_ENCRYPTION_SECRET",
    "PROFILE_USER_APIS_ENCRYPTION_SECRET",
    "GOOGLE_OAUTH_CLIENT_SECRET",
    "WECHAT_OPEN_APP_SECRET",
    "STRIPE_SECRET_KEY",
    "STRIPE_WEBHOOK_SECRET",
  ]);
  misplacedRootServerEnv.forEach((entry) => {
    warnings.push(`Root env file ${entry.source} contains server-only key ${entry.key}. Move active server secrets into server/.env.local or the VPS runtime env.`);
  });

  printSection("Immediate Blockers");
  if (blockers.length === 0) {
    console.log("- none detected in the local snapshot");
  } else {
    blockers.forEach((blocker) => {
      console.log(`- ${blocker}`);
    });
  }

  printSection("Remote Checks");
  if (remoteChecks.length === 0) {
    console.log("- none detected from the local snapshot");
  } else {
    remoteChecks.forEach((item) => {
      console.log(`- ${item}`);
    });
  }

  printSection("Warnings");
  if (warnings.length === 0) {
    console.log("- none");
  } else {
    warnings.forEach((item) => {
      console.log(`- ${item}`);
    });
  }

  if (blockers.length > 0) {
    console.error(
      `[release:hosted:check] Preflight blocked by ${blockers.length} issue(s). Please fix them before releasing.`,
    );
    process.exitCode = 1;
    process.exit(1);
  }

  printSection("Notes");
  console.log("- This script only checks local files and current process env. It does not read remote VPS or Vercel dashboard state.");
  console.log("- VPS API, payment, and PostgreSQL secrets must be configured in the VPS runtime environment.");
  console.log("- `VERCEL_ORG_ID` and `VERCEL_PROJECT_ID` can replace a local `.vercel/project.json` link in CI or scripted releases.");
  console.log("- If the global Vercel CLI is missing but npm is available, the repo scripts can still run through `npx`.");
  console.log("- Use this check before deploying the frontend or VPS API to avoid copying local-only or legacy managed-database config into hosted environments.");
}

run();
