import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';

const ROOT_DIR = process.cwd();

function readSource(relativePath: string): string {
  return readFileSync(path.join(ROOT_DIR, relativePath), 'utf-8');
}

test('App wires ecommerce group slot runtime state into preview and canvas surfaces', () => {
  const appSource = readSource('src/App.tsx');
  const promptNodeSource = readSource('src/components/canvas/PromptNodeComponent.tsx');

  assert.match(appSource, /groupSlots/);
  assert.match(appSource, /buildInitialEcommerceGroupSlotState/);
  assert.match(appSource, /applyEcommerceSlotResult/);
  assert.match(appSource, /buildEcommerceSlotPreviewBundle/);
  assert.match(appSource, /handlePreviewEcommerceSlotHistory/);
  assert.match(appSource, /onPreviewEcommerceSlotHistory/);
  assert.match(appSource, /ecommerceSlotState/);
  assert.match(promptNodeSource, /ecommerceSlotState/);
  assert.match(promptNodeSource, /onPreviewEcommerceSlotHistory/);
  assert.match(promptNodeSource, /ecommerce-slot-version-surface/);
});
