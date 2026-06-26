import { readSource } from '../support/workspacePaths.js';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';

const ROOT_DIR = process.cwd();



test('settings shell and exported routes use one shared route factory instead of duplicating route trees', () => {
  const routeConfigSource = readSource('apps/web/src/components/settings/settingsRouteConfig.tsx');
  const panelSource = readSource('apps/web/src/components/settings/SettingsPanel.localized.tsx');
  const routesSource = readSource('apps/web/src/routes/settingsRoutes.tsx');

  assert.match(routeConfigSource, /export function createSettingsRouteObjects\(/);
  assert.match(routeConfigSource, /export function renderSettingsRouteElements\(/);
  assert.match(routeConfigSource, /path: 'storage-settings'/);
  assert.match(routeConfigSource, /path: 'capability-sources\/official\/:officialId'/);
  assert.match(routeConfigSource, /path: 'capability-sources\/provider\/:providerId'/);
  assert.match(routeConfigSource, /path: `\$\{basePath\}\/api-management\/\*`/);
  assert.match(panelSource, /from '\.\/settingsRouteConfig';/);
  assert.match(routesSource, /from '\.\.\/components\/settings\/settingsRouteConfig';/);
  assert.doesNotMatch(panelSource, /<Route path="\/settings\/api-management"/);
  assert.doesNotMatch(panelSource, /<Route path="\/settings\/storage-settings"/);
  assert.doesNotMatch(routesSource, /path: 'api-management'/);
  assert.doesNotMatch(routesSource, /path: 'storage-settings'/);
});
