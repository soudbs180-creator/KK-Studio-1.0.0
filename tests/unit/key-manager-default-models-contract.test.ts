import { readSource } from '../support/workspacePaths.js';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';

const ROOT_DIR = process.cwd();



async function loadDefaultModels(): Promise<{
  GOOGLE_IMAGE_WHITELIST: string[];
  VIDEO_MODEL_WHITELIST: string[];
  ADVANCED_IMAGE_MODEL_WHITELIST: string[];
  AUDIO_MODEL_WHITELIST: string[];
  DEFAULT_GOOGLE_MODELS: string[];
  DEFAULT_OPENAI_MODELS: string[];
}> {
  const fullPath = path.join(ROOT_DIR, 'apps/web/src/services/auth/keyManagerDefaultModels.ts');
  assert.equal(existsSync(fullPath), true, 'apps/web/src/services/auth/keyManagerDefaultModels.ts must exist');
  return await import('../../apps/web/src/services/auth/keyManagerDefaultModels.ts') as Awaited<ReturnType<typeof loadDefaultModels>>;
}

test('keyManager default model constants live outside the monolithic key manager', () => {
  const keyManagerSource = readSource('apps/web/src/services/auth/keyManager.ts');
  const helperSource = readSource('apps/web/src/services/auth/keyManagerDefaultModels.ts');
  const testConfigSource = readSource('tsconfig.tests.json');

  assert.match(testConfigSource, /tests\/unit\/key-manager-default-models-contract\.test\.ts/);
  assert.match(keyManagerSource, /from '\.\/keyManagerDefaultModels(?:\.ts)?';/);
  assert.match(keyManagerSource, /export \{[\s\S]*DEFAULT_GOOGLE_MODELS[\s\S]*GOOGLE_IMAGE_WHITELIST[\s\S]*\} from '\.\/keyManagerDefaultModels(?:\.ts)?';/);
  assert.doesNotMatch(keyManagerSource, /export const GOOGLE_IMAGE_WHITELIST = \[/);
  assert.doesNotMatch(keyManagerSource, /export const DEFAULT_GOOGLE_MODELS = \[/);
  assert.doesNotMatch(keyManagerSource, /const DEFAULT_OPENAI_MODELS = \[/);
  assert.match(helperSource, /export const GOOGLE_IMAGE_WHITELIST = \[/);
  assert.match(helperSource, /export const DEFAULT_GOOGLE_MODELS = \[/);
  assert.match(helperSource, /export const DEFAULT_OPENAI_MODELS = \[/);
  assert.doesNotMatch(helperSource, /from ['"]\.\/keyManager(?:['"]|\.ts['"])/);
  assert.doesNotMatch(helperSource, /fetch\(|localStorage|providerPersistence|cloudSync|keyStorage|resolveProviderRuntime/);
});

test('keyManager default model constants preserve whitelist and default model behavior', async () => {
  const {
    GOOGLE_IMAGE_WHITELIST,
    VIDEO_MODEL_WHITELIST,
    ADVANCED_IMAGE_MODEL_WHITELIST,
    AUDIO_MODEL_WHITELIST,
    DEFAULT_GOOGLE_MODELS,
    DEFAULT_OPENAI_MODELS,
  } = await loadDefaultModels();

  assert.deepEqual(GOOGLE_IMAGE_WHITELIST, [
    'gemini-2.5-flash-image',
    'gemini-3-pro-image-preview',
    'gemini-3.1-flash-image-preview',
    'imagen-4.0-generate-001',
    'imagen-4.0-ultra-generate-001',
    'imagen-4.0-fast-generate-001',
  ]);
  assert.deepEqual(VIDEO_MODEL_WHITELIST, [
    'runway-gen3',
    'luma-video',
    'kling-v1',
    'sv3d',
    'vidu',
    'minimax-video',
    'wan-v1',
  ]);
  assert.deepEqual(ADVANCED_IMAGE_MODEL_WHITELIST, ['flux-kontext-max', 'recraft-v3-svg', 'ideogram-v2']);
  assert.deepEqual(AUDIO_MODEL_WHITELIST, ['suno-v3.5', 'minimax-t2a-01']);
  assert.equal(DEFAULT_GOOGLE_MODELS.includes('gemini-3.1-pro-preview'), true);
  assert.equal(DEFAULT_GOOGLE_MODELS.includes('veo-3.1-fast-generate-preview'), true);
  for (const imageModel of GOOGLE_IMAGE_WHITELIST) {
    assert.equal(DEFAULT_GOOGLE_MODELS.includes(imageModel), true);
  }
  assert.deepEqual(DEFAULT_OPENAI_MODELS, ['dall-e-3', 'dall-e-2', 'gpt-4o', 'gpt-4o-mini']);
});
