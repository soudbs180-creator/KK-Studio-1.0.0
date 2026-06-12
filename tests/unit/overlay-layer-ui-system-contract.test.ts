import assert from 'node:assert/strict';
import { test } from 'node:test';

import { readSource } from '../support/workspacePaths.js';

test('overlay and auth modal styles expose reusable system tokens and classes', () => {
  const cssSource = readSource('apps/web/src/styles/kk-ui-tokens.css');

  for (const token of [
    '--kk-overlay-backdrop-bg',
    '--kk-auth-modal-bg',
    '--kk-auth-modal-border',
    '--kk-auth-modal-shadow',
    '--kk-auth-modal-muted-text',
    '--kk-auth-modal-accent-text',
    '--kk-auth-modal-state-warning-bg',
    '--kk-auth-modal-state-danger-bg',
    '--kk-canvas-selection-menu-bg',
    '--kk-lightbox-backdrop-opacity',
  ]) {
    assert.match(cssSource, new RegExp(`${token}[,:]`), `missing ${token}`);
  }

  for (const selector of [
    '.kk-overlay-backdrop',
    '.kk-auth-modal-panel',
    '.kk-auth-modal-header',
    '.kk-auth-modal-close',
    '.kk-auth-modal-state',
    '.kk-canvas-selection-menu',
    '.kk-canvas-selection-menu-item',
    '.kk-lightbox-backdrop',
  ]) {
    assert.match(cssSource, new RegExp(selector.replace('.', '\\.')), `missing ${selector}`);
  }

  assert.match(cssSource, /\.kk-auth-modal-close\s*\{[\s\S]*min-width:\s*var\(--kk-touch-target-min\)/);
  assert.match(cssSource, /\.kk-canvas-selection-menu-item\s*\{[\s\S]*min-height:\s*var\(--kk-touch-target-min\)/);
});

test('top-level overlay components consume KK_LAYER instead of raw z-index utilities', () => {
  const layersSource = readSource('packages/ui/src/core/layers.ts');
  const wechatSource = readSource('apps/web/src/components/auth/WechatQrModal.tsx');
  const lightboxSource = readSource('apps/web/src/components/image/GlobalLightbox.tsx');

  assert.match(layersSource, /fullscreen:\s*\d+/);

  assert.match(wechatSource, /import\s+\{\s*KK_LAYER\s*\}\s+from\s+'@kk\/ui'/);
  assert.match(wechatSource, /className="kk-overlay-backdrop/);
  assert.match(wechatSource, /className="kk-auth-modal-panel/);
  assert.match(wechatSource, /zIndex:\s*KK_LAYER\.modalBackdrop/);
  assert.doesNotMatch(wechatSource, /z-\[10030\]|bg-black\/65|bg-\[#081629\]|border-white\/10|shadow-\[0_30px_90px_rgba/);

  assert.match(lightboxSource, /import\s+\{\s*KK_LAYER\s*\}\s+from\s+'@kk\/ui'/);
  assert.match(lightboxSource, /className="kk-result-surface kk-lightbox-backdrop/);
  assert.match(lightboxSource, /zIndex:\s*KK_LAYER\.fullscreen/);
  assert.match(lightboxSource, /'--kk-lightbox-backdrop-opacity':\s*getOpacity\(\)/);
  assert.doesNotMatch(lightboxSource, /z-\[99999\]/);
  assert.doesNotMatch(lightboxSource, /backgroundColor:\s*`?rgb\(/);
});

test('canvas selection menu uses shared floating layer and menu primitives', () => {
  const source = readSource('apps/web/src/components/canvas/SelectionMenu.tsx');

  assert.match(source, /import\s+\{\s*KK_LAYER\s*\}\s+from\s+'@kk\/ui'/);
  assert.match(source, /className="kk-canvas-selection-menu/);
  assert.match(source, /className="kk-canvas-selection-menu-item/);
  assert.match(source, /zIndex:\s*KK_LAYER\.floating/);
  assert.doesNotMatch(source, /z-\[10000\]/);
  assert.doesNotMatch(source, /rgba\(99, 102, 241, 0\.25\)/);
});
