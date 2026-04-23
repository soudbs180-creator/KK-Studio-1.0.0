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
  assert.match(source, /SettingsActionButton/);
  assert.match(source, /icon=\{ArrowRight\}/);
  assert.equal((source.match(/tone="primary"/g) || []).length, 1);
  assert.match(source, /getSettingsViewMeta\('dashboard'/);
  assert.match(source, /getSettingsPrimaryActionMeta\('dashboard'/);
  assert.match(source, /getSettingsStatusSummaryLabel\('dashboard'/);
  assert.match(source, /Primary routes/);
  assert.match(source, /Maintenance/);
  assert.match(source, /Workspace snapshot/);
  assert.match(source, /Recent activity/);
  assert.doesNotMatch(source, /Quick access/);
  assert.doesNotMatch(source, /Storage settings/);
  assert.doesNotMatch(source, /Status and next step/);
  assert.doesNotMatch(source, /System overview/);
  assert.doesNotMatch(source, /Request Trend/);
  assert.doesNotMatch(source, /Storage Distribution/);
  assert.doesNotMatch(source, /Warnings Need Review/);
  assert.match(registrySource, /dashboard:[\s\S]*primaryActionLabelZh:/);
  assert.match(registrySource, /dashboard:[\s\S]*statusSummaryLabelZh:/);
  assert.doesNotMatch(source, /settings-reference-page-header/);
  assert.match(source, /const refreshStorageSnapshot = useCallback\(async \(\) => \{/);
  assert.match(source, /const scheduleStorageSnapshotRefresh = useCallback\(\(\) => \{/);
  assert.match(source, /requestIdleCallback/);
  assert.doesNotMatch(
    source,
    /const \[nextStorageMode, usageBytes, imageIds\] = await Promise\.all\(\[\s*getStorageMode\(\),\s*getStorageUsage\(\)\.catch\(\(\) => 0\),\s*getAllImageIds\(\)\.catch\(\(\) => \[\]\),\s*\]\);/,
  );
});
