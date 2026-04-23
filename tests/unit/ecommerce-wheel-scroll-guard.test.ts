import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';

const ROOT_DIR = process.cwd();

function readSource(relativePath: string): string {
  return readFileSync(path.join(ROOT_DIR, relativePath), 'utf-8');
}

test('ecommerce composer scroll surfaces are marked so canvas wheel zoom does not swallow module scrolling', () => {
  const infiniteCanvasSource = readSource('src/components/canvas/InfiniteCanvas.tsx');
  const reviewPanelSource = readSource('src/components/ecommerce/EcommerceAnalysisReviewPanel.tsx');
  const desktopWorkbenchSource = readSource('src/components/layout/prompt-bar/DesktopComposerEcommercePanel.tsx');

  assert.match(infiniteCanvasSource, /closest\('\.input-bar, \.custom-scrollbar, textarea, input'\)/);
  assert.match(reviewPanelSource, /custom-scrollbar/);
  assert.match(desktopWorkbenchSource, /custom-scrollbar/);
});
