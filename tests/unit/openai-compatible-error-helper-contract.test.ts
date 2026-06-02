import { readSource } from '../support/workspacePaths.js';
import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { readFileSync } from "node:fs";
import path from "node:path";
import { test } from "node:test";

const ROOT_DIR = process.cwd();
const HELPER_RELATIVE_PATH = "apps/web/src/services/llm/openAICompatibleErrors.ts";



async function loadHelper(): Promise<{
  buildOpenAICompatibleHttpError: (params: {
    message: string;
    status?: number;
    requestPath?: string;
    requestBody?: string;
    responseBody?: string;
    provider?: string;
  }) => Error;
  buildOpenAICompatibleImageCompatibilityModeError: (
    endpointMode: "chat" | "standard",
    originalError: unknown,
    fallbackProvider?: string,
  ) => Error;
}> {
  assert.equal(
    existsSync(path.join(ROOT_DIR, HELPER_RELATIVE_PATH)),
    true,
    "OpenAI-compatible errors should live in a focused helper module",
  );
  return import("../../apps/web/src/services/llm/openAICompatibleErrors.ts");
}

test("OpenAI-compatible HTTP errors preserve diagnostic metadata", async () => {
  const { buildOpenAICompatibleHttpError } = await loadHelper();
  const error = buildOpenAICompatibleHttpError({
    message: "[422] Provider rejected image request",
    status: 422,
    requestPath: "/v1/images/generations",
    requestBody: '{"model":"image"}',
    responseBody: '{"error":"bad size"}',
    provider: "gpt-best",
  }) as Error & {
    status?: number;
    code?: string;
    requestPath?: string;
    requestBody?: string;
    responseBody?: string;
    provider?: string;
  };

  assert.equal(error.message, "[422] Provider rejected image request");
  assert.equal(error.status, 422);
  assert.equal(error.code, "HTTP_422");
  assert.equal(error.requestPath, "/v1/images/generations");
  assert.equal(error.requestBody, '{"model":"image"}');
  assert.equal(error.responseBody, '{"error":"bad size"}');
  assert.equal(error.provider, "gpt-best");
});

test("OpenAI-compatible image compatibility errors preserve original error metadata", async () => {
  const { buildOpenAICompatibleImageCompatibilityModeError } = await loadHelper();
  const originalError = Object.assign(new Error("OpenAI image error: 404 unsupported"), {
    status: 404,
    code: "HTTP_404",
    requestPath: "/v1/images/generations",
    requestBody: '{"prompt":"<omitted:prompt>"}',
    responseBody: '{"error":"unsupported endpoint"}',
    provider: "openai-compatible",
  });

  const error = buildOpenAICompatibleImageCompatibilityModeError(
    "standard",
    originalError,
    "fallback-provider",
  ) as Error & {
    status?: number;
    code?: string;
    requestPath?: string;
    requestBody?: string;
    responseBody?: string;
    provider?: string;
    compatibilityModeHint?: string;
  };

  assert.match(error.message, /Standard Images endpoint failed/);
  assert.match(error.message, /Automatic fallback to Chat API is disabled/);
  assert.match(error.message, /Original error: OpenAI image error: 404 unsupported/);
  assert.equal(error.status, 404);
  assert.equal(error.code, "HTTP_404");
  assert.equal(error.requestPath, "/v1/images/generations");
  assert.equal(error.requestBody, '{"prompt":"<omitted:prompt>"}');
  assert.equal(error.responseBody, '{"error":"unsupported endpoint"}');
  assert.equal(error.provider, "openai-compatible");
  assert.equal(error.compatibilityModeHint, "standard");
});

test("OpenAICompatibleAdapter delegates error construction to the helper module", () => {
  const adapterSource = readSource("apps/web/src/services/llm/OpenAICompatibleAdapter.ts");
  assert.equal(
    existsSync(path.join(ROOT_DIR, HELPER_RELATIVE_PATH)),
    true,
    "OpenAI-compatible errors should live in a focused helper module",
  );
  const helperSource = readSource("apps/web/src/services/llm/openAICompatibleErrors.ts");

  assert.match(adapterSource, /buildOpenAICompatibleHttpError/);
  assert.match(adapterSource, /buildOpenAICompatibleImageCompatibilityModeError/);
  assert.doesNotMatch(adapterSource, /private buildHttpError\(/);
  assert.doesNotMatch(adapterSource, /private buildImageCompatibilityModeError\(/);
  assert.match(helperSource, /export function buildOpenAICompatibleHttpError/);
  assert.match(helperSource, /export function buildOpenAICompatibleImageCompatibilityModeError/);
});
