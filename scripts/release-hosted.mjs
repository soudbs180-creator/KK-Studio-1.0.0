import { spawnSync } from "child_process";
import path from "path";
import { fileURLToPath } from "url";

const scriptPath = fileURLToPath(import.meta.url);
const repoRoot = path.resolve(path.dirname(scriptPath), "..");
const projectRef = "ovdjhdofjysanamgkfng";

const args = new Set(process.argv.slice(2));
const skipCheck = args.has("--skip-check");
const skipSupabase = args.has("--skip-supabase");
const skipMigrations = args.has("--skip-migrations");
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
  console.log(`Usage: node scripts/release-hosted.mjs [--preview] [--skip-check] [--skip-supabase] [--skip-migrations] [--skip-vercel]

Options:
  --preview        Deploy Vercel as a preview instead of production.
  --skip-check     Skip the hosted preflight check.
  --skip-supabase  Skip Supabase link + Edge Function deploy steps.
  --skip-migrations  Skip \`npx supabase db push\` after linking the project.
  --skip-vercel    Skip Vercel deployment.
  --help, -h       Show this help message.`);
}

function main() {
  if (help) {
    printUsage();
    return;
  }

  console.log("[release:hosted] Starting hosted release workflow");
  console.log(`[release:hosted] repo: ${repoRoot}`);
  console.log(`[release:hosted] supabase project ref: ${projectRef}`);

  if (!skipCheck) {
    runStep("Hosted preflight check", "npm run release:hosted:check");
  }

    if (!skipSupabase) {
      runStep("Link Supabase project", `npx supabase link --project-ref ${projectRef}`);
      if (!skipMigrations) {
        runStep("Push Supabase migrations", "npx supabase db push");
      }
      runStep("Deploy user-route-proxy", "npm run supabase:functions:deploy:user-route-proxy");
      runStep("Deploy secure-model-proxy", "npm run supabase:functions:deploy:secure-model-proxy");
      runStep("Deploy admin-credit-models", "npm run supabase:functions:deploy:admin-credit-models");
      runStep("Deploy wechat-auth", "npm run supabase:functions:deploy:wechat-auth");
  }

  if (!skipVercel) {
    const vercelCommand = preview
      ? "npx vercel deploy -y"
      : "npx vercel deploy --prod -y";
    runStep(preview ? "Deploy Vercel preview" : "Deploy Vercel production", vercelCommand);
  }

  console.log("\n[release:hosted] Workflow finished.");
  console.log("[release:hosted] Reminder: keep VITE_KK_API_BASE_URL and VITE_ENABLE_LEGACY_WEB_API_FALLBACK out of Vercel hosted env.");
  console.log("[release:hosted] Reminder: confirm WeChat secrets exist in Supabase before validating hosted auth.");
}

try {
  main();
} catch (error) {
  console.error(`\n[release:hosted] ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
}
