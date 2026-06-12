import assert from 'node:assert/strict';
import { test } from 'node:test';

import { readSource } from '../support/workspacePaths.js';

test('notification toast exposes tokenized state surfaces and reusable classes', () => {
  const cssSource = readSource('apps/web/src/styles/kk-ui-tokens.css');

  for (const token of [
    '--kk-toast-card-bg',
    '--kk-toast-card-border',
    '--kk-toast-card-shadow',
    '--kk-toast-success-accent',
    '--kk-toast-error-accent',
    '--kk-toast-warning-accent',
    '--kk-toast-info-accent',
    '--kk-toast-update-accent',
    '--kk-toast-drawer-bg',
  ]) {
    assert.match(cssSource, new RegExp(`${token}:`), `missing ${token}`);
  }

  for (const selector of [
    '.kk-toast-layer',
    '.kk-toast-card',
    '.kk-toast-mobile-bar',
    '.kk-toast-drawer-panel',
    '.kk-toast-icon-shell',
    '.kk-toast-icon-button',
    '.kk-toast-action-badge',
    '.kk-toast-details',
  ]) {
    assert.match(cssSource, new RegExp(selector.replace('.', '\\.')), `missing ${selector}`);
  }

  assert.match(cssSource, /\.kk-toast-icon-button\s*\{[\s\S]*min-width:\s*var\(--kk-touch-target-min\)/);
});

test('NotificationToast uses the shared toast layer and avoids raw surface colors', () => {
  const source = readSource('apps/web/src/components/common/NotificationToast.tsx');

  assert.match(source, /import\s+\{\s*KK_LAYER\s*\}\s+from\s+'@kk\/ui'/);
  assert.match(source, /className="kk-toast-layer/);
  assert.match(source, /className="kk-toast-card/);
  assert.match(source, /className="kk-toast-drawer-panel/);
  assert.match(source, /KK_LAYER\.toast/);
  assert.doesNotMatch(source, /z-\[99999\]|z-\[100000\]|zIndex:\s*99999/);
  assert.doesNotMatch(source, /rgba\(|#[0-9a-fA-F]{3,8}|bg-black\/|bg-white\/|text-white\/|border-white\/|text-purple-|bg-purple-/);
  assert.doesNotMatch(source, /getPremiumStyles/);
});
