import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';

const ROOT_DIR = process.cwd();

function readSource(relativePath: string): string {
  return readFileSync(path.join(ROOT_DIR, relativePath), 'utf-8');
}

test('mobile settings shell keeps the focused four-entry home inside the shared router-backed workbench', () => {
  const appSource = readSource('src/App.tsx');
  const settingsSource = readSource('src/components/settings/SettingsPanel.localized.tsx');
  const mobileSurfaceSource = readSource('src/components/mobile/MobileWorkspaceSurface.tsx');
  const registrySource = readSource('src/components/settings/settingsRegistry.ts');
  const homeSource = readSource('src/components/settings/mobile/MobileSettingsHome.tsx');

  assert.match(homeSource, /data-testid="mobile-settings-home"/);
  assert.match(homeSource, /Overview \/ API \/ Billing \/ Errors/);
  assert.match(homeSource, /label: 'Overview'/);
  assert.match(homeSource, /label: 'Billing'/);
  assert.match(homeSource, /label: 'Errors'/);
  assert.doesNotMatch(homeSource, /Storage/);
  assert.match(settingsSource, /MobileSettingsHome/);
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
