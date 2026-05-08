import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { test } from "node:test";

import type { SecureProxyUserRouteConfigDto } from "../../packages/contracts/src/index.ts";
import {
  buildGeminiAuth,
  buildOpenAICompatAuth,
} from "../../apps/api/src/modules/model-proxy/application/local-user-route-auth.ts";

const ROOT_DIR = process.cwd();

function routeConfig(overrides: Partial<SecureProxyUserRouteConfigDto>): SecureProxyUserRouteConfigDto {
  return {
    routeId: "route-auth-contract",
    provider: "openai",
    baseUrl: "https://provider.example/v1",
    apiKey: "sk-contract",
    format: "openai",
    authMethod: "header",
    headerName: "Authorization",
    compatibilityMode: "standard",
    ...overrides,
  };
}

function readSource(relativePath: string): string {
  return readFileSync(path.join(ROOT_DIR, relativePath), "utf-8");
}

test("local user-route auth helper keeps official Gemini API keys in the query string", () => {
  const auth = buildGeminiAuth(
    "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-pro:generateContent",
    routeConfig({
      provider: "google",
      baseUrl: "https://generativelanguage.googleapis.com",
      apiKey: "Bearer google-token",
      format: "gemini",
      authMethod: undefined,
      headerName: undefined,
    }),
  );

  assert.equal(auth.headers.Authorization, undefined);
  assert.equal(auth.headers["x-goog-api-key"], undefined);
  assert.match(auth.url, /[?&]key=google-token(?:&|$)/);
});

test("local user-route auth helper forces GPT Best routes back to bearer header auth", () => {
  const auth = buildGeminiAuth(
    "https://gpt-best.example/v1beta/models/gemini-2.5-pro:generateContent",
    routeConfig({
      provider: "gpt-best",
      baseUrl: "https://gpt-best.example",
      apiKey: "gb-token",
      format: "gemini",
      authMethod: "query",
      headerName: undefined,
    }),
  );

  assert.equal(auth.url, "https://gpt-best.example/v1beta/models/gemini-2.5-pro:generateContent");
  assert.equal(auth.headers.Authorization, "Bearer gb-token");
});

test("local user-route auth helper keeps 12AI Gemini auth in the query string", () => {
  const auth = buildGeminiAuth(
    "https://api.12ai.org/v1beta/models/gemini-2.5-flash:generateContent?alt=sse&key=old-token",
    routeConfig({
      provider: "12AI",
      baseUrl: "https://api.12ai.org",
      apiKey: "Bearer twelve-token",
      format: "gemini",
      authMethod: undefined,
      headerName: undefined,
    }),
  );

  const parsedUrl = new URL(auth.url);
  assert.equal(parsedUrl.searchParams.get("alt"), "sse");
  assert.equal(parsedUrl.searchParams.get("key"), "twelve-token");
  assert.equal(auth.headers.Authorization, undefined);
  assert.equal(auth.headers["x-goog-api-key"], undefined);
});

test("local user-route auth helper keeps Wuyin Gemini authorization raw", () => {
  const auth = buildGeminiAuth(
    "https://wuyinkeji.example/v1beta/models/gemini-2.5-pro:generateContent",
    routeConfig({
      provider: "wuyin",
      baseUrl: "https://wuyinkeji.example",
      apiKey: "Bearer wuyin-token",
      format: "gemini",
      authMethod: "header",
      headerName: undefined,
    }),
  );

  assert.equal(auth.url, "https://wuyinkeji.example/v1beta/models/gemini-2.5-pro:generateContent");
  assert.equal(auth.headers.Authorization, "wuyin-token");
});

test("local user-route auth helper sends raw token for non-Authorization custom headers", () => {
  const auth = buildOpenAICompatAuth(
    "https://provider.example/v1/chat/completions",
    routeConfig({
      provider: "custom",
      baseUrl: "https://provider.example/v1",
      apiKey: "Bearer raw-token",
      format: "openai",
      authMethod: "header",
      headerName: "X-Api-Key",
    }),
  );

  assert.equal(auth.url, "https://provider.example/v1/chat/completions");
  assert.equal(auth.headers["X-Api-Key"], "raw-token");
  assert.equal(auth.headers.Authorization, undefined);
});

test("local user-route auth helper normalizes copied API key whitespace for query and header auth", () => {
  const queryAuth = buildGeminiAuth(
    "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-pro:generateContent",
    routeConfig({
      provider: "google",
      baseUrl: "https://generativelanguage.googleapis.com",
      apiKey: "Bearer \u200Bgoogle-\n token\t",
      format: "gemini",
      authMethod: undefined,
      headerName: undefined,
    }),
  );
  const headerAuth = buildOpenAICompatAuth(
    "https://provider.example/v1/chat/completions",
    routeConfig({
      provider: "openai",
      baseUrl: "https://provider.example/v1",
      apiKey: "Bearer \u200Bopenai-\n token\t",
      format: "openai",
      authMethod: "header",
      headerName: "Authorization",
    }),
  );

  assert.match(queryAuth.url, /[?&]key=google-token(?:&|$)/);
  assert.equal(headerAuth.headers.Authorization, "Bearer openai-token");
});

test("local user-route proxy delegates auth assembly to the focused helper module", () => {
  const proxySource = readSource("apps/api/src/modules/model-proxy/application/local-user-route-proxy-service.ts");
  const wrapperSource = readSource("apps/api/src/modules/model-proxy/application/local-user-route-auth.ts");
  const helperSource = readSource("apps/api/src/lib/local-user-route-auth.ts");

  assert.match(proxySource, /from "\.\/local-user-route-auth\.ts"/);
  assert.match(wrapperSource, /export \* from "\.\.\/\.\.\/\.\.\/lib\/local-user-route-auth\.ts";/);
  assert.doesNotMatch(proxySource, /function buildGeminiAuth\(/);
  assert.doesNotMatch(proxySource, /function buildOpenAICompatAuth\(/);
  assert.match(helperSource, /export function buildGeminiAuth\(/);
  assert.match(helperSource, /export function buildOpenAICompatAuth\(/);
});
