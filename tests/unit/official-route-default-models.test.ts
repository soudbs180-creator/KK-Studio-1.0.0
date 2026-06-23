import { readSource } from '../support/workspacePaths.js';
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { test } from "node:test";

const ROOT_DIR = process.cwd();



test("keyManager keeps built-in defaults for official Google routes when saved models are empty", () => {
  const source = readSource("apps/web/src/services/auth/keyManager.ts");
  const effectiveModelsSource = readSource("apps/web/src/services/auth/keyManagerEffectiveProviderModels.ts");
  const defaultsSource = readSource("apps/web/src/services/auth/keyManagerDefaultModels.ts");

  assert.match(source, /from '\.\/keyManagerEffectiveProviderModels(?:\.ts)?';/);
  assert.match(defaultsSource, /export const DEFAULT_GOOGLE_MODELS = \[/);
  assert.match(
    effectiveModelsSource,
    /const builtInOfficialModels = getDefaultOfficialModelsForRuntime\(runtime\);\s*if \(builtInOfficialModels\.length > 0\) \{\s*return normalizeModelList\(builtInOfficialModels, runtime\.uiProvider \|\| input\.provider, input\.baseUrl\);\s*\}/,
  );
});

test("keyManager keeps built-in defaults for official OpenAI routes when saved models are empty", () => {
  const effectiveModelsSource = readSource("apps/web/src/services/auth/keyManagerEffectiveProviderModels.ts");
  const defaultsSource = readSource("apps/web/src/services/auth/keyManagerDefaultModels.ts");

  assert.match(defaultsSource, /export const DEFAULT_OPENAI_MODELS = \['dall-e-3', 'dall-e-2', 'gpt-4o', 'gpt-4o-mini'\];/);
  assert.match(
    effectiveModelsSource,
    /runtime\.strategyId === 'openai' && \(!runtime\.baseUrl \|\| runtime\.host === (?:'api\.openai\.com'|\('api\.open' \+ 'ai\.com'\))\)[\s\S]*return DEFAULT_OPENAI_MODELS;/,
  );
});

test("keyManager does not treat custom OpenAI-compatible proxy URLs as official default-model routes", () => {
  const effectiveModelsSource = readSource("apps/web/src/services/auth/keyManagerEffectiveProviderModels.ts");

  assert.match(effectiveModelsSource, /runtime\.host === (?:'api\.openai\.com'|\('api\.open' \+ 'ai\.com'\))/);
  assert.doesNotMatch(
    effectiveModelsSource,
    /runtime\.strategyId === 'openai'\) \{\s*return DEFAULT_OPENAI_MODELS;/,
  );
});

test("ApiSettingsView no longer tells official routes to fetch models before they are usable", () => {
  const source = readSource("apps/web/src/components/settings/ApiSettingsView.tsx");

  assert.match(source, /const effectiveModels = resolveEffectiveProviderModels\(/);
  assert.match(source, /modelCountLabel: String\(effectiveModels\.length \|\| slot\.supportedModels\?\.length \|\| 0\)/);
  assert.doesNotMatch(source, /helper: slot\.supportedModels\.length > 0 \? pick\('已自动识别模型列表', 'Auto detected models list'\) : pick\('点击刷新后自动拉取', 'Refresh to fetch models'\)/);
});

test("slot channel configs keep the official OpenAI base URL when a saved slot omits baseUrl", () => {
  const source = readSource("apps/web/src/services/auth/keyManager.ts");

  assert.match(source, /const slotBaseUrl = slot\.baseUrl\s*\|\|\s*\(slot\.provider === 'OpenAI' \? (?:'https:\/\/api\.openai\.com'|\('https:\/\/api\.open' \+ 'ai\.com'\)) : GOOGLE_API_BASE\);/);
  assert.match(source, /baseUrl: slotBaseUrl,/);
});
