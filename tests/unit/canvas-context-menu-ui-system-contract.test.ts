import assert from 'node:assert/strict';
import { test } from 'node:test';

import { readSource } from '../support/workspacePaths.js';

test('canvas context menu exposes reusable system tokens and primitives', () => {
  const cssSource = readSource('apps/web/src/styles/kk-ui-tokens.css');

  for (const token of [
    '--kk-canvas-context-menu-bg',
    '--kk-canvas-context-menu-border',
    '--kk-canvas-context-menu-shadow',
    '--kk-canvas-context-menu-text',
    '--kk-canvas-context-menu-muted-text',
    '--kk-canvas-context-menu-item-hover-bg',
    '--kk-canvas-context-menu-danger-text',
    '--kk-canvas-context-menu-danger-hover-bg',
    '--kk-canvas-context-menu-divider',
    '--kk-canvas-context-menu-swatch-border',
  ]) {
    assert.match(cssSource, new RegExp(`${token}:`), `missing ${token}`);
  }

  for (const selector of [
    '.kk-canvas-context-menu',
    '.kk-canvas-context-menu-item',
    '.kk-canvas-context-menu-item--danger',
    '.kk-canvas-context-menu-divider',
    '.kk-canvas-context-menu-label',
    '.kk-canvas-context-menu-swatch',
    '.kk-canvas-context-menu-swatch[data-selected="true"]',
    '.kk-canvas-context-menu-color-input',
  ]) {
    assert.match(cssSource, new RegExp(selector.replace('.', '\\.').replace('[', '\\[').replace(']', '\\]')), `missing ${selector}`);
  }
});

test('canvas group context menu consumes KK_LAYER and canvas menu primitives', () => {
  const source = readSource('apps/web/src/components/canvas/CanvasGroupComponent.tsx');
  const menuMatch = source.match(/\{contextMenu && createPortal\([\s\S]*?document\.body\s*\)\}/);
  assert.ok(menuMatch, 'canvas group context menu block should remain easy to audit');
  const menuSource = menuMatch[0];

  assert.match(source, /import\s+\{\s*KK_LAYER\s*\}\s+from\s+'@kk\/ui'/);
  assert.match(source, /const CANVAS_GROUP_CONTEXT_MENU_LAYER = KK_LAYER\.dropdown;/);
  assert.match(source, /const CANVAS_GROUP_CONTEXT_MENU_OFFSET_PX = 6;/);
  assert.match(source, /const CANVAS_GROUP_CONTEXT_MENU_VIEWPORT_PADDING_PX = 8;/);
  assert.match(menuSource, /className="kk-canvas-context-menu fixed animate-fadeIn"/);
  assert.match(menuSource, /data-kk-canvas-context-menu-layer="true"/);
  assert.match(menuSource, /role="menu"/);
  assert.match(menuSource, /style=\{\{[\s\S]*zIndex:\s*CANVAS_GROUP_CONTEXT_MENU_LAYER/);
  assert.match(menuSource, /className="kk-canvas-context-menu-item"/);
  assert.match(menuSource, /role="menuitem"/);
  assert.match(menuSource, /className="kk-canvas-context-menu-item kk-canvas-context-menu-item--danger"/);
  assert.match(menuSource, /className="kk-canvas-context-menu-divider"/);
  assert.match(menuSource, /className="kk-canvas-context-menu-label"/);
  assert.match(menuSource, /className="kk-canvas-context-menu-swatch"/);
  assert.match(menuSource, /data-selected=\{selected\}/);

  assert.doesNotMatch(menuSource, /z-\[9999\]/);
  assert.doesNotMatch(menuSource, /contextMenu\.x \+ 6|contextMenu\.y \+ 6|window\.innerWidth - rect\.width - 8|window\.innerHeight - rect\.height - 8/);
  assert.doesNotMatch(menuSource, /text-red-500|hover:text-red-400|hover:bg-\[rgba\(255,107,90,0\.10\)\]|bg-\[var\(--border-light\)\]/);
});
