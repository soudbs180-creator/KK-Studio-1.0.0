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

test('settings workbench self-hosts a MemoryRouter because the app root does not mount a global router', () => {
  const localizedShellSource = readSource('src/components/settings/SettingsPanel.localized.tsx');
  const mainSource = readSource('src/main.tsx');

  assert.doesNotMatch(mainSource, /<BrowserRouter/);
  assert.match(localizedShellSource, /import \{ MemoryRouter, Routes, useLocation, useNavigate \} from 'react-router-dom';/);
  assert.match(localizedShellSource, /<MemoryRouter initialEntries=\{\[initialEntry\]\} key=\{initialEntry\}>[\s\S]*<SettingsRouterShell/);
});
