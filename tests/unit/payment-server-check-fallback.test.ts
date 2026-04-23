import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';

const ROOT_DIR = process.cwd();

function readSource(relativePath: string): string {
  return readFileSync(path.join(ROOT_DIR, relativePath), 'utf-8');
}

test('payment-server check script falls back to in-process syntax parsing when spawnSync is blocked', () => {
  const source = readSource('scripts/check-payment-server.mjs');

  assert.match(source, /spawnSync\(process\.execPath, \["--check", file\]/);
  assert.match(source, /code === ['"]EPERM['"]/);
  assert.match(source, /new vm\.Script\(/);
});
