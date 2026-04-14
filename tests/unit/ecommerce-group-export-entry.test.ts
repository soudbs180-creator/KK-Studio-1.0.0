import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';

const ROOT_DIR = process.cwd();

function readSource(relativePath: string): string {
  return readFileSync(path.join(ROOT_DIR, relativePath), 'utf-8');
}

test('app wires main-image and A+ export entrypoints through the ecommerce group export manifest helper', () => {
  const appSource = readSource('src/App.tsx');
  const promptNodeSource = readSource('src/components/canvas/PromptNodeComponent.tsx');

  assert.match(appSource, /buildEcommerceGroupExportManifest/);
  assert.match(appSource, /handleExportEcommerceGroup/);
  assert.match(promptNodeSource, /打包主图/);
  assert.match(promptNodeSource, /打包A\+/);
  assert.match(appSource, /主图包/);
  assert.match(appSource, /A\+包/);
});
