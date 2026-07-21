import { readSource } from '../support/workspacePaths.js';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';

const ROOT_DIR = process.cwd();



test('unit test script uses the dedicated Windows-safe runner', () => {
  const packageJson = JSON.parse(readSource('package.json')) as {
    scripts: Record<string, string>;
  };
  const runnerSource = readSource('scripts/test/run-unit-suite.cmd');

  assert.equal(packageJson.scripts['test:unit'], 'node scripts/test/run-tests.mjs process "tests/unit/*.test.ts"');
  assert.equal(packageJson.scripts['test:integration'], 'node scripts/test/run-tests.mjs none "tests/integration/*.test.ts"');
  assert.equal(packageJson.scripts['test:contract'], 'node scripts/test/run-tests.mjs none "tests/contract/*.test.ts"');
  assert.equal(packageJson.scripts['test:e2e'], 'node scripts/test/run-tests.mjs none "tests/e2e/*.test.ts"');
  assert.match(runnerSource, /for %%F in \(tests\\unit\\\*\.test\.ts\) do \(/);
  assert.match(runnerSource, /node scripts\/test\/run-tests\.mjs none "%%F"/);
});
