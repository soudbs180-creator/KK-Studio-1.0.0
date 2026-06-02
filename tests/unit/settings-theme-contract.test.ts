import { readSource } from '../support/workspacePaths.js';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';

const ROOT_DIR = process.cwd();



test('premium settings tokens expose shared typography, radius, and motion scales for both themes', () => {
  const cssSource = readSource('apps/web/src/index.css');

  assert.match(cssSource, /--type-display:/);
  assert.match(cssSource, /--type-title-1:/);
  assert.match(cssSource, /--type-title-2:/);
  assert.match(cssSource, /--type-title-3:/);
  assert.match(cssSource, /--type-body-1:/);
  assert.match(cssSource, /--type-body-2:/);
  assert.match(cssSource, /--type-caption:/);
  assert.match(cssSource, /--type-micro:/);
  assert.match(cssSource, /--radius-control-sm:/);
  assert.match(cssSource, /--radius-control-md:/);
  assert.match(cssSource, /--radius-surface-md:/);
  assert.match(cssSource, /--radius-surface-lg:/);
  assert.match(cssSource, /--motion-hover:/);
  assert.match(cssSource, /--motion-toggle:/);
  assert.match(cssSource, /--motion-panel:/);
  assert.match(cssSource, /--motion-theme:/);
  assert.match(cssSource, /--settings-state-info-bg:/);
  assert.match(cssSource, /--settings-state-success-bg:/);
  assert.match(cssSource, /--settings-state-warning-bg:/);
  assert.match(cssSource, /--settings-state-danger-bg:/);
  assert.match(cssSource, /--settings-nav-glass-bg:/);
  assert.match(cssSource, /--settings-nav-glass-border:/);
  assert.match(cssSource, /\.settings-panel \{[\s\S]*--settings-page-bg: #f5f5f7;/);
  assert.match(cssSource, /\.settings-panel \{[\s\S]*--settings-accent-rgb: 0 113 227;/);
  assert.match(cssSource, /body\.dark-mode \.settings-panel \{[\s\S]*--settings-accent-rgb: 41 151 255;/);
  assert.doesNotMatch(cssSource, /\.settings-panel \{[\s\S]*--settings-accent-rgb: 130 135 145;/);
});

test('shared settings primitives consume the Apple token contract instead of hard-coded panel styling', () => {
  const scaffoldSource = readSource('apps/web/src/components/settings/SettingsScaffold.tsx');
  const uiSource = readSource('apps/web/src/components/settings/ui/index.tsx');
  const headerSource = readSource('apps/web/src/components/settings/desktop/SettingsDesktopWorkbenchHeader.tsx');
  const sidebarSource = readSource('apps/web/src/components/settings/desktop/SettingsDesktopSidebar.tsx');

  assert.match(scaffoldSource, /var\(--radius-control-md\)/);
  assert.match(scaffoldSource, /var\(--settings-state-info-bg\)/);
  assert.match(scaffoldSource, /var\(--settings-state-warning-bg\)/);
  assert.match(scaffoldSource, /var\(--settings-state-danger-bg\)/);
  assert.match(uiSource, /var\(--radius-control-md\)/);
  assert.match(uiSource, /var\(--type-body-2\)/);
  assert.match(headerSource, /var\(--settings-shell-header-bg\)/);
  assert.match(headerSource, /var\(--settings-nav-glass-border\)/);
  assert.match(sidebarSource, /var\(--settings-nav-glass-bg\)/);
  assert.doesNotMatch(uiSource, /rounded-\[16px\]/);
  assert.doesNotMatch(headerSource, /text-\[28px\]/);
  assert.doesNotMatch(headerSource, /backdropFilter:/);
});
