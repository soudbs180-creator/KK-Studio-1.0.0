import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';

const ROOT_DIR = process.cwd();

function readSource(relativePath: string): string {
  return readFileSync(path.join(ROOT_DIR, relativePath), 'utf-8');
}

test('provider list cards stay compact and keep only edit, refresh, and pause actions on the list surface', () => {
  const source = readSource('src/components/settings/ApiSettingsView.tsx');
  const cardSource = readSource('src/components/settings/apiWorkbenchCards.tsx');

  assert.match(source, /title=\{provider\.name\}/);
  assert.match(source, /density="compact"/);
  assert.match(cardSource, /settings-provider-card--compact/);
  assert.match(cardSource, /settings-provider-card__inline-actions/);
  assert.doesNotMatch(source, /<SettingsActionButton icon=\{Wand2\} size="sm"[\s\S]*provider-price:\$\{provider\.id\}/);
  assert.match(source, /<SettingsActionButton icon=\{Edit3\} size="sm" disabled=\{providerActionsDisabled\} onClick=\{\(\) => startEditProvider\(provider\)\}>/);
  assert.match(source, /<SettingsActionButton icon=\{RefreshCw\} size="sm" disabled=\{routeDiagnosticsActionDisabled\} loading=\{busy === `provider-check:\$\{provider\.id\}`\} onClick=\{\(\) => void refreshProvider\(provider\)\}>/);
  assert.match(source, /<SettingsActionButton icon=\{provider\.isActive \? Pause : Play\} size="sm" disabled=\{providerActionsDisabled\} onClick=\{\(\) => void toggleProvider\(provider\)\}>/);
});

test('provider editor advanced tools expose model sync, price sync, and a custom pricing endpoint fallback', () => {
  const source = readSource('src/components/settings/ApiSettingsView.tsx');

  assert.match(source, /自动获取模型/);
  assert.match(source, /自动获取价格/);
  assert.match(source, /价格地址/);
  assert.match(source, /showPricingEndpointOverride/);
  assert.match(source, /providerPricingEndpointDraft/);
  assert.match(source, /如果默认价格地址失败，可以在这里输入自定义价格地址。/);
});
