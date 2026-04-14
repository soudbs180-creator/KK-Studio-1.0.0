import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';

const ROOT_DIR = process.cwd();

function readSource(relativePath: string): string {
  return readFileSync(path.join(ROOT_DIR, relativePath), 'utf-8');
}

test('DashboardView.localized removes the hidden legacy overview header block after hero migration', () => {
  const source = readSource('src/components/settings/views/DashboardView.localized.tsx');

  assert.doesNotMatch(source, /\{false && \(/);
  assert.match(source, /<SettingsHero/);
  assert.match(source, /title=\{pick\('快捷入口', 'Quick access'\)\}/);
  assert.match(source, /title=\{pick\('工作区快照', 'Workspace snapshot'\)\}/);
  assert.doesNotMatch(source, /title=\{pick\('状态与下一步', 'Status and next step'\)\}/);
  assert.doesNotMatch(source, /title=\{pick\('系统概览', 'System overview'\)\}/);
});
