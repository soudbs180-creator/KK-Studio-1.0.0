import { readSource } from '../support/workspacePaths.js';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';

const ROOT_DIR = process.cwd();

test('desktop settings shell keeps a real inner scroll container and viewport-safe shell sizing', () => {
  const shellSource = readSource('apps/web/src/components/settings/SettingsPanel.localized.tsx');
  const sidebarSource = readSource('apps/web/src/components/settings/desktop/SettingsDesktopSidebar.tsx');
  const headerSource = readSource('apps/web/src/components/settings/desktop/SettingsDesktopWorkbenchHeader.tsx');
  const cssSource = readSource('apps/web/src/index.css');

  assert.match(shellSource, /className="flex min-h-0 min-w-0 flex-1 flex-col"/);
  assert.match(sidebarSource, /width: 'var\(--settings-sidebar-width\)'/);
  assert.match(
    cssSource,
    /\.settings-shell-desktop \{[\s\S]*grid-template-columns: var\(--settings-sidebar-width\) minmax\(0, 1fr\);[\s\S]*--settings-shell-card-grid-2-width: 556px;[\s\S]*--settings-shell-content-width: var\(--settings-shell-card-grid-2-width\);[\s\S]*--settings-shell-adaptive-width: calc\(var\(--settings-sidebar-width\) \+ var\(--settings-shell-page-inline-padding\) \+ var\(--settings-shell-page-inline-padding\) \+ var\(--settings-shell-content-width\)\);[\s\S]*width: min\(var\(--settings-shell-adaptive-width\), calc\(100vw - var\(--chat-sidebar-width, 0px\) - 48px\)\);[\s\S]*height: min\(calc\(100dvh - 48px\), 920px\);[\s\S]*border-radius: var\(--settings-radius-unified\);[\s\S]*overflow: hidden;/,
  );
  assert.match(
    cssSource,
    /@media \(min-width: 1238px\) \{[\s\S]*\.settings-shell-desktop \{[\s\S]*--settings-shell-content-width: var\(--settings-shell-card-grid-3-width\);/,
  );
  assert.match(
    cssSource,
    /@media \(min-width: 1524px\) \{[\s\S]*\.settings-shell-desktop \{[\s\S]*--settings-shell-content-width: var\(--settings-shell-card-grid-4-width\);/,
  );
  assert.match(cssSource, /\.settings-panel \{[\s\S]*--settings-sidebar-width: 292px;/);
  assert.match(cssSource, /\.settings-shell-main \{[\s\S]*min-height: 0;/);
  assert.match(cssSource, /\.settings-shell-nav \{[\s\S]*position: relative;[\s\S]*z-index: 2;/);
  assert.match(cssSource, /\.settings-shell-main \{[\s\S]*z-index: 1;/);
  assert.match(cssSource, /\.settings-shell-page \{[\s\S]*overflow-y: auto;[\s\S]*overscroll-behavior: contain;/);
  assert.match(cssSource, /\.settings-shell-mobile__topbar \{[\s\S]*backdrop-filter: saturate\(180%\) blur\(20px\);/);
  assert.doesNotMatch(
    cssSource,
    /\.settings-panel \.settings-shell,\s*\.settings-panel \.settings-shell-page--desktop\s*\{[^}]*border: [12]px solid var\(--settings-shell-border\) !important;/,
  );
  const shellDesktopBlocks = cssSource.match(/(?:\.settings-panel\s+)?\.settings-shell-desktop\s*\{[^}]*\}/g) || [];
  assert.ok(shellDesktopBlocks.length > 0);
  for (const block of shellDesktopBlocks) {
    assert.doesNotMatch(block, /0 0 0 1px rgb\(255 255 255 \/ 0\.025\)/);
  }
  assert.doesNotMatch(sidebarSource, /backdropFilter:/);
  assert.doesNotMatch(headerSource, /backdropFilter:/);
  assert.doesNotMatch(
    cssSource,
    /\.settings-shell-nav,\s*\.settings-shell-main,\s*\.settings-shell-mobile\s*\{[^}]*backdrop-filter:/,
  );
  assert.doesNotMatch(
    cssSource,
    /body\.dark-mode\s+\.settings-shell-mobile,\s*body\.dark-mode\s+\.settings-shell-nav,\s*body\.dark-mode\s+\.settings-shell-main\s*\{[^}]*backdrop-filter:/,
  );
});

test('settings shell uses Apple page surfaces instead of the old gray control-console canvas', () => {
  const cssSource = readSource('apps/web/src/index.css');

  assert.match(cssSource, /\.settings-panel \{[\s\S]*--settings-page-bg: #f5f5f7;/);
  assert.match(cssSource, /\.settings-panel \{[\s\S]*--settings-shell-bg: #ffffff;/);
  assert.match(cssSource, /body\.dark-mode \.settings-panel \{[\s\S]*--settings-shell-bg: #000000;/);
  assert.match(cssSource, /body\.dark-mode \.settings-panel \{[\s\S]*--settings-page-bg: #0f0f10;/);
  assert.doesNotMatch(cssSource, /\.settings-panel \{[\s\S]*--settings-page-bg: #EEF1F4;/);
});

test('settings visual tokens use Apple blue accents and soft product-card shadows by default', () => {
  const cssSource = readSource('apps/web/src/index.css');

  assert.match(cssSource, /\.settings-panel \{[\s\S]*--settings-accent-rgb: 0 113 227;/);
  assert.match(cssSource, /\.settings-panel \{[\s\S]*--settings-radius-unified: 20px;/);
  assert.match(cssSource, /\.settings-panel \.settings-sidebar-item \{[\s\S]*border-radius: var\(--settings-radius-unified\)/);
  assert.match(cssSource, /\.settings-panel \.settings-shell-nav__search \{[\s\S]*border-radius: var\(--settings-radius-unified\)/);
  assert.match(cssSource, /\.settings-panel \.settings-reference-card \{[\s\S]*border-radius: var\(--settings-radius-unified\)/);
  assert.doesNotMatch(cssSource, /--settings-accent-rgb: 148 152 161;/);
  assert.match(cssSource, /\.settings-panel \.settings-reference-card \{[\s\S]*box-shadow: var\(--settings-card-shadow\);/);
});

test('settings sidebar search keeps the input visually transparent inside the search shell', () => {
  const sidebarSource = readSource('apps/web/src/components/settings/desktop/SettingsDesktopSidebar.tsx');
  const cssSource = readSource('apps/web/src/index.css');

  assert.match(sidebarSource, /className="w-full min-w-0 bg-transparent text-sm outline-none"/);
  assert.doesNotMatch(
    cssSource,
    /\.settings-panel \.settings-shell-nav__search,\s*[\r\n]+\.settings-panel \.settings-shell-nav__search input \{/,
  );
  assert.match(
    cssSource,
    /\.settings-panel \.settings-shell-nav__search input \{[\s\S]*background: transparent !important;[\s\S]*border: 0 !important;[\s\S]*box-shadow: none !important;[\s\S]*backdrop-filter: none;/,
  );
});
