import { readSource } from '../support/workspacePaths.js';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';

const ROOT_DIR = process.cwd();



test('mobile settings shell opens a grouped console home and shares routed detail views', () => {
  const appSource = readSource('apps/web/src/App.tsx');
  const settingsSource = readSource('apps/web/src/components/settings/SettingsWorkbenchShell.tsx');
  const mobileSurfaceSource = readSource('apps/web/src/components/mobile/MobileWorkspaceSurface.tsx');
  const registrySource = readSource('apps/web/src/components/settings/settingsRegistry.ts');

  assert.match(settingsSource, /SettingsMobileDashboard/);
  assert.match(settingsSource, /SettingsConsoleRoutes/);
  assert.match(settingsSource, /const atHome = location\.pathname === '\/settings'/);
  assert.match(settingsSource, /if \(activeView === 'dashboard'\) onClose\(\);/);
  assert.doesNotMatch(appSource, /mobileSettingsSection/);
  assert.doesNotMatch(appSource, /openMobileSettings/);
  assert.match(mobileSurfaceSource, /onOpenSettings: \(\) => void;/);
  assert.match(mobileSurfaceSource, /onClick=\{onOpenSettings\}/);
  assert.doesNotMatch(mobileSurfaceSource, /settingsHome: React\.ReactNode;/);
  assert.doesNotMatch(mobileSurfaceSource, /settingsPage: React\.ReactNode;/);
  assert.doesNotMatch(mobileSurfaceSource, /settings-home/);
  assert.doesNotMatch(mobileSurfaceSource, /settings-page/);
  assert.match(registrySource, /id: 'storage-settings'/);
  assert.match(registrySource, /id: 'system-logs'/);
});

test('mobile settings shell treats settings root as the grouped home route', () => {
  const settingsSource = readSource('apps/web/src/components/settings/SettingsWorkbenchShell.tsx');

  assert.doesNotMatch(settingsSource, /SettingsRouterLocationState/);
  assert.doesNotMatch(settingsSource, /settingsMobileDetail/);
  assert.match(settingsSource, /const atHome = location\.pathname === '\/settings' \|\| location\.pathname === '\/settings\/'/);
  assert.match(settingsSource, /atHome \? <SettingsMobileDashboard/);
  assert.match(settingsSource, /const handleNavigate = \(view: CanonicalSettingsViewId\) => navigate\(buildSettingsPath\(view\)\);/);
});
