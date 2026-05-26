import { readSource } from '../support/workspacePaths.js';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';

const ROOT_DIR = process.cwd();



test('settings routes and panel use Apple-style billing naming for consumption records', () => {
  const routesSource = readSource('src/routes/settingsRoutes.tsx');
  const settingsPanelSource = readSource('src/components/settings/SettingsPanel.localized.tsx');
  const registrySource = readSource('src/components/settings/settingsRegistry.ts');
  const dashboardSource = readSource('src/components/settings/views/DashboardView.localized.tsx');

  assert.match(routesSource, /getSettingsNavItems\('zh-CN'\)/);
  assert.match(registrySource, /labelZh:\s*'计费账本'/);
  assert.match(settingsPanelSource, /pickByLanguage\(language,\s*'计费',\s*'Billing'\)/);
  assert.match(dashboardSource, /pick\('计费账本', 'Billing'\)/);
  assert.match(dashboardSource, /pick\('账户交易记录', 'Transaction History'\)/);
});

test('mobile settings navigation keeps the logs entry framed as concise error triage', () => {
  const dashboardSource = readSource('src/components/settings/views/DashboardView.localized.tsx');

  assert.match(dashboardSource, /pick\('日志诊断', 'System Logs'\)/);
  assert.match(dashboardSource, /pick\('错误排障与告警', 'Triage & Diagnostics'\)/);
});
