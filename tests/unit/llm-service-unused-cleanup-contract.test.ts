import { readSource } from '../support/workspacePaths.js';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';

const ROOT_DIR = process.cwd();



test('LLMService does not retain source-proven direct-call dead code', () => {
  const source = readSource('src/services/llm/LLMService.ts');
  const testConfigSource = readSource('tsconfig.tests.json');

  assert.match(testConfigSource, /tests\/unit\/llm-service-unused-cleanup-contract\.test\.ts/);
  assert.match(source, /callLocalUserRouteProxyChat/);
  assert.match(source, /callSecureSystemProxyImage/);
  assert.match(source, /throwBrowserDirectProviderCallBlocked/);

  assert.doesNotMatch(source, /ProviderConfig/);
  assert.doesNotMatch(source, /import \{ LLMAdapter,/);
  assert.doesNotMatch(source, /GeminiNativeAdapter/);
  assert.doesNotMatch(source, /OpenAICompatibleAdapter/);
  assert.doesNotMatch(source, /ClaudeNativeAdapter/);
  assert.doesNotMatch(source, /KeyManager,/);
  assert.doesNotMatch(source, /VideoCompatibleAdapter/);
  assert.doesNotMatch(source, /AudioCompatibleAdapter/);
  assert.doesNotMatch(source, /getAdapterForSlot/);
  assert.doesNotMatch(source, /resolveAdapterKind/);
  assert.doesNotMatch(source, /resolveProviderRuntime/);
  assert.doesNotMatch(source, /videoAdapter/);
  assert.doesNotMatch(source, /audioAdapter/);
  assert.doesNotMatch(source, /resolveSystemBaseModelId/);
  assert.doesNotMatch(source, /runDirectChat/);
  assert.doesNotMatch(source, /runDirectImage/);
  assert.doesNotMatch(source, /runDirectVideo/);
  assert.doesNotMatch(source, /runDirectAudio/);
  assert.doesNotMatch(source, /runDirectTaskStatus/);
  assert.doesNotMatch(source, /runDirectTaskStatuses/);
  assert.match(source, /generateAudio\(options: AudioGenerationOptions, _onTaskId\?:/);
  assert.match(source, /_mode: GenerationMode,/);
  assert.match(source, /_modelId\?: string/);
});

test('geminiService does not retain compiler-proven unused imports and helpers', () => {
  const source = readSource('src/services/llm/geminiService.ts');

  assert.match(source, /import \{ AspectRatio, ImageSize, (?:type )?ModelType, (?:type )?ReferenceImage\s*\} from ['"]\.\.\/\.\.\/types['"];/);
  assert.doesNotMatch(source, /GenerationMode/);
  assert.doesNotMatch(source, /from '\.\.\/auth\/keyManager'/);
  assert.doesNotMatch(source, /from '\.\.\/api\/apiConfig'/);
  assert.doesNotMatch(source, /ProxyModelConfig/);
  assert.doesNotMatch(source, /__fallbackFlagCache/);
  assert.doesNotMatch(source, /getFallbackFlag/);
  assert.doesNotMatch(source, /const isLocalDev =/);
  assert.doesNotMatch(source, /function calculateImageTokens/);
  assert.match(source, /_negativePrompt: string = '',/);
  assert.match(source, /const result = await llmService\.generateImage\(llmOptions\);/);
  assert.match(source, /let cost = result\.usage\?\.cost \|\| 0;/);
});
