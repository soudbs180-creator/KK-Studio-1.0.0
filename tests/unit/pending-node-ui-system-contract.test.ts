import assert from 'node:assert/strict';
import { test } from 'node:test';

import { readSource } from '../support/workspacePaths.js';

test('pending node exposes reusable canvas pending tokens and primitives', () => {
  const cssSource = readSource('apps/web/src/styles/kk-ui-tokens.css');

  for (const token of [
    '--kk-canvas-pending-disconnect-bg',
    '--kk-canvas-pending-disconnect-hover-bg',
    '--kk-canvas-pending-disconnect-text',
    '--kk-canvas-pending-connector-stroke',
    '--kk-canvas-pending-shimmer-bg',
    '--kk-canvas-pending-glow-outer-bg',
    '--kk-canvas-pending-glow-inner-bg',
    '--kk-canvas-pending-layer-connector',
    '--kk-canvas-pending-layer-ambient',
    '--kk-canvas-pending-layer-card',
    '--kk-canvas-pending-layer-content',
  ]) {
    assert.match(cssSource, new RegExp(`${token}:`), `missing ${token}`);
  }

  for (const selector of [
    '.kk-canvas-pending-disconnect-button',
    '.kk-canvas-pending-disconnect-icon',
    '.kk-canvas-pending-connector',
    '.kk-canvas-pending-placeholder-card',
    '.kk-canvas-pending-shimmer',
    '.kk-canvas-pending-ambient',
    '.kk-canvas-pending-glow--outer',
    '.kk-canvas-pending-glow--inner',
    '.kk-canvas-pending-content',
    '.kk-canvas-pending-spinner-shell',
  ]) {
    assert.match(cssSource, new RegExp(selector.replace('.', '\\.')), `missing ${selector}`);
  }
});

test('pending node consumes canvas pending primitives instead of raw internal chrome', () => {
  const source = readSource('apps/web/src/components/canvas/PendingNode.tsx');

  assert.match(source, /className="kk-canvas-pending-disconnect-button/);
  assert.match(source, /className="kk-canvas-pending-disconnect-icon/);
  assert.match(source, /className="kk-canvas-pending-connector pointer-events-none"/);
  assert.match(source, /stroke="var\(--kk-canvas-pending-connector-stroke\)"/);
  assert.match(source, /className="kk-canvas-pending-placeholder-card"/);
  assert.match(source, /className="kk-canvas-pending-shimmer"/);
  assert.match(source, /className="kk-canvas-pending-ambient"/);
  assert.match(source, /className="kk-canvas-pending-glow kk-canvas-pending-glow--outer"/);
  assert.match(source, /className="kk-canvas-pending-glow kk-canvas-pending-glow--inner"/);
  assert.match(source, /className="kk-canvas-pending-content"/);
  assert.match(source, /className="kk-canvas-pending-spinner-shell"/);

  assert.doesNotMatch(source, /zIndex:\s*(?:1|5|10)\b/);
  assert.doesNotMatch(source, /bg-red-500\/20|hover:bg-red-500\/40|text-red-400/);
  assert.doesNotMatch(source, /stroke="rgba\(255,255,255,0\.25\)"/);
  assert.doesNotMatch(source, /rgba\(255,255,255,0\.12\)|rgba\(255,255,255,0\.15\)/);
  assert.doesNotMatch(source, /linear-gradient\(45deg, rgb\(255 77 139|linear-gradient\(135deg, rgb\(255 176 132/);
});
