import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';

const ROOT_DIR = process.cwd();

function readSource(relativePath: string): string {
  return readFileSync(path.join(ROOT_DIR, relativePath), 'utf8');
}

test('unit test script uses the dedicated Windows-safe runner', () => {
  const packageJson = JSON.parse(readSource('package.json')) as {
    scripts: Record<string, string>;
  };
  const runnerSource = readSource('scripts/test/run-unit-suite.cmd');

  assert.equal(packageJson.scripts['test:unit'], 'scripts\\test\\run-unit-suite.cmd');
  assert.match(runnerSource, /for %%F in \(tests\\unit\\\*\.test\.ts\) do \(/);
  assert.match(runnerSource, /node --import \.\/scripts\/test\/set-log-level\.mjs --test --test-concurrency=1 --test-isolation=none "%%F"/);
});
