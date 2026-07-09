import assert from 'node:assert/strict';
import { test } from 'node:test';

import { readSource } from '../support/workspacePaths.js';

test('image card exposes shared state, media, and menu primitives', () => {
  const cssSource = readSource('apps/web/src/styles/kk-ui-tokens.css');

  for (const token of [
    '--kk-image-card-active-border',
    '--kk-image-card-active-ring',
    '--kk-image-card-error-border',
    '--kk-image-card-skeleton-bg',
    '--kk-image-card-state-bg',
    '--kk-image-card-state-error-text',
    '--kk-image-card-state-expired-text',
    '--kk-image-card-generating-bg',
    '--kk-image-card-ppt-badge-bg',
    '--kk-image-card-video-button-bg',
    '--kk-image-card-download-menu-bg',
  ]) {
    assert.match(cssSource, new RegExp(`${token}:`), `missing ${token}`);
  }

  for (const selector of [
    '.kk-image-card-skeleton',
    '.kk-image-card-state',
    '.kk-image-card-state--error',
    '.kk-image-card-state--expired',
    '.kk-image-card-state--generating',
    '.kk-image-card-state--loading',
    '.kk-image-card-ppt-badge',
    '.kk-image-card-video-overlay',
    '.kk-image-card-video-button',
    '.kk-image-card-download-menu',
    '.kk-image-card-download-item',
    '.kk-image-card-stop-generate',
  ]) {
    assert.match(cssSource, new RegExp(selector.replace('.', '\\.')), `missing ${selector}`);
  }
});

test('image card consumes system primitives for overlays and floating download menu', () => {
  const source = readSource('apps/web/src/components/image/ImageCard2.tsx');
  const sourceWithoutTokenExceptions = source
    .split('\n')
    .filter((line) => !line.includes('UI_TOKEN_EXCEPTION'))
    .join('\n');

  assert.match(source, /import\s+\{\s*KK_LAYER\s*\}\s+from\s+'@kk\/ui'/);
  assert.match(source, /<LayerPortal zIndex=\{KK_LAYER\.dropdown\}>/);
  assert.match(source, /className="kk-image-card-download-menu/);
  assert.match(source, /className="kk-image-card-download-item/);
  assert.match(source, /className="kk-image-card-ppt-badge/);
  assert.match(source, /className="kk-image-card-video-overlay/);
  assert.match(source, /className="kk-image-card-video-button/);
  assert.match(source, /className="kk-image-card-state kk-image-card-state--generating/);
  assert.match(source, /className="kk-image-card-state kk-image-card-state--loading/);
  assert.match(source, /className=\{joinClasses\(\s*'kk-image-card-state/);
  assert.match(source, /var\(--kk-image-card-active-border\)/);
  assert.doesNotMatch(source, /z-\[1100\]|<LayerPortal zIndex=\{1100\}>/);
  assert.doesNotMatch(sourceWithoutTokenExceptions, /bg-black\/|bg-white\/|border-white\/|text-white|bg-red-500|border-red-500|text-red-500|rgba\(|rgb\(245,\s*158,\s*11\)|rgb\(244,\s*63,\s*94\)|shadow-2xl/);
});
