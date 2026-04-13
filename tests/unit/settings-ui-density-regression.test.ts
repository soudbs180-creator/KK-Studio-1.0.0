import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';

const ROOT_DIR = process.cwd();

function readSource(relativePath: string): string {
  return readFileSync(path.join(ROOT_DIR, relativePath), 'utf-8');
}

test('shared settings ui primitives use a calmer desktop density scale', () => {
  const source = readSource('src/components/settings/ui/index.tsx');

  assert.doesNotMatch(source, /rounded-\[22px\]/);
  assert.doesNotMatch(source, /rounded-\[20px\]/);
  assert.doesNotMatch(source, /rounded-\[18px\]/);
  assert.match(source, /rounded-\[16px\]/);
  assert.match(source, /px-4 py-2\.5 text-sm/);
});

