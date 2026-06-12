import assert from 'node:assert/strict';
import { test } from 'node:test';

import { readSource } from '../support/workspacePaths.js';

function getGeneratingPlaceholderBlock(source: string): string {
  const start = source.indexOf('const row = Math.floor(i / COLS);');
  const end = source.indexOf('<GenerationTimer', start);
  assert.notEqual(start, -1, 'desktop generating placeholder map should exist');
  assert.notEqual(end, -1, 'generating placeholder timer should exist');
  return source.slice(start, end);
}

test('prompt node generating placeholder exposes reusable system tokens and primitives', () => {
  const cssSource = readSource('apps/web/src/styles/kk-ui-tokens.css');

  for (const token of [
    '--kk-canvas-prompt-node-energy-layer',
    '--kk-canvas-prompt-node-energy-trail-stroke',
    '--kk-canvas-prompt-node-energy-base-stroke',
    '--kk-canvas-prompt-node-energy-stop-start',
    '--kk-canvas-prompt-node-energy-stop-mid',
    '--kk-canvas-prompt-node-energy-stop-warm',
    '--kk-canvas-prompt-node-energy-stop-end',
    '--kk-canvas-prompt-node-generating-overlay-layer',
    '--kk-canvas-prompt-node-generating-sheen-bg',
    '--kk-canvas-prompt-node-generating-sweep-bg',
  ]) {
    assert.match(cssSource, new RegExp(`${token}:`), `missing ${token}`);
  }

  for (const selector of [
    '.kk-canvas-prompt-node-energy-trail',
    '.kk-canvas-prompt-node-generating-image-overlay',
    '.kk-canvas-prompt-node-generating-sheen',
    '.kk-canvas-prompt-node-generating-sweep',
  ]) {
    assert.match(cssSource, new RegExp(selector.replace('.', '\\.')), `missing ${selector}`);
  }
});

test('prompt node generating placeholder consumes tokenized layers and energy chrome', () => {
  const source = readSource('apps/web/src/components/canvas/PromptNodeComponent.tsx');
  const block = getGeneratingPlaceholderBlock(source);

  assert.match(block, /className="kk-canvas-prompt-node-energy-trail pointer-events-none"/);
  assert.match(block, /stopColor="var\(--kk-canvas-prompt-node-energy-stop-start\)"/);
  assert.match(block, /stopColor="var\(--kk-canvas-prompt-node-energy-stop-mid\)"/);
  assert.match(block, /stopColor="var\(--kk-canvas-prompt-node-energy-stop-warm\)"/);
  assert.match(block, /stopColor="var\(--kk-canvas-prompt-node-energy-stop-end\)"/);
  assert.match(block, /stroke="var\(--kk-canvas-prompt-node-energy-trail-stroke\)"/);
  assert.match(block, /stroke="var\(--kk-canvas-prompt-node-energy-base-stroke\)"/);
  assert.match(block, /fill="var\(--kk-canvas-prompt-node-energy-stop-end\)"/);
  assert.match(block, /className="kk-canvas-prompt-node-generating-image-overlay"/);
  assert.match(block, /className="kk-canvas-prompt-node-generating-sheen"/);
  assert.match(block, /className="kk-canvas-prompt-node-generating-sweep"/);

  assert.doesNotMatch(block, /zIndex:\s*1\b/);
  assert.doesNotMatch(block, /z-\[6\]/);
  assert.doesNotMatch(block, /stopColor="#ff4d8b"|stopColor="#ff6b5a"|stopColor="#ffb084"|stopColor="#b8a4ed"/);
  assert.doesNotMatch(block, /stroke="#ff6b5a"|stroke="#ff4d8b"|fill="#b8a4ed"/);
  assert.doesNotMatch(block, /rgba\(255,255,255,0\.01\)|rgba\(255,255,255,0\.05\)|rgba\(255,255,255,0\.6\)/);
});
