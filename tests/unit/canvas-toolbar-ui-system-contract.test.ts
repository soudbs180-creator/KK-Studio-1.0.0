import assert from 'node:assert/strict';
import { test } from 'node:test';

import { readSource } from '../support/workspacePaths.js';

test('canvas toolbar exposes reusable system tokens and primitives', () => {
  const cssSource = readSource('apps/web/src/styles/kk-ui-tokens.css');

  for (const token of [
    '--kk-canvas-toolbar-bg',
    '--kk-canvas-toolbar-border',
    '--kk-canvas-toolbar-shadow',
    '--kk-canvas-toolbar-button-text',
    '--kk-canvas-toolbar-button-hover-bg',
    '--kk-canvas-toolbar-button-active-bg',
    '--kk-canvas-toolbar-button-active-text',
  ]) {
    assert.match(cssSource, new RegExp(`${token}:`), `missing ${token}`);
  }

  for (const selector of [
    '.kk-canvas-toolbar',
    '.kk-canvas-toolbar-button',
    '.kk-canvas-toolbar-button[data-active="true"]',
    '.kk-canvas-toolbar-icon',
  ]) {
    assert.match(cssSource, new RegExp(selector.replace('.', '\\.').replace('[', '\\[').replace(']', '\\]')), `missing ${selector}`);
  }
});

test('main canvas toolbar consumes KK_LAYER toolbar and canvas toolbar primitives', () => {
  const source = readSource('apps/web/src/components/canvas/Canvas.tsx');
  const toolbarMatch = source.match(/<div\s+id="canvas-toolbar"[\s\S]*?\n            <\/div>\n\n            \{\/\* Zoom Slider/);
  assert.ok(toolbarMatch, 'canvas toolbar block should remain easy to audit');
  const toolbarSource = toolbarMatch[0];

  assert.match(source, /import\s+\{\s*KK_LAYER\s*\}\s+from\s+'@kk\/ui'/);
  assert.match(toolbarSource, /id="canvas-toolbar"\s+className="kk-canvas-toolbar absolute/);
  assert.match(toolbarSource, /style=\{\{ zIndex: KK_LAYER\.toolbar \}\}/);
  assert.match(toolbarSource, /className="kk-canvas-toolbar-button group"/);
  assert.match(toolbarSource, /data-active=\{showGrid\}/);
  assert.match(toolbarSource, /className="kk-canvas-toolbar-icon/);

  assert.doesNotMatch(toolbarSource, /z-\[1001\]/);
  assert.doesNotMatch(toolbarSource, /text-gray-500|dark:text-zinc-400|dark:group-hover:text-white|dark:text-white/);
});
