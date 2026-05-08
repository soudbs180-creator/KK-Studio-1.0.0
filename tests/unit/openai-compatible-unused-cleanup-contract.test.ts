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

test('OpenAI compatible adapter does not retain unreachable commented legacy delegates', () => {
  const source = readSource('src/services/llm/OpenAICompatibleAdapter.ts');
  const chatStart = source.indexOf('async chat(options: ChatOptions, keySlot: KeySlot): Promise<string>');
  const chatStreamStart = source.indexOf('async chatStream(options: ChatOptions, keySlot: KeySlot): Promise<void>');
  const generateImageStart = source.indexOf('async generateImage(options: ImageGenerationOptions, keySlot: KeySlot)');
  const strictStart = source.indexOf('private async generateImageStandard_OpenAI_Strict(');
  const siliconFlowStart = source.indexOf('private async generateImageStandard_SiliconFlow(');

  assert.ok(chatStart > -1);
  assert.ok(chatStreamStart > chatStart);
  assert.ok(generateImageStart > chatStreamStart);
  assert.ok(strictStart > generateImageStart);
  assert.ok(siliconFlowStart > strictStart);

  const chatSource = source.slice(chatStart, chatStreamStart);
  const chatStreamSource = source.slice(chatStreamStart, generateImageStart);
  const strictSource = source.slice(strictStart, siliconFlowStart);

  assert.match(chatSource, /return this\.chatWithCompatibleResponses\(options, keySlot\);/);
  assert.match(chatStreamSource, /return this\.chatStreamWithCompatibleResponses\(options, keySlot\);/);
  assert.match(strictSource, /return this\.generateImageStandard_OpenAI_Strict_DocSafe\(options, keySlot\);/);

  assert.doesNotMatch(chatSource, /\/\*|\/chat\/completions|await fetch\(/);
  assert.doesNotMatch(chatStreamSource, /\/\*|response\.body\.getReader|TextDecoder/);
  assert.doesNotMatch(strictSource, /\/\*|const is12AIChannel =|官方 OpenAI 编辑端点待完整对接支持/);
});
