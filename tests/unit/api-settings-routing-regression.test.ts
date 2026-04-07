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

  assert.match(source, /const showOfficialEditor = isOfficialEditorRoute;/);
  assert.match(source, /const showProviderEditor = isProviderEditorRoute;/);
  assert.match(source, /navigate\(API_MANAGEMENT_HOME_PATH,\s*\{\s*state:\s*buildApiManagementListState\(/);
  assert.match(source, /settings-provider-card--return-focus/);
  assert.match(source, /cardRef=\{\(node\) => registerOfficialCardRef\(slot\.id, node\)\}/);
  assert.match(source, /<SettingsActionButton icon=\{Plus\} tone="primary" disabled=\{headerPrimaryActionDisabled\}/);
  assert.ok(source.includes('action={<SettingsBadge tone="neutral">'));
  assert.ok(source.includes('${officialSlots.length} endpoints'));
  assert.ok(source.includes('${thirdPartyProviders.length} providers'));
  assert.match(source, /action=\{<SettingsActionButton icon=\{Plus\} tone="primary" disabled=\{userApiActionsDisabled\} onClick=\{beginCreateOfficial\}/);
  assert.match(source, /action=\{<SettingsActionButton icon=\{Plus\} tone="primary" disabled=\{providerActionsDisabled\} onClick=\{beginCreateProvider\}/);
});

test('ConsoleEndpointCard keeps the structured header layout for fast scanning', () => {
  const source = readSource('src/components/settings/ApiSettingsView.tsx');

  assert.match(source, /className="settings-provider-card__header"/);
  assert.match(source, /className="settings-provider-card__header-main"/);
  assert.match(source, /className="settings-provider-card__header-side"/);
});

test('ConsoleEndpointCard keeps the structured metrics layout for scan-friendly cards', () => {
  const source = readSource('src/components/settings/ApiSettingsView.tsx');

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
