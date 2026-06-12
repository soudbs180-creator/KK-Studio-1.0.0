import { readSource } from '../support/workspacePaths.js';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';

const ROOT_DIR = process.cwd();



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

test('mobile settings smoke verification opens settings directly on overview before entering API workbench', () => {
  const scriptSource = readSource('scripts/test/verify-mobile-settings-smoke.mjs');
  const mobileHeaderSource = readSource('apps/web/src/components/mobile/MobileHeader.tsx');
  const mobileSurfaceSource = readSource('apps/web/src/components/mobile/MobileWorkspaceSurface.tsx');
  const mobileTileSource = readSource('apps/web/src/components/mobile/MobileResultTile.tsx');
  const dashboardSource = readSource('apps/web/src/components/settings/views/DashboardView.localized.tsx');
  const workbenchSectionsSource = readSource('apps/web/src/components/settings/apiWorkbenchSections.tsx');
  const scaffoldSource = readSource('apps/web/src/components/settings/SettingsScaffold.tsx');

  assert.match(scriptSource, /mobile-workspace-surface/);
  assert.match(scriptSource, /mobile-header-menu-button/);
  assert.match(scriptSource, /mobile-result-tile/);
  assert.match(scriptSource, /\[data-testid\^="mobile-result-tile-"\]/);
  assert.match(scriptSource, /localStorage\.setItem\(storageKey, JSON\.stringify\(state\)\);[\s\S]*page\.reload\(\{ waitUntil: 'domcontentloaded' \}\);[\s\S]*page\.waitForTimeout\(2500\);/);
  assert.match(scriptSource, /mobile-result-detail-screen/);
  assert.match(scriptSource, /设置总览\|Settings Overview/);
  assert.match(scriptSource, /添加 API|本地 API|Local API/);
  assert.match(scriptSource, /api-official-provider-add|api-simple-provider-add/);
  assert.match(scriptSource, /api-official-editor-back/);
  assert.match(scriptSource, /Advanced mode/);
  assert.match(scriptSource, /Hide advanced mode/);
  assert.doesNotMatch(scriptSource, /mobile-settings-home/);
  assert.doesNotMatch(scriptSource, /mobile-settings-entry-api-management/);
  assert.doesNotMatch(scriptSource, /鏌ョ湅璇婃柇/);
  assert.match(scriptSource, /settings-workbench-overview/);
  assert.match(scriptSource, /settings-workbench-diagnostics/);
  assert.match(scriptSource, /settings-workbench-platform/);
  assert.match(scriptSource, /mode: 'fallback'/);
  assert.match(scriptSource, /assertHttpHtml/);
  assert.match(scriptSource, /browserPreflight/);
  assert.match(scriptSource, /runBrowserPreflight/);
  assert.match(scriptSource, /temp_user_session_v1/);
  assert.match(scriptSource, /mobile-smoke-temp-user/);
  assert.match(scriptSource, /page\.addInitScript\(\(\{ state, storageKey \}\) => \{/);
  assert.match(scriptSource, /window\.localStorage\.setItem\(storageKey, JSON\.stringify\(state\)\);/);

  assert.match(mobileHeaderSource, /data-testid="mobile-header-menu-button"/);
  assert.match(mobileSurfaceSource, /data-testid="mobile-more-menu-settings"/);
  assert.match(mobileSurfaceSource, /data-testid="mobile-more-sheet"/);
  assert.match(mobileTileSource, /data-testid=\{`mobile-result-tile-\$\{entry\.id\}`\}/);
  assert.match(dashboardSource, /dashboard-grid-card/);
  assert.match(dashboardSource, /dashboardPrimaryAction/);
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
  const desktopChromeSource = readSource('apps/web/src/app/AppDesktopChrome.tsx');
  const settingsPanelSource = readSource('apps/web/src/components/settings/SettingsPanel.localized.tsx');
  const apiSettingsViewSource = readSource('apps/web/src/components/settings/ApiSettingsView.tsx');
  const workbenchSectionsSource = readSource('apps/web/src/components/settings/apiWorkbenchSections.tsx');

  assert.match(scriptSource, /\/settings'/);
  assert.match(scriptSource, /\/settings\/api-management'/);
  assert.match(scriptSource, /desktop-user-menu-trigger/);
  assert.match(scriptSource, /desktop-user-menu-settings/);
  assert.match(scriptSource, /settings-page-root/);
  assert.match(scriptSource, /api-official-provider-add/);
  assert.match(scriptSource, /Advanced mode/);
  assert.match(scriptSource, /Hide advanced mode/);
  assert.match(scriptSource, /SETTINGS_API_PATH\}\/official\/new/);
  assert.match(scriptSource, /settings-workbench-stage/);
  assert.match(scriptSource, /settings-workbench-diagnostics/);
  assert.match(scriptSource, /testId="settings-workbench-overview"/);
  assert.match(scriptSource, /testId="settings-workbench-capability"\|Capability roles/);
  assert.match(scriptSource, /api-workbench-diagnostics-toggle/);
  assert.match(scriptSource, /Provider settings and capability routing\|dashboardPrimaryAction/);
  assert.doesNotMatch(scriptSource, /\/API setup\//);
  assert.doesNotMatch(scriptSource, /\/Usage & Status\//);
  assert.doesNotMatch(scriptSource, /\/API & Capability Routing\//);
  assert.match(scriptSource, /Hide more advanced items/);
  assert.match(scriptSource, /name: 'Hide more advanced items', exact: true/);
  assert.match(scriptSource, /api-official-editor-back/);
  assert.match(scriptSource, /mode: 'fallback'/);
  assert.match(scriptSource, /assertHttpHtml/);
  assert.match(scriptSource, /browserPreflight/);
  assert.match(scriptSource, /runBrowserPreflight/);
  assert.match(scriptSource, /officialEditorBack/);
  assert.match(scriptSource, /temp_user_session_v1/);
  assert.match(scriptSource, /smoke-temp-user/);
  assert.match(scriptSource, /waitFor\(\{ state: 'hidden', timeout: 15000 \}\)/);
  assert.doesNotMatch(scriptSource, /waitForPathname\(page, '\/settings\/api-management\/official\/new'\)/);
  assert.doesNotMatch(scriptSource, /settings-shell-desktop/);
  assert.doesNotMatch(scriptSource, /overlayWorkbenchStage/);
  assert.doesNotMatch(scriptSource, /getByRole\('button', \{ name: \/Show diagnostics\/i \}\)/);
  assert.doesNotMatch(scriptSource, /getByRole\('button', \{ name: \/Hide diagnostics\/i \}\)/);

  assert.match(desktopChromeSource, /data-testid="desktop-user-menu-trigger"/);
  assert.match(desktopChromeSource, /testId="desktop-user-menu-settings"/);
  assert.match(settingsPanelSource, /data-testid="settings-page-root"/);
  assert.match(workbenchSectionsSource, /data-testid="api-workbench-diagnostics-toggle"/);
  assert.ok((apiSettingsViewSource.match(/data-testid="api-official-editor-back"/g) || []).length >= 2);
});

test('browser smoke scripts prefer stable Playwright npx cache entries over alpha cache entries', () => {
  const scriptSources = [
    readSource('scripts/test/verify-mobile-settings-smoke.mjs'),
    readSource('scripts/test/verify-desktop-settings-smoke.mjs'),
    readSource('scripts/test/verify-prompt-group-drag.mjs'),
    readSource('scripts/test/verify-startup-runtime-banner-centering.mjs'),
  ];

  for (const scriptSource of scriptSources) {
    assert.match(scriptSource, /readPlaywrightCacheVersion/);
    assert.match(scriptSource, /isStablePlaywrightVersion/);
    assert.match(scriptSource, /Number\(right\.stable\) - Number\(left\.stable\)/);
  }
});
