import { readSource } from '../support/workspacePaths.js';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';

const ROOT_DIR = process.cwd();



test('ecommerce composer scroll surfaces are marked so canvas wheel zoom does not swallow module scrolling', () => {
  const infiniteCanvasSource = readSource('src/components/canvas/InfiniteCanvas.tsx');
  const reviewPanelSource = readSource('src/components/ecommerce/EcommerceAnalysisReviewPanel.tsx');
  const desktopWorkbenchSource = readSource('src/components/layout/prompt-bar/DesktopComposerEcommercePanel.tsx');

  assert.match(infiniteCanvasSource, /closest\('\.input-bar, \.custom-scrollbar, textarea, input'\)/);
  assert.match(reviewPanelSource, /custom-scrollbar/);
  assert.match(desktopWorkbenchSource, /custom-scrollbar/);
});

test('InfiniteCanvas forwards its optional id prop to the canvas container', () => {
  const infiniteCanvasSource = readSource('src/components/canvas/InfiniteCanvas.tsx');

  assert.match(infiniteCanvasSource, /id\?: string;/);
  assert.match(infiniteCanvasSource, /forwardRef<InfiniteCanvasHandle, InfiniteCanvasProps>\(\(\{[\s\S]*\bid,/);
  assert.match(infiniteCanvasSource, /<div[\s\S]*ref=\{containerRef\}[\s\S]*id=\{id\}/);
});
