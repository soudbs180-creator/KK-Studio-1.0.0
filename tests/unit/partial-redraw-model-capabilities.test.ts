import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';

const ROOT_DIR = process.cwd();

function readSource(relativePath: string): string {
  return readFileSync(path.join(ROOT_DIR, relativePath), 'utf-8');
}

test('model capabilities expose partial redraw helpers and strip AUTO from redraw ratios', () => {
  const source = readSource('src/services/model/modelCapabilities.ts');

  assert.match(source, /export function getPartialRedrawSupportedRatios\(\s*modelId: string\s*\): AspectRatio\[\]/);
  assert.match(source, /filter\(\(ratio\) => ratio !== AspectRatio\.AUTO\)/);
  assert.match(source, /export function modelSupportsPartialRedraw\(\s*modelId: string\s*\): boolean/);
  assert.match(source, /const maxRefImages = getMaxRefImages\(modelId\);/);
  assert.match(source, /return concreteRatios\.length > 0 && maxRefImages > 0;/);
});
