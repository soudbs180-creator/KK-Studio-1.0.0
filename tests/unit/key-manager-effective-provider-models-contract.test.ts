import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { test } from "node:test";

const ROOT_DIR = process.cwd();

type EffectiveProviderModelsModule = {
  resolveEffectiveProviderModels: (input: {
    provider?: string;
    baseUrl?: string;
    format?: "auto" | "gemini" | "openai" | "google-genai";
    models?: string[];
  }) => string[];
};

function readSource(relativePath: string): string {
  const fullPath = path.join(ROOT_DIR, relativePath);
  return existsSync(fullPath) ? readFileSync(fullPath, "utf-8") : "";
}

async function loadEffectiveProviderModels(): Promise<EffectiveProviderModelsModule> {
  const fullPath = path.join(ROOT_DIR, "src/services/auth/keyManagerEffectiveProviderModels.ts");
  assert.equal(existsSync(fullPath), true, "src/services/auth/keyManagerEffectiveProviderModels.ts must exist");
  return await import("../../apps/web/src/services/auth/keyManagerEffectiveProviderModels.ts") as EffectiveProviderModelsModule;
}

test("keyManager effective provider model boundary lives outside the monolithic key manager", () => {
  const keyManagerSource = readSource("src/services/auth/keyManager.ts");
  const helperSource = readSource("src/services/auth/keyManagerEffectiveProviderModels.ts");
  const testConfigSource = readSource("tsconfig.tests.json");

  assert.match(testConfigSource, /tests\/unit\/key-manager-effective-provider-models-contract\.test\.ts/);
  assert.match(keyManagerSource, /from '\.\/keyManagerEffectiveProviderModels';/);
  assert.match(
    keyManagerSource,
    /export \{[\s\S]*resolveEffectiveProviderModels[\s\S]*\} from '\.\/keyManagerEffectiveProviderModels';/,
  );
  assert.doesNotMatch(keyManagerSource, /export function resolveEffectiveProviderModels/);
  assert.doesNotMatch(keyManagerSource, /function getDefaultOfficialModelsForRuntime/);
  assert.match(helperSource, /function getDefaultOfficialModelsForRuntime/);
  assert.match(helperSource, /export function resolveEffectiveProviderModels/);
  assert.doesNotMatch(helperSource, /from ['"]\.\/keyManager(?:\.ts)?['"]/);
});

test("effective provider model helper preserves official defaults and custom proxy behavior", async () => {
  const { resolveEffectiveProviderModels } = await loadEffectiveProviderModels();

  assert.deepEqual(resolveEffectiveProviderModels({
    provider: "OpenAI",
    baseUrl: "https://api.openai.com",
    models: [],
  }), ["dall-e-3", "dall-e-2", "gpt-4o", "gpt-4o-mini"]);

  const officialGoogleModels = resolveEffectiveProviderModels({
    provider: "Google",
    models: [],
  });
  assert.equal(officialGoogleModels[0], "gemini-3.1-pro-preview");
  assert.ok(officialGoogleModels.includes("gemini-3.1-flash-image-preview"));
  assert.ok(officialGoogleModels.includes("imagen-4.0-fast-generate-001"));

  assert.deepEqual(resolveEffectiveProviderModels({
    provider: "OpenAI",
    baseUrl: "https://proxy.example.test/v1",
    format: "openai",
    models: [],
  }), []);
});
