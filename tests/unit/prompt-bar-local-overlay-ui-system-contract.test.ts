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
    '--kk-prompt-bar-count-active-bg',
    '--kk-prompt-bar-count-active-text',
  ]) {
    assert.match(cssSource, new RegExp(`${token}:`), `missing ${token}`);
  }

  for (const selector of [
    '.kk-prompt-bar-count-bubble',
    '.kk-prompt-bar-count-option',
    '.kk-prompt-bar-count-option--active',
    '.kk-prompt-bar-overlay-arrow',
    '.kk-prompt-bar-tooltip',
    '.kk-prompt-bar-tooltip-arrow',
  ]) {
    assert.match(cssSource, new RegExp(selector.replace('.', '\\.')), `missing ${selector}`);
  }
});

test('prompt bar local bubbles consume primitives instead of raw black overlays', () => {
  const source = readSource('apps/web/src/components/layout/PromptBar.tsx');

  assert.match(source, /import \{ KK_LAYER \} from '@kk\/ui';/);
  assert.match(source, /className="kk-prompt-bar-count-bubble absolute bottom-full/);
  assert.match(source, /style=\{\{ zIndex: KK_LAYER\.dropdown \}\}/);
  assert.match(source, /className=\{`kk-prompt-bar-count-option/);
  assert.match(source, /kk-prompt-bar-count-option--active/);
  assert.match(source, /className="kk-prompt-bar-overlay-arrow/);
  assert.match(source, /className="kk-prompt-bar-tooltip/);
  assert.match(source, /className="kk-prompt-bar-tooltip-arrow/);

  assert.doesNotMatch(source, /z-\[1200\]/);
  assert.doesNotMatch(source, /bg-black\/85|dark:bg-black\/90|text-white\/60|shadow-pink-500\/20/);
  assert.doesNotMatch(source, /bg-black\/85 text-white text-xs rounded-lg/);
});
