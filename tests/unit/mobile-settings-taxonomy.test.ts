import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';

const ROOT_DIR = process.cwd();

function readSource(relativePath: string): string {
  return readFileSync(path.join(ROOT_DIR, relativePath), 'utf-8');
}

test('settings routes and panel use billing-focused naming for consumption records', () => {
  const routesSource = readSource('src/routes/settingsRoutes.tsx');
  const settingsPanelSource = readSource('src/components/settings/SettingsPanel.localized.tsx');
  const registrySource = readSource('src/components/settings/settingsRegistry.ts');

  assert.match(routesSource, /getSettingsNavItems\('zh-CN'\)/);
  assert.match(registrySource, /labelZh:\s*'消耗账单'/);
  assert.match(settingsPanelSource, /pickByLanguage\(language,\s*'消耗账单',\s*'Billing Ledger'\)/);
});

test('mobile settings navigation keeps system logs scoped to troubleshooting copy', () => {
  const settingsPanelSource = readSource('src/components/settings/SettingsPanel.localized.tsx');

  assert.match(settingsPanelSource, /pickByLanguage\(language,\s*'系统错误日志',\s*'System Error Logs'\)/);
  assert.match(settingsPanelSource, /pickByLanguage\(language,\s*'排查运行异常、错误和警告',\s*'Inspect runtime errors, warnings, and troubleshooting details\.'\)/);
});
