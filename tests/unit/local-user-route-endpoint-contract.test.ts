import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { test } from "node:test";

import {
  buildDirectClaudeEndpoint,
  buildDirectOpenAIEndpoint,
  normalizeDirectClaudeBaseUrl,
  normalizeDirectGeminiBaseUrl,
  normalizeDirectOpenAIBaseUrl,
} from "../../apps/api/src/modules/model-proxy/application/local-user-route-endpoints.ts";

const ROOT_DIR = process.cwd();

function readSource(relativePath: string): string {
  return readFileSync(path.join(ROOT_DIR, relativePath), "utf-8");
}

test("local user-route endpoint helper normalizes OpenAI-compatible endpoints", () => {
  assert.equal(normalizeDirectOpenAIBaseUrl(undefined), "https://api.openai.com/v1");
  assert.equal(
    normalizeDirectOpenAIBaseUrl("https://provider.example/v1/chat/completions"),
    "https://provider.example/v1",
  );
  assert.equal(
    normalizeDirectOpenAIBaseUrl("https://provider.example/custom"),
    "https://provider.example/custom/v1",
  );
  assert.equal(
    buildDirectOpenAIEndpoint("https://provider.example/v1/", "/responses"),
    "https://provider.example/v1/responses",
  );
});

test("local user-route endpoint helper normalizes Claude endpoints", () => {
  assert.equal(normalizeDirectClaudeBaseUrl(undefined), "https://api.anthropic.com/v1");
  assert.equal(
    normalizeDirectClaudeBaseUrl("https://claude.example/v1/messages"),
    "https://claude.example/v1",
  );
  assert.equal(
    normalizeDirectClaudeBaseUrl("https://claude.example/custom"),
    "https://claude.example/custom/v1",
  );
  assert.equal(
    buildDirectClaudeEndpoint("https://claude.example/v1/", "/messages"),
    "https://claude.example/v1/messages",
  );
});

test("local user-route endpoint helper normalizes Gemini generateContent bases", () => {
  assert.equal(normalizeDirectGeminiBaseUrl(undefined), "https://generativelanguage.googleapis.com");
  assert.equal(
    normalizeDirectGeminiBaseUrl("https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-pro:generateContent"),
    "https://generativelanguage.googleapis.com",
  );
  assert.equal(
    normalizeDirectGeminiBaseUrl("https://gemini.example/v1beta/models"),
    "https://gemini.example",
  );
  assert.equal(
    normalizeDirectGeminiBaseUrl("https://gemini.example/v1/models/gemini:streamGenerateContent"),
    "https://gemini.example",
  );
});

test("local user-route proxy delegates endpoint normalization to the focused helper module", () => {
  const proxySource = readSource("apps/api/src/modules/model-proxy/application/local-user-route-proxy-service.ts");
  const helperSource = readSource("apps/api/src/modules/model-proxy/application/local-user-route-endpoints.ts");

  assert.match(proxySource, /from "\.\/local-user-route-endpoints\.ts"/);
  assert.doesNotMatch(proxySource, /function normalizeDirectOpenAIBaseUrl\(/);
  assert.doesNotMatch(proxySource, /function normalizeDirectClaudeBaseUrl\(/);
  assert.doesNotMatch(proxySource, /function normalizeDirectGeminiBaseUrl\(/);
  assert.match(helperSource, /export function buildDirectOpenAIEndpoint\(/);
  assert.match(helperSource, /export function buildDirectClaudeEndpoint\(/);
  assert.match(helperSource, /export function normalizeDirectGeminiBaseUrl\(/);
});
