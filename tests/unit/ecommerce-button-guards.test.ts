import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';

const ROOT_DIR = process.cwd();

function readSource(relativePath: string): string {
  return readFileSync(path.join(ROOT_DIR, relativePath), 'utf-8');
}

test('ecommerce workbench only shows current-version preview when a slot has a current image', () => {
  const workbenchSource = readSource('src/components/layout/prompt-bar/DesktopComposerEcommercePanel.tsx');

  assert.match(workbenchSource, /currentTaskSlot\?\.currentImageId && onPreviewSlotHistory \? \(/);
});

test('ecommerce batch generation warns instead of silently no-oping when no eligible cards remain', () => {
  const appSource = readSource('src/App.tsx');

  assert.match(appSource, /const queuedCount = enqueueEcommerceFrameworkNodes\(node\.id, targetNodes\);/);
  assert.match(appSource, /if \(queuedCount === 0\) \{/);
  assert.match(appSource, /notify\.warning\('No eligible cards', 'There are no ecommerce cards ready to enqueue\.'\);/);
});

test('ecommerce card selection button labels describe the next action instead of the current state', () => {
  const actionSource = readSource('src/components/ecommerce/EcommerceCardActions.tsx');

  assert.match(actionSource, /\{selected \? 'Skip' : 'Include'\}/);
  assert.doesNotMatch(actionSource, /\{selected \? 'Selected' : 'Skipped'\}/);
});
