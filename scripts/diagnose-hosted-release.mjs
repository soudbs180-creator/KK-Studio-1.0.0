import fs from "fs";
import path from "path";
import { spawnSync } from "child_process";
import { fileURLToPath } from "url";

import {
  collectEnvSnapshots,
  compareSupabaseProjectRefs,
  findSnapshotEntries,
  findIgnoredLegacySecrets,
  getEffectiveValue,
  isPlaceholder,
  resolveRepoRoot,
  summarizeValue,
} from "./lib/env-contract.mjs";

const scriptPath = fileURLToPath(import.meta.url);
const repoRoot = resolveRepoRoot(import.meta.url);
const rootPath = repoRoot;

const hostedFrontendRequired = [
  "VITE_SUPABASE_URL",
  "VITE_SUPABASE_ANON_KEY",
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
  "VITE_KK_API_BASE_URL",
  "VITE_ENABLE_LEGACY_WEB_API_FALLBACK",
];

const functionSecretsRequired = [
  "SUPABASE_URL",
  "SUPABASE_ANON_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
  "WECHAT_OPEN_APP_ID",
  "WECHAT_OPEN_APP_SECRET",
  "WECHAT_OPEN_REDIRECT_URI",
  "WECHAT_STATE_SIGNING_SECRET",
  "WECHAT_ALLOWED_REDIRECT_ORIGINS",
];

