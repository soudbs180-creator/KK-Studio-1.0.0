import { readSource } from '../support/workspacePaths.js';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';

const ROOT_DIR = process.cwd();



test('ecommerce runtime sync rehydrates built cards when product, extra, or per-item manual reference uploads change', () => {
  const appSource = readSource('apps/web/src/App.tsx');
  const buildRuntimeSource = readSource('apps/web/src/app/useEcommerceBuildRuntime.ts');
  const syncRuntimeSource = readSource('apps/web/src/app/useEcommercePostBuildSyncRuntime.ts');
  const uploadReferenceHookSource = readSource('apps/web/src/app/useEcommerceUploadReferenceRuntime.ts');

  assert.match(appSource, /useEcommerceUploadReferenceRuntime\(\{/);
  assert.match(appSource, /useEcommerceBuildRuntime\(\{/);
  assert.match(appSource, /useEcommercePostBuildSyncRuntime\(\{/);
  assert.match(syncRuntimeSource, /extractEcommerceManualReferenceBindings/);
  assert.match(syncRuntimeSource, /manualReferences(?:: manualReferences)?[,}]/);
  assert.match(syncRuntimeSource, /const manualReferences = extractEcommerceManualReferenceBindings\(taskStateSeed\)/);
  assert.match(
    syncRuntimeSource,
    /const nextReferenceImages = \[\.\.\.rowReferences, \.\.\.manualReferences\.map\(\(reference\) => reference\.referenceImage\), \.\.\.nextProductReferences, \.\.\.nextExtraReferences\]/,
  );
  assert.match(syncRuntimeSource, /referenceImages: nextReferenceImages/);
  assert.match(syncRuntimeSource, /productImageRef: nextProductImageRef/);
  assert.match(buildRuntimeSource, /const taskManualReferences = extractEcommerceManualReferenceBindings\(taskStateSeed\)/);
  assert.match(buildRuntimeSource, /manualReferences: taskManualReferences/);
  assert.match(
    buildRuntimeSource,
    /const referenceImages = \[\.\.\.rowReferences, \.\.\.taskManualReferences\.map\(\(reference\) => reference\.referenceImage\), \.\.\.productReferences, \.\.\.extraReferences\]/,
  );
  assert.match(uploadReferenceHookSource, /productFiles/);
  assert.match(uploadReferenceHookSource, /extraReferenceFiles/);
  assert.match(uploadReferenceHookSource, /MAX_ECOMMERCE_PRODUCT_FILES/);
  assert.match(uploadReferenceHookSource, /MAX_ECOMMERCE_EXTRA_REFERENCE_FILES/);
});
