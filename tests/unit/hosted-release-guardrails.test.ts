import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { test } from "node:test";

const ROOT_DIR = process.cwd();

function readSource(relativePath: string): string {
  return readFileSync(path.join(ROOT_DIR, relativePath), "utf-8");
}

test("vercel production rewrites hosted BFF routes to the VPS gateway", () => {
  const configPath = path.join(ROOT_DIR, "vercel.json");

  assert.equal(existsSync(configPath), true, "vercel.json should exist");
  const config = JSON.parse(readFileSync(configPath, "utf-8")) as {
    rewrites?: Array<{ source?: string; destination?: string }>;
  };

  assert.ok(Array.isArray(config.rewrites), "vercel.json should define rewrites");
  assert.deepEqual(config.rewrites.slice(0, 4), [
    { source: "/api/v1/:path*", destination: "http://172.245.156.16/api/v1/:path*" },
    { source: "/api/auth/:path*", destination: "http://172.245.156.16/api/auth/:path*" },
    { source: "/healthz", destination: "http://172.245.156.16/healthz" },
    { source: "/api/manifest", destination: "http://172.245.156.16/api/manifest" },
  ]);
});

test("hosted preflight checks verify VPS API and PostgreSQL prerequisites without Supabase release dependencies", () => {
  const source = readSource("scripts/diagnose-hosted-release.mjs");

  assert.match(source, /from "\.\/lib\/env-contract\.mjs";/);
  assert.match(source, /const hostedFrontendRequired = \[\s*"VITE_KK_API_BASE_URL",\s*\];/);
  assert.match(source, /const hostedFrontendForbidden = \[\s*"VITE_ENABLE_LEGACY_WEB_API_FALLBACK",\s*"VITE_SUPABASE_URL",\s*"VITE_SUPABASE_ANON_KEY",\s*\];/);
  assert.match(source, /const frontendSnapshots = snapshots\.frontendSnapshots;/);
  assert.match(source, /const localApiSnapshots = snapshots\.apiSnapshots;/);
  assert.match(source, /label: "vercel whoami"/);
  assert.match(source, /label: "npx vercel whoami"/);
  assert.doesNotMatch(source, /label: "supabase projects list"/);
  assert.doesNotMatch(source, /label: "npx supabase projects list"/);
  assert.match(source, /"DATABASE_URL"/);
  assert.match(source, /"GOOGLE_OAUTH_CLIENT_ID"/);
  assert.match(source, /"GOOGLE_OAUTH_CLIENT_SECRET"/);
  assert.match(source, /"GOOGLE_OAUTH_REDIRECT_URI"/);
  assert.match(source, /"GOOGLE_STATE_SIGNING_SECRET"/);
  assert.match(source, /"GOOGLE_ALLOWED_REDIRECT_ORIGINS"/);
  assert.match(source, /Hosted API Required Env/);
  assert.doesNotMatch(source, /runtime env or Supabase Secrets/);
  assert.doesNotMatch(source, /printSection\("Supabase Project Alignment"\);/);
  assert.doesNotMatch(source, /SUPABASE_URL does not point at the same Supabase project as VITE_SUPABASE_URL/);
  assert.match(source, /Vercel authentication is unavailable\./);
  assert.doesNotMatch(source, /Supabase authentication is unavailable\./);
  assert.match(source, /It does not read remote VPS or Vercel dashboard state\./);
});

test("hosted release workflow deploys the VPS API before deploying the frontend", () => {
  const source = readSource("scripts/release-hosted.mjs");
  const movedSource = readSource("scripts/release/release-hosted.mjs");

  assert.match(source, /const skipVps = args\.has\("--skip-vps"\);/);
  assert.match(source, /const vpsDeployCommand = process\.env\.KK_VPS_DEPLOY_COMMAND/);
  assert.doesNotMatch(source, /skipSupabase/);
  assert.doesNotMatch(source, /npx supabase/);
  assert.doesNotMatch(source, /supabase:functions:deploy/);
  assert.match(source, /runStep\("Deploy VPS API", vpsDeployCommand\);/);
  assert.match(source, /npx vercel deploy --prod -y/);
  assert.match(movedSource, /import "\.\.\/release-hosted\.mjs";/);
});

