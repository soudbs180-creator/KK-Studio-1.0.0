import { readSource } from '../support/workspacePaths.js';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';

const ROOT_DIR = process.cwd();

type KeyManagerModelListModule = {
  BLACKLIST_MODELS: RegExp[];
  normalizeModelList: (models: string[], provider?: string, baseUrl?: string) => string[];
};



async function loadKeyManagerModelList(): Promise<KeyManagerModelListModule> {
  const fullPath = path.join(ROOT_DIR, 'apps/web/src/services/auth/keyManagerModelList.ts');
  assert.equal(existsSync(fullPath), true, 'apps/web/src/services/auth/keyManagerModelList.ts must exist');
  return await import('../../apps/web/src/services/auth/keyManagerModelList.ts') as KeyManagerModelListModule;
}

test('keyManager model-list normalization lives outside the monolithic key manager', () => {
  const keyManagerSource = readSource('apps/web/src/services/auth/keyManager.ts');
  const modelListSource = readSource('apps/web/src/services/auth/keyManagerModelList.ts');
  const testConfigSource = readSource('tsconfig.tests.json');

  assert.match(testConfigSource, /tests\/unit\/key-manager-model-list-contract\.test\.ts/);
  assert.match(keyManagerSource, /from '\.\/keyManagerModelList(?:\.ts)?';/);
  assert.match(keyManagerSource, /import \{[\s\S]*normalizeModelList[\s\S]*\} from '\.\/keyManagerModelList(?:\.ts)?';/);
  assert.match(keyManagerSource, /export \{[\s\S]*BLACKLIST_MODELS[\s\S]*normalizeModelList[\s\S]*\} from '\.\/keyManagerModelList(?:\.ts)?';/);
  assert.match(modelListSource, /export const BLACKLIST_MODELS = \[/);
  assert.match(modelListSource, /function shouldFilterModel\(modelId: string\): boolean/);
  assert.match(modelListSource, /export function normalizeModelList\(models: string\[], provider\?: string, baseUrl\?: string\): string\[]/);
  assert.match(modelListSource, /GOOGLE_IMAGE_WHITELIST\.includes\(modelId\)/);
  assert.match(modelListSource, /MODEL_MIGRATION_MAP\[raw\]/);
  assert.match(modelListSource, /normalizeModelId\(raw\)/);
  assert.match(modelListSource, /resolveProviderModelCompatibilityIssue\(\{ provider, baseUrl, modelId: id \}\)/);
  assert.doesNotMatch(keyManagerSource, /export const BLACKLIST_MODELS = \[/);
  assert.doesNotMatch(keyManagerSource, /function shouldFilterModel\(modelId: string\): boolean/);
  assert.doesNotMatch(keyManagerSource, /export function normalizeModelList\(models: string\[], provider\?: string, baseUrl\?: string\): string\[]/);
});

test('model-list helper preserves official Google migration, filtering, and dedupe behavior', async () => {
  const { BLACKLIST_MODELS, normalizeModelList } = await loadKeyManagerModelList();

  assert.equal(BLACKLIST_MODELS.some((pattern) => pattern.test('imagen-4.0-generate-preview-06-06')), true);
  assert.deepEqual(
    normalizeModelList([
      ' nano banana pro ',
      'nano-banana-2',
      'gemini-3.1-flash-image-preview',
      'gemini-2.0-flash-exp-image-generation',
      'imagen-4.0-generate-preview-06-06',
      'gemini-3.1-flash-image-preview',
    ], 'Google'),
    [
      'gemini-3-pro-image-preview',
      'gemini-3.1-flash-image-preview',
      'gemini-2.5-flash-image',
    ],
  );
});

test('model-list helper preserves non-official raw aliases and provider compatibility filtering', async () => {
  const { normalizeModelList } = await loadKeyManagerModelList();

  assert.deepEqual(
    normalizeModelList([' nano-banana-2 ', 'gemini-3.1-flash-image-preview'], 'Proxy', 'https://example.test/v1'),
    ['nano-banana-2', 'gemini-3.1-flash-image-preview'],
  );

  assert.deepEqual(
    normalizeModelList([
      'gemini-4-flash-image-preview',
      'gemini-3.1-flash-image-preview',
    ], '12AI', 'https://cdn.12ai.org'),
    ['gemini-3.1-flash-image-preview'],
  );
});
