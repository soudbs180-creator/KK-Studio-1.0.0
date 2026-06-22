import assert from 'node:assert/strict';
import { test } from 'node:test';

import { readSource } from '../support/workspacePaths.js';

test('prompt bar deep model overlays expose reusable primitives', () => {
  const cssSource = readSource('apps/web/src/styles/kk-ui-tokens.css');

  for (const token of [
    '--kk-prompt-bar-deep-popover-bg',
    '--kk-prompt-bar-deep-popover-border',
    '--kk-prompt-bar-deep-popover-shadow',
    '--kk-prompt-bar-deep-input-bg',
    '--kk-prompt-bar-deep-input-border',
    '--kk-prompt-bar-deep-item-hover-bg',
    '--kk-prompt-bar-deep-item-active-bg',
    '--kk-prompt-bar-deep-section-bg',
    '--kk-prompt-bar-deep-primary-bg',
    '--kk-prompt-bar-deep-primary-text',
  ]) {
    assert.match(cssSource, new RegExp(`${token}:`), `missing ${token}`);
  }

  for (const selector of [
    '.kk-prompt-bar-deep-model-search',
    '.kk-prompt-bar-deep-model-search-input',
    '.kk-prompt-bar-deep-model-list',
    '.kk-prompt-bar-deep-model-section',
    '.kk-prompt-bar-deep-provider-row',
    '.kk-prompt-bar-deep-model-item',
    '.kk-prompt-bar-deep-menu-item',
    '.kk-prompt-bar-deep-field',
    '.kk-prompt-bar-deep-modal-action',
    '.kk-prompt-bar-deep-modal-action--primary',
    '.kk-prompt-bar-deep-count-popover',
    '.kk-prompt-bar-deep-count-option',
    '.kk-prompt-bar-deep-audio-panel',
    '.kk-prompt-bar-deep-audio-option',
  ]) {
    assert.match(cssSource, new RegExp(selector.replace('.', '\\.')), `missing ${selector}`);
  }
});

test('prompt bar deep model overlays consume semantic layers and primitive classes', () => {
  const source = readSource('apps/web/src/components/layout/PromptBar.tsx');
  const desktopModelMenuStart = source.indexOf('const modelDropdownContent = (');
  const footerStart = source.indexOf('<PromptBarFooter', desktopModelMenuStart);
  assert.notEqual(desktopModelMenuStart, -1, 'desktop model dropdown content should exist');
  assert.notEqual(footerStart, -1, 'footer should follow model dropdown content');
  const modelMenuSource = source.slice(desktopModelMenuStart, footerStart);

  const deepOverlayStart = source.indexOf('{contextMenu && ReactDOM.createPortal(');
  const deepOverlayEnd = source.indexOf('<CreditSendButton', deepOverlayStart);
  assert.notEqual(deepOverlayStart, -1, 'model context menu portal should exist');
  assert.notEqual(deepOverlayEnd, -1, 'send button should follow model context overlays');
  const deepOverlaySource = source.slice(deepOverlayStart, deepOverlayEnd);

  assert.match(source, /const PROMPT_BAR_DEEP_DROPDOWN_LAYER = KK_LAYER\.dropdown;/);
  assert.match(source, /const PROMPT_BAR_DEEP_MODAL_BACKDROP_LAYER = KK_LAYER\.modalBackdrop;/);
  assert.match(source, /const PROMPT_BAR_DEEP_MODAL_PANEL_LAYER = KK_LAYER\.modal;/);
  assert.match(source, /const PROMPT_BAR_DEEP_SHEET_LAYER = KK_LAYER\.modal;/);

  assert.match(modelMenuSource, /className="kk-prompt-bar-deep-model-search/);
  assert.match(modelMenuSource, /className="kk-prompt-bar-deep-model-search-input/);
  assert.match(modelMenuSource, /className="kk-prompt-bar-deep-model-list/);
  assert.match(modelMenuSource, /className="kk-prompt-bar-deep-model-section/);
  assert.match(modelMenuSource, /className=\{`kk-prompt-bar-deep-provider-row/);
  assert.match(modelMenuSource, /className=\{`kk-prompt-bar-deep-model-item/);
  assert.match(source, /className="kk-prompt-bar-deep-audio-panel/);
  assert.match(source, /className=\{`kk-prompt-bar-deep-audio-option/);

  assert.match(deepOverlaySource, /style=\{\{[\s\S]*zIndex:\s*PROMPT_BAR_DEEP_DROPDOWN_LAYER/);
  assert.match(deepOverlaySource, /className="kk-prompt-bar-deep-menu-item/);
  assert.match(deepOverlaySource, /style=\{\{\s*zIndex:\s*PROMPT_BAR_DEEP_MODAL_BACKDROP_LAYER\s*\}\}/);
  assert.match(deepOverlaySource, /style=\{\{\s*zIndex:\s*PROMPT_BAR_DEEP_MODAL_PANEL_LAYER\s*\}\}/);
  assert.match(deepOverlaySource, /role="dialog"/);
  assert.match(deepOverlaySource, /aria-modal="true"/);
  assert.match(deepOverlaySource, /className="kk-prompt-bar-deep-field/);
  assert.match(deepOverlaySource, /className="kk-prompt-bar-deep-modal-action/);
  assert.match(deepOverlaySource, /className="kk-prompt-bar-deep-modal-action kk-prompt-bar-deep-modal-action--primary/);
  assert.match(source, /className="kk-prompt-bar-deep-count-popover/);
  assert.match(source, /className=\{`kk-prompt-bar-deep-count-option/);
  assert.match(source, /style=\{\{\s*zIndex:\s*PROMPT_BAR_DEEP_SHEET_LAYER\s*\}\}/);

  assert.doesNotMatch(deepOverlaySource, /zIndex:\s*KK_LAYER\.modal(?!Backdrop)/);
  assert.doesNotMatch(modelMenuSource, /bg-black\/5|dark:bg-white\/5|bg-black\/10|hover:bg-black\/\[0\.02\]|dark:hover:bg-white\/\[0\.02\]/);
  assert.doesNotMatch(deepOverlaySource, /style=\{\{\s*color:\s*'var\(--text-primary\)'\s*\}\}/);
  assert.doesNotMatch(deepOverlaySource, /background:\s*'var\(--frost-input-bg\)'|borderColor:\s*'var\(--prompt-bar-shell-border\)'|boxShadow:\s*'var\(--settings-button-primary-shadow\)'/);
});
