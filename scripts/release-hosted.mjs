import { spawnSync } from "child_process";
import path from "path";
import { fileURLToPath } from "url";

const scriptPath = fileURLToPath(import.meta.url);
const repoRoot = path.resolve(path.dirname(scriptPath), "..");
const vpsDeployCommand = process.env.KK_VPS_DEPLOY_COMMAND;
const vpsPreviewDeployCommand = process.env.KK_VPS_PREVIEW_DEPLOY_COMMAND;

const args = new Set(process.argv.slice(2));
const skipCheck = args.has("--skip-check");
const skipVps = args.has("--skip-vps");
const skipVercel = args.has("--skip-vercel");
const preview = args.has("--preview");
const help = args.has("--help") || args.has("-h");

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
  --skip-vps     Skip the VPS API/payment-sidecar deploy step.
  --skip-vercel  Skip Vercel deployment.
  --help, -h     Show this help message.

Environment:
  KK_VPS_DEPLOY_COMMAND          Command that deploys PostgreSQL migrations, apps/api, and apps/payment-sidecar on the production VPS.
  KK_VPS_PREVIEW_DEPLOY_COMMAND  Optional command that deploys the preview/staging VPS API. Production VPS deploy is skipped for --preview unless this is set.`);
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

  if (!skipCheck) {
    runStep("Hosted preflight check", "npm run release:hosted:check");
  }

  if (!skipVps) {
    deployVps();
  }

  if (!skipVercel) {
    const vercelCommand = preview
      ? "npx vercel deploy -y"
      : "npx vercel deploy --prod -y";
    runStep(preview ? "Deploy Vercel preview" : "Deploy Vercel production", vercelCommand);
  }

  console.log("\n[release:hosted] Workflow finished.");
  console.log("[release:hosted] Reminder: confirm VITE_KK_API_BASE_URL points at the VPS API before validating hosted auth.");
  console.log("[release:hosted] Reminder: confirm VPS PostgreSQL, payment, Google, and WeChat secrets exist before smoke tests.");
}

try {
  main();
} catch (error) {
  console.error(`\n[release:hosted] ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
}
