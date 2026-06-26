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


