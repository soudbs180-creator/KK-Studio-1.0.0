import { readSource } from '../support/workspacePaths.js';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';

const ROOT_DIR = process.cwd();



test('ecommerce review scrolling stays isolated while the composer shell remains single-page', () => {
  const infiniteCanvasSource = readSource('apps/web/src/components/canvas/InfiniteCanvas.tsx');
  const reviewPanelSource = readSource('apps/web/src/components/ecommerce/EcommerceAnalysisReviewPanel.tsx');
  const desktopWorkbenchSource = readSource('apps/web/src/components/layout/prompt-bar/DesktopComposerEcommercePanel.tsx');

  assert.match(infiniteCanvasSource, /closest\('\.input-bar, \.custom-scrollbar, textarea, input'\)/);
  assert.match(reviewPanelSource, /className="min-w-0 pr-1"/);
  assert.doesNotMatch(reviewPanelSource, /kk-ecommerce-review-panel custom-scrollbar/);
  assert.match(desktopWorkbenchSource, /kk-ecommerce-composer-panel[^\n]*overflow-visible/);
  assert.doesNotMatch(desktopWorkbenchSource, /kk-ecommerce-composer-panel[^\n]*(?:overflow-y-auto|custom-scrollbar)/);
});

test('InfiniteCanvas forwards its optional id prop to the canvas container', () => {
  const infiniteCanvasSource = readSource('apps/web/src/components/canvas/InfiniteCanvas.tsx');

  assert.match(infiniteCanvasSource, /id\?: string;/);
  assert.match(infiniteCanvasSource, /forwardRef<InfiniteCanvasHandle, InfiniteCanvasProps>\(\(\{[\s\S]*\bid,/);
  assert.match(infiniteCanvasSource, /<div[\s\S]*ref=\{containerRef\}[\s\S]*id=\{id\}/);
});
