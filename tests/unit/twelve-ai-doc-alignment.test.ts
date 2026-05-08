import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { test } from "node:test";

const ROOT_DIR = process.cwd();

function readSource(relativePath: string): string {
  return readFileSync(path.join(ROOT_DIR, relativePath), "utf-8");
}

test("12AI Gemini native image payload keeps doc-specific snake_case request parts", () => {
  const adapterSource = readSource("src/services/llm/OpenAICompatibleAdapter.ts");

  assert.match(
    adapterSource,
    /buildInlineImagePart\(base64, mimeType \|\| 'image\/png', is12AIChannel\)/,
  );
  assert.match(
    adapterSource,
    /buildGeminiNativeGroundingTools\(options\.providerConfig\?\.google\?\.tools, is12AIChannel\)/,
  );
});

test("12AI built-in presets include the current Nano Banana 2 model", () => {
  const providerPresetsSource = readSource("src/services/auth/keyManagerProviderPresets.ts");

  assert.match(
    providerPresetsSource,
    /'12ai':\s*\{[\s\S]*?models:\s*\[[\s\S]*?'gemini-3\.1-flash-image-preview'/,
  );
  assert.match(
    providerPresetsSource,
    /'12ai-nanobanana':\s*\{[\s\S]*?models:\s*\[[\s\S]*?'gemini-3\.1-flash-image-preview'/,
  );
});

test("12AI model discovery falls back to documented presets instead of a remote models endpoint", () => {
  const keyManagerSource = readSource("src/services/auth/keyManager.ts");
  const providerPresetsSource = readSource("src/services/auth/keyManagerProviderPresets.ts");
  const connectionTestSource = readSource("src/services/api/connectionTest.ts");

  assert.match(
    providerPresetsSource,
    /export function getDocumentedStaticModelsForProvider\(strategyId: string\)/,
  );
  assert.match(
    keyManagerSource,
    /const documentedModels = getDocumentedStaticModelsForProvider\(runtime\.strategyId\);/,
  );
  assert.match(
    connectionTestSource,
    /const documentedModels = getDocumentedStaticModelsForProvider\(runtime\.strategyId\);/,
  );
  assert.match(
    connectionTestSource,
    /source: '12ai-doc-preset'/,
  );
});

test("12AI Gemini-native chat and proxy layers keep snake_case request fields on 12AI gateways", () => {
  const geminiAdapterSource = readSource("src/services/llm/GeminiNativeAdapter.ts");
  const localProxySource = readSource("apps/api/src/modules/model-proxy/application/local-user-route-proxy-service.ts");
  const localRouteAuthWrapperSource = readSource("apps/api/src/modules/model-proxy/application/local-user-route-auth.ts");
  const localRouteAuthSource = readSource("apps/api/src/lib/local-user-route-auth.ts");

  assert.match(geminiAdapterSource, /const useSnakeCase = runtime\.strategyId === '12ai';/);
  assert.match(geminiAdapterSource, /payload\[useSnakeCase \? 'system_instruction' : 'systemInstruction'\]/);
  assert.match(geminiAdapterSource, /buildInlineImagePart\(media\.data, media\.mimeType, useSnakeCase\)/);

  assert.match(localRouteAuthSource, /function is12AIBaseUrl\(baseUrl: string \| undefined\): boolean/);
  assert.match(localRouteAuthWrapperSource, /export \* from "\.\.\/\.\.\/\.\.\/lib\/local-user-route-auth\.ts";/);
  assert.match(localProxySource, /from "\.\/local-user-route-auth\.ts"/);
  assert.match(localProxySource, /payload\[useSnakeCase \? "system_instruction" : "systemInstruction"\]/);
  assert.match(localProxySource, /toInlineImagePartWithFormat\(ref, useSnakeCase\)/);
});

test("12AI diagnostics probe uses action endpoints and 12AI auth rules instead of a models listing endpoint", () => {
  const diagnosticsSource = readSource("apps/api/src/modules/auth/application/user-route-diagnostics-service.ts");
  const localRouteAuthSource = readSource("apps/api/src/lib/local-user-route-auth.ts");

  assert.match(diagnosticsSource, /const TWELVE_AI_DOCUMENTED_MODELS = \[/);
  assert.match(diagnosticsSource, /from "\.\.\/\.\.\/\.\.\/lib\/local-user-route-auth\.ts";/);
  assert.match(localRouteAuthSource, /function is12AIBaseUrl\(baseUrl: string \| undefined\): boolean/);
  assert.match(localRouteAuthSource, /return is12AIBaseUrl\(routeConfig\.baseUrl\) \? "Authorization" : "x-api-key";/);
  assert.match(localRouteAuthSource, /return is12AIBaseUrl\(routeConfig\.baseUrl\) \? "bearer" : "raw";/);
  assert.match(diagnosticsSource, /buildGeminiGenerateContentEndpoint\(routeConfig\.baseUrl, "gemini-2\.5-flash", routeConfig\.apiKey, authMethod\)/);
  assert.match(diagnosticsSource, /models: is12AI \? TWELVE_AI_DOCUMENTED_MODELS : normalizeModels\(payload\)/);
});

test("proxy chat layers can switch response-only models to /v1/responses", () => {
  const localProxySource = readSource("apps/api/src/modules/model-proxy/application/local-user-route-proxy-service.ts");

  assert.match(localProxySource, /function localModelPrefersResponsesApi\(modelId\?: string\): boolean \{/);
  assert.match(localProxySource, /const responsesRequestBody = buildLocalResponsesPayload\(\{/);
  assert.match(localProxySource, /endpointPath: "chat\/completions" \| "responses"/);
  assert.match(localProxySource, /await executeOpenAIRequest\("responses", responsesRequestBody\)/);
  assert.match(localProxySource, /shouldRetryWithLocalResponsesApi\(error\.statusCode, error\.message\)/);
  assert.match(localProxySource, /content: extractLocalOpenAITextPayload\(result\)/);
});
