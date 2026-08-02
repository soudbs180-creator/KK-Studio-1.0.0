import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readSource } from '../support/workspacePaths.js';

test('desktop settings shell owns the grouped console sidebar and shared routed content', () => {
  const shellSource = readSource('apps/web/src/components/settings/SettingsWorkbenchShell.tsx');
  const routeSource = readSource('apps/web/src/components/settings/settingsRouteConfig.tsx');

  assert.match(shellSource, /const SettingsConsoleSidebar/);
  assert.match(shellSource, /const SettingsConsoleTopbar/);
  assert.match(shellSource, /const SettingsConsoleRoutes/);
  assert.match(shellSource, /<SettingsConsoleSidebar activeView=\{activeView\}/);
  assert.match(shellSource, /<SettingsConsoleTopbar activeView=\{activeView\}/);
  assert.match(shellSource, /renderSettingsRouteElements/);
  assert.match(routeSource, /refreshKey\?: number;/);
  assert.match(routeSource, /path: 'user-profile\/security'/);
  assert.match(routeSource, /path: 'recharge'/);
  assert.doesNotMatch(shellSource, /SettingsDesktopSidebar/);
  assert.doesNotMatch(shellSource, /SettingsDesktopWorkbenchHeader/);
});

test('desktop console sidebar exposes fixed groups and a bottom account entry', () => {
  const shellSource = readSource('apps/web/src/components/settings/SettingsWorkbenchShell.tsx');
  const navigationSource = readSource('apps/web/src/components/settings/settingsNavigationRegistry.ts');

  assert.match(shellSource, /getSettingsNavigationGroups\(language\)/);
  for (const label of ['总览', '集成', 'API 配置', '能力配置', 'AI 代理', '系统维护', '数据与安全', '性能配置', '系统日志']) {
    assert.match(navigationSource, new RegExp(label));
  }
  assert.match(shellSource, /className="settings-console-nav__group"/);
  assert.match(shellSource, /className="settings-console-account"/);
  assert.match(shellSource, /onClick=\{\(\) => onNavigate\('user-profile'\)\}/);
  assert.doesNotMatch(shellSource, /type="search"/);
});

test('desktop console topbar stays compact and action-oriented', () => {
  const shellSource = readSource('apps/web/src/components/settings/SettingsWorkbenchShell.tsx');

  assert.doesNotMatch(shellSource, /<span>\{meta\.eyebrow\}<\/span>/);
  assert.match(shellSource, /aria-label=\{pick\('切换主题', 'Toggle theme'\)\}/);
  assert.match(shellSource, /aria-label=\{pick\('刷新当前页面', 'Refresh current view'\)\}/);
  assert.match(shellSource, /aria-label=\{pick\('关闭设置', 'Close settings'\)\}/);
  assert.doesNotMatch(shellSource, /settings-toolbar-search/);
});
