import { readSource } from '../support/workspacePaths.js';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';

const ROOT_DIR = process.cwd();



test('ecommerce analysis review panel keeps the full task editor scoped to the actively edited item', () => {
  const source = readSource('apps/web/src/components/ecommerce/EcommerceAnalysisReviewPanel.tsx');
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
  const source = readSource('apps/web/src/components/ecommerce/EcommerceAnalysisReviewPanel.tsx');
  const taskEditorSource = readSource('apps/web/src/components/ecommerce/EcommerceTaskEditorPanel.tsx');

  assert.match(source, /extractEcommerceManualReferenceBindings/);
  assert.match(source, /data-testid="ecommerce-review-active-detail"/);
  assert.match(source, /data-testid="ecommerce-review-reference-gallery"/);
  assert.match(source, /data-testid="ecommerce-review-reference-upload"/);
  assert.match(source, /data-testid="ecommerce-review-manual-reference-remove"/);
  assert.match(source, /accept="image\/\*"/);
  assert.match(source, /activeTaskState\?\.promptOverride \|\| activeTaskState\?\.resolvedPromptPreview \|\| activeReviewItem\.promptDraft/);
  assert.match(source, /识别档位|sizeTier/);
  assert.match(source, /实际采用档位|effectiveSizeTier/);
  assert.match(source, /onTaskStateChange=\{\(taskId, updater\) => onTaskStateChange\(activeTaskState\.taskId === taskId \? taskId : activeTaskState\.taskId, updater\)\}/);
  assert.match(taskEditorSource, /提示词改写|实际提示词/);
  assert.match(taskEditorSource, /promptOverride/);
});

test('ecommerce analysis review panel keeps global product uploads visible and disables confirm while building cards', () => {
  const source = readSource('apps/web/src/components/ecommerce/EcommerceAnalysisReviewPanel.tsx');

  assert.match(source, /globalProductFiles\?: File\[];/);
  assert.match(source, /globalExtraReferenceFiles\?: File\[];/);
  assert.match(source, /isConfirming\?: boolean;/);
  assert.match(source, /renderUploadGallery\(\s*'全局产品图'/);
  assert.match(source, /renderUploadGallery\(\s*'全局补充参考图'/);
  assert.match(source, /disabled=\{isConfirming\}/);
  assert.match(source, /isConfirming \? '建卡中…' : '确认并建卡'/);
});
