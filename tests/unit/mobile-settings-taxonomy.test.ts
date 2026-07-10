import { readSource } from '../support/workspacePaths.js';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';

const ROOT_DIR = process.cwd();



test('settings routes and dashboard keep billing terminology on the live usage summary', () => {
  const routesSource = readSource('apps/web/src/routes/settingsRoutes.tsx');
  const settingsPanelSource = readSource('apps/web/src/components/settings/SettingsWorkbenchShell.tsx');
  const registrySource = readSource('apps/web/src/components/settings/settingsRegistry.ts');
  const dashboardSource = readSource('apps/web/src/components/settings/views/DashboardView.localized.tsx');

  assert.match(routesSource, /getSettingsNavItems\('zh-CN'\)/);
  assert.match(registrySource, /'consumption-records': 'capability-sources'/);
  assert.match(registrySource, /mobileUsageLabel:\s*'计费'/);
  assert.match(registrySource, /mobileUsageLabel:\s*'Billing'/);
  assert.match(dashboardSource, /pick\('今日消耗', 'Spend today'\)/);
  assert.match(dashboardSource, /pick\('调用趋势', 'Usage trend'\)/);
  assert.match(dashboardSource, /pick\('余额', 'Balance'\)/);
});

test('settings dashboard keeps runtime diagnostics grouped with storage health', () => {
  const dashboardSource = readSource('apps/web/src/components/settings/views/DashboardView.localized.tsx');

  assert.match(dashboardSource, /pick\('存储与运行诊断', 'Storage and diagnostics'\)/);
  assert.match(dashboardSource, /pick\('运行诊断', 'Diagnostics'\)/);
  assert.match(dashboardSource, /pick\('告警', 'Warnings'\)/);
});
