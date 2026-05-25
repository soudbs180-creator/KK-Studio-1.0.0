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

  assert.equal(packageJson.scripts['test:unit'], 'node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none "tests/unit/*.test.ts"');
  assert.equal(packageJson.scripts['test:integration'], 'node --test --test-isolation=none "tests/integration/*.test.ts"');
  assert.equal(packageJson.scripts['test:contract'], 'node --test --test-isolation=none "tests/contract/*.test.ts"');
  assert.equal(packageJson.scripts['test:e2e'], 'node --test --test-isolation=none "tests/e2e/*.test.ts"');
  assert.match(runnerSource, /for %%F in \(tests\\unit\\\*\.test\.ts\) do \(/);
  assert.match(runnerSource, /node --import \.\/scripts\/test\/set-log-level\.mjs --test --test-concurrency=1 --test-isolation=none "%%F"/);
});
