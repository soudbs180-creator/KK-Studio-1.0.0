import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';

const ROOT_DIR = process.cwd();

function readSource(relativePath: string): string {
  return readFileSync(path.join(ROOT_DIR, relativePath), 'utf-8');
}

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
