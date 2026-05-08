import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { test } from "node:test";

const ROOT_DIR = process.cwd();

function readSource(relativePath: string): string {
  return readFileSync(path.join(ROOT_DIR, relativePath), "utf-8");
}

test("server-side user-route config resolution forces GPT Best back to bearer-header auth", () => {
  const payloadSource = readSource("apps/api/src/modules/auth/infrastructure/user-api-payload.ts");
  const diagnosticsSource = readSource("apps/api/src/modules/auth/application/user-route-diagnostics-service.ts");
  const localProxySource = readSource("apps/api/src/modules/model-proxy/application/local-user-route-proxy-service.ts");
  const authWrapperSource = readSource("apps/api/src/modules/model-proxy/application/local-user-route-auth.ts");
  const authHelperSource = readSource("apps/api/src/lib/local-user-route-auth.ts");

  assert.match(payloadSource, /function shouldForceHeaderAuthForProvider\(provider: string, baseUrl: string\): boolean \{/);
  assert.match(
    payloadSource,
    /authMethod: shouldForceHeaderAuthForProvider\(provider, baseUrl\)\s*\?\s*"header"\s*:\s*rawRecord\.authMethod === "query" \? "query" : "header"/,
  );

  assert.match(
    diagnosticsSource,
    /inferLocalAuthMethod\(routeConfig, format\)/,
  );

  assert.match(localProxySource, /from "\.\/local-user-route-auth\.ts"/);
  assert.match(authWrapperSource, /export \* from "\.\.\/\.\.\/\.\.\/lib\/local-user-route-auth\.ts";/);
  assert.match(authHelperSource, /function shouldForceHeaderAuthForProvider\(provider: string \| undefined, baseUrl: string \| undefined\): boolean \{/);
  assert.match(
    authHelperSource,
    /if \(shouldForceHeaderAuthForProvider\(routeConfig\.provider, routeConfig\.baseUrl\)\) \{\s*return "header";\s*\}/,
  );
});
