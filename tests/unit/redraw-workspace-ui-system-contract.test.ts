import assert from 'node:assert/strict';
import { test } from 'node:test';

import { readSource } from '../support/workspacePaths.js';

test('redraw workspace exposes shared fullscreen editing primitives', () => {
  const cssSource = readSource('apps/web/src/styles/kk-ui-tokens.css');

  for (const token of [
    '--kk-redraw-workspace-bg',
    '--kk-redraw-toolbar-bg',
    '--kk-redraw-control-bg',
    '--kk-redraw-control-active-bg',
    '--kk-redraw-composer-bg',
    '--kk-redraw-reference-bg',
    '--kk-redraw-annotation-stroke',
    '--kk-redraw-draft-stroke',
    '--kk-redraw-swatch-red',
  ]) {
    assert.match(cssSource, new RegExp(`${token}:`), `missing ${token}`);
  }

  for (const selector of [
    '.kk-redraw-workspace',
    '.kk-redraw-close-button',
    '.kk-redraw-toolbar',
    '.kk-redraw-tool-button',
    '.kk-redraw-control-group',
    '.kk-redraw-swatch',
    '.kk-redraw-floating-prompt',
    '.kk-redraw-composer',
    '.kk-redraw-prompt-rail',
    '.kk-redraw-reference-tray',
    '.kk-redraw-reference-tile',
  ]) {
    assert.match(cssSource, new RegExp(selector.replace('.', '\\.')), `missing ${selector}`);
  }
});

test('redraw workspace consumes system layers and avoids raw fullscreen chrome visuals', () => {
  const source = readSource('apps/web/src/components/image/RedrawWorkspace.tsx');

  assert.match(source, /import\s+\{\s*KK_LAYER\s*\}\s+from\s+'@kk\/ui'/);
  assert.match(source, /zIndex:\s*KK_LAYER\.fullscreen/);
  assert.match(source, /className="kk-redraw-workspace/);
  assert.match(source, /className="kk-redraw-toolbar/);
  assert.match(source, /className=\{`kk-redraw-composer/);
  assert.match(source, /data-active=\{tool === 'pan'\}/);
  assert.match(source, /data-active=\{selectedColor === swatch\.value\}/);
  assert.match(source, /var\(--kk-redraw-swatch-red\)/);
  assert.match(source, /readCssToken\('--kk-redraw-annotation-stroke'/);
  assert.doesNotMatch(source, /z-\[\d+\]|zIndex:\s*\d+|rgba?\(|hsla?\(|#[0-9a-fA-F]{3,8}|bg-black\/|bg-white\/|border-white\/|text-white|bg-\[#|bg-sky-|hover:bg-sky-|border-sky-|text-sky-|bg-zinc-|text-zinc-|shadow-2xl/);
});
