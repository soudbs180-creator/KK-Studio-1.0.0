import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';

const ROOT_DIR = process.cwd();

function readSource(relativePath: string): string {
  return readFileSync(path.join(ROOT_DIR, relativePath), 'utf-8');
}

test('ApiSettingsView keeps editor visibility route-driven and returns through API management state', () => {
  const source = readSource('src/components/settings/ApiSettingsView.tsx');

  assert.doesNotMatch(source, /const showInlineOfficialCreate =/);
  assert.doesNotMatch(source, /const showInlineProviderCreate =/);
  assert.match(source, /const showOfficialEditor = activeEditorMode === 'official';/);
  assert.match(source, /const showProviderEditor = activeEditorMode === 'third-party';/);
  assert.match(source, /navigate\(API_MANAGEMENT_HOME_PATH,\s*\{\s*state:\s*buildApiManagementListState\(/);
  assert.doesNotMatch(source, /headerPrimaryActionDisabled/);
  assert.match(source, /<SettingsActionButton\s+icon=\{RefreshCw\}\s+loading=\{busy === 'cloud-refresh'\}/);

  const createOfficialButtonUsages = source.match(/onClick=\{\(\) => beginCreateOfficial\(\)\}/g) ?? [];
  const createOfficialAddEntryUsages = source.match(/data-testid="api-official-provider-add"/g) ?? [];
  const createProxyAddEntryUsages = source.match(/data-testid="api-proxy-provider-add"/g) ?? [];
  const createProviderButtonUsages = source.match(/onClick=\{beginCreateProvider\}/g) ?? [];

  assert.equal(createOfficialButtonUsages.length, 0);
  assert.equal(createOfficialAddEntryUsages.length, 1);
  assert.equal(createProxyAddEntryUsages.length, 1);
  assert.equal(createProviderButtonUsages.length, 2);
});

test('ConsoleEndpointCard keeps the structured header layout for fast scanning', () => {
  const source = readSource('src/components/settings/apiWorkbenchCards.tsx');

  assert.match(source, /className="settings-provider-card__header"/);
  assert.match(source, /className="settings-provider-card__header-main"/);
  assert.match(source, /className="settings-provider-card__header-side"/);
});

test('ConsoleEndpointCard keeps the structured metrics layout for scan-friendly cards', () => {
  const source = readSource('src/components/settings/apiWorkbenchCards.tsx');

  assert.match(source, /className="settings-provider-card__metrics"/);
  assert.ok(source.includes('settings-provider-card__metric'));
  assert.ok(source.includes('settings-provider-card__metric-value'));
  assert.ok(source.includes('settings-provider-card__metric-helper'));
});

test('ApiSettingsView clears stale provider models when the provider connection changes or a refresh returns an empty list', () => {
  const source = readSource('src/components/settings/ApiSettingsView.tsx');

  assert.match(source, /const connectionSignatureChanged = Boolean\(/);
  assert.match(source, /models: connectionSignatureChanged \? \[\] : \(existingProvider\?\.models \|\| \[\]\),/);
  assert.match(source, /supportedModels: check\.ok \? check\.models : slot\.supportedModels,/);
  assert.match(source, /models: check\.ok \? check\.models : provider\.models,/);
});

test('Settings mobile shell routes nested API editor back actions to the API management list', () => {
  const source = readSource('src/components/settings/SettingsPanel.localized.tsx');

  assert.ok(source.includes('isApiManagementEditorRoute'));
  assert.ok(source.includes('onBackToApiManagement'));
  assert.match(source, /if \(isApiManagementEditorRoute\) \{\s*onBackToApiManagement\(\);\s*return;\s*\}/);
  assert.match(source, /onBackToApiManagement=\{handleBackToApiManagement\}/);
  assert.match(source, /isApiManagementEditorRoute=\{nestedApiEditorRoute\}/);
});

test('ApiSettingsView list mode delegates calmer workbench overview copy to dedicated workbench sections', () => {
  const source = readSource('src/components/settings/ApiSettingsView.tsx');
  const sectionSource = readSource('src/components/settings/apiWorkbenchSections.tsx');

  assert.match(source, /<ApiWorkbenchOverviewSection/);
  assert.match(source, /<ApiWorkbenchCurrentViewSection/);
  assert.match(sectionSource, /title=\{pick\('工作台摘要', 'Workspace snapshot'\)\}/);
  assert.match(sectionSource, /title=\{pick\('当前视图', 'Current view'\)\}/);
});
