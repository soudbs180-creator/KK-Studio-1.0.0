import { readSource } from '../support/workspacePaths.js';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';

const ROOT_DIR = process.cwd();



test('mobile settings shell opens the overview directly inside the shared router-backed workbench', () => {
  const appSource = readSource('apps/web/src/App.tsx');
  const settingsSource = readSource('apps/web/src/components/settings/SettingsWorkbenchShell.tsx');
  const mobileSurfaceSource = readSource('apps/web/src/components/mobile/MobileWorkspaceSurface.tsx');
  const registrySource = readSource('apps/web/src/components/settings/settingsRegistry.ts');

  assert.doesNotMatch(settingsSource, /MobileSettingsHome/);
  assert.match(settingsSource, /activeView === 'dashboard' \? onClose\(\) : onNavigate\('dashboard'\);/);
  assert.match(settingsSource, /pick\('关闭设置', 'Close settings'\)/);
  assert.match(settingsSource, /pick\('返回设置总览', 'Back to settings overview'\)/);
  assert.match(settingsSource, /onBackToApiManagement/);
  assert.doesNotMatch(settingsSource, /settings-shell-mobile__focus/);
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

test('mobile settings shell treats settings root as the dashboard detail route', () => {
  const settingsSource = readSource('apps/web/src/components/settings/SettingsWorkbenchShell.tsx');

  assert.doesNotMatch(settingsSource, /SettingsRouterLocationState/);
  assert.doesNotMatch(settingsSource, /settingsMobileDetail/);
  assert.doesNotMatch(settingsSource, /isMobileHomeRoute/);
  assert.doesNotMatch(settingsSource, /showHome/);
  assert.doesNotMatch(settingsSource, /setShowHome/);
  assert.match(settingsSource, /const handleNavigate = \(view: CanonicalSettingsViewId\) => \{\s*navigate\(buildSettingsPath\(view\)\);\s*\};/);
});
