import { readSource } from '../support/workspacePaths.js';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';

const ROOT_DIR = process.cwd();



test('ecommerce task editor uses Clay frosted shells, inputs, and accent chips instead of stale blue literals', () => {
  const source = readSource('src/components/ecommerce/EcommerceTaskEditorPanel.tsx');

  assert.match(source, /var\(--frost-card-framework-bg\)/);
  assert.match(source, /var\(--frost-card-main-bg\)/);
  assert.match(source, /var\(--frost-card-sub-bg\)/);
  assert.match(source, /var\(--frost-input-bg\)/);
  assert.match(source, /var\(--clay-brand-pink\)/);
  assert.match(source, /var\(--clay-brand-peach\)/);
  assert.match(source, /updateReferenceAnchorRole/);
  assert.match(source, /resolveReferenceImageSrc/);
  assert.doesNotMatch(source, /rgba\(59,\s*130,\s*246|rgba\(16,\s*185,\s*129|rgba\(245,\s*158,\s*11|rgba\(15,\s*23,\s*42|rgba\(148,\s*163,\s*184/);
});

test('ecommerce card actions use frosted action surfaces and Clay accent borders for selection and queue control', () => {
  const source = readSource('src/components/ecommerce/EcommerceCardActions.tsx');

  assert.match(source, /var\(--frost-card-sub-bg\)/);
  assert.match(source, /var\(--frost-card-main-bg\)/);
  assert.match(source, /var\(--frost-card-sub-shadow\)/);
  assert.match(source, /var\(--clay-brand-pink\)/);
  assert.match(source, /var\(--clay-brand-peach\)/);
  assert.match(source, /var\(--clay-brand-coral\)/);
  assert.match(source, /resolveTaskQueueItem/);
  assert.match(source, /不满意重生成/);
  assert.match(source, /\(\[1, 2, 4\] as const\)/);
  assert.doesNotMatch(source, /rgba\(59,\s*130,\s*246|rgba\(16,\s*185,\s*129|rgba\(245,\s*158,\s*11|color-mix\(/);
});

test('desktop ecommerce workbench keeps framework, main, and sub surfaces tokenized with token hover states', () => {
  const source = readSource('src/components/layout/prompt-bar/DesktopComposerEcommercePanel.tsx');

  assert.match(source, /var\(--frost-card-framework-bg\)/);
  assert.match(source, /var\(--frost-card-main-bg\)/);
  assert.match(source, /var\(--frost-card-sub-bg\)/);
  assert.match(source, /var\(--frost-card-framework-shadow\)/);
  assert.match(source, /var\(--frost-card-main-shadow\)/);
  assert.match(source, /hover:bg-\[var\(--toolbar-hover\)\]/);
  assert.match(source, /var\(--clay-brand-pink\)/);
  assert.doesNotMatch(source, /rgba\(59,\s*130,\s*246|rgba\(148,\s*163,\s*184|rgba\(15,\s*23,\s*42|hover:bg-white\/5/);
});

test('ecommerce import and review panels use frosted tokens instead of blue-gray literal cards', () => {
  const importSource = readSource('src/components/ecommerce/EcommerceImportPanel.tsx');
  const reviewSource = readSource('src/components/ecommerce/EcommerceAnalysisReviewPanel.tsx');

  assert.match(importSource, /var\(--frost-card-framework-bg\)/);
  assert.match(importSource, /var\(--frost-card-sub-bg\)/);
  assert.match(importSource, /var\(--mobile-clay-active-bg\)/);
  assert.doesNotMatch(importSource, /rgba\(59,\s*130,\s*246|rgba\(14,\s*165,\s*233|rgba\(148,\s*163,\s*184|var\(--bg-tertiary\)/);

  assert.match(reviewSource, /var\(--frost-card-framework-bg\)/);
  assert.match(reviewSource, /var\(--frost-card-sub-bg\)/);
  assert.match(reviewSource, /var\(--mobile-clay-active-bg\)/);
  assert.doesNotMatch(reviewSource, /rgba\(59,\s*130,\s*246|rgba\(16,\s*185,\s*129|rgba\(245,\s*158,\s*11|var\(--bg-tertiary\)|var\(--bg-secondary\)/);
});
