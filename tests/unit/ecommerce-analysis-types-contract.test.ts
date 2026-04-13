import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';

const ROOT_DIR = process.cwd();

function readSource(relativePath: string): string {
  return readFileSync(path.join(ROOT_DIR, relativePath), 'utf-8');
}

test('ecommerce analysis types share the canonical size policy and the normalizer assigns policy outputs directly', () => {
  const typesSource = readSource('src/services/ecommerce/types.ts');
  const normalizerSource = readSource('src/services/ecommerce/normalize/ecommerceAnalysisNormalizer.ts');

  assert.match(typesSource, /import type \{ EcommerceSizePolicy \} from '\.\.\/\.\.\/types';/);
  assert.match(typesSource, /export type EcommerceAnalysisSizePolicy = EcommerceSizePolicy;/);
  assert.match(typesSource, /export interface EcommerceAnalysisMainImageItem[\s\S]*sizePolicy: EcommerceAnalysisSizePolicy;/);
  assert.match(typesSource, /export interface EcommerceAnalysisAPlusModule[\s\S]*sizePolicy: EcommerceAnalysisSizePolicy;/);
  assert.match(normalizerSource, /const policy = resolveEcommerceAspectPolicy\(\{ kind: 'main-image', modelId \}\);/);
  assert.match(normalizerSource, /sizePolicy: policy\.sizePolicy,/);
  assert.match(normalizerSource, /kind: 'a-plus-module'/);
});
