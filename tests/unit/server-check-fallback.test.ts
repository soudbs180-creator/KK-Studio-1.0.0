import { readSource } from '../support/workspacePaths.js';
import assert from 'node:assert/strict';
import { test } from 'node:test';

test('server check script falls back to in-process syntax parsing when spawnSync is blocked', () => {
  const source = readSource('scripts/ci/check-server.mjs');

  assert.match(source, /spawnSync\(process\.execPath, \["--check", file\]/);
  assert.match(source, /code === ['"]EPERM['"]/);
  assert.match(source, /new vm\.Script\(/);
});
