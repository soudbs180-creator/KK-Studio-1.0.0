import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';

const ROOT_DIR = process.cwd();

function readSource(relativePath: string): string {
  return readFileSync(path.join(ROOT_DIR, relativePath), 'utf-8');
}

test('global reset stays in the base layer so Tailwind spacing utilities keep precedence', () => {
  const source = readSource('src/index.css');
  const resetHeaderIndex = source.indexOf('Reset & Base Styles');
  const layeredResetIndex = source.indexOf('@layer base', resetHeaderIndex);
  const resetBlockEndIndex = source.indexOf('\n\nhtml,', layeredResetIndex);
  const resetBlock = source.slice(layeredResetIndex, resetBlockEndIndex);

  assert.ok(resetHeaderIndex >= 0, 'reset section should be present');
  assert.ok(layeredResetIndex > resetHeaderIndex, 'reset section must open a base layer');
  assert.match(resetBlock, /@layer base\s*\{\s*\*,\s*\*::before,\s*\*::after\s*\{/);
  assert.match(resetBlock, /box-sizing: border-box;/);
  assert.match(resetBlock, /margin: 0;/);
  assert.match(resetBlock, /padding: 0;/);
  assert.match(resetBlock, /\}\s*\}$/);
});
