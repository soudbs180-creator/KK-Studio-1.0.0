import { readSource } from '../support/workspacePaths.js';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';

const ROOT_DIR = process.cwd();



test('app wires main-image and A+ export entrypoints through the ecommerce group export runtime', () => {
  const appSource = readSource('src/App.tsx');
  const hookSource = readSource('src/app/useEcommerceGroupExportRuntime.ts');
  const promptNodeSource = readSource('src/components/canvas/PromptNodeComponent.tsx');

  assert.match(hookSource, /buildEcommerceGroupExportManifest/);
  assert.match(appSource, /useEcommerceGroupExportRuntime/);
  assert.match(appSource, /handleExportEcommerceGroup/);
  assert.match(promptNodeSource, /打包主图/);
  assert.match(promptNodeSource, /打包A\+/);
  assert.match(hookSource, /主图包/);
  assert.match(hookSource, /A\+包/);
  assert.doesNotMatch(appSource, /buildEcommerceGroupExportManifest/);
});
