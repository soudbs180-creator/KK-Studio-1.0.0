import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { test } from "node:test";

const ROOT_DIR = process.cwd();

function readSource(relativePath: string): string {
  return readFileSync(path.join(ROOT_DIR, relativePath), "utf-8");
}

test("VPS local proxy keeps provider-aware auth selection for system Gemini-compatible routes", () => {
  const localProxySource = readSource("apps/api/src/modules/model-proxy/application/local-user-route-proxy-service.ts");

  assert.match(
    localProxySource,
    /function isBearerGeminiCompatRoute\(routeConfig: SecureProxyUserRouteConfigDto\): boolean \{/,
  );
  assert.match(
    localProxySource,
    /function isWuyinGeminiRoute\(routeConfig: SecureProxyUserRouteConfigDto\): boolean \{/,
  );
  assert.match(
    localProxySource,
    /function buildGeminiAuth\(\s*url: string,\s*routeConfig: SecureProxyUserRouteConfigDto,\s*\): \{ url: string; headers: Record<string, string> \} \{/,
  );
  assert.match(
    localProxySource,
    /if \(isWuyinGeminiRoute\(routeConfig\) \|\| isBearerGeminiCompatRoute\(routeConfig\)\) \{/,
  );
  assert.match(
    localProxySource,
    /const auth = buildGeminiAuth\(`\$\{apiBase\}\/\$\{upstreamTaskId\}`,\s*routeConfig\);/,
  );
  assert.match(
    localProxySource,
    /await this\.tryDeleteDirectVideoTask\(routeConfig, endpointType, baseUrl, upstreamTaskId\);/,
  );
});
