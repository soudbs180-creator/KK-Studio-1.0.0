import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { test } from "node:test";

const ROOT_DIR = process.cwd();

function readSource(relativePath: string): string {
  return readFileSync(path.join(ROOT_DIR, relativePath), "utf-8");
}

test("vercel production proxies hosted BFF routes without forwarding the public Host header", () => {
  const configPath = path.join(ROOT_DIR, "vercel.json");

  assert.equal(existsSync(configPath), true, "vercel.json should exist");
  const config = JSON.parse(readFileSync(configPath, "utf-8")) as {
    rewrites?: Array<{ source?: string; destination?: string }>;
  };

  const rewrites = Array.isArray(config.rewrites) ? config.rewrites : [];
  assert.equal(
    rewrites.some((rewrite) => String(rewrite.destination || "").startsWith("http://172.245.156.16")),
    false,
    "Vercel must not externally rewrite to the VPS because the original Host header makes the VPS redirect to kkai.plus",
  );
  assert.deepEqual(rewrites, [
    { source: "/healthz", destination: "/api/healthz" },
    { source: "/api/v1/:path*", destination: "/api/v1?__kk_path=:path*" },
    { source: "/api/auth/:path*", destination: "/api/auth?__kk_path=:path*" },
  ]);

  const vercelProxyEntries = [
    "api/[...path].ts",
    "api/v1.ts",
    "api/v1/[...path].ts",
    "api/auth.ts",
    "api/auth/[...path].ts",
    "api/manifest.ts",
    "api/healthz.ts",
  ];

  [
    "api/_vpsProxy.js",
    "api/_vpsProxy.d.ts",
    ...vercelProxyEntries,
  ].forEach((relativePath) => {
    assert.equal(existsSync(path.join(ROOT_DIR, relativePath)), true, `${relativePath} should exist`);
  });

  vercelProxyEntries.forEach((relativePath) => {
    const source = readSource(relativePath);
    assert.match(
      source,
      /export const config = \{ runtime: ['"]edge['"] \};/,
      `${relativePath} should declare the Edge runtime locally so Vercel does not deploy it as a Node lambda`,
    );
    assert.doesNotMatch(
      source,
      /_vpsProxy\.ts/,
      `${relativePath} must not import the helper with a .ts extension because Vercel compiles entries to .js`,
    );
    assert.match(
      source,
      /_vpsProxy\.js/,
      `${relativePath} should import the deployed helper module with a .js runtime specifier`,
    );
  });

  const proxySource = readSource("api/_vpsProxy.js");
  assert.match(proxySource, /const HOP_BY_HOP_REQUEST_HEADERS = new Set/);
  assert.match(proxySource, /['"]host['"]/);
  assert.match(proxySource, /const DEFAULT_VPS_API_BASE_URL = 'https:\/\//);
  assert.doesNotMatch(proxySource, /DEFAULT_VPS_API_BASE_URL = 'http:\/\//);
  assert.match(proxySource, /export async function proxyToVps/);
  assert.match(proxySource, /new URL\(upstreamPath, resolveVpsApiBaseUrl\(\)\)/);
  assert.match(proxySource, /upstreamUrl\.host/);
  assert.match(proxySource, /upstreamUrl\.protocol/);
  assert.match(proxySource, /UPSTREAM_REQUIRES_HTTPS/);
});

test("hosted preflight checks verify VPS API and PostgreSQL prerequisites without Supabase release dependencies", () => {
  const source = readSource("scripts/diagnose-hosted-release.mjs");

  assert.match(source, /from "\.\/lib\/env-contract\.mjs";/);
  assert.match(source, /const hostedFrontendRequired = \[\s*"VITE_KK_API_BASE_URL",\s*\];/);
  assert.match(source, /const hostedFrontendForbidden = \[\s*"VITE_ENABLE_LEGACY_WEB_API_FALLBACK",\s*"VITE_SUPABASE_URL",\s*"VITE_SUPABASE_ANON_KEY",\s*"VITE_TURNSTILE_LOCAL_BYPASS",\s*\];/);
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
  assert.match(source, /Hosted frontend forbidden env \$\{key\} is present/);
  assert.match(source, /Hosted frontend VITE_KK_API_BASE_URL must be HTTPS or same-origin/);
  assert.match(source, /isRemoteHttpUrl/);
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
  assert.match(source, /Current 1\.4\.6 hosted baseline uses `https:\/\/kkai\.plus` as the browser-facing same-origin API/);
  assert.match(source, /`https:\/\/172-245-156-16\.sslip\.io`/);
  assert.match(source, /API_DOMAIN=api\.kkai\.plus/);
  assert.match(source, /scripts\/vps\/configure-kk-vps-api-tls\.sh/);
  assert.match(source, /curl -fsS https:\/\/api\.kkai\.plus\/healthz/);
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

test("Cloudflare DNS helper upserts the API host as DNS-only before VPS TLS", () => {
  const dnsScriptPath = "scripts/deploy/cloudflare-upsert-api-dns.mjs";
  assert.equal(existsSync(path.join(ROOT_DIR, dnsScriptPath)), true, `${dnsScriptPath} should exist`);

  const source = readSource(dnsScriptPath);

  assert.match(source, /CF_API_TOKEN/);
  assert.match(source, /CLOUDFLARE_API_TOKEN/);
  assert.match(source, /CLOUDFLARE_ZONE_ID/);
  assert.match(source, /6e8b3a4638980f182b0c4b89bf99e6da/);
  assert.match(source, /api\.kkai\.plus/);
  assert.match(source, /172\.245\.156\.16/);
  assert.match(source, /proxied:\s*false/);
  assert.match(source, /DNS-only/);
  assert.match(source, /PATCH/);
  assert.match(source, /POST/);
  assert.match(source, /const apiBaseUrl = "https:\/\/api\.cloudflare\.com";/);
  assert.doesNotMatch(source, /const apiBaseUrl = "https:\/\/api\.cloudflare\.com\/client\/v4";/);
  assert.match(source, /\/client\/v4\/zones\/\$\{zoneId\}\/dns_records/);
  assert.match(source, /verifyDns/);
  assert.doesNotMatch(source, /console\.log\(token/);
});

test("Vercel upload boundaries exclude local ledgers, generated artifacts, and nested repo copies", () => {
  const vercelIgnore = readSource(".vercelignore");
  const previewDeploy = readSource("scripts/deploy/vercel-preview-deploy.ps1");

  [
    "m",
    "output",
    "tests",
    "docs",
    "release",
    "deploy",
    "plans.md",
    "implement.md",
    "status.md",
    "validation.md",
  ].forEach((entry) => {
    assert.match(vercelIgnore, new RegExp(`(^|\\n)${entry.replace(".", "\\.")}($|\\n)`), `${entry} should be excluded from Vercel uploads`);
  });

  [
    "--exclude=m",
    "--exclude=output",
    "--exclude=tests",
    "--exclude=docs",
    "--exclude=release",
    "--exclude=deploy",
    "--exclude=plans.md",
    "--exclude=implement.md",
    "--exclude=status.md",
    "--exclude=validation.md",
  ].forEach((flag) => {
    assert.match(previewDeploy, new RegExp(flag.replace(".", "\\.")), `${flag} should be excluded from preview tar uploads`);
  });
});

test("production html does not load Tailwind from the browser CDN", () => {
  const source = readSource("index.html");

  assert.doesNotMatch(source, /https:\/\/cdn\.tailwindcss\.com/);
  assert.doesNotMatch(source, /tailwind\.config\s*=/);
  assert.match(readSource("src/index.css"), /@import "tailwindcss";/);
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
