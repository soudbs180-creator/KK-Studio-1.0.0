import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';

const ROOT_DIR = process.cwd();

function readSource(relativePath: string): string {
  return readFileSync(path.join(ROOT_DIR, relativePath), 'utf-8');
}

test('api key modal compat shell is removed once settings owns the canonical entrypoint directly', () => {
  const appSource = readSource('src/App.tsx');
  const servicePath = path.join(ROOT_DIR, 'src/services/api/apiKeyModalService.ts');

  assert.equal(existsSync(servicePath), false);
  assert.doesNotMatch(appSource, /apiKeyModalService/);
  assert.doesNotMatch(appSource, /openApiKeyModal/);
});
