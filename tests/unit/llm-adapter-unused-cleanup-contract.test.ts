import { readSource } from '../support/workspacePaths.js';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';

const ROOT_DIR = process.cwd();



test('small LLM adapters do not retain compiler-proven unused locals', () => {
  const audioAdapterSource = readSource('src/services/llm/AudioCompatibleAdapter.ts');
  const volcengineAdapterSource = readSource('src/services/llm/VolcengineAdapter.ts');
  const testConfigSource = readSource('tsconfig.tests.json');

  assert.match(testConfigSource, /tests\/unit\/llm-adapter-unused-cleanup-contract\.test\.ts/);
  assert.doesNotMatch(audioAdapterSource, /getAudioCapability/);
  assert.doesNotMatch(audioAdapterSource, /isAudioModel/);
  assert.doesNotMatch(audioAdapterSource, /const audioCaps =/);
  assert.match(audioAdapterSource, /const maxDuration = getMaxAudioDuration\(options\.modelId\);/);

  assert.match(volcengineAdapterSource, /supports\(_modelId: string\): boolean/);
  assert.doesNotMatch(volcengineAdapterSource, /supports\(modelId: string\): boolean/);
});

test('GoogleAdapter does not retain import-only compiler-proven unused symbols', () => {
  const googleAdapterSource = readSource('src/services/llm/GoogleAdapter.ts');
  const llmAdapterImport = googleAdapterSource.match(/^import \{[^;]+\} from '\.\/LLMAdapter';/m)?.[0] ?? '';
  const loggerImport = googleAdapterSource.match(/^import \{[^;]+\} from '\.\.\/system\/systemLogService';/m)?.[0] ?? '';

  assert.doesNotMatch(llmAdapterImport, /\bProviderConfig\b/);
  assert.doesNotMatch(llmAdapterImport, /\bVideoGenerationOptions\b/);
  assert.doesNotMatch(llmAdapterImport, /\bVideoGenerationResult\b/);
  assert.equal(loggerImport, "import { logError } from '../system/systemLogService';");
  assert.match(googleAdapterSource, /async generateVideo\(options: import\('\.\/LLMAdapter'\)\.VideoGenerationOptions, keySlot: KeySlot\): Promise<import\('\.\/LLMAdapter'\)\.VideoGenerationResult>/);
});
