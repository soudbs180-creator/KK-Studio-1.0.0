import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';

const ROOT_DIR = process.cwd();

function readSource(relativePath: string): string {
  return readFileSync(path.join(ROOT_DIR, relativePath), 'utf-8');
}

test('desktop theme tokens expose inverse text and error aliases for shared UI primitives', () => {
  const cssSource = readSource('src/index.css');
  const settingsUiSource = readSource('src/components/settings/ui/index.tsx');

  assert.match(cssSource, /--text-inverse:/);
  assert.match(cssSource, /--error:/);
  assert.match(settingsUiSource, /var\(--text-inverse\)/);
  assert.match(settingsUiSource, /var\(--error\)/);
});

