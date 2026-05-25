import { readSource } from '../support/workspacePaths.js';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';

const ROOT_DIR = process.cwd();



test('desktop settings shell keeps navigation metadata in the sidebar and leaves page titles to the active settings view', () => {
  const shellSource = readSource('src/components/settings/SettingsPanel.localized.tsx');
  const routeConfigSource = readSource('src/components/settings/settingsRouteConfig.tsx');
  const headerSource = readSource('src/components/settings/desktop/SettingsDesktopWorkbenchHeader.tsx');
  const sidebarSource = readSource('src/components/settings/desktop/SettingsDesktopSidebar.tsx');

  assert.match(shellSource, /import SettingsDesktopSidebar from '\.\/desktop\/SettingsDesktopSidebar';/);
  assert.match(shellSource, /import SettingsDesktopWorkbenchHeader from '\.\/desktop\/SettingsDesktopWorkbenchHeader';/);
  assert.match(shellSource, /<SettingsDesktopSidebar/);
  assert.match(shellSource, /<SettingsDesktopWorkbenchHeader/);
  assert.match(shellSource, /const sections = getSettingsNavSections\(language\);/);
  assert.match(shellSource, /sections=\{sections\}/);
  assert.match(shellSource, /<SettingsLanguageToggle compact \/>/);
  assert.doesNotMatch(shellSource, /const headerMeta = getSettingsViewMeta\(activeView, language\);/);
  assert.doesNotMatch(shellSource, /languageControl=<\{?<SettingsLanguageToggle \/>/);
  assert.doesNotMatch(shellSource, /<SettingsLanguageToggle \/>/);
  assert.doesNotMatch(shellSource, /const headerPrimaryAction = getSettingsPrimaryActionMeta\(activeView, language\);/);
  assert.doesNotMatch(shellSource, /const headerStatusSummaryLabel = getSettingsStatusSummaryLabel\(activeView, language\);/);
  assert.doesNotMatch(shellSource, /primaryActionLabel=\{headerPrimaryAction\.label\}/);
  assert.doesNotMatch(shellSource, /statusSummaryLabel=\{headerStatusSummaryLabel\}/);
  assert.match(shellSource, /aria-label=\{pick\('语言切换', 'Language switch'\)\}/);
  assert.match(shellSource, />\s*中文\s*</);
  assert.match(shellSource, /pick\('当前账户', 'Current account'\)/);
  assert.match(shellSource, /pick\('管理员', 'Administrator'\)/);
  assert.match(shellSource, /pick\('标准账户', 'Standard account'\)/);
  assert.match(shellSource, /data-testid="settings-account-block"/);
  assert.doesNotMatch(shellSource, /navigate\(buildSettingsPath\('api-management'\)\);/);
  assert.match(shellSource, /renderSettingsRouteElements\(/);
  assert.match(shellSource, /refreshKey:\s*contentRefreshKey/);
  assert.doesNotMatch(shellSource, /<Suspense key=\{`\$\{activeView\}:\$\{contentRefreshKey\}`\}/);
  assert.doesNotMatch(shellSource, /<Route path="\/settings\/api-management"/);
  assert.match(routeConfigSource, /refreshKey\?: number;/);
  assert.match(routeConfigSource, /const routeRefreshKey = `\$\{definition\.kind\}:\$\{definition\.path \|\| 'dashboard'\}:\$\{options\.refreshKey \|\| 0\}`;/);
  assert.match(routeConfigSource, /export function renderSettingsRouteElements/);
  assert.doesNotMatch(shellSource, /settings-toolbar-search/);
  assert.doesNotMatch(shellSource, /System Active/);
  assert.match(sidebarSource, /items\.filter\(\(item\) => item\.section === section\.id\)/);
  assert.match(sidebarSource, /item\.description/);
  assert.match(sidebarSource, /section\.label/);
  assert.doesNotMatch(headerSource, /SettingsBadge/);
  assert.doesNotMatch(headerSource, /Current surface/);
  assert.doesNotMatch(headerSource, /Primary next step/);
  assert.doesNotMatch(headerSource, /meta:/);
  assert.doesNotMatch(headerSource, /languageControl\?: React\.ReactNode;/);
  assert.doesNotMatch(headerSource, /meta\.title/);
  assert.doesNotMatch(headerSource, /meta\.description/);
  assert.doesNotMatch(headerSource, /meta\.eyebrow/);
  assert.doesNotMatch(headerSource, /pick\('当前面板', 'Current surface'\)/);
  assert.doesNotMatch(headerSource, /pick\('主要下一步', 'Primary next step'\)/);
  assert.doesNotMatch(headerSource, /pick\('视图工具', 'View tools'\)/);
  assert.match(headerSource, /pick\('刷新', 'Refresh'\)/);
  assert.match(headerSource, /pick\('日志', 'Logs'\)/);
  assert.match(headerSource, /pick\('关闭', 'Close'\)/);
});

test('desktop workbench header stays action-only so it does not duplicate the active page hero', () => {
  const headerSource = readSource('src/components/settings/desktop/SettingsDesktopWorkbenchHeader.tsx');

  assert.doesNotMatch(headerSource, /pick\('当前面板', 'Current surface'\)/);
  assert.doesNotMatch(headerSource, /pick\('主要下一步', 'Primary next step'\)/);
  assert.doesNotMatch(headerSource, /pick\('视图工具', 'View tools'\)/);
  assert.doesNotMatch(headerSource, /meta\.title/);
  assert.doesNotMatch(headerSource, /meta\.description/);
  assert.doesNotMatch(headerSource, /meta\.eyebrow/);
  assert.doesNotMatch(headerSource, /languageControl/);
  assert.match(headerSource, /pick\('刷新', 'Refresh'\)/);
  assert.match(headerSource, /pick\('日志', 'Logs'\)/);
  assert.match(headerSource, /pick\('关闭', 'Close'\)/);
});

test('settings workbench flattens cramped nested containers and clips rounded surfaces cleanly', () => {
  const headerSource = readSource('src/components/settings/desktop/SettingsDesktopWorkbenchHeader.tsx');
  const cssSource = readSource('src/index.css');

  assert.match(headerSource, /settings-desktop-quick-actions/);
  assert.doesNotMatch(headerSource, /rounded-full border p-1/);
  const quickActionsClass = headerSource.match(/className="([^"]*settings-desktop-quick-actions[^"]*)"/);
  assert.ok(quickActionsClass);
  assert.doesNotMatch(
    quickActionsClass[1],
    /(?:^|\s)(?:rounded(?:-[^\s"]+)?|border(?:-[^\s"]+)?|bg-[^\s"]+|shadow(?:-[^\s"]+)?|ring(?:-[^\s"]+)?|backdrop(?:-[^\s"]+)?|p-\d|px-\d|py-\d)(?:\s|$)/,
  );
  assert.match(
    headerSource,
    /<div className="settings-desktop-quick-actions[^"]*">\s*<SettingsActionButton[\s\S]*<SettingsActionButton[\s\S]*<SettingsActionButton/,
  );
  assert.match(
    cssSource,
    /\.settings-panel \.settings-desktop-quick-actions \{[\s\S]*background: transparent !important;[\s\S]*border: 0 !important;[\s\S]*box-shadow: none !important;/,
  );
  assert.match(
    cssSource,
    /\.settings-panel \.settings-desktop-quick-actions > button \{[\s\S]*border-radius: var\(--radius-control-md\) !important;[\s\S]*box-shadow: none !important;/,
  );
  assert.doesNotMatch(
    cssSource,
    /\.settings-panel \.settings-reference-card,[\s\S]*\.settings-panel \.settings-section-card \{[\s\S]*overflow: clip;/,
  );
  assert.match(
    cssSource,
    /\.settings-panel \.settings-reference-card,[\s\S]*\.settings-panel \.settings-section-card \{[\s\S]*overflow: hidden;/,
  );
  assert.match(
    cssSource,
    /\.settings-panel \.settings-shell-desktop \{[\s\S]*border: 1px solid var\(--settings-shell-border\) !important;[\s\S]*box-shadow: var\(--settings-shell-shadow\) !important;/,
  );
  assert.match(
    cssSource,
    /\.settings-panel \.settings-shell-mobile \{[\s\S]*background: var\(--frost-card-framework-bg\) !important;[\s\S]*border: 0 !important;[\s\S]*box-shadow: none !important;/,
  );
  assert.match(
    cssSource,
    /\.settings-panel \.settings-shell-main__topbar \{[\s\S]*background: transparent !important;[\s\S]*border-bottom-color: transparent !important;[\s\S]*box-shadow: none !important;/,
  );
  assert.match(
    cssSource,
    /\.settings-panel \.settings-reference-toolbar--flat \{[\s\S]*padding: 0 !important;[\s\S]*background: transparent !important;/,
  );
  assert.match(cssSource, /\.settings-panel \.settings-provider-card__metric,[\s\S]*\.settings-panel \.settings-reference-mini-metric,[\s\S]*\.settings-panel \.settings-reference-list-item,[\s\S]*\.settings-panel \.settings-log-entry,[\s\S]*\.settings-panel \.settings-reference-ring-row \{[\s\S]*box-shadow: none !important;/);
  assert.match(cssSource, /\.settings-panel \.settings-api-quick-add__icon \{[\s\S]*box-shadow: none !important;/);
  assert.match(cssSource, /\.settings-panel \.settings-shell-page--desktop \.settings-reference-ring-row \{[\s\S]*display: grid;[\s\S]*grid-template-columns: 64px minmax\(0, 1fr\);/);
  assert.match(
    cssSource,
    /\.settings-panel \.settings-shell-page--desktop \.settings-dashboard-overview-grid \.settings-reference-ring-row \{[\s\S]*background: transparent !important;[\s\S]*border-color: transparent !important;[\s\S]*box-shadow: none !important;/,
  );
});
