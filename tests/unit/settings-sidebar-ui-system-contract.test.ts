import assert from 'node:assert/strict';
import { test } from 'node:test';

import { readSource } from '../support/workspacePaths.js';

test('desktop settings sidebar exposes module state attributes instead of private paint logic', () => {
  const source = readSource('apps/web/src/components/settings/desktop/SettingsDesktopSidebar.tsx');

  assert.match(source, /modules\.filter\(\(module\) => module\.id !== activeModuleId\)/);
  assert.match(source, /data-state="idle"/);
  assert.match(source, /data-accent=\{module\.id === 'ai'/);
  assert.match(source, /data-settings-module=\{module\.id\}/);
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

  assert.doesNotMatch(source, /\u5bb8\u30e4|\u5bee\u72b2|\u9418\u8235|\u7481\uFFFD|\u93c3\u30e5|\u701b\u6a3a|\u947e\u5cf0/);
  assert.match(source, /本地优先 · 快捷策略/);
  assert.match(source, /条能力链路已配置/);
  assert.match(source, /项运行告警/);
  assert.match(source, /张资源 ·/);
});
