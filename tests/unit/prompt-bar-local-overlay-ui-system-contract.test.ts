import assert from 'node:assert/strict';
import { test } from 'node:test';

import { readSource } from '../support/workspacePaths.js';

test('prompt bar exposes reusable local overlay primitives', () => {
  const cssSource = readSource('apps/web/src/styles/kk-ui-tokens.css');

  for (const token of [
    '--kk-prompt-bar-overlay-bg',
    '--kk-prompt-bar-overlay-border',
    '--kk-prompt-bar-overlay-shadow',
    '--kk-prompt-bar-overlay-text',
    '--kk-prompt-bar-overlay-muted-text',
    '--kk-prompt-bar-overlay-arrow-bg',
  ]) {
    assert.match(cssSource, new RegExp(`${token}:`), `missing ${token}`);
  }

  for (const selector of [
    '.kk-prompt-bar-overlay-arrow',
    '.kk-prompt-bar-tooltip',
    '.kk-prompt-bar-tooltip-arrow',
  ]) {
    assert.match(cssSource, new RegExp(selector.replace('.', '\\.')), `missing ${selector}`);
  }
});

test('prompt bar local overlays keep tooltips but remove the obsolete mobile count bubble', () => {
  const source = readSource('apps/web/src/components/layout/PromptBar.tsx');
  const tokenStyles = readSource('apps/web/src/styles/kk-ui-tokens.css');
  const morphicStyles = readSource('apps/web/src/styles/morphic-ui.css');

  assert.match(source, /className="kk-prompt-bar-tooltip/);
  assert.match(source, /className="kk-prompt-bar-tooltip-arrow/);
  for (const obsoleteSource of [source, tokenStyles, morphicStyles]) {
    assert.doesNotMatch(obsoleteSource, /kk-prompt-bar-count-bubble/);
    assert.doesNotMatch(obsoleteSource, /kk-prompt-bar-count-option/);
    assert.doesNotMatch(obsoleteSource, /--kk-prompt-bar-count-active-/);
  }

  assert.doesNotMatch(source, /z-\[1200\]/);
  assert.doesNotMatch(source, /bg-black\/85|dark:bg-black\/90|text-white\/60|shadow-pink-500\/20/);
  assert.doesNotMatch(source, /bg-black\/85 text-white text-xs rounded-lg/);
});
