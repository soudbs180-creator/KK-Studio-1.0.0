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

  // 验证控制台标题、四指标与紧凑模块布局
  assert.match(source, /dashboard-console-header/);
  assert.match(source, /console-grid dashboard-console-metrics/);
  assert.match(source, /dashboard-grid-container/);
  assert.match(source, /dashboard-grid-card/);
  assert.doesNotMatch(source, /<SettingsHero/);
  assert.match(source, /Activity/);
  assert.match(source, /KeyRound/);
  assert.match(source, /HardDrive/);
  assert.match(source, /ScrollText/);
  assert.doesNotMatch(source, /\bWallet,/);
  // Coins 曾是未使用的遗留 import。现在它是「平台积分」路由选项的图标，
  // 因此判据从「不得出现」改为「若 import 就必须真的被使用」——
  // 原本要防的是死 import，而不是这个标识符本身。
  assertImportIsUsedIfPresent(source, 'Coins');
});

function assertImportIsUsedIfPresent(source: string, identifier: string): void {
  const importedInList = new RegExp(`^\\s*${identifier},\\s*$`, 'm').test(source);
  if (!importedInList) return;

  const occurrences = source.match(new RegExp(`\\b${identifier}\\b`, 'g')) || [];
  assert.ok(
    occurrences.length >= 2,
    `${identifier} 已被 import 但未在文件中使用，属于死 import`
  );
}
