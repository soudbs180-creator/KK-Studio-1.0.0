import { readSource } from '../support/workspacePaths.js';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';

const ROOT_DIR = process.cwd();



test('settings routes and panel use Apple-style billing naming for consumption records', () => {
  const routesSource = readSource('apps/web/src/routes/settingsRoutes.tsx');
  const settingsPanelSource = readSource('apps/web/src/components/settings/SettingsWorkbenchShell.tsx');
  const registrySource = readSource('apps/web/src/components/settings/settingsRegistry.ts');
  const dashboardSource = readSource('apps/web/src/components/settings/views/DashboardView.localized.tsx');

  assert.match(routesSource, /getSettingsNavItems\('zh-CN'\)/);
  assert.match(registrySource, /labelZh:\s*'计费账本'/);
  assert.match(registrySource, /mobileUsageLabel:\s*'计费'/);
  assert.match(registrySource, /mobileUsageLabel:\s*'Billing'/);
  assert.match(dashboardSource, /pick\('计费账本', 'Billing'\)/);
  assert.match(dashboardSource, /pick\('账户交易记录', 'Transaction History'\)/);
});

test('mobile settings navigation keeps the logs entry framed as concise error triage', () => {
  const dashboardSource = readSource('apps/web/src/components/settings/views/DashboardView.localized.tsx');

  assert.match(dashboardSource, /pick\('日志诊断', 'System Logs'\)/);
  assert.match(dashboardSource, /pick\('错误排障与告警', 'Triage & Diagnostics'\)/);
});
