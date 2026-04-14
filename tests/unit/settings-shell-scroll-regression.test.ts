import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';

const ROOT_DIR = process.cwd();

function readSource(relativePath: string): string {
  return readFileSync(path.join(ROOT_DIR, relativePath), 'utf-8');
}

test('desktop settings shell keeps a real inner scroll container and viewport-safe shell sizing', () => {
  const shellSource = readSource('src/components/settings/SettingsPanel.localized.tsx');
  const cssSource = readSource('src/index.css');

  assert.match(shellSource, /className="flex min-h-0 min-w-0 flex-1 flex-col"/);
  assert.match(
    cssSource,
    /\.settings-shell-desktop \{[\s\S]*width: min\(1480px, calc\(100vw - 48px\)\);[\s\S]*height: min\(calc\(100dvh - 48px\), 920px\);/,
  );
  assert.match(cssSource, /\.settings-shell-main \{[\s\S]*min-height: 0;/);
  assert.match(cssSource, /\.settings-shell-page \{[\s\S]*overflow-y: auto;[\s\S]*overscroll-behavior: contain;/);
});

test('dark-mode settings shell avoids the pure black canvas that made the workbench feel too heavy', () => {
  const cssSource = readSource('src/index.css');

  assert.match(cssSource, /body\.dark-mode \.settings-panel \{[\s\S]*--settings-shell-bg: #1B1D21;/);
  assert.match(cssSource, /body\.dark-mode \.settings-panel \{[\s\S]*--settings-page-bg: #24272C;/);
  assert.doesNotMatch(cssSource, /body\.dark-mode \.settings-panel \{[\s\S]*--settings-shell-bg: #000000;/);
  assert.doesNotMatch(cssSource, /body\.dark-mode \.settings-panel \{[\s\S]*--settings-page-bg: #000000;/);
});

test('settings visual tokens use neutral gray accents and keep nested cards shadowless by default', () => {
  const cssSource = readSource('src/index.css');

  assert.match(cssSource, /body\.dark-mode \.settings-panel \{[\s\S]*--settings-accent-rgb: 148 152 161;/);
  assert.doesNotMatch(cssSource, /body\.dark-mode \.settings-panel \{[\s\S]*--settings-accent-rgb: 118 162 255;/);
  assert.doesNotMatch(cssSource, /body\.dark-mode \.settings-panel \{[\s\S]*--settings-button-primary-bg: linear-gradient\(135deg, #8bbdff 0%, #6c90ff 100%\);/);
  assert.match(
    cssSource,
    /\.settings-panel \.settings-metric-card,[\s\S]*\.settings-panel \.api-settings-provider-item,[\s\S]*\.settings-panel \.settings-dashboard-row,[\s\S]*box-shadow: none;/,
  );
});
