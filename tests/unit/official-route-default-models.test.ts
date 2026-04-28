import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { test } from "node:test";

const ROOT_DIR = process.cwd();

function readSource(relativePath: string): string {
  return readFileSync(path.join(ROOT_DIR, relativePath), "utf-8");
}

test("keyManager keeps built-in defaults for official Google routes when saved models are empty", () => {
  const source = readSource("src/services/auth/keyManager.ts");

  assert.match(source, /export const DEFAULT_GOOGLE_MODELS = \[/);
  assert.match(
    source,
    /const builtInOfficialModels = getDefaultOfficialModelsForRuntime\(runtime\);\s*if \(builtInOfficialModels\.length > 0\) \{\s*return normalizeModelList\(builtInOfficialModels, runtime\.uiProvider \|\| input\.provider, input\.baseUrl\);\s*\}/,
  );
});

test("keyManager keeps built-in defaults for official OpenAI routes when saved models are empty", () => {
  const source = readSource("src/services/auth/keyManager.ts");

  assert.match(source, /const DEFAULT_OPENAI_MODELS = \['dall-e-3', 'dall-e-2', 'gpt-4o', 'gpt-4o-mini'\];/);
  assert.match(
    source,
    /runtime\.strategyId === 'openai'[\s\S]*return DEFAULT_OPENAI_MODELS;/,
  );
});

test("ApiSettingsView no longer tells official routes to fetch models before they are usable", () => {
  const source = readSource("src/components/settings/ApiSettingsView.tsx");

  assert.match(source, /const effectiveOfficialModels = resolveEffectiveProviderModels\(/);
  assert.match(source, /helper: effectiveOfficialModels\.length > 0\s*\? pick\('官方默认模型已内置', 'Built-in default models are ready'\)/);
  assert.doesNotMatch(source, /helper: slot\.supportedModels\.length > 0 \? pick\('已自动识别模型列表', 'Auto detected models list'\) : pick\('点击刷新后自动拉取', 'Refresh to fetch models'\)/);
});

test("slot channel configs keep the official OpenAI base URL when a saved slot omits baseUrl", () => {
  const source = readSource("src/services/auth/keyManager.ts");

  assert.match(source, /const slotBaseUrl = slot\.baseUrl\s*\|\|\s*\(slot\.provider === 'OpenAI' \? 'https:\/\/api\.openai\.com' : GOOGLE_API_BASE\);/);
  assert.match(source, /baseUrl: slotBaseUrl,/);
});
