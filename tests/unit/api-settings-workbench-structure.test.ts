import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';

const ROOT_DIR = process.cwd();

function readSource(relativePath: string): string {
  return readFileSync(path.join(ROOT_DIR, relativePath), 'utf-8');
}

test('ApiSettingsView list mode exposes a dedicated workspace snapshot section', () => {
  const source = readSource('src/components/settings/ApiSettingsView.tsx');

  assert.match(source, /title=\{pick\('工作台摘要', 'Workspace snapshot'\)\}/);
});

test('ApiSettingsView keeps platform capabilities as a dedicated section instead of mixing them into provider list content', () => {
  const source = readSource('src/components/settings/ApiSettingsView.tsx');

  assert.match(source, /title=\{pick\('平台能力入口', 'Platform capabilities'\)\}/);
});

