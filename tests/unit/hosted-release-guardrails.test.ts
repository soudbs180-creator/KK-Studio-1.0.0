import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { test } from "node:test";

const ROOT_DIR = process.cwd();

function readSource(relativePath: string): string {
  return readFileSync(path.join(ROOT_DIR, relativePath), "utf-8");
}

test("hosted preflight checks verify auth prerequisites and keep local API fallback out of Vercel", () => {
  const source = readSource("scripts/diagnose-hosted-release.mjs");

  assert.match(source, /from "\.\/lib\/env-contract\.mjs";/);
  assert.match(source, /const hostedFrontendForbidden = \[\s*"VITE_KK_API_BASE_URL",\s*"VITE_ENABLE_LEGACY_WEB_API_FALLBACK",\s*\];/);
  assert.match(source, /const frontendSnapshots = snapshots\.frontendSnapshots;/);
  assert.match(source, /const localApiSnapshots = snapshots\.apiSnapshots;/);
  assert.match(source, /label: "vercel whoami"/);
  assert.match(source, /label: "npx vercel whoami"/);
  assert.match(source, /label: "supabase projects list"/);
  assert.match(source, /label: "npx supabase projects list"/);
  assert.match(source, /"GOOGLE_OAUTH_CLIENT_ID"/);
  assert.match(source, /"GOOGLE_OAUTH_CLIENT_SECRET"/);
  assert.match(source, /"GOOGLE_OAUTH_REDIRECT_URI"/);
  assert.match(source, /"GOOGLE_STATE_SIGNING_SECRET"/);
  assert.match(source, /"GOOGLE_ALLOWED_REDIRECT_ORIGINS"/);
  assert.match(source, /Hosted API \/ function secret/);
  assert.match(source, /runtime env or Supabase Secrets/);
  assert.match(source, /printSection\("Supabase Project Alignment"\);/);
  assert.match(source, /SUPABASE_URL does not point at the same Supabase project as VITE_SUPABASE_URL/);
  assert.match(source, /Vercel authentication is unavailable\./);
  assert.match(source, /Supabase authentication is unavailable\./);
  assert.match(source, /It does not read remote Vercel or Supabase dashboard state\./);
});

test("hosted release workflow pushes migrations before deploying edge functions and frontend", () => {
  const source = readSource("scripts/release-hosted.mjs");
  const movedSource = readSource("scripts/release/release-hosted.mjs");

  assert.match(source, /const skipMigrations = args\.has\("--skip-migrations"\);/);
  assert.match(source, /const productionProjectRef =/);
  assert.match(source, /const previewProjectRef = process\.env\.SUPABASE_PROJECT_REF_PREVIEW;/);
  assert.match(source, /if \(previewProjectRef && productionProjectRef && previewProjectRef === productionProjectRef\) \{/);
  assert.match(source, /const supabaseProjectRef = preview\s+\?\s+previewProjectRef\s+:\s+productionProjectRef;/);
  assert.match(source, /runStep\("Link Supabase project", `npx supabase link --project-ref \$\{supabaseProjectRef\}`\);/);
  assert.match(source, /runStep\("Push Supabase migrations", "npx supabase db push"\);/);
  assert.match(source, /runStep\("Deploy user-route-proxy", "npm run supabase:functions:deploy:user-route-proxy"\);/);
  assert.match(source, /runStep\("Deploy secure-model-proxy", "npm run supabase:functions:deploy:secure-model-proxy"\);/);
  assert.match(source, /runStep\("Deploy admin-credit-models", "npm run supabase:functions:deploy:admin-credit-models"\);/);
  assert.match(source, /runStep\("Deploy wechat-auth", "npm run supabase:functions:deploy:wechat-auth"\);/);
  assert.match(source, /npx vercel deploy --prod -y/);
  assert.match(movedSource, /import "\.\.\/release-hosted\.mjs";/);
});

test("cloud auto deploy waits for Supabase functions before Vercel and includes user-route-proxy", () => {
  const source = readSource(".github/workflows/cloud-auto-deploy.yml");

  assert.match(source, /deploy-vercel:\s+[\s\S]*needs:\s+[\s\S]*- verify\s+[\s\S]*- deploy-supabase-functions/);
  assert.match(source, /needs\.deploy-supabase-functions\.result == 'success'/);
  assert.match(source, /Deploy user-route-proxy Edge Function/);
  assert.match(source, /supabase functions deploy user-route-proxy/);
});

test("hosted release runbook keeps routing and billing smoke tests explicit", () => {
  const source = readSource("docs/development/hosted-release-runbook.md");

  assert.match(source, /User-owned API routes must use `userRoute` and must not consume credits\./);
  assert.match(source, /`apps\/api\/\.env\.local` is the authoritative local API source/);
  assert.match(source, /npm run api:diagnose/);
  assert.match(source, /npm run release:hosted:check/);
  assert.match(source, /1\. Supabase database migrations/);
  assert.match(source, /2\. Supabase Edge Functions/);
  assert.match(source, /3\. Vercel frontend/);
  assert.match(source, /4\. Smoke tests/);
  assert.match(source, /Confirm the request succeeds and the user credit balance does not decrease\./);
  assert.match(source, /Hosted `secure-model-proxy` is still on an older version without `userRoute`/);
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
