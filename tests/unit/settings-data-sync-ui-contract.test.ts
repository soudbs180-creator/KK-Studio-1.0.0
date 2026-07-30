import assert from 'node:assert/strict';
import { test } from 'node:test';

import { readSource } from '../support/workspacePaths.js';

const dataSyncSource = readSource('apps/web/src/components/settings/views/DataSyncView.tsx');
const storageSource = readSource('apps/web/src/components/settings/views/StorageSettingsView.localized.tsx');
const scaffoldSource = readSource('apps/web/src/components/settings/SettingsScaffold.tsx');
const settingsConsoleStyles = readSource('apps/web/src/styles/settings-console.css');

test('data sync route renders one canonical settings page shell', () => {
  assert.match(dataSyncSource, /=> <StorageSettingsView \/>;/);
  assert.doesNotMatch(dataSyncSource, /SettingsViewShell|SettingsHero|SettingsSection/);

  assert.equal((storageSource.match(/<SettingsViewShell/g) || []).length, 1);
  assert.equal((storageSource.match(/<SettingsHero/g) || []).length, 1);
  assert.match(storageSource, /className="settings-storage-view"/);
});

test('storage settings uses shared settings primitives without the legacy dashboard renderer', () => {
  for (const primitive of [
    'SettingsActionButton',
    'SettingsDangerZone',
    'SettingsMetricCard',
    'SettingsSection',
    'SettingsSystemCard',
    'SettingsSystemField',
  ]) {
    assert.match(storageSource, new RegExp(`<${primitive}`), `${primitive} should be rendered`);
  }

  assert.doesNotMatch(storageSource, /dashboard-grid-card|a-card-span-/);
  assert.doesNotMatch(storageSource, /text-\[(?:9|10|11)px\]/);
  assert.doesNotMatch(storageSource, /(?:text|bg|border)-(?:slate|blue|emerald|amber|orange|red)-/);
  assert.doesNotMatch(storageSource, /active:scale-/);
});

test('storage controls expose stable pressed, busy, and disabled feedback', () => {
  assert.match(storageSource, /aria-pressed=\{mode === 'local'\}/);
  assert.match(storageSource, /aria-pressed=\{mode === 'browser'\}/);
  assert.match(storageSource, /loading=\{switchingMode === 'local'\}/);
  assert.match(storageSource, /loading=\{switchingMode === 'browser'\}/);
  assert.match(storageSource, /disabled=\{!supportsLocal \|\| mode === 'local'\}/);
  assert.match(storageSource, /disabled=\{mode === 'browser'\}/);
});

test('plain settings sections do not create another card surface', () => {
  assert.match(scaffoldSource, /surface === 'plain'/);
  assert.match(scaffoldSource, /settings-section--plain/);
  assert.doesNotMatch(scaffoldSource, /强制忽略 surface="plain"/);
});

test('shared settings actions keep touch targets on mobile and compact only on desktop', () => {
  assert.match(scaffoldSource, /settings-action-button/);
  assert.match(scaffoldSource, /data-size=\{size\}/);
  assert.match(
    settingsConsoleStyles,
    /\.settings-action-button\[data-size='md'\]\s*\{\s*min-height: 36px !important;/,
  );
  assert.match(
    settingsConsoleStyles,
    /@media \(max-width: 767px\)[\s\S]*?\.settings-action-button\s*\{\s*min-height: 44px !important;/,
  );
});
