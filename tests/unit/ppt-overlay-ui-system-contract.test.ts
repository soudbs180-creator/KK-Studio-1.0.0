import assert from 'node:assert/strict';
import { test } from 'node:test';

import { readSource } from '../support/workspacePaths.js';

test('ppt overlay primitives expose shared deck and stack classes', () => {
  const cssSource = readSource('apps/web/src/styles/kk-ui-tokens.css');

  for (const token of [
    '--kk-ppt-stack-page-bg',
    '--kk-ppt-stack-page-border',
    '--kk-ppt-stack-page-active-ring',
    '--kk-ppt-badge-bg',
    '--kk-ppt-slide-nav-bg',
    '--kk-ppt-slide-nav-active-bg',
    '--kk-ppt-preview-frame-bg',
    '--kk-ppt-layer-card-bg',
  ]) {
    assert.match(cssSource, new RegExp(`${token}:`), `missing ${token}`);
  }

  for (const selector of [
    '.kk-ppt-stack-preview',
    '.kk-ppt-stack-page',
    '.kk-ppt-page-badge',
    '.kk-ppt-deck-editor',
    '.kk-ppt-deck-header',
    '.kk-ppt-slide-nav',
    '.kk-ppt-preview-frame',
    '.kk-ppt-editor-panel',
    '.kk-ppt-layer-card',
    '.kk-ppt-layer-icon',
  ]) {
    assert.match(cssSource, new RegExp(selector.replace('.', '\\.')), `missing ${selector}`);
  }
});

test('ppt preview and deck editor consume system layers and avoid raw modal visuals', () => {
  const stackSource = readSource('apps/web/src/components/image/PptStackPreviewModal.tsx');
  const editorSource = readSource('apps/web/src/components/image/PptDeckEditorModal.tsx');

  for (const source of [stackSource, editorSource]) {
    assert.match(source, /import\s+\{\s*KK_LAYER\s*\}\s+from\s+'@kk\/ui'/);
    assert.match(source, /KK_LAYER\.fullscreen/);
    assert.doesNotMatch(source, /z-\[10000[01]\]|bg-black\/|bg-white\/|border-white\/|text-white|bg-\[#|#[0-9a-fA-F]{3,8}|bg-sky-|hover:bg-sky-|border-sky-|text-sky-|bg-slate-|text-slate-|shadow-2xl|rgba\(/);
  }

  assert.match(stackSource, /className="kk-image-modal-backdrop kk-ppt-stack-preview/);
  assert.match(stackSource, /className="kk-image-modal-panel kk-ppt-stack-shell/);
  assert.match(stackSource, /className="kk-ppt-stack-page/);
  assert.match(stackSource, /className="kk-ppt-page-badge/);

  assert.match(editorSource, /className="kk-image-modal-backdrop kk-ppt-deck-editor/);
  assert.match(editorSource, /className=\{`kk-image-modal-panel/);
  assert.match(editorSource, /className="kk-ppt-slide-nav/);
  assert.match(editorSource, /data-active=\{isActive\}/);
  assert.match(editorSource, /className="kk-ppt-preview-frame/);
  assert.match(editorSource, /className="kk-ppt-editor-panel/);
  assert.match(editorSource, /className="kk-ppt-layer-card/);
});
