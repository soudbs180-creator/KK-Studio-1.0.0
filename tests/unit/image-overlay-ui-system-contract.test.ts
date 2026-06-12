import assert from 'node:assert/strict';
import { test } from 'node:test';

import { readSource } from '../support/workspacePaths.js';

test('image overlay primitives expose tokenized preview and partial-redraw surfaces', () => {
  const cssSource = readSource('apps/web/src/styles/kk-ui-tokens.css');

  for (const token of [
    '--kk-image-preview-frame-bg',
    '--kk-image-preview-frame-border',
    '--kk-image-preview-frame-shadow',
    '--kk-image-modal-panel-bg',
    '--kk-image-modal-stage-bg',
    '--kk-image-modal-sidebar-bg',
    '--kk-image-modal-control-bg',
    '--kk-image-selection-frame-border',
    '--kk-image-generation-frame-border',
    '--kk-image-warning-bg',
  ]) {
    assert.match(cssSource, new RegExp(`${token}:`), `missing ${token}`);
  }

  for (const selector of [
    '.kk-image-preview-root',
    '.kk-image-preview-backdrop',
    '.kk-image-preview-frame',
    '.kk-image-modal-backdrop',
    '.kk-image-modal-panel',
    '.kk-image-modal-toolbar',
    '.kk-image-modal-stage',
    '.kk-image-modal-sidebar',
    '.kk-image-modal-label',
    '.kk-image-modal-field',
    '.kk-image-modal-control',
    '.kk-image-modal-primary',
    '.kk-image-modal-icon-button',
    '.kk-image-selection-frame',
    '.kk-image-generation-frame',
    '.kk-image-reference-tile',
    '.kk-image-info-panel',
    '.kk-image-warning-panel',
  ]) {
    assert.match(cssSource, new RegExp(selector.replace('.', '\\.')), `missing ${selector}`);
  }

  assert.match(cssSource, /\.kk-image-modal-control\s*\{[\s\S]*min-height:\s*var\(--kk-touch-target-min\)/);
  assert.match(cssSource, /\.kk-image-modal-icon-button\s*\{[\s\S]*min-width:\s*var\(--kk-touch-target-min\)/);
});

test('image preview and partial redraw overlays consume KK_LAYER and avoid raw visual literals', () => {
  const previewSource = readSource('apps/web/src/components/image/ImagePreview.tsx');
  const partialRedrawSource = readSource('apps/web/src/components/image/PartialRedrawModal.tsx');

  for (const source of [previewSource, partialRedrawSource]) {
    assert.match(source, /import\s+\{\s*KK_LAYER\s*\}\s+from\s+'@kk\/ui'/);
    assert.match(source, /KK_LAYER\.fullscreen/);
    assert.doesNotMatch(source, /z-\[\d+\]|rgba\(|#[0-9a-fA-F]{3,8}|bg-black\/|bg-white\/|text-white|border-white|shadow-\[|bg-indigo-|hover:bg-indigo-|border-sky-|bg-sky-|border-emerald-|bg-emerald-|border-amber-|bg-amber-|text-amber-/);
  }

  assert.match(previewSource, /className="kk-image-preview-root/);
  assert.match(previewSource, /className="kk-image-preview-backdrop/);
  assert.match(previewSource, /className="kk-image-preview-frame/);

  assert.match(partialRedrawSource, /className="kk-image-modal-backdrop/);
  assert.match(partialRedrawSource, /className="kk-image-modal-panel/);
  assert.match(partialRedrawSource, /className="kk-image-modal-stage/);
  assert.match(partialRedrawSource, /className="kk-image-modal-sidebar/);
  assert.match(partialRedrawSource, /className="kk-image-selection-frame/);
  assert.match(partialRedrawSource, /className="kk-image-generation-frame/);
});
