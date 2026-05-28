import { readSource } from '../support/workspacePaths.js';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';

const ROOT_DIR = process.cwd();



test('import-only unused cleanup stays limited to type/import lists', () => {
  const lightboxSource = readSource('src/components/image/GlobalLightbox.tsx');
  const imageQualityHookSource = readSource('src/hooks/useImageQuality.ts');
  const modelRegistrySource = readSource('src/services/model/modelRegistry.ts');
  const costServiceSource = readSource('src/services/billing/costService.ts');

  assert.match(lightboxSource, /type RedrawRequest/);
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

  assert.match(costServiceSource, /import \{ ImageSize \} from '\.\.\/\.\.\/types';/);
  assert.doesNotMatch(costServiceSource, /\bModelType\b/);
  assert.doesNotMatch(costServiceSource, /\bgetRefImageTokenEstimate\b/);
  assert.match(costServiceSource, /getModelPricing\(normalizedId\)/);
  assert.match(costServiceSource, /getImageTokenEstimate\(normalizedId, size\)/);
  assert.match(costServiceSource, /export const calculateCost = \(/);
  assert.match(costServiceSource, /export function resolveImageCost/);
});
