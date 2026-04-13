import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';

const ROOT_DIR = process.cwd();

function readSource(relativePath: string): string {
  return readFileSync(path.join(ROOT_DIR, relativePath), 'utf-8');
}

test('mobile settings shell keeps the five focused mobile entry points and no day-1 cleanup CTA', () => {
  const settingsSource = readSource('src/components/settings/SettingsPanel.localized.tsx');
  const storageSource = readSource('src/components/settings/views/StorageSettingsView.localized.tsx');
  const mobileShellStart = settingsSource.indexOf('const SettingsMobileShell');
  const mobileShellEnd = settingsSource.indexOf('const SettingsRouterShell');
  const mobileShellSource = settingsSource.slice(mobileShellStart, mobileShellEnd);

  assert.match(mobileShellSource, /Mobile Settings/);
  assert.match(mobileShellSource, /Five Mobile Entries/);
  assert.match(mobileShellSource, /Only the focused mobile entries are kept here/);
  assert.match(mobileShellSource, /settings-shell-mobile__focus/);
  assert.match(mobileShellSource, /Dashboard \/ API \/ Billing \/ Storage \/ Errors/);
  assert.doesNotMatch(mobileShellSource, /Advanced Settings/);
  assert.match(settingsSource, /Billing Ledger/);
  assert.match(settingsSource, /System Error Logs/);
  assert.match(settingsSource, /API Management/);
  assert.match(settingsSource, /Dashboard/);
  assert.match(settingsSource, /Storage/);
  assert.match(storageSource, /7-Day Policy/);
  assert.match(storageSource, /30-Day Policy/);
  assert.doesNotMatch(storageSource, /1 Day Cache|1-Day Policy|1 澶╃紦瀛?/);
});
