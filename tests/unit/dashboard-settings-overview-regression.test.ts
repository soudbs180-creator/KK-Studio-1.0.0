import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';

const ROOT_DIR = process.cwd();

function readSource(relativePath: string): string {
  return readFileSync(path.join(ROOT_DIR, relativePath), 'utf-8');
}

test('DashboardView.localized uses calmer settings primitives for the desktop overview shell', () => {
  const source = readSource('src/components/settings/views/DashboardView.localized.tsx');

  assert.match(source, /SettingsHero/);
  assert.match(source, /SettingsSection/);
  assert.match(source, /<SettingsHero/);
  assert.match(source, /<SettingsSection[\s\S]*title=\{pick\('快捷操作', 'Quick actions'\)\}/);
  assert.match(source, /<SettingsSection[\s\S]*title=\{pick\('系统概览', 'System overview'\)\}/);
  assert.doesNotMatch(source, /settings-reference-page-header/);
});