test("hosted preview release skips the production VPS deploy command by default", () => {
  const source = readSource("scripts/release-hosted.mjs");

  assert.match(source, /const vpsPreviewDeployCommand = process\.env\.KK_VPS_PREVIEW_DEPLOY_COMMAND/);
  assert.match(source, /if \(preview\) \{[\s\S]*runStep\("Deploy preview VPS API", vpsPreviewDeployCommand\);/);
  assert.match(source, /Skipping VPS API deploy for preview/);
  assert.match(source, /KK_VPS_PREVIEW_DEPLOY_COMMAND/);
});

test("cloud auto deploy waits for the VPS API before Vercel", () => {
  const source = readSource(".github/workflows/cloud-auto-deploy.yml");

  assert.match(source, /deploy-vercel:\s+[\s\S]*needs:\s+[\s\S]*- verify\s+[\s\S]*- deploy-vps-api/);
  assert.match(source, /needs\.deploy-vps-api\.result == 'success'/);
  assert.match(source, /deploy-vps-api:/);
  assert.match(source, /KK_VPS_DEPLOY_COMMAND/);
  assert.doesNotMatch(source, /deploy-supabase-functions/);
  assert.doesNotMatch(source, /supabase functions deploy/);
});

test("hosted release runbook keeps routing and billing smoke tests explicit", () => {
  const source = readSource("docs/development/hosted-release-runbook.md");

  assert.match(source, /User-owned API routes must use `userRoute` and must not consume credits\./);
  assert.match(source, /`apps\/api\/\.env\.local` is the authoritative local API source/);
  assert.match(source, /npm run api:diagnose/);
  assert.match(source, /npm run release:hosted:check/);
  assert.match(source, /1\. VPS PostgreSQL migrations/);
  assert.match(source, /2\. VPS API and payment sidecar/);
  assert.match(source, /3\. Vercel frontend/);
  assert.match(source, /4\. Smoke tests/);
  assert.match(source, /Confirm the request succeeds and the user credit balance does not decrease\./);
  assert.match(source, /Hosted API on the VPS is still on an older version without `userRoute`/);
  assert.match(source, /Hosted payment runtimes must fail closed when durable storage or settlement auth is unavailable\./);
  assert.match(source, /Legacy `\/api\/pay\*` payment routes stay local-only by default/);
  assert.match(source, /`PAYMENT_SIDECAR_SETTLEMENT_TOKEN`/);
  assert.match(source, /`PAYMENT_WEBHOOK_SETTLEMENT_TOKEN`/);
  assert.match(source, /`GOOGLE_OAUTH_CLIENT_ID`/);
  assert.match(source, /`GOOGLE_OAUTH_CLIENT_SECRET`/);
  assert.match(source, /`GOOGLE_OAUTH_REDIRECT_URI`/);
  assert.match(source, /`GOOGLE_STATE_SIGNING_SECRET`/);
  assert.match(source, /`GOOGLE_ALLOWED_REDIRECT_ORIGINS`/);
  assert.match(source, /GOOGLE_AUTH_UNAVAILABLE/);
  assert.match(source, /WECHAT_AUTH_UNAVAILABLE/);
});

test("local API env example documents hosted Google and WeChat auth server secrets", () => {
  const source = readSource("apps/api/.env.local.example");

  assert.match(source, /GOOGLE_OAUTH_CLIENT_ID=/);
  assert.match(source, /GOOGLE_OAUTH_CLIENT_SECRET=/);
  assert.match(source, /GOOGLE_OAUTH_REDIRECT_URI=/);
  assert.match(source, /GOOGLE_STATE_SIGNING_SECRET=/);
  assert.match(source, /GOOGLE_ALLOWED_REDIRECT_ORIGINS=/);
  assert.match(source, /WECHAT_OPEN_APP_ID=/);
});
