import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

test('mobile primary navigation exposes Create, Canvas, Copilot and Assets while retaining legacy values', () => {
  const rootTypes = fs.readFileSync('apps/web/src/types.ts', 'utf8');
  const indexTypes = fs.readFileSync('apps/web/src/types/index.ts', 'utf8');
  const tabBar = fs.readFileSync('apps/web/src/components/mobile/MobileTabBar.tsx', 'utf8');

  for (const source of [rootTypes, indexTypes]) {
    assert.match(source, /MobilePrimaryTab\s*=\s*[\s\S]*'create'[\s\S]*'canvas'[\s\S]*'copilot'[\s\S]*'assets'/);
    assert.match(source, /MobilePrimaryTab[\s\S]*'library'[\s\S]*'chat'[\s\S]*'me'/);
  }

  assert.match(tabBar, /key:\s*'canvas'/);
  assert.match(tabBar, /key:\s*'copilot'/);
  assert.match(tabBar, /key:\s*'assets'/);
  assert.doesNotMatch(tabBar, /key:\s*'me'/);
  assert.doesNotMatch(tabBar, /duration-300|active:scale/);
});

test('mobile Canvas V3 provides touch pan, pinch zoom, card dragging and a bottom inspector', () => {
  const mobileCanvas = fs.readFileSync('apps/web/src/components/mobile/MobileCanvasV3Surface.tsx', 'utf8');
  const mobileWorkspace = fs.readFileSync('apps/web/src/app/AppMobileWorkspace.tsx', 'utf8');
  const morphicCss = fs.readFileSync('apps/web/src/styles/morphic-ui.css', 'utf8');

  assert.match(mobileCanvas, /data-testid="mobile-canvas-v3"/);
  assert.match(mobileCanvas, /touchAction:\s*'none'/);
  assert.match(mobileCanvas, /setPointerCapture/);
  assert.match(mobileCanvas, /pinch/);
  assert.match(mobileCanvas, /updatePromptNodePosition/);
  assert.match(mobileCanvas, /updateImageNodePosition/);
  assert.match(mobileCanvas, /updateWorkflowNodePosition/);
  assert.match(mobileCanvas, /CanvasEdgeLayer/);
  assert.match(mobileCanvas, /kk-mobile-canvas-inspector/);
  assert.match(mobileCanvas, /node\.kind !== 'prompt' && node\.kind !== 'image'/);
  assert.match(mobileCanvas, /const MOBILE_READABLE_SCALE = 0\.72/);
  assert.match(mobileWorkspace, /<MobileCanvasV3Surface/);
  assert.match(mobileWorkspace, /<MobileTabBar/);
  assert.match(morphicCss, /\.kk-mobile-canvas-inspector/);
  assert.match(morphicCss, /env\(safe-area-inset-bottom/);
});
