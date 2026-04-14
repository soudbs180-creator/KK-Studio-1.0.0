import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';

const ROOT_DIR = process.cwd();

function readSource(relativePath: string): string {
  return readFileSync(path.join(ROOT_DIR, relativePath), 'utf-8');
}

test('ecommerce analysis review panel keeps the full task editor scoped to the actively edited item', () => {
  const source = readSource('src/components/ecommerce/EcommerceAnalysisReviewPanel.tsx');
  const scopedEditorGuardMatches =
    source.match(
      /const shouldShowTaskEditor = Boolean\(\s*taskState && isTaskActive && onTaskStateChange\s*\);/g,
    ) ?? [];
  const scopedEditorRenderMatches = source.match(/\{shouldShowTaskEditor \? \(/g) ?? [];

  assert.equal(scopedEditorGuardMatches.length, 1);
  assert.equal(scopedEditorRenderMatches.length, 1);
  assert.doesNotMatch(source, /taskState && onTaskStateChange \? \(/);
  assert.doesNotMatch(source, /compact=\{!isTaskActive\}/);
});

test('ecommerce analysis review panel exposes active detail prompt, reference galleries, and per-item manual upload controls', () => {
  const source = readSource('src/components/ecommerce/EcommerceAnalysisReviewPanel.tsx');

  assert.match(source, /extractEcommerceManualReferenceBindings/);
  assert.match(source, /data-testid="ecommerce-review-active-detail"/);
  assert.match(source, /data-testid="ecommerce-review-reference-gallery"/);
  assert.match(source, /data-testid="ecommerce-review-reference-upload"/);
  assert.match(source, /data-testid="ecommerce-review-manual-reference-remove"/);
  assert.match(source, /accept="image\/\*"/);
  assert.match(source, /activeTaskState\?\.resolvedPromptPreview \|\| activeReviewItem\.promptDraft/);
  assert.match(source, /onTaskStateChange=\{\(taskId, updater\) => onTaskStateChange\(activeTaskState\.taskId === taskId \? taskId : activeTaskState\.taskId, updater\)\}/);
});
