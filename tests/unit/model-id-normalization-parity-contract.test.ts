import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';

const ROOT_DIR = process.cwd();

type ModelNormalizationModule = {
  MODEL_MIGRATION_MAP: Record<string, string>;
  normalizeModelId: (modelId: string) => string;
  parseModelVariantMeta: (modelId: string) => {
    baseId: string;
    canonicalId: string;
    speed?: 'fast' | 'slow';
    quality?: string;
    ratio?: string;
  };
};

function readSource(relativePath: string): string {
  return readFileSync(path.join(ROOT_DIR, relativePath), 'utf-8');
}

async function loadCanonicalHelpers(): Promise<ModelNormalizationModule> {
  const fullPath = path.join(ROOT_DIR, 'src/services/auth/keyManagerModelHelpers.ts');
  assert.equal(existsSync(fullPath), true, 'src/services/auth/keyManagerModelHelpers.ts must exist');
  return await import('../../src/services/auth/keyManagerModelHelpers.ts') as ModelNormalizationModule;
}

async function loadCompatibilityFacade(): Promise<ModelNormalizationModule> {
  const fullPath = path.join(ROOT_DIR, 'src/utils/modelIdNormalization.ts');
  assert.equal(existsSync(fullPath), true, 'src/utils/modelIdNormalization.ts must exist');
  return await import('../../src/utils/modelIdNormalization.ts') as ModelNormalizationModule;
}

test('modelIdNormalization stays a thin compatibility facade over keyManager model helpers', () => {
  const facadeSource = readSource('src/utils/modelIdNormalization.ts');
  const helperSource = readSource('src/services/auth/keyManagerModelHelpers.ts');
  const testConfigSource = readSource('tsconfig.tests.json');

  assert.match(testConfigSource, /tests\/unit\/model-id-normalization-parity-contract\.test\.ts/);
  assert.match(facadeSource, /from '\.\.\/services\/auth\/keyManagerModelHelpers(?:\.ts)?';/);
  assert.match(helperSource, /export const MODEL_MIGRATION_MAP/);
  assert.match(helperSource, /export function normalizeModelId/);
  assert.match(helperSource, /export function parseModelVariantMeta/);
  assert.doesNotMatch(facadeSource, /export const MODEL_MIGRATION_MAP/);
  assert.doesNotMatch(facadeSource, /export function normalizeModelId/);
  assert.doesNotMatch(facadeSource, /export function parseModelVariantMeta/);
  assert.doesNotMatch(facadeSource, /export interface ModelVariantMeta/);
});

test('modelIdNormalization exports the canonical migration map and variant parser behavior', async () => {
  const canonical = await loadCanonicalHelpers();
  const facade = await loadCompatibilityFacade();

  assert.equal(facade.MODEL_MIGRATION_MAP, canonical.MODEL_MIGRATION_MAP);
  assert.equal(facade.normalizeModelId, canonical.normalizeModelId);
  assert.equal(facade.parseModelVariantMeta, canonical.parseModelVariantMeta);
  assert.equal(facade.MODEL_MIGRATION_MAP['nano-banana-2'], 'gemini-3.1-flash-image-preview');
  assert.equal(facade.normalizeModelId('nano banana pro'), 'gemini-3-pro-image-preview');
  assert.equal(facade.normalizeModelId('gemini-3.1-flash-image-preview-4k'), 'gemini-3.1-flash-image-preview');
  assert.deepEqual(facade.parseModelVariantMeta('imagen-4.0-generate-001-fast-4k-16x9'), {
    baseId: 'imagen-4.0-generate-001-fast-4k-16x9',
    canonicalId: 'imagen-4.0-generate-001-fast',
    speed: 'fast',
    quality: '4k',
    ratio: '16x9',
  });
});
