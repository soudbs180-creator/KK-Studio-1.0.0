import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';

const ROOT_DIR = process.cwd();

function readSource(relativePath: string): string {
  return readFileSync(path.join(ROOT_DIR, relativePath), 'utf-8');
}

test('keyManager does not retain proven unused local helper definitions', () => {
  const source = readSource('src/services/auth/keyManager.ts');
  const testConfigSource = readSource('tsconfig.tests.json');

  assert.match(testConfigSource, /tests\/unit\/key-manager-dead-code-pruning-contract\.test\.ts/);
  assert.doesNotMatch(source, /const isLegacyGoogleModelList = /);
  assert.doesNotMatch(source, /private migrateFromOldFormat\(\): KeyManagerState/);
  assert.doesNotMatch(source, /function getDefaultGoogleModels\(\): string\[]/);
});
