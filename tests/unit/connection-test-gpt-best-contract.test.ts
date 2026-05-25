import { readSource } from '../support/workspacePaths.js';
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { test } from "node:test";

const ROOT_DIR = process.cwd();



test("testModelsList derives GPT Best model-list requests from provider runtime auth", () => {
  const connectionSource = readSource("src/services/api/connectionTest.ts");
  const strategySource = readSource("src/services/api/providerStrategy.ts");

  assert.match(
    strategySource,
    /if \(strategy\.id === 'gpt-best'\) \{\s*authMethod = 'header';\s*\}/,
  );
  assert.match(
    connectionSource,
    /const usesOpenAIStyleModelList = runtime\.providerFamily === 'newapi-family';/,
  );
  assert.match(
    connectionSource,
    /const listBase = !nativeGemini && !nativeClaude[\s\S]*?resolveOfficialCompatibleBaseUrl\(runtime, cleanBase, 'models'\)/,
  );
  assert.match(
    connectionSource,
    /buildProxyHeaders\(runtime\.authMethod as AuthMethod, resolved\.apiKey, runtime\.headerName, undefined, runtime\.authorizationValueFormat\)/,
  );
});

test("GPT Best connection tests do not fall back to official API bases", () => {
  const connectionSource = readSource("src/services/api/connectionTest.ts");

  assert.match(
    connectionSource,
    /function resolveOfficialCompatibleBaseUrl\(runtime: ReturnType<typeof resolveConnectionRuntime>, cleanBase: string, surface: 'chat' \| 'models'\): string/,
  );
  assert.match(
    connectionSource,
    /runtime\.strategyId !== 'openai'[\s\S]*?throw new Error\(`\$\{runtime\.strategy\.label \|\| runtime\.strategyId\} \$\{surfaceLabel\} test requires a Base URL/,
  );
  assert.match(
    connectionSource,
    /const base = resolveOfficialCompatibleBaseUrl\(runtime, cleanBase, 'chat'\);/,
  );
  assert.match(
    connectionSource,
    /const listBase = !nativeGemini && !nativeClaude[\s\S]*?resolveOfficialCompatibleBaseUrl\(runtime, cleanBase, 'models'\)/,
  );
  assert.match(
    connectionSource,
    /function assertNativeProtocolBaseUrl[\s\S]*?runtime\.providerFamily === 'google-official'[\s\S]*?runtime\.strategyId === 'anthropic'[\s\S]*?!allowOfficialDefault && !normalizedBase/,
  );
  assert.doesNotMatch(
    connectionSource,
    /buildOpenAIEndpoint\(cleanBase \|\| 'https:\/\/api\.openai\.com', '\/models'\)/,
  );
});
