import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';

const ROOT_DIR = process.cwd();

function readSource(relativePath: string): string {
  return readFileSync(path.join(ROOT_DIR, relativePath), 'utf-8');
}

test('package.json exposes a mobile settings browser verification script', () => {
  const pkg = JSON.parse(readSource('package.json')) as {
    scripts?: Record<string, string>;
  };

  assert.equal(pkg.scripts?.['verify:mobile-settings-smoke'], 'node scripts/test/verify-mobile-settings-smoke.mjs');
  assert.equal(pkg.scripts?.['verify:desktop-settings-smoke'], 'node scripts/test/verify-desktop-settings-smoke.mjs');
});

test('verify:changes pulls the mobile settings smoke verification into the main verification chain once', () => {
  const pkg = JSON.parse(readSource('package.json')) as {
    scripts?: Record<string, string>;
  };

  const verifyChanges = pkg.scripts?.['verify:changes'] || '';

  assert.match(verifyChanges, /npm run verify:prompt-group-drag && npm run verify:mobile-settings-smoke/);
  assert.equal((verifyChanges.match(/verify:mobile-settings-smoke/g) || []).length, 1);
  assert.match(verifyChanges, /npm run verify:desktop-settings-smoke/);
  assert.equal((verifyChanges.match(/verify:desktop-settings-smoke/g) || []).length, 1);
});

test('mobile settings smoke verification uses stable selectors for the mobile shell, detail screen, settings home, and workbench sections', () => {
  const scriptSource = readSource('scripts/test/verify-mobile-settings-smoke.mjs');
  const mobileHeaderSource = readSource('src/components/mobile/MobileHeader.tsx');
  const mobileSurfaceSource = readSource('src/components/mobile/MobileWorkspaceSurface.tsx');
  const mobileTileSource = readSource('src/components/mobile/MobileResultTile.tsx');
  const settingsHomeSource = readSource('src/components/settings/mobile/MobileSettingsHome.tsx');
  const workbenchSectionsSource = readSource('src/components/settings/apiWorkbenchSections.tsx');
  const scaffoldSource = readSource('src/components/settings/SettingsScaffold.tsx');

  assert.match(scriptSource, /mobile-workspace-surface/);
  assert.match(scriptSource, /mobile-header-menu-button/);
  assert.match(scriptSource, /mobile-result-tile/);
  assert.match(scriptSource, /mobile-result-detail-screen/);
  assert.match(scriptSource, /mobile-settings-home/);
  assert.match(scriptSource, /settings-workbench-overview/);
  assert.match(scriptSource, /settings-workbench-diagnostics/);
  assert.match(scriptSource, /settings-workbench-platform/);

  assert.match(mobileHeaderSource, /data-testid="mobile-header-menu-button"/);
  assert.match(mobileSurfaceSource, /data-testid="mobile-more-menu-settings"/);
  assert.match(mobileSurfaceSource, /data-testid="mobile-more-sheet"/);
  assert.match(mobileTileSource, /data-testid=\{`mobile-result-tile-\$\{entry\.id\}`\}/);
  assert.match(settingsHomeSource, /data-testid=\{`mobile-settings-entry-\$\{entry\.id\}`\}/);
  assert.match(scaffoldSource, /testId\?: string;/);
  assert.match(scaffoldSource, /data-testid=\{testId\}/);
  assert.match(workbenchSectionsSource, /testId="settings-workbench-overview"/);
  assert.match(workbenchSectionsSource, /testId="settings-workbench-current-view"/);
  assert.match(workbenchSectionsSource, /testId="settings-workbench-stage"/);
  assert.match(workbenchSectionsSource, /testId="settings-workbench-diagnostics"/);
  assert.match(workbenchSectionsSource, /testId="settings-workbench-platform"/);
});

test('desktop settings smoke verification covers direct settings routes and the in-app settings entry with stable selectors', () => {
  const scriptSource = readSource('scripts/test/verify-desktop-settings-smoke.mjs');
  const appSource = readSource('src/App.tsx');
  const settingsPanelSource = readSource('src/components/settings/SettingsPanel.localized.tsx');
  const apiSettingsViewSource = readSource('src/components/settings/ApiSettingsView.tsx');
  const workbenchSectionsSource = readSource('src/components/settings/apiWorkbenchSections.tsx');

  assert.match(scriptSource, /\/settings'/);
  assert.match(scriptSource, /\/settings\/api-management'/);
  assert.match(scriptSource, /desktop-user-menu-trigger/);
  assert.match(scriptSource, /desktop-user-menu-settings/);
  assert.match(scriptSource, /settings-page-root/);
  assert.match(scriptSource, /settings-workbench-stage/);
  assert.match(scriptSource, /settings-workbench-diagnostics/);
  assert.match(scriptSource, /api-workbench-diagnostics-toggle/);
  assert.match(scriptSource, /api-workbench-primary-action/);
  assert.match(scriptSource, /api-official-editor-back/);
  assert.match(scriptSource, /officialEditorBack/);
  assert.match(scriptSource, /waitFor\(\{ state: 'hidden', timeout: 15000 \}\)/);
  assert.doesNotMatch(scriptSource, /waitForPathname\(page, '\/settings\/api-management\/official\/new'\)/);
  assert.doesNotMatch(scriptSource, /settings-shell-desktop/);
  assert.doesNotMatch(scriptSource, /overlayWorkbenchStage/);
  assert.doesNotMatch(scriptSource, /getByRole\('button', \{ name: \/Show diagnostics\/i \}\)/);
  assert.doesNotMatch(scriptSource, /getByRole\('button', \{ name: \/Hide diagnostics\/i \}\)/);

  assert.match(appSource, /data-testid="desktop-user-menu-trigger"/);
  assert.match(appSource, /data-testid="desktop-user-menu-settings"/);
  assert.match(settingsPanelSource, /data-testid="settings-page-root"/);
  assert.match(workbenchSectionsSource, /data-testid="api-workbench-diagnostics-toggle"/);
  assert.ok((apiSettingsViewSource.match(/data-testid="api-official-editor-back"/g) || []).length >= 2);
});
