import { readSource } from '../support/workspacePaths.js';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';

const ROOT_DIR = process.cwd();



test('DashboardView.localized uses calmer settings primitives for the desktop overview shell', () => {
  const source = readSource('apps/web/src/components/settings/views/DashboardView.localized.tsx');
  const registrySource = readSource('apps/web/src/components/settings/settingsRegistry.ts');

  assert.match(source, /from '\.\.\/settingsRegistry';/);
  assert.match(source, /SettingsViewShell/);
  assert.match(source, /getSettingsViewMeta\('dashboard'/);
  assert.match(source, /getSettingsPrimaryActionMeta\('dashboard'/);
  assert.match(source, /getSettingsStatusSummaryLabel\('dashboard'/);
  assert.match(registrySource, /dashboard:[\s\S]*primaryActionLabelZh:/);
  assert.match(registrySource, /dashboard:[\s\S]*statusSummaryLabelZh:/);
  assert.doesNotMatch(source, /settings-reference-page-header/);
  assert.match(source, /const refreshStorageSnapshot = useCallback\(async \(\) => \{/);
  assert.match(source, /const scheduleStorageSnapshotRefresh = useCallback\(\(\) => \{/);
  assert.match(source, /requestIdleCallback/);

  // 验证大卡片布局
  assert.match(source, /dashboard-grid-container/);
  assert.match(source, /dashboard-grid-card/);
  assert.match(source, /Wallet/);
  assert.match(source, /KeyRound/);
  assert.match(source, /HardDrive/);
  assert.match(source, /ScrollText/);
  assert.match(source, /Coins/);
});
