import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';

const ROOT_DIR = process.cwd();

function readSource(relativePath: string): string {
  return readFileSync(path.join(ROOT_DIR, relativePath), 'utf-8');
}

test('import-only unused cleanup stays limited to type/import lists', () => {
  const lightboxSource = readSource('src/components/image/GlobalLightbox.tsx');
  const imageQualityHookSource = readSource('src/hooks/useImageQuality.ts');
  const modelRegistrySource = readSource('src/services/model/modelRegistry.ts');

  assert.match(lightboxSource, /type PartialRedrawRequest/);
  assert.doesNotMatch(lightboxSource, /type NormalizedRect/);
  assert.match(lightboxSource, /export const GlobalLightbox/);

  assert.match(imageQualityHookSource, /import \{ getAppropriateQuality \} from '\.\.\/services\/image\/imageQuality';/);
  assert.doesNotMatch(imageQualityHookSource, /import \{ ImageQuality,/);
  assert.match(imageQualityHookSource, /export function useImageQuality/);

  assert.match(modelRegistrySource, /import type \{ Provider \} from '\.\.\/\.\.\/types';/);
  assert.doesNotMatch(modelRegistrySource, /\bModelType\b/);
  assert.doesNotMatch(modelRegistrySource, /\bImageSize\b/);
  assert.match(modelRegistrySource, /export const MODEL_REGISTRY/);
  assert.match(modelRegistrySource, /export interface ActiveModel/);
});
