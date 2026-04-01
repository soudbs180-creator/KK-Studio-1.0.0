import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { test } from "node:test";

const ROOT_DIR = process.cwd();

function readSource(relativePath: string): string {
  return readFileSync(path.join(ROOT_DIR, relativePath), "utf-8");
}

test("user-owned API traffic is routed through the dedicated Supabase user-route proxy", () => {
  const proxySource = readSource("src/services/model/secureModelProxy.ts");
  const callerSource = readSource("src/services/model/modelCaller.ts");
  const functionSource = readSource("supabase/functions/user-route-proxy/index.ts");

  assert.match(proxySource, /functions\/v1\/user-route-proxy/);
  assert.match(proxySource, /apikey: supabaseAnonKey/);
  assert.match(proxySource, /startsWith\('local_proxy:'\)/);
  assert.match(callerSource, /callLocalUserRouteProxyChat/);
  assert.match(callerSource, /routeId: config\.route\.id/);
  assert.doesNotMatch(callerSource, /callSecureSystemProxyChat\(\{[\s\S]*userRoute:/);
  assert.match(functionSource, /from\('profiles'\)\s*\.select\('user_apis'\)/);
  assert.match(functionSource, /deducted: false/);
  assert.match(functionSource, /LOCAL_PROXY_TASK_PREFIX = 'local_proxy:'/);
});

test("LLM service no longer retries user-owned API calls through the credit-model proxy", () => {
  const source = readSource("src/services/llm/LLMService.ts");

  assert.match(
    source,
    /private shouldFallbackToCloudUserRouteAfterLocalProxy\(\s*error: unknown,\s*\): boolean \{\s*void error;\s*return false;\s*\}/,
  );
  assert.doesNotMatch(source, /return isLocalUserRouteProxyFallbackError\(error\);/);
});

test("hosted release workflow deploys the dedicated user-route proxy before the credit-model proxy", () => {
  const source = readSource("scripts/release-hosted.mjs");

  assert.match(source, /runStep\("Deploy user-route-proxy", "npm run supabase:functions:deploy:user-route-proxy"\);/);
});
