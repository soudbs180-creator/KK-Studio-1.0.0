import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';

const ROOT_DIR = process.cwd();

function readSource(relativePath: string): string {
  return readFileSync(path.join(ROOT_DIR, relativePath), 'utf-8');
}

test('settings routes and panel use Apple-style billing naming for consumption records', () => {
  const routesSource = readSource('src/routes/settingsRoutes.tsx');
  const settingsPanelSource = readSource('src/components/settings/SettingsPanel.localized.tsx');
  const registrySource = readSource('src/components/settings/settingsRegistry.ts');
  const homeSource = readSource('src/components/settings/mobile/MobileSettingsHome.tsx');

  assert.match(routesSource, /getSettingsNavItems\('zh-CN'\)/);
  assert.match(registrySource, /labelZh:\s*'计费账本'/);
  assert.match(settingsPanelSource, /pickByLanguage\(language,\s*'计费',\s*'Billing'\)/);
  assert.match(homeSource, /description: 'Recharge history, spend, and ledger activity'/);
});

test('mobile settings navigation keeps the logs entry framed as concise error triage', () => {
  const homeSource = readSource('src/components/settings/mobile/MobileSettingsHome.tsx');

  assert.match(homeSource, /label: 'Errors'/);
  assert.match(homeSource, /description: 'System errors, warnings, and troubleshooting signals'/);
});
