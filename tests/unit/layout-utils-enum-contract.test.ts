import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';

const ROOT_DIR = process.cwd();

function readSource(relativePath: string): string {
  return readFileSync(path.join(ROOT_DIR, relativePath), 'utf-8');
}

test('generated image layout reuses shared enum members for aspect and mode defaults', () => {
  const source = readSource('src/utils/generatedImageLayout.ts');

  assert.match(source, /import type \{ AspectRatio, GenerationMode \} from '\.\.\/types\.ts';/);
  assert.match(source, /const coerceAspectRatio = \(value: string\): AspectRatio => value as unknown as AspectRatio;/);
  assert.match(source, /const coerceGenerationMode = \(value: string\): GenerationMode => value as unknown as GenerationMode;/);
  assert.match(source, /const ASPECT_RATIO_AUTO = coerceAspectRatio\('auto'\);/);
  assert.match(source, /const GENERATION_MODE_PPT = coerceGenerationMode\('ppt'\);/);
});

test('style utils derive layout ratio constants from the shared AspectRatio enum', () => {
  const source = readSource('src/utils/styleUtils.ts');

  assert.match(source, /import type \{ AspectRatio \} from '\.\.\/types\.ts';/);
  assert.match(source, /const coerceAspectRatio = \(value: string\): AspectRatio => value as unknown as AspectRatio;/);
  assert.match(source, /AUTO: coerceAspectRatio\('auto'\),/);
  assert.match(source, /SQUARE: coerceAspectRatio\('1:1'\),/);
  assert.match(source, /LANDSCAPE_16_9: coerceAspectRatio\('16:9'\),/);
  assert.match(source, /PORTRAIT_9_16: coerceAspectRatio\('9:16'\),/);
});
