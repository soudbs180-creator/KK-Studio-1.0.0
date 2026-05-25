import { readSource } from '../support/workspacePaths.js';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';

const ROOT_DIR = process.cwd();



test('ecommerce workbench only shows current-version preview when a slot has a current image', () => {
  const workbenchSource = readSource('src/components/layout/prompt-bar/DesktopComposerEcommercePanel.tsx');

  assert.match(workbenchSource, /currentTaskSlot\?\.currentImageId && onPreviewSlotHistory \? \(/);
});

test('ecommerce batch generation warns instead of silently no-oping when no eligible cards remain', () => {
  const runtimeSource = readSource('src/app/useEcommerceRuntime.ts');

  assert.match(runtimeSource, /const queuedCount = enqueueEcommerceFrameworkNodes\(node\.id, targetNodes\);/);
  assert.match(runtimeSource, /if \(queuedCount === 0\) \{/);
  assert.match(runtimeSource, /import \{ pickByDocumentLanguage \} from '\.\.\/utils\/localeText';/);
  assert.match(runtimeSource, /'No eligible cards'/);
  assert.match(runtimeSource, /'There are no ecommerce cards ready to enqueue\.'/);
  assert.doesNotMatch(runtimeSource, /notify\.warning\('No eligible cards'/);
});

test('ecommerce card selection button labels describe the next action instead of the current state', () => {
  const actionSource = readSource('src/components/ecommerce/EcommerceCardActions.tsx');

  assert.match(actionSource, /\{selected \? pick\('[^']+', 'Skip'\) : pick\('[^']+', 'Include'\)\}/);
  assert.doesNotMatch(actionSource, /\{selected \? pick\('[^']+', 'Selected'\) : pick\('[^']+', 'Skipped'\)\}/);
});
