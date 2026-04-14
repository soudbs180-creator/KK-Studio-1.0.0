import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { test } from "node:test";

const ROOT_DIR = process.cwd();

function readSource(relativePath: string): string {
  return readFileSync(path.join(ROOT_DIR, relativePath), "utf-8");
}

test("secure-model-proxy keeps provider-aware auth selection for system Gemini-compatible routes", () => {
  const secureProxySource = readSource("supabase/functions/secure-model-proxy/index.ts");

  assert.match(
    secureProxySource,
    /function isBearerGeminiCompatProvider\(providerId: string \| undefined, baseUrl: string \| undefined\): boolean \{/,
  );
  assert.match(
    secureProxySource,
    /function isWuyinGeminiCompatProvider\(providerId: string \| undefined, baseUrl: string \| undefined\): boolean \{/,
  );
  assert.match(
    secureProxySource,
    /function buildSystemGeminiAuth\(url: string, providerId: string \| undefined, baseUrl: string, apiKey: string\): \{ url: string; headers: HeadersInit \} \{/,
  );
  assert.match(
    secureProxySource,
    /if \(isBearerGeminiCompatProvider\(providerId, baseUrl\)\) \{/,
  );
  assert.match(
    secureProxySource,
    /if \(isWuyinGeminiCompatProvider\(providerId, baseUrl\)\) \{/,
  );
  assert.match(
    secureProxySource,
    /const geminiAuth = buildSystemGeminiAuth\(/,
  );
  assert.match(
    secureProxySource,
    /await tryDeleteUpstreamVideoTask\(taskPayload\.endpointType, baseUrl, selectedKey, taskPayload\.operationName, taskPayload\.providerId\);/,
  );
});
