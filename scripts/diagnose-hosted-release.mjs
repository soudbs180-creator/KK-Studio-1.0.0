import fs from "fs";
import path from "path";
import { spawnSync } from "child_process";
import { fileURLToPath } from "url";

const scriptPath = fileURLToPath(import.meta.url);
const repoRoot = path.resolve(path.dirname(scriptPath), "..");
const rootPath = repoRoot;

const envFiles = [
  path.join(rootPath, ".env"),
  path.join(rootPath, ".env.local"),
  path.join(rootPath, "apps", "api", ".env"),
  path.join(rootPath, "apps", "api", ".env.local"),
  path.join(rootPath, "supabase", ".env.functions.local"),
];

const placeholderPatterns = [
  /^replace-with-/i,
  /^your[-_]/i,
  /^changeme$/i,
  /^todo$/i,
  /^placeholder$/i,
];

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
        (value.startsWith("\"") && value.endsWith("\""))
        || (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
      }
      acc[key] = value;
      return acc;
    }, {});
}

function summarizeValue(value) {
  if (!String(value || "").trim()) return "<missing>";
  if (isPlaceholder(value)) return "<placeholder>";
  return "<present>";
}

function collectEnvSnapshots() {
  return envFiles
    .filter((filePath) => fs.existsSync(filePath))
    .map((filePath) => ({
      filePath,
      values: parseEnvFile(filePath),
    }));
}

function getEffectiveValue(snapshots, key) {
  const processValue = process.env[key];
  if (String(processValue || "").trim()) {
    return {
      source: "process.env",
      value: processValue,
    };
  }

  for (let index = snapshots.length - 1; index >= 0; index -= 1) {
    const snapshot = snapshots[index];
    if (Object.prototype.hasOwnProperty.call(snapshot.values, key)) {
      return {
        source: path.relative(rootPath, snapshot.filePath) || snapshot.filePath,
        value: snapshot.values[key],
      };
    }
  }

  return null;
}

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
  const snapshots = collectEnvSnapshots();
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
  console.log(`- env files found: ${snapshots.length}`);
  snapshots.forEach((snapshot) => {
    console.log(`  * ${path.relative(rootPath, snapshot.filePath)}`);
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

  printKeyStatuses("Hosted Frontend Required Env", snapshots, hostedFrontendRequired);
  printKeyStatuses("Hosted Frontend Recommended Env", snapshots, hostedFrontendRecommended);
  printKeyStatuses("Hosted Frontend Optional Env", snapshots, hostedFrontendOptional);
  printKeyStatuses("Supabase Function Required Secrets", snapshots, functionSecretsRequired);
  printKeyStatuses("Supabase Function Recommended Secrets", snapshots, functionSecretsRecommended);

  printSection("Hosted Frontend Forbidden Env");
  hostedFrontendForbidden.forEach((key) => {
    const value = getEffectiveValue(snapshots, key);
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
  hostedFrontendRequired.forEach((key) => {
    const value = getEffectiveValue(snapshots, key);
    if (!value || isPlaceholder(value.value)) {
      remoteChecks.push(`Hosted frontend env ${key} is missing or still a placeholder in the local snapshot. Confirm it in Vercel before deploying.`);
    }
  });
  functionSecretsRequired.forEach((key) => {
    const value = getEffectiveValue(snapshots, key);
    if (!value || isPlaceholder(value.value)) {
      remoteChecks.push(`Function secret ${key} is missing or still a placeholder in the local snapshot. Confirm it in Supabase Secrets before deploying.`);
    }
  });
  hostedFrontendForbidden.forEach((key) => {
    const value = getEffectiveValue(snapshots, key);
    if (value && String(value.value || "").trim()) {
      warnings.push(`Hosted frontend forbidden env ${key} is present in the local snapshot via ${value.source}. Keep it local-only and do not copy it into Vercel.`);
    }
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
