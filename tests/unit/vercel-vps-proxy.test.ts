import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { test } from "node:test";

const ROOT_DIR = process.cwd();
const VPS_API_ORIGIN = "https://172-245-156-16.sslip.io";

function readVercelConfig() {
  return JSON.parse(readFileSync(path.join(ROOT_DIR, "vercel.json"), "utf8")) as {
    cleanUrls?: boolean;
    rewrites?: Array<{ source?: string; destination?: string }>;
  };
}

test("Vercel serves OAuth callback deep links through the SPA root", () => {
  const config = readVercelConfig();
  const rewrites = config.rewrites || [];
  const spaFallback = rewrites.at(-1);

  assert.equal(config.cleanUrls, true);
  assert.deepEqual(
    spaFallback,
    { source: "/(.*)", destination: "/" },
    "expected cleanUrls-compatible SPA fallback so /auth/callback resolves to the web app",
  );
});

test("Vercel proxies hosted auth and health routes to the VPS API origin", () => {
  const config = readVercelConfig();
  const rewrites = config.rewrites || [];

  assert.ok(
    rewrites.some((rewrite) => rewrite.source === "/healthz" && rewrite.destination === `${VPS_API_ORIGIN}/healthz`),
    "expected /healthz to proxy to the VPS health route",
  );
  assert.ok(
    rewrites.some((rewrite) => rewrite.source === "/api/v1/:path*" && rewrite.destination === `${VPS_API_ORIGIN}/api/v1/:path*`),
    "expected /api/v1/* to proxy to the VPS API instead of a missing local serverless function",
  );
  assert.ok(
    rewrites.some((rewrite) => rewrite.source === "/api/pricing-proxy" && rewrite.destination === `${VPS_API_ORIGIN}/api/pricing-proxy`),
    "expected /api/pricing-proxy to proxy to the VPS pricing route",
  );
  assert.ok(
    rewrites.some((rewrite) => rewrite.source === "/api/auth/:path*" && rewrite.destination === `${VPS_API_ORIGIN}/api/v1/auth/:path*`),
    "expected legacy /api/auth/* paths to proxy to the VPS auth namespace",
  );
  assert.equal(
    existsSync(path.join(ROOT_DIR, "api", "pricing-proxy.js")),
    false,
    "expected the Wuyin pricing proxy serverless handler to be removed",
  );
  assert.equal(
    existsSync(path.join(ROOT_DIR, "api", "user-model-proxy.js")),
    false,
    "expected the Wuyin user model proxy serverless handler to be removed",
  );
  assert.equal(
    rewrites.some((rewrite) => String(rewrite.destination || "").includes("__kk_path")),
    false,
    "hosted rewrites must not target the removed __kk_path serverless shim",
  );
});
