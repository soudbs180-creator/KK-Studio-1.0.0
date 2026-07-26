import { spawnSync } from "child_process";
import path from "path";
import { fileURLToPath } from "url";

import { assertVersionConsistency } from "../lib/version-gate.mjs";

const scriptPath = fileURLToPath(import.meta.url);
// 本文件位于 scripts/release/，需上溯两级才是仓库根目录；此前只上溯一级，
// 所有部署步骤实际运行在 scripts/ 下（与 diagnose-hosted-release.mjs 同类修复）。
const repoRoot = path.resolve(path.dirname(scriptPath), "..", "..");
const vpsDeployCommand = process.env.KK_VPS_DEPLOY_COMMAND;
const vpsPreviewDeployCommand = process.env.KK_VPS_PREVIEW_DEPLOY_COMMAND;

const args = new Set(process.argv.slice(2));
const skipCheck = args.has("--skip-check");
const skipVps = args.has("--skip-vps");
const skipVercel = args.has("--skip-vercel");
const preview = args.has("--preview");
const help = args.has("--help") || args.has("-h");

function hasVercelToken() {
  return Boolean(String(process.env.VERCEL_TOKEN || "").trim());
}

function getVercelTokenShellArg() {
  if (!hasVercelToken()) {
    return "";
  }

  return process.platform === "win32"
    ? ' --token "%VERCEL_TOKEN%"'
    : ' --token "$VERCEL_TOKEN"';
}

function shellCommand(command) {
  if (process.platform === "win32") {
    return ["cmd.exe", ["/d", "/s", "/c", command]];
  }

  return ["sh", ["-lc", command]];
}

function runStep(title, command) {
  console.log(`\n[release:hosted] ${title}`);
  console.log(`[release:hosted] $ ${command}`);

  const [cmd, cmdArgs] = shellCommand(command);
  const result = spawnSync(cmd, cmdArgs, {
    cwd: repoRoot,
    stdio: "inherit",
    env: process.env,
  });

  if (result.status !== 0) {
    throw new Error(`${title} failed with exit code ${result.status ?? "unknown"}`);
  }
}

function printUsage() {
  console.log(`Usage: node scripts/release-hosted.mjs [--preview] [--skip-check] [--skip-vps] [--skip-vercel]

Options:
  --preview      Deploy Vercel as a preview instead of production.
  --skip-check   Skip the hosted preflight check.
  --skip-vps     Skip the VPS backend deploy step.
  --skip-vercel  Skip Vercel deployment.
  --help, -h     Show this help message.

Environment:
  KK_VPS_DEPLOY_COMMAND          Command that deploys PostgreSQL migrations and the server/ backend on the production VPS.
  KK_VPS_PREVIEW_DEPLOY_COMMAND  Optional command that deploys the preview/staging VPS API. Production VPS deploy is skipped for --preview unless this is set.
  VERCEL_TOKEN                   Optional token passed to Vercel CLI as an env var reference for non-interactive deployments.
  VERCEL_ORG_ID / VERCEL_PROJECT_ID  Optional project metadata used by Vercel CLI when the repo has not been linked locally.`);
}

function deployVps() {
  if (preview) {
    if (vpsPreviewDeployCommand) {
      runStep("Deploy preview VPS API", vpsPreviewDeployCommand);
      return;
    }

    console.log("[release:hosted] Skipping VPS API deploy for preview because KK_VPS_PREVIEW_DEPLOY_COMMAND is not set.");
    return;
  }

  if (!vpsDeployCommand) {
    throw new Error("Missing KK_VPS_DEPLOY_COMMAND. Set it to the production VPS deployment command or pass --skip-vps.");
  }

  runStep("Deploy VPS API", vpsDeployCommand);
}

function main() {
  if (help) {
    printUsage();
    return;
  }

  console.log("[release:hosted] Starting hosted release workflow");
  console.log(`[release:hosted] repo: ${repoRoot}`);

  // 发布门禁：该路径可绕过 GitHub Actions 直连生产，版本一致性必须在此校验。
  // 刻意不受 --skip-check 控制——该标志只用于跳过环境探测，不得跳过版本真理源。
  assertVersionConsistency({ context: "release:hosted", rootDir: repoRoot });

  if (!skipCheck) {
    runStep("Hosted preflight check", "npm run release:hosted:check");
  }

  if (!skipVps) {
    deployVps();
  }

  if (!skipVercel) {
    const vercelTokenArg = getVercelTokenShellArg();
    const vercelCommand = preview
      ? `npx vercel deploy -y${vercelTokenArg}`
      : `npx vercel deploy --prod -y${vercelTokenArg}`;
    runStep(preview ? "Deploy Vercel preview" : "Deploy Vercel production", vercelCommand);
  }

  console.log("\n[release:hosted] Workflow finished.");
  console.log("[release:hosted] Reminder: confirm VITE_KK_API_BASE_URL points at the VPS API before validating hosted auth.");
  console.log("[release:hosted] Reminder: confirm VPS PostgreSQL, Stripe, Google, and WeChat secrets exist before smoke tests.");
}

try {
  main();
} catch (error) {
  console.error(`\n[release:hosted] ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
}
