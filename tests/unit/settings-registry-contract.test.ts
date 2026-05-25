import { readSource } from '../support/workspacePaths.js';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';

const ROOT_DIR = process.cwd();



test('settings shell and routes share a single registry for canonical views and legacy aliases', () => {
  const registrySource = readSource('src/components/settings/settingsRegistry.ts');
  const panelSource = readSource('src/components/settings/SettingsPanel.localized.tsx');
  const routesSource = readSource('src/components/settings/settingsRouteConfig.tsx');
  const headerSource = readSource('src/components/settings/desktop/SettingsDesktopWorkbenchHeader.tsx');

  assert.match(registrySource, /export type CanonicalSettingsViewId =/);
  assert.match(registrySource, /export type LegacySettingsViewId =/);
  assert.match(registrySource, /export const SETTINGS_PATHS:/);
  assert.match(registrySource, /export const LEGACY_SETTINGS_VIEW_ALIASES:/);
  assert.match(registrySource, /export const SETTINGS_LEGACY_ROUTE_REDIRECTS/);
  assert.match(registrySource, /export const SETTINGS_VIEW_META:/);
  assert.match(registrySource, /primaryActionLabelZh:/);
  assert.match(registrySource, /primaryActionLabelEn:/);
  assert.match(registrySource, /primaryActionTarget:/);
  assert.match(registrySource, /statusSummaryLabelZh:/);
  assert.match(registrySource, /statusSummaryLabelEn:/);
  assert.match(registrySource, /export function getSettingsViewMeta/);
  assert.match(registrySource, /export function getSettingsPrimaryActionMeta/);
  assert.match(registrySource, /export function getSettingsStatusSummaryLabel/);

  assert.match(panelSource, /from '\.\/settingsRegistry';/);
  assert.match(panelSource, /getSettingsShellCopy/);
  assert.doesNotMatch(panelSource, /const NAV_PATHS:/);
  assert.doesNotMatch(panelSource, /const LEGACY_SETTINGS_VIEW_ALIASES:/);
  assert.doesNotMatch(panelSource, /const LEGACY_SETTINGS_ROUTE_REDIRECTS:/);
  assert.doesNotMatch(panelSource, /getFocusedMobileEntryLabels\(/);

  assert.match(routesSource, /from '\.\/settingsRegistry';/);
  assert.doesNotMatch(routesSource, /const SETTINGS_PATHS:/);
  assert.doesNotMatch(routesSource, /const LEGACY_SETTINGS_VIEW_ALIASES:/);
  assert.doesNotMatch(routesSource, /const LEGACY_SETTINGS_ROUTE_REDIRECTS:/);

  assert.match(headerSource, /from '\.\.\/settingsRegistry';/);
  assert.doesNotMatch(headerSource, /const headerMeta =/);
});
