import { readSource } from '../support/workspacePaths.js';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';

const ROOT_DIR = process.cwd();



test('production settings entry delegates to the localized router-backed workbench shell', () => {
  const appSource = readSource('apps/web/src/App.tsx');
  const settingsPageRootSource = readSource('apps/web/src/app/SettingsPageRoot.tsx');
  const settingsEntrySource = readSource('apps/web/src/components/settings/SettingsPanel.tsx');

  const switchSource = readSource('apps/web/src/app/AppRootContentSwitch.tsx');
  assert.match(appSource, /import AppRootContentSwitch from '\.\/app\/AppRootContentSwitch';/);
  assert.match(appSource, /AppContentComponent=\{AppRootContentSwitch\}/);
  assert.match(switchSource, /lazyWithRetry\(\(\) => import\('\.\/SettingsPageRoot'\)\)/);
  assert.match(switchSource, /const AdminLayoutSuspended: React\.FC<any> = \(props\) => \([\s\S]*?<AdminLayout \{\.\.\.props\} \/>[\s\S]*?\);/);
  assert.match(switchSource, /const SettingsPageRootSuspended: React\.FC<any> = \(props\) => \([\s\S]*?<SettingsPageRoot \{\.\.\.props\} \/>[\s\S]*?\);/);
  assert.match(settingsPageRootSource, /const SettingsPanel = lazyWithRetry\(\(\) => import\('\.\.\/components\/settings\/SettingsPanel'\)\);/);
  assert.match(settingsPageRootSource, /presentation="page"/);
  assert.match(settingsPageRootSource, /initialPathname=\{window\.location\.pathname\}/);
  assert.doesNotMatch(appSource, /const MobileApiSettingsView = lazy\(\(\) => import\('\.\/components\/settings\/ApiSettingsView'\)\);/);
  assert.doesNotMatch(appSource, /const MobileSystemLogsView = lazy\(\(\) => import\('\.\/components\/settings\/views\/SystemLogsView\.localized\.tsx'\)\);/);
  assert.doesNotMatch(appSource, /const MobileUsageView = lazy\(\(\) => import\('\.\/pages\/CostEstimation'\)\);/);
  assert.doesNotMatch(appSource, /const mobileSettingsHomeContent = isMobile \?/);
  assert.doesNotMatch(appSource, /const mobileSettingsPageContent = isMobile \?/);
  assert.match(
    settingsEntrySource,
    /SettingsWorkbenchPanel[\s\S]*<SettingsWorkbenchPanel \{\.\.\.props\} \/>/,
  );
  assert.doesNotMatch(settingsEntrySource, /createPortal\(content, document\.body\)/);
  assert.doesNotMatch(settingsEntrySource, /const normalizedView = useMemo/);
});

test('settings routing metadata is owned by a shared registry instead of duplicated across shell and route modules', () => {
  const localizedShellSource = readSource('apps/web/src/components/settings/SettingsWorkbenchShell.tsx');
  const routesSource = readSource('apps/web/src/components/settings/settingsRouteConfig.tsx');

  assert.match(localizedShellSource, /from '\.\/settingsRegistry';/);
  assert.match(routesSource, /from '\.\/settingsRegistry';/);
  assert.doesNotMatch(localizedShellSource, /const LEGACY_SETTINGS_VIEW_ALIASES: Record<LegacySettingsViewId, CanonicalSettingsViewId> = \{/);
  assert.doesNotMatch(localizedShellSource, /const getNavItems = \(language: AppLanguage\): NavItem\[] => \[/);
  assert.doesNotMatch(routesSource, /const LEGACY_SETTINGS_VIEW_ALIASES: Record<LegacySettingsViewId, CanonicalSettingsViewId> = \{/);
  assert.doesNotMatch(routesSource, /export const settingsNavItems: SettingsNavItem\[] = \[/);
});

test('settings workbench self-hosts a MemoryRouter because the app root does not mount a global router', () => {
  const localizedShellSource = readSource('apps/web/src/components/settings/SettingsWorkbenchPanel.tsx');
  const mainSource = readSource('apps/web/src/main.tsx');

  assert.doesNotMatch(mainSource, /<BrowserRouter/);
  assert.match(localizedShellSource, /import.*MemoryRouter.*from 'react-router-dom';/);
  assert.match(localizedShellSource, /<MemoryRouter initialEntries=\{\[initialEntry\]\} key=\{initialEntry\}>/);
});

test('page-mode settings navigation syncs the browser URL while overlay mode stays isolated from app routes', () => {
  const localizedShellSource = readSource('apps/web/src/components/settings/SettingsWorkbenchPanel.tsx');

  assert.match(localizedShellSource, /presentation === 'page'/);
  assert.match(localizedShellSource, /window\.history\.pushState\(/);
  assert.match(localizedShellSource, /window\.history\.replaceState\(/);
  assert.match(localizedShellSource, /window\.addEventListener\('popstate', handlePopstate\)/);
  assert.match(localizedShellSource, /window\.location\.assign\(nextWindowPath\)/);
});
