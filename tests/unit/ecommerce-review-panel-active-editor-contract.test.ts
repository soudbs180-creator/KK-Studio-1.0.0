import { readSource } from '../support/workspacePaths.js';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';

const ROOT_DIR = process.cwd();



test('pre-confirmation ecommerce review only expands the active task editor', () => {
  const reviewPanelSource = readSource('apps/web/src/components/ecommerce/EcommerceAnalysisReviewPanel.tsx');

  assert.match(
    reviewPanelSource,
    /const shouldShowTaskEditor = Boolean\(\s*taskState && isTaskActive && onTaskStateChange\s*\);/,
  );

  const guardedEditorRenders = reviewPanelSource.match(/\{shouldShowTaskEditor \? \(/g) ?? [];
  assert.equal(
    guardedEditorRenders.length,
    1,
    'expected the shared review-section renderer to guard editor expansion behind the active task',
  );

  assert.doesNotMatch(reviewPanelSource, /\{taskState && onTaskStateChange \? \(/);
});
