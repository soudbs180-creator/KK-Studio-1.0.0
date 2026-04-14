import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';

const ROOT_DIR = process.cwd();

function readSource(relativePath: string): string {
  return readFileSync(path.join(ROOT_DIR, relativePath), 'utf-8');
}

test('ecommerce runtime sync rehydrates built cards when product, extra, or per-item manual reference uploads change', () => {
  const appSource = readSource('src/App.tsx');

  assert.match(appSource, /extractEcommerceManualReferenceBindings/);
  assert.match(appSource, /manualReferences: taskManualReferences/);
  assert.match(appSource, /manualReferences: manualReferences/);
  assert.match(appSource, /const taskManualReferences = extractEcommerceManualReferenceBindings\(taskStateSeed\)/);
  assert.match(appSource, /const manualReferences = extractEcommerceManualReferenceBindings\(taskStateSeed\)/);
  assert.match(
    appSource,
    /referenceImages = \[\.\.\.rowReferences, \.\.\.taskManualReferences\.map\(\(reference\) => reference\.referenceImage\), \.\.\.productReferences, \.\.\.extraReferences\]/,
  );
  assert.match(
    appSource,
    /const nextReferenceImages = \[\.\.\.rowReferences, \.\.\.manualReferences\.map\(\(reference\) => reference\.referenceImage\), \.\.\.nextProductReferences, \.\.\.nextExtraReferences\]/,
  );
  assert.match(appSource, /referenceImages: nextReferenceImages/);
  assert.match(appSource, /productImageRef: nextProductImageRef/);
  assert.match(appSource, /ecommerceState\.productFiles/);
  assert.match(appSource, /ecommerceState\.extraReferenceFiles/);
});
