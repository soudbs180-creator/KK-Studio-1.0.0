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

  assert.match(source, /borderRadius: 'var\(--radius-control-md\)'/);
  assert.match(source, /fontSize: 'var\(--type-body-2\)'/);
  assert.match(source, /fontSize: 'var\(--type-caption\)'/);
  assert.match(source, /minHeight: 'var\(--ui-control-height-default\)'/);
  assert.match(source, /minHeight: 'var\(--ui-control-height-compact\)'/);
  assert.doesNotMatch(source, /rounded-\[22px\]/);
  assert.doesNotMatch(source, /rounded-\[20px\]/);
});
