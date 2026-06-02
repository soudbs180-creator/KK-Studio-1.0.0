import { readSource } from '../support/workspacePaths.js';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';

const ROOT_DIR = process.cwd();



test('settings shell keeps legacy admin and billing aliases canonicalized instead of surfacing them as first-class views', () => {
  const panelSource = readSource('apps/web/src/components/settings/SettingsPanel.localized.tsx');
  const registrySource = readSource('apps/web/src/components/settings/settingsRegistry.ts');
  const routesSource = readSource('apps/web/src/components/settings/settingsRouteConfig.tsx');
  const headerSource = readSource('apps/web/src/components/settings/desktop/SettingsDesktopWorkbenchHeader.tsx');

  assert.match(registrySource, /export type LegacySettingsViewId =/);
  assert.match(registrySource, /export const LEGACY_SETTINGS_VIEW_ALIASES: Record<LegacySettingsViewId, CanonicalSettingsViewId> = \{/);
  assert.match(registrySource, /'admin-console': 'api-management',/);
  assert.match(registrySource, /'cost-estimation': 'consumption-records',/);
  assert.match(panelSource, /navigate\(\s*buildSettingsPath\(view\)(?:,|\s*\))/);
  assert.doesNotMatch(panelSource, /id: 'admin-console',/);
  assert.match(routesSource, /from '\.\/settingsRegistry';/);
  assert.match(routesSource, /LEGACY_SETTINGS_ROUTE_REDIRECTS/);
  assert.match(routesSource, /buildSettingsPath\(target\)/);
  assert.doesNotMatch(routesSource, /const isLegacyAdminSettingsPath =/);
  assert.doesNotMatch(headerSource, /'admin-console': \{/);
});
