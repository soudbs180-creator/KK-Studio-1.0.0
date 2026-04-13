import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';

const ROOT_DIR = process.cwd();

function readSource(relativePath: string): string {
  return readFileSync(path.join(ROOT_DIR, relativePath), 'utf-8');
}

test('DashboardView.localized uses calmer settings primitives for the desktop overview shell', () => {
  const source = readSource('src/components/settings/views/DashboardView.localized.tsx');
  const registrySource = readSource('src/components/settings/settingsRegistry.ts');

  assert.match(source, /from '\.\.\/settingsRegistry';/);
  assert.match(source, /SettingsHero/);
  assert.match(source, /SettingsSection/);
  assert.match(source, /<SettingsHero/);
  assert.match(source, /Status and next step/);
  assert.match(source, /SettingsActionButton/);
  assert.match(source, /icon=\{ArrowRight\}/);
  assert.match(source, /tone="primary"/);
  assert.match(source, /getSettingsViewMeta\('dashboard'/);
  assert.match(source, /getSettingsPrimaryActionMeta\('dashboard'/);
  assert.match(source, /getSettingsStatusSummaryLabel\('dashboard'/);
  assert.match(source, /Quick actions/);
  assert.match(source, /System overview/);
  assert.match(registrySource, /dashboard:[\s\S]*primaryActionLabelZh:/);
  assert.match(registrySource, /dashboard:[\s\S]*statusSummaryLabelZh:/);
  assert.doesNotMatch(source, /settings-reference-page-header/);
});
