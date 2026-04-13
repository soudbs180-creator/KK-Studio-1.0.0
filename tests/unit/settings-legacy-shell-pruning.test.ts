import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';

const ROOT_DIR = process.cwd();

function readSource(relativePath: string): string {
  return readFileSync(path.join(ROOT_DIR, relativePath), 'utf-8');
}

test('settings shell keeps legacy admin and billing aliases canonicalized instead of surfacing them as first-class views', () => {
  const panelSource = readSource('src/components/settings/SettingsPanel.localized.tsx');
  const routesSource = readSource('src/routes/settingsRoutes.tsx');
  const headerSource = readSource('src/components/settings/desktop/SettingsDesktopWorkbenchHeader.tsx');

  assert.match(panelSource, /type LegacySettingsViewId =/);
  assert.match(panelSource, /const LEGACY_SETTINGS_VIEW_ALIASES: Record<LegacySettingsViewId, CanonicalSettingsViewId> = \{/);
  assert.match(panelSource, /'admin-console': 'api-management',/);
  assert.match(panelSource, /'cost-estimation': 'consumption-records',/);
  assert.match(panelSource, /navigate\(buildSettingsPath\('api-management'\)\);/);
  assert.doesNotMatch(panelSource, /id: 'admin-console',/);
  assert.match(routesSource, /const LEGACY_SETTINGS_VIEW_ALIASES: Record<LegacySettingsViewId, CanonicalSettingsViewId> = \{/);
  assert.match(routesSource, /'credit-models': 'api-management',/);
  assert.match(routesSource, /'cost-estimation': 'consumption-records',/);
  assert.doesNotMatch(routesSource, /const isLegacyAdminSettingsPath =/);
  assert.doesNotMatch(headerSource, /'admin-console': \{/);
});
