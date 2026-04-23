import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';

const ROOT_DIR = process.cwd();

function readSource(relativePath: string): string {
  return readFileSync(path.join(ROOT_DIR, relativePath), 'utf-8');
}

test('ecommerce prompt cards overlay per-item figure labels on reference thumbnails', () => {
  const source = readSource('src/components/canvas/PromptNodeComponent.tsx');

  assert.match(source, /const getEcommerceAssetPreviewLabel =/);
  assert.match(source, /label\?: string,/);
  assert.match(source, /label=\{getEcommerceAssetPreviewLabel\(node\.ecommerce\?\.editableTask\?\.assetRoles\?\.\[idx\]\)\}/);
});
