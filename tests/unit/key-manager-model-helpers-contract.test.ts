import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';

const ROOT_DIR = process.cwd();

type KeyManagerModelHelpersModule = {
  MODEL_MIGRATION_MAP: Record<string, string>;
  appendModelVariantLabel: (baseName: string, modelId: string) => string;
  categorizeModels: (models: string[]) => {
    imageModels: string[];
    videoModels: string[];
    chatModels: string[];
    otherModels: string[];
  };
  extractModelIdsFromPricingData: (pricingData: unknown) => string[];
  normalizeModelId: (modelId: string) => string;
  parseModelString: (input: string) => { id: string; name?: string; description?: string; provider?: string };
  parseModelVariantMeta: (modelId: string) => {
    baseId: string;
    canonicalId: string;
    speed?: 'fast' | 'slow';
    quality?: string;
    ratio?: string;
  };
};

function readSource(relativePath: string): string {
  const fullPath = path.join(ROOT_DIR, relativePath);
  return existsSync(fullPath) ? readFileSync(fullPath, 'utf-8') : '';
}

async function loadKeyManagerModelHelpers(): Promise<KeyManagerModelHelpersModule> {
  const fullPath = path.join(ROOT_DIR, 'src/services/auth/keyManagerModelHelpers.ts');
  assert.equal(existsSync(fullPath), true, 'src/services/auth/keyManagerModelHelpers.ts must exist');
  return await import('../../src/services/auth/keyManagerModelHelpers.ts') as KeyManagerModelHelpersModule;
}

test('keyManager model helper boundary lives outside the monolithic key manager', () => {
  const keyManagerSource = readSource('src/services/auth/keyManager.ts');
  const helperSource = readSource('src/services/auth/keyManagerModelHelpers.ts');
  const effectiveSlotSource = readSource('src/services/auth/keyManagerEffectiveSlot.ts');
  const testConfigSource = readSource('tsconfig.tests.json');

  assert.match(testConfigSource, /tests\/unit\/key-manager-model-helpers-contract\.test\.ts/);
  assert.match(keyManagerSource, /from '\.\/keyManagerModelHelpers';/);
  assert.match(keyManagerSource, /import \{[\s\S]*categorizeModels[\s\S]*\} from '\.\/keyManagerModelHelpers';/);
  assert.match(keyManagerSource, /import \{[\s\S]*extractModelIdsFromPricingData[\s\S]*\} from '\.\/keyManagerModelHelpers';/);
  assert.match(keyManagerSource, /export \{[\s\S]*parseModelString[\s\S]*MODEL_MIGRATION_MAP[\s\S]*normalizeModelId[\s\S]*parseModelVariantMeta[\s\S]*appendModelVariantLabel[\s\S]*categorizeModels[\s\S]*\} from '\.\/keyManagerModelHelpers';/);
  assert.match(keyManagerSource, /export type \{[\s\S]*ModelVariantMeta[\s\S]*\} from '\.\/keyManagerModelHelpers';/);
  assert.match(helperSource, /export function parseModelString/);
  assert.match(helperSource, /export const MODEL_MIGRATION_MAP/);
  assert.match(helperSource, /export const DEPRECATED_MODELS/);
  assert.match(helperSource, /export function normalizeModelId/);
  assert.match(helperSource, /export function parseModelVariantMeta/);
  assert.match(helperSource, /export function appendModelVariantLabel/);
  assert.match(helperSource, /export function categorizeModels/);
  assert.match(helperSource, /export function extractModelIdsFromPricingData/);
  assert.doesNotMatch(keyManagerSource, /export function parseModelString/);
  assert.doesNotMatch(keyManagerSource, /export const MODEL_MIGRATION_MAP/);
  assert.doesNotMatch(keyManagerSource, /export function normalizeModelId/);
  assert.doesNotMatch(keyManagerSource, /export function parseModelVariantMeta/);
  assert.doesNotMatch(keyManagerSource, /export function appendModelVariantLabel/);
  assert.doesNotMatch(keyManagerSource, /export function categorizeModels/);
  assert.doesNotMatch(keyManagerSource, /function extractModelIdsFromPricingData/);
  assert.match(effectiveSlotSource, /import \{ parseModelString \} from "\.\/keyManagerModelHelpers";/);
  assert.doesNotMatch(effectiveSlotSource, /import \{ determineKeyType, parseModelString \} from "\.\/keyManager";/);
  assert.doesNotMatch(effectiveSlotSource, /from "\.\/keyManager"/);
});

