import assert from 'node:assert/strict';
import { test } from 'node:test';

import { readSource } from '../support/workspacePaths.js';

test('desktop settings sidebar exposes system state attributes instead of private paint logic', () => {
  const source = readSource('apps/web/src/components/settings/desktop/SettingsDesktopSidebar.tsx');

  assert.match(source, /data-state=\{isActive \? 'active' : 'idle'\}/);
  assert.match(source, /data-accent=\{accent\}/);
  assert.match(source, /settings-sidebar-card__active-rail/);
  assert.match(source, /settings-sidebar-card__active-chevron/);
  assert.doesNotMatch(source, /<style>\{\`|rgba\(|#[0-9a-fA-F]{3,8}|linear-gradient\(to bottom|theme\.(glow|shadow|border|bg|icon)/);
  assert.doesNotMatch(source, /style=\{isActive \?/);
});

test('desktop settings sidebar primitives are tokenized in the settings system stylesheet', () => {
  const cssSource = readSource('apps/web/src/styles/settings.css');

  assert.match(cssSource, /\.settings-panel \.settings-sidebar-card\s*\{/);
  assert.match(cssSource, /\.settings-panel \.settings-sidebar-card\[data-state="active"\]\s*\{/);
  assert.match(cssSource, /\.settings-panel \.settings-sidebar-card\[data-accent="api"\]\s*\{/);
  assert.match(cssSource, /--settings-sidebar-card-accent:\s*var\(--settings-state-info-text\)/);
  assert.match(cssSource, /\.settings-panel \.settings-sidebar-card__active-rail\s*\{/);
  assert.match(cssSource, /\.settings-panel \.settings-sidebar-card__active-chevron\s*\{/);
});

test('desktop settings sidebar keeps Chinese status copy readable', () => {
  const source = readSource('apps/web/src/components/settings/desktop/SettingsDesktopSidebar.tsx');

  assert.doesNotMatch(source, /宸ヤ|寮犲|鐘舵|璁\uFFFD|鏃ュ|瀛樺|鑾峰/);
  assert.match(source, /工作区健康和总览面板就绪/);
  assert.match(source, /张图 ·/);
});
