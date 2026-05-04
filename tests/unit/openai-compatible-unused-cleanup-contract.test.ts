import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';

const ROOT_DIR = process.cwd();

function readSource(relativePath: string): string {
  return readFileSync(path.join(ROOT_DIR, relativePath), 'utf-8');
}

test('OpenAI compatible adapter does not retain source-proven unused code', () => {
  const source = readSource('src/services/llm/OpenAICompatibleAdapter.ts');
  const testConfigSource = readSource('tsconfig.tests.json');
  const chatMethodStart = source.indexOf('private async generateImageViaChat(');
  const chatMethodEnd = source.indexOf('private async generateImageViaChatStrict(');
  const chatMethodSource = source.slice(chatMethodStart, chatMethodEnd);

  assert.match(testConfigSource, /tests\/unit\/openai-compatible-unused-cleanup-contract\.test\.ts/);
  assert.ok(chatMethodStart > -1 && chatMethodEnd > chatMethodStart);
  assert.match(source, /generateImageViaChat/);
  assert.match(source, /generateImageStandard_OpenAI_Strict/);
  assert.match(source, /buildImageCompatibilityModeError/);

  assert.doesNotMatch(source, /AudioGenerationOptions/);
  assert.doesNotMatch(source, /AudioGenerationResult/);
  assert.doesNotMatch(source, /ImageSize, AspectRatio, GenerationMode/);
  assert.doesNotMatch(source, /logWarning, addLog, LogLevel/);
  assert.doesNotMatch(source, /GoogleAdapter, convertImageToBase64/);
  assert.doesNotMatch(source, /normalizeApiProtocolFormat/);
  assert.doesNotMatch(source, /private is12AIGateway/);
  assert.doesNotMatch(source, /private static normalizeUrl/);
  assert.doesNotMatch(source, /const configuredFormat = /);
  assert.doesNotMatch(source, /const isLegacyGateway = /);
  assert.doesNotMatch(chatMethodSource, /const requestedImageSize = /);
  assert.doesNotMatch(chatMethodSource, /const aspectRatio = /);
  assert.doesNotMatch(chatMethodSource, /const reportedImageSize = /);
  assert.doesNotMatch(source, /nativeImageSizeStr/);
});
