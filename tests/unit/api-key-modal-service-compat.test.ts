import { readSource } from '../support/workspacePaths.js';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';

const ROOT_DIR = process.cwd();



test('api key modal compat shell is removed once settings owns the canonical entrypoint directly', () => {
  const appSource = readSource('src/App.tsx');
  const servicePath = path.join(ROOT_DIR, 'apps/web/src/services/api/apiKeyModalService.ts');

  assert.equal(existsSync(servicePath), false);
  assert.doesNotMatch(appSource, /apiKeyModalService/);
  assert.doesNotMatch(appSource, /openApiKeyModal/);
});
