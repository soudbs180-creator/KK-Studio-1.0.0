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
  "VITE_PAYMENT_GATEWAY_URL",
];

const hostedFrontendForbidden = [
  "VITE_ENABLE_LEGACY_WEB_API_FALLBACK",
  "VITE_SUPABASE_URL",
  "VITE_SUPABASE_ANON_KEY",
  "VITE_TURNSTILE_LOCAL_BYPASS",
];

const hostedApiRequired = [
  "DATABASE_URL",
  "USER_API_ENCRYPTION_SECRET",
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
  "PAYMENT_SIDECAR_INTERNAL_TOKEN",
  "PAYMENT_SIDECAR_SETTLEMENT_TOKEN",
];

const hostedApiRecommended = [
  "WECHAT_DEFAULT_REDIRECT_URL",
  "KK_INTERNAL_ROUTE_PROXY_SECRET",
  "SYSTEM_PROXY_TASK_SECRET",
  "USER_ROUTE_PROXY_TASK_SECRET",
  "KK_PRIMARY_ADMIN_USER_ID",
];

function formatStatus(sourceRecord) {
  if (!sourceRecord) return "<missing>";
  if (isPlaceholder(sourceRecord.value)) {
    return `<placeholder from ${sourceRecord.source}>`;
  }
  return `<present from ${sourceRecord.source}>`;
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

function readVercelProject() {
  const projectFile = path.join(rootPath, ".vercel", "project.json");
  if (!fs.existsSync(projectFile)) {
    return null;
  }

  try {
    const parsed = JSON.parse(fs.readFileSync(projectFile, "utf8"));
    return {
      filePath: projectFile,
      projectId: parsed.projectId || "",
      orgId: parsed.orgId || "",
      projectName: parsed.projectName || "",
    };
  } catch (error) {
    return {
      filePath: projectFile,
      parseError: error instanceof Error ? error.message : "invalid json",
    };
  }
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
    if (!value || isPlaceholder(value.value)) {
      remoteChecks.push(`${label} ${key} is missing or still a placeholder in the local snapshot. Confirm it in the runtime environment before deploying.`);
    }
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
      label: "vercel whoami",
      command: "vercel",
      args: ["whoami"],
    },
    {
      label: "npx vercel whoami",
      command: "npx",
      args: ["vercel", "whoami"],
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
    console.log("- .vercel/project.json: <missing>");
  } else if (vercelProject.parseError) {
    console.log(`- .vercel/project.json: parse error (${vercelProject.parseError})`);
  } else {
    console.log(`- projectName: ${vercelProject.projectName || "<unknown>"}`);
    console.log(`- projectId: ${vercelProject.projectId || "<missing>"}`);
    console.log(`- orgId: ${vercelProject.orgId || "<missing>"}`);
  }

  printKeyStatuses("Hosted Frontend Required Env", frontendSnapshots, hostedFrontendRequired);
  printKeyStatuses("Hosted Frontend Recommended Env", frontendSnapshots, hostedFrontendRecommended);
  printKeyStatuses("Hosted Frontend Optional Env", frontendSnapshots, hostedFrontendOptional);
  printKeyStatuses("Hosted API Required Env", localApiSnapshots, hostedApiRequired);
  printKeyStatuses("Hosted API Recommended Env", localApiSnapshots, hostedApiRecommended);

  printSection("Hosted Frontend Forbidden Env");
  hostedFrontendForbidden.forEach((key) => {
    const value = getEffectiveValue(frontendSnapshots, key);
    if (!value) {
      console.log(`- ${key}: <not set>`);
      return;
    }
    console.log(`- ${key}: <present in ${value.source}>`);
  });

  const blockers = [];
  const remoteChecks = [];
  const warnings = [];
  if (!vercelProject || vercelProject.parseError || !vercelProject.projectId || !vercelProject.orgId) {
    blockers.push("Vercel project metadata is incomplete. Re-link the repo with `vercel link` if needed.");
  }
  if (!vercelCli.available && !packageRunner.available) {
    blockers.push("Vercel CLI is unavailable on this machine and npm is not available as a package runner.");
  }
  if (!vercelAuth.authenticated) {
    blockers.push("Vercel authentication is unavailable. Run `vercel login` or export `VERCEL_TOKEN` before releasing.");
  }

  pushMissingEnvChecks(remoteChecks, "Hosted frontend env", frontendSnapshots, hostedFrontendRequired);
  pushMissingEnvChecks(remoteChecks, "Hosted API env", localApiSnapshots, hostedApiRequired);

  hostedFrontendForbidden.forEach((key) => {
    const value = getEffectiveValue(frontendSnapshots, key);
    if (value && String(value.value || "").trim()) {
      blockers.push(`Hosted frontend forbidden env ${key} is present in the local snapshot via ${value.source}. Use a clean hosted build environment and do not copy local/dev bypass flags into Vercel.`);
    }
  });
  const hostedApiBaseUrl = getEffectiveValue(frontendSnapshots, "VITE_KK_API_BASE_URL");
  if (hostedApiBaseUrl && isRemoteHttpUrl(hostedApiBaseUrl.value)) {
    blockers.push(`Hosted frontend VITE_KK_API_BASE_URL must be HTTPS or same-origin. Current local snapshot via ${hostedApiBaseUrl.source} points at remote HTTP.`);
  }
  const misplacedRootServerEnv = findSnapshotEntries(frontendSnapshots, [
    "DATABASE_URL",
    "USER_API_ENCRYPTION_SECRET",
    "PROFILE_USER_APIS_ENCRYPTION_SECRET",
    "GOOGLE_OAUTH_CLIENT_SECRET",
    "WECHAT_OPEN_APP_SECRET",
    "PAYMENT_SIDECAR_INTERNAL_TOKEN",
    "PAYMENT_SIDECAR_SETTLEMENT_TOKEN",
  ]);
  misplacedRootServerEnv.forEach((entry) => {
    warnings.push(`Root env file ${entry.source} contains server-only key ${entry.key}. Move active server secrets into apps/api/.env.local or the VPS runtime env.`);
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
  console.log("- VPS API, payment sidecar, and PostgreSQL secrets must be configured in the VPS runtime environment.");
  console.log("- If the global Vercel CLI is missing but npm is available, the repo scripts can still run through `npx`.");
  console.log("- Use this check before deploying the frontend or VPS API to avoid copying local-only or legacy managed-database config into hosted environments.");
}

run();
