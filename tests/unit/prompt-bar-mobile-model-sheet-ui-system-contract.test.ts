import assert from 'node:assert/strict';
import { test } from 'node:test';

import { readSource } from '../support/workspacePaths.js';

function getMobileModelSheetBlock(source: string): string {
  const start = source.indexOf('{isModelMenuOpen && isMobile && (');
  const end = source.indexOf('{isModelMenuOpen && !isMobile', start);
  assert.notEqual(start, -1, 'mobile model menu sheet block should exist');
  assert.notEqual(end, -1, 'desktop model menu block should follow mobile sheet block');
  return source.slice(start, end);
}

test('prompt bar exposes mobile model sheet system tokens and primitives', () => {
  const cssSource = readSource('apps/web/src/styles/kk-ui-tokens.css');

  for (const token of [
    '--kk-prompt-bar-mobile-model-backdrop-bg',
    '--kk-prompt-bar-mobile-model-backdrop-blur',
    '--kk-prompt-bar-mobile-model-sheet-bg',
    '--kk-prompt-bar-mobile-model-sheet-border',
    '--kk-prompt-bar-mobile-model-sheet-shadow',
    '--kk-prompt-bar-mobile-model-sheet-blur',
    '--kk-prompt-bar-mobile-model-sheet-handle-bg',
  ]) {
    assert.match(cssSource, new RegExp(`${token}:`), `missing ${token}`);
  }

  for (const selector of [
    '.kk-prompt-bar-mobile-model-backdrop',
    '.kk-prompt-bar-mobile-model-sheet-host',
    '.kk-prompt-bar-mobile-model-sheet',
    '.kk-prompt-bar-mobile-model-sheet-handle',
  ]) {
    assert.match(cssSource, new RegExp(selector.replace('.', '\\.')), `missing ${selector}`);
  }

  assert.match(cssSource, /@keyframes kk-prompt-bar-mobile-model-sheet-enter/);
});

test('prompt bar mobile model sheet consumes KK_LAYER and stable semantic markers', () => {
  const source = readSource('apps/web/src/components/layout/PromptBar.tsx');
  const block = getMobileModelSheetBlock(source);

  assert.match(block, /data-prompt-bar-mobile-model-layer="true"/);
  assert.match(block, /className="kk-prompt-bar-mobile-model-backdrop"/);
  assert.match(block, /style=\{\{ zIndex: KK_LAYER\.modalBackdrop \}\}/);
  assert.match(block, /onClick=\{\(e\) => \{ e\.stopPropagation\(\); setActiveMenu\(null\); \}\}/);
  assert.match(block, /className="kk-prompt-bar-mobile-model-sheet-host"/);
  assert.match(block, /style=\{\{ zIndex: KK_LAYER\.modal \}\}/);
  assert.match(block, /className="kk-prompt-bar-mobile-model-sheet"/);
  assert.match(block, /className="kk-prompt-bar-mobile-model-sheet-handle"/);

  assert.doesNotMatch(block, /z-\[1049\]|z-\[1050\]/);
  assert.doesNotMatch(source, /\[class\*="z-\[1049\]"\]|\[class\*="z-\[1050\]"\]/);
  assert.doesNotMatch(block, /bg-black\/40|model-sheet-slide-up|rgba\(0,0,0,0\.25\)/);
});