const functionSecretsRecommended = [
  "WECHAT_DEFAULT_REDIRECT_URL",
  "USER_API_ENCRYPTION_SECRET",
  "KK_INTERNAL_ROUTE_PROXY_SECRET",
  "SYSTEM_PROXY_TASK_SECRET",
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

function run() {
  const snapshots = collectEnvSnapshots(rootPath, { includeFunctionEnv: true });
  const frontendSnapshots = snapshots.frontendSnapshots;
  const localApiSnapshots = snapshots.apiSnapshots;
  const hostedFunctionSnapshots = [...snapshots.apiSnapshots, ...snapshots.functionSnapshots];
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
  const supabaseCli = inspectCommandAvailability("supabase", ["--version"], {
    label: "npx supabase",
    command: "npx",
    args: ["supabase", "--version"],
  });
  const supabaseAuth = inspectAuthenticatedAccess(
    {
      label: "supabase projects list",
      command: "supabase",
      args: ["projects", "list"],
    },
    {
      label: "npx supabase projects list",
      command: "npx",
      args: ["supabase", "projects", "list"],
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
  console.log(`- function env files: ${snapshots.functionSnapshots.length}`);
  snapshots.functionSnapshots.forEach((snapshot) => {
    console.log(`  * ${snapshot.relativePath}`);
  });
  console.log(`- ignored legacy env files: ${snapshots.ignoredSnapshots.length}`);
  snapshots.ignoredSnapshots.forEach((snapshot) => {
    console.log(`  * ${snapshot.relativePath}`);
  });

  printSection("Tooling");
  console.log(`- vercel CLI: ${vercelCli.available ? vercelCli.detail : `missing (${vercelCli.detail})`}`);
  console.log(`- supabase CLI: ${supabaseCli.available ? supabaseCli.detail : `missing (${supabaseCli.detail})`}`);
  console.log(`- package runner: ${packageRunner.available ? packageRunner.detail : `missing (${packageRunner.detail})`}`);

  printSection("Remote Access");
  console.log(`- vercel auth: ${vercelAuth.authenticated ? vercelAuth.detail : `missing (${vercelAuth.detail})`}`);
  console.log(`- supabase auth: ${supabaseAuth.authenticated ? supabaseAuth.detail : `missing (${supabaseAuth.detail})`}`);

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
  printKeyStatuses("Supabase Function Required Secrets", hostedFunctionSnapshots, functionSecretsRequired);
  printKeyStatuses("Supabase Function Recommended Secrets", hostedFunctionSnapshots, functionSecretsRecommended);

  const publicSupabaseUrl = getEffectiveValue(frontendSnapshots, "VITE_SUPABASE_URL")?.value;
  const serverSupabaseUrl = getEffectiveValue(localApiSnapshots, "SUPABASE_URL")?.value || publicSupabaseUrl;
  const projectAlignment = compareSupabaseProjectRefs(publicSupabaseUrl, serverSupabaseUrl);
  printSection("Supabase Project Alignment");
  console.log(`- public project ref: ${projectAlignment.publicProjectRef || "<missing>"}`);
  console.log(`- server project ref: ${projectAlignment.serverProjectRef || "<missing>"}`);
  console.log(`- project refs match: ${projectAlignment.matches === undefined ? "<unknown>" : String(projectAlignment.matches)}`);

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
  if (!supabaseCli.available && !packageRunner.available) {
    blockers.push("Supabase CLI is unavailable on this machine and npm is not available as a package runner.");
  }
  if (!vercelAuth.authenticated) {
    blockers.push("Vercel authentication is unavailable. Run `vercel login` or export `VERCEL_TOKEN` before releasing.");
  }
  if (!supabaseAuth.authenticated) {
    blockers.push("Supabase authentication is unavailable. Run `supabase login` or export `SUPABASE_ACCESS_TOKEN` before releasing.");
  }
  if (projectAlignment.matches === false) {
    blockers.push("SUPABASE_URL does not point at the same Supabase project as VITE_SUPABASE_URL. Align the frontend and server env values before releasing.");
  }
  hostedFrontendRequired.forEach((key) => {
    const value = getEffectiveValue(frontendSnapshots, key);
    if (!value || isPlaceholder(value.value)) {
      remoteChecks.push(`Hosted frontend env ${key} is missing or still a placeholder in the local snapshot. Confirm it in Vercel before deploying.`);
    }
  });
  functionSecretsRequired.forEach((key) => {
    const value = getEffectiveValue(hostedFunctionSnapshots, key);
    if (!value || isPlaceholder(value.value)) {
      remoteChecks.push(`Function secret ${key} is missing or still a placeholder in the local snapshot. Confirm it in Supabase Secrets before deploying.`);
    }
  });
  hostedFrontendForbidden.forEach((key) => {
    const value = getEffectiveValue(frontendSnapshots, key);
    if (value && String(value.value || "").trim()) {
      warnings.push(`Hosted frontend forbidden env ${key} is present in the local snapshot via ${value.source}. Keep it local-only and do not copy it into Vercel.`);
    }
  });
  const misplacedRootServerEnv = findSnapshotEntries(frontendSnapshots, [
    "SUPABASE_URL",
    "SUPABASE_SERVICE_ROLE_KEY",
    "SUPABASE_SECRET_KEY",
    "SUPABASE_ANON_KEY",
    "USER_API_ENCRYPTION_SECRET",
  ]);
  misplacedRootServerEnv.forEach((entry) => {
    warnings.push(`Root env file ${entry.source} contains server-only key ${entry.key}. Local API startup ignores root server values, so move it into apps/api/.env.local or Supabase secrets.`);
  });
  const ignoredLegacySecrets = findIgnoredLegacySecrets(snapshots.ignoredSnapshots, [
    "SUPABASE_SERVICE_ROLE_KEY",
    "SUPABASE_SECRET_KEY",
  ]);
  ignoredLegacySecrets.forEach((entry) => {
    warnings.push(`Legacy env file ${entry.source} still contains ${entry.key}. Hosted checks ignore server/.env, so move active server secrets into apps/api/.env.local or Supabase secrets.`);
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

  printSection("Notes");
  console.log("- This script only checks local files and current process env. It does not read remote Vercel or Supabase dashboard state.");
  console.log("- Production Edge Function secrets can be managed in Supabase Dashboard or with `npx supabase secrets set --env-file <file>`.");
  console.log("- If the global CLIs are missing but npm is available, the repo scripts can still run through `npx`.");
  console.log("- Use this check before deploying the frontend or Edge Functions to avoid copying local-only fallback config into hosted environments.");
}

run();
