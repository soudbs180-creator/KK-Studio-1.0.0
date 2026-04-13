import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';

const ROOT_DIR = process.cwd();

function readSource(relativePath: string): string {
  return readFileSync(path.join(ROOT_DIR, relativePath), 'utf-8');
}

test('PromptBar context menu and model modal use shared theme tokens instead of hard-coded dark surfaces', () => {
  const source = readSource('src/components/layout/PromptBar.tsx');

  assert.doesNotMatch(source, /bg-\[#2a2a2e\]/);
  assert.doesNotMatch(source, /bg-\[#1e1e20\]/);
  assert.doesNotMatch(source, /bg-indigo-600/);
  assert.match(source, /var\(--prompt-bar-shell-bg\)/);
  assert.match(source, /var\(--prompt-bar-shell-border\)/);
  assert.match(source, /var\(--text-primary\)/);
});