test('keyManager model helpers preserve parsing, migration, and variant label behavior', async () => {
  const {
    MODEL_MIGRATION_MAP,
    appendModelVariantLabel,
    normalizeModelId,
    parseModelString,
    parseModelVariantMeta,
  } = await loadKeyManagerModelHelpers();

  assert.deepEqual(parseModelString('model-id|Model Name|Provider'), {
    id: 'model-id',
    name: 'Model Name',
    provider: 'Provider',
  });
  assert.deepEqual(parseModelString('Display Name|model-id|Provider'), {
    id: 'model-id',
    name: 'Display Name',
    provider: 'Provider',
  });
  assert.deepEqual(parseModelString('model-id（Model Name / Description）'), {
    id: 'model-id',
    name: 'Model Name',
    description: 'Description',
  });

  assert.equal(MODEL_MIGRATION_MAP['nano-banana-2'], 'gemini-3.1-flash-image-preview');
  assert.equal(normalizeModelId('nano banana pro'), 'gemini-3-pro-image-preview');
  assert.equal(normalizeModelId('gemini-3.1-flash-image-preview-4k'), 'gemini-3.1-flash-image-preview');

  const fastFamilyVariant = parseModelVariantMeta('imagen-4.0-fast-generate-001-4k-16x9');
  assert.equal(fastFamilyVariant.baseId, 'imagen-4.0-fast-generate-001-4k-16x9');
  assert.equal(fastFamilyVariant.canonicalId, 'imagen-4.0-fast-generate-001');
  assert.equal(fastFamilyVariant.speed, undefined);
  assert.equal(fastFamilyVariant.quality, '4k');
  assert.equal(fastFamilyVariant.ratio, '16x9');
  assert.deepEqual(parseModelVariantMeta('imagen-4.0-generate-001-fast-4k-16x9'), {
    baseId: 'imagen-4.0-generate-001-fast-4k-16x9',
    canonicalId: 'imagen-4.0-generate-001-fast',
    speed: 'fast',
    quality: '4k',
    ratio: '16x9',
  });
  assert.equal(appendModelVariantLabel('Imagen 4', 'imagen-4.0-fast-generate-001-4k'), 'Imagen 4 (4K)');
});

test('keyManager model helpers preserve pricing catalog model ID extraction behavior', async () => {
  const { extractModelIdsFromPricingData } = await loadKeyManagerModelHelpers();

  assert.deepEqual(extractModelIdsFromPricingData('not-an-array'), []);
  assert.deepEqual(extractModelIdsFromPricingData([
    { model: 'models/gpt-4.1' },
    { model: ' trimmed-model ' },
    { model: '', modelId: 'models/gpt-4.1-mini' },
    { model: undefined, modelId: '', id: 'custom-id' },
    { model_name: 'legacy_snake' },
    { modelName: 'legacyCamel' },
    { name: 'fallback-name' },
    { model: 'gpt-4.1' },
    { model: 'gpt-4.1-mini' },
    null,
    0,
  ]), [
    'gpt-4.1',
    'trimmed-model',
    'gpt-4.1-mini',
    'custom-id',
    'legacy_snake',
    'legacyCamel',
    'fallback-name',
  ]);
});

test('keyManager model helpers preserve model category heuristics', async () => {
  const { categorizeModels } = await loadKeyManagerModelHelpers();

  assert.deepEqual(categorizeModels([
    'veo-3',
    'RUNWAY-gen',
    'imagen-4',
    'dall-e-3',
    'nano-banana',
    'gemini-2.5-pro',
    'gpt-4o',
    'claude-3',
    'chat-model',
    'embedding-model',
    'video-image-hybrid',
  ]), {
    videoModels: ['veo-3', 'RUNWAY-gen', 'video-image-hybrid'],
    imageModels: ['imagen-4', 'dall-e-3', 'nano-banana'],
    chatModels: ['gemini-2.5-pro', 'gpt-4o', 'claude-3', 'chat-model'],
    otherModels: ['embedding-model'],
  });
});
