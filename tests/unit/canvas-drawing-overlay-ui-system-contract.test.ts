import assert from 'node:assert/strict';
import { test } from 'node:test';

import { readSource } from '../support/workspacePaths.js';

test('canvas drawing overlay exposes reusable system tokens and primitives', () => {
  const cssSource = readSource('apps/web/src/styles/kk-ui-tokens.css');

  for (const token of [
    '--kk-canvas-drawing-selection-stroke',
    '--kk-canvas-drawing-selection-fill',
    '--kk-canvas-drawing-text-input-bg',
    '--kk-canvas-drawing-text-input-border',
    '--kk-canvas-drawing-text-input-shadow',
  ]) {
    assert.match(cssSource, new RegExp(`${token}:`), `missing ${token}`);
  }

  for (const selector of [
    '.kk-canvas-drawing-overlay',
    '.kk-canvas-drawing-text-input-anchor',
    '.kk-canvas-drawing-text-input',
  ]) {
    assert.match(cssSource, new RegExp(selector.replace('.', '\\.')), `missing ${selector}`);
  }
});

test('canvas drawing overlay consumes KK_LAYER and tokenized drawing chrome', () => {
  const source = readSource('apps/web/src/components/canvas/CanvasDrawingInteractionOverlay.tsx');

  assert.match(source, /import\s+\{\s*KK_LAYER\s*\}\s+from\s+'@kk\/ui'/);
  assert.match(source, /className="kk-canvas-drawing-overlay absolute"/);
  assert.match(source, /zIndex:\s*KK_LAYER\.nodeSelected/);
  assert.match(source, /stroke="var\(--kk-canvas-drawing-selection-stroke\)"/);
  assert.match(source, /fill="var\(--kk-canvas-drawing-selection-fill\)"/);
  assert.match(source, /className="kk-canvas-drawing-text-input-anchor"/);
  assert.match(source, /zIndex:\s*KK_LAYER\.floating/);
  assert.match(source, /className="kk-canvas-drawing-text-input"/);

  assert.doesNotMatch(source, /className="absolute z-\[25\] cursor-crosshair pointer-events-auto"/);
  assert.doesNotMatch(source, /className="absolute z-\[100\]"/);
  assert.doesNotMatch(source, /stroke="#6366f1"|fill="rgba\(99, 102, 241, 0\.12\)"/);
  assert.doesNotMatch(source, /frost-card-main-bg,\s*rgba\(255,\s*255,\s*255,\s*0\.85\)|accent-coral,\s*#ef4444|0 0 10px rgba\(0,0,0,0\.15\)/);
});
