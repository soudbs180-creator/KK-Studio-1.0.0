import assert from 'node:assert/strict';
import { test } from 'node:test';

import { readSource } from '../support/workspacePaths.js';

const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

test('search palette exposes reusable shell tokens and primitives', () => {
  const cssSource = readSource('apps/web/src/styles/kk-ui-tokens.css');

  for (const token of [
    '--kk-search-palette-backdrop-bg',
    '--kk-search-palette-panel-bg',
    '--kk-search-palette-panel-border',
    '--kk-search-palette-panel-shadow',
    '--kk-search-palette-panel-blur',
    '--kk-search-palette-mobile-radius',
    '--kk-search-palette-desktop-radius',
  ]) {
    assert.match(cssSource, new RegExp(`${token}\\s*:`), `missing ${token}`);
  }

  for (const selector of [
    '.kk-search-palette-backdrop',
    '.kk-search-palette-scrim',
    '.kk-search-palette-panel',
    '[data-search-surface="mobile"] .kk-search-palette-panel',
    '[data-search-surface="desktop"] .kk-search-palette-panel',
  ]) {
    assert.match(cssSource, new RegExp(escapeRegExp(selector)), `missing ${selector}`);
  }

  assert.match(cssSource, /--kk-search-palette-backdrop-bg:\s*var\(--search-palette-overlay-bg\);/);
  assert.match(cssSource, /--kk-search-palette-panel-bg:\s*var\(--frost-card-framework-bg\);/);
  assert.match(cssSource, /--kk-search-palette-panel-border:\s*var\(--frost-card-framework-border\);/);
  assert.match(cssSource, /--kk-search-palette-panel-shadow:\s*var\(--frost-card-framework-shadow\);/);
});

test('search palette consumes shared layer and class-based surface styling', () => {
  const source = readSource('apps/web/src/components/layout/SearchPalette.tsx');

  assert.match(source, /import\s+\{\s*KK_LAYER\s*\}\s+from\s+'@kk\/ui'/);
  assert.match(source, /className=\{`kk-search-palette-backdrop/);
  assert.match(source, /className="kk-search-palette-scrim/);
  assert.match(source, /className=\{`kk-search-palette-panel/);
  assert.match(source, /zIndex:\s*KK_LAYER\.modal/);
  assert.match(source, /data-search-surface=\{isMobile \? 'mobile' : 'desktop'\}/);
  assert.match(source, /data-search-panel=\{isMobile \? 'mobile-bottom-sheet' : 'desktop-command-surface'\}/);
  assert.match(source, /clay-mobile-search-sheet mobile-sheet-viewport/);
  assert.match(source, /var\(--search-palette-mobile-radius\)/);
  assert.match(source, /var\(--search-palette-desktop-radius\)/);

  assert.doesNotMatch(source, /z-\[100\]/);
  assert.doesNotMatch(source, /className=\{`fixed inset-0 z-\[100\]/);
  assert.doesNotMatch(source, /style=\{\{\s*background:\s*'var\(--search-palette-overlay-bg\)'/);
  assert.doesNotMatch(source, /background:\s*'var\(--frost-card-framework-bg\)'/);
  assert.doesNotMatch(source, /borderColor:\s*'var\(--frost-card-framework-border\)'/);
  assert.doesNotMatch(source, /boxShadow:\s*'var\(--frost-card-framework-shadow\)'/);
  assert.doesNotMatch(source, /WebkitBackdropFilter:\s*'blur\(var\(--frost-card-framework-blur\)\) saturate\(1\.16\)'/);
  assert.doesNotMatch(source, /backdropFilter:\s*'blur\(var\(--frost-card-framework-blur\)\) saturate\(1\.16\)'/);
});
