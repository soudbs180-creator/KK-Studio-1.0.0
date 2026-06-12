import assert from 'node:assert/strict';
import { test } from 'node:test';

import { readSource } from '../support/workspacePaths.js';

function sliceBetween(source: string, startMarker: string, endMarker: string, label: string): string {
  const start = source.indexOf(startMarker);
  const end = source.indexOf(endMarker, start);
  assert.notEqual(start, -1, `${label} start marker should exist`);
  assert.notEqual(end, -1, `${label} end marker should exist`);
  return source.slice(start, end);
}

test('prompt bar exposes reusable deep overlay tokens and primitives', () => {
  const cssSource = readSource('apps/web/src/styles/kk-ui-tokens.css');

  for (const token of [
    '--kk-prompt-bar-deep-popover-bg',
    '--kk-prompt-bar-deep-popover-border',
    '--kk-prompt-bar-deep-popover-shadow',
    '--kk-prompt-bar-deep-modal-backdrop-bg',
    '--kk-prompt-bar-deep-modal-backdrop-blur',
    '--kk-prompt-bar-deep-modal-panel-bg',
    '--kk-prompt-bar-deep-modal-panel-border',
    '--kk-prompt-bar-deep-modal-panel-shadow',
    '--kk-prompt-bar-deep-sheet-backdrop-bg',
    '--kk-prompt-bar-deep-sheet-backdrop-blur',
    '--kk-prompt-bar-deep-sheet-bg',
    '--kk-prompt-bar-deep-sheet-border',
    '--kk-prompt-bar-deep-sheet-shadow',
  ]) {
    assert.match(cssSource, new RegExp(`${token}:`), `missing ${token}`);
  }

  for (const selector of [
    '.kk-prompt-bar-deep-popover-host',
    '.kk-prompt-bar-deep-context-menu',
    '.kk-prompt-bar-deep-modal-backdrop',
    '.kk-prompt-bar-deep-modal-panel',
    '.kk-prompt-bar-deep-count-sheet-backdrop',
    '.kk-prompt-bar-deep-count-sheet',
  ]) {
    assert.match(cssSource, new RegExp(selector.replace('.', '\\.')), `missing ${selector}`);
  }
});

test('prompt bar deep overlays consume KK_LAYER and shared primitives', () => {
  const source = readSource('apps/web/src/components/layout/PromptBar.tsx');
  const desktopModelMenuBlock = sliceBetween(
    source,
    '{isModelMenuOpen && !isMobile && ReactDOM.createPortal(',
    '{isEmbeddedMobileComposer ? (',
    'desktop model menu portal',
  );
  const contextMenuBlock = sliceBetween(
    source,
    '{contextMenu && ReactDOM.createPortal(',
    '{modelSettingsModal && ReactDOM.createPortal(',
    'context menu portal',
  );
  const modelSettingsBlock = sliceBetween(
    source,
    '{modelSettingsModal && ReactDOM.createPortal(',
    '<div data-mobile-footer-control="send"',
    'model settings modal portal',
  );
  const countSheetBlock = sliceBetween(
    source,
    "{isMobile && activeMenu === 'count' && ReactDOM.createPortal(",
    'document.body\n                )}',
    'mobile count sheet portal',
  );

  assert.match(desktopModelMenuBlock, /className="kk-prompt-bar-deep-popover-host animate-fadeIn origin-bottom"/);
  assert.match(desktopModelMenuBlock, /zIndex: KK_LAYER\.dropdown/);
  assert.match(contextMenuBlock, /className="kk-prompt-bar-deep-context-menu"/);
  assert.match(contextMenuBlock, /zIndex: KK_LAYER\.dropdown/);
  assert.match(modelSettingsBlock, /className="kk-prompt-bar-deep-modal-backdrop"/);
  assert.match(modelSettingsBlock, /zIndex: KK_LAYER\.modal/);
  assert.match(modelSettingsBlock, /className="kk-prompt-bar-deep-modal-panel"/);
  assert.match(countSheetBlock, /className="kk-prompt-bar-deep-count-sheet-backdrop"/);
  assert.match(countSheetBlock, /zIndex: KK_LAYER\.modal/);
  assert.match(countSheetBlock, /className="kk-prompt-bar-deep-count-sheet"/);

  assert.doesNotMatch(source, /z-\[10000\]|z-\[10010\]|z-\[10020\]/);
  assert.doesNotMatch(countSheetBlock, /bg-black\/45|backdrop-blur-\[2px\]|rgba\(0,0,0,0\.18\)/);
  assert.doesNotMatch(modelSettingsBlock, /color-mix\(in srgb, var\(--bg-base\) 52%, transparent\)|backdropFilter: 'blur\(12px\)'/);
});
