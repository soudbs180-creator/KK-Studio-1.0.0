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
  const cssSource = readSource('src/index.css');
  const registrySource = readSource('src/components/settings/settingsRegistry.ts');

  assert.match(source, /from '\.\.\/settingsRegistry';/);
  assert.match(source, /SettingsHero/);
  assert.match(source, /SettingsSection/);
  assert.match(source, /<SettingsHero/);
  assert.match(source, /SettingsActionButton/);
  assert.match(source, /icon=\{ArrowRight\}/);
  assert.match(source, /className="settings-dashboard-hero__mobile-action"/);
  assert.equal((source.match(/tone="primary"/g) || []).length, 1);
  assert.match(source, /getSettingsViewMeta\('dashboard'/);
  assert.match(source, /getSettingsPrimaryActionMeta\('dashboard'/);
  assert.match(source, /getSettingsStatusSummaryLabel\('dashboard'/);
  assert.match(source, /Traffic overview/);
  assert.match(source, /Operational health/);
  assert.match(source, /Quick routes/);
  assert.match(source, /Recent signals/);
  assert.doesNotMatch(source, /Quick access/);
  assert.doesNotMatch(source, /Storage settings/);
  assert.doesNotMatch(source, /Status and next step/);
  assert.doesNotMatch(source, /System overview/);
  assert.match(source, /Request trend/);
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

  assert.match(source, /const DashboardSignalHero/);
  assert.match(source, /className="settings-dashboard-cockpit"/);
  assert.match(source, /className="settings-dashboard-live-bars"/);
  assert.match(source, /settings-dashboard-cockpit__pulse/);
  assert.match(source, /className="settings-dashboard-overview-grid"/);
  assert.match(source, /className="settings-dashboard-secondary-grid"/);
  assert.match(source, /className="settings-dashboard-mobile-flow-strip"/);
  assert.match(cssSource, /\.settings-panel \.settings-dashboard-cockpit/);
  assert.match(cssSource, /\.settings-panel \.settings-shell-page--desktop \.settings-dashboard-overview-grid/);
  assert.match(cssSource, /\.settings-panel \.settings-shell-page--desktop \.settings-dashboard-secondary-grid/);
  assert.match(cssSource, /\.settings-panel \.settings-shell-page--desktop \.settings-dashboard-quick-routes \{[\s\S]*display: none;/);
  assert.match(cssSource, /\.settings-panel \.settings-shell-page--desktop \.settings-dashboard-hero__mobile-action \{[\s\S]*display: none;/);
  assert.match(cssSource, /\.settings-panel \.settings-shell-page--mobile \.settings-dashboard-hero__mobile-action \{[\s\S]*display: inline-flex;/);
  assert.match(cssSource, /\.settings-panel \.settings-shell-page--desktop \.settings-dashboard-cockpit__flow \{[\s\S]*display: none;/);
  assert.match(cssSource, /\.settings-panel \.settings-shell-page--mobile \.settings-dashboard-overview-grid/);
  assert.match(cssSource, /\.settings-panel \.settings-shell-page--mobile \.settings-dashboard-mobile-flow-strip/);
  assert.match(cssSource, /@keyframes settings-dashboard-pulse/);
  assert.match(cssSource, /@keyframes settings-dashboard-flow/);
  assert.match(cssSource, /prefers-reduced-motion: reduce/);
});
