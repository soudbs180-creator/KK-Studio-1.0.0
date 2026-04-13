import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';

const ROOT_DIR = process.cwd();

function readSource(relativePath: string): string {
  return readFileSync(path.join(ROOT_DIR, relativePath), 'utf-8');
}

test('production settings entry delegates to the localized router-backed workbench shell', () => {
  const appSource = readSource('src/App.tsx');
  const settingsEntrySource = readSource('src/components/settings/SettingsPanel.tsx');

  assert.match(appSource, /const SettingsPanel = lazy\(\(\) => import\('\.\/components\/settings\/SettingsPanel'\)\);/);
  assert.doesNotMatch(appSource, /const MobileApiSettingsView = lazy\(\(\) => import\('\.\/components\/settings\/ApiSettingsView'\)\);/);
  assert.doesNotMatch(appSource, /const MobileSystemLogsView = lazy\(\(\) => import\('\.\/components\/settings\/views\/SystemLogsView\.localized\.tsx'\)\);/);
  assert.doesNotMatch(appSource, /const MobileUsageView = lazy\(\(\) => import\('\.\/pages\/CostEstimation'\)\);/);
  assert.doesNotMatch(appSource, /const mobileSettingsHomeContent = isMobile \?/);
  assert.doesNotMatch(appSource, /const mobileSettingsPageContent = isMobile \?/);
  assert.doesNotMatch(appSource, /showSettingsPanel && !isMobile/);
  assert.match(appSource, /showSettingsPanel && \(/);
  assert.match(
    settingsEntrySource,
    /SettingsWorkbenchPanel[\s\S]*<SettingsWorkbenchPanel \{\.\.\.props\} \/>/,
  );
  assert.doesNotMatch(settingsEntrySource, /createPortal\(content, document\.body\)/);
  assert.doesNotMatch(settingsEntrySource, /const normalizedView = useMemo/);
});

test('settings routing metadata is owned by a shared registry instead of duplicated across shell and route modules', () => {
  const localizedShellSource = readSource('src/components/settings/SettingsPanel.localized.tsx');
  const routesSource = readSource('src/routes/settingsRoutes.tsx');

  assert.match(localizedShellSource, /from '\.\/settingsRegistry';/);
  assert.match(routesSource, /from '\.\.\/components\/settings\/settingsRegistry';/);
  assert.doesNotMatch(localizedShellSource, /const LEGACY_SETTINGS_VIEW_ALIASES: Record<LegacySettingsViewId, CanonicalSettingsViewId> = \{/);
  assert.doesNotMatch(localizedShellSource, /const getNavItems = \(language: AppLanguage\): NavItem\[] => \[/);
  assert.doesNotMatch(routesSource, /const LEGACY_SETTINGS_VIEW_ALIASES: Record<LegacySettingsViewId, CanonicalSettingsViewId> = \{/);
  assert.doesNotMatch(routesSource, /export const settingsNavItems: SettingsNavItem\[] = \[/);
});

test('settings workbench relies on the app router instead of nesting a MemoryRouter', () => {
  const localizedShellSource = readSource('src/components/settings/SettingsPanel.localized.tsx');

  assert.doesNotMatch(localizedShellSource, /import \{ MemoryRouter,/);
  assert.doesNotMatch(localizedShellSource, /<MemoryRouter[\s\S]*<\/MemoryRouter>/);
});
