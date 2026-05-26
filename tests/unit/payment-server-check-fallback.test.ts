import { readSource } from '../support/workspacePaths.js';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';

const ROOT_DIR = process.cwd();



test('payment-server check script falls back to in-process syntax parsing when spawnSync is blocked', () => {
  const source = readSource('scripts/check-server.mjs');

  assert.match(source, /spawnSync\(process\.execPath, \["--check", file\]/);
  assert.match(source, /code === ['"]EPERM['"]/);
  assert.match(source, /new vm\.Script\(/);
});
