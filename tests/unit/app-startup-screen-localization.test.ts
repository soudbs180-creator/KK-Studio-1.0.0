import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';

const ROOT_DIR = process.cwd();

test('AppStartupScreen follows the shared document language helpers', () => {
  const source = readFileSync(
    path.join(ROOT_DIR, 'src/components/common/AppStartupScreen.tsx'),
    'utf-8',
  );

  assert.match(source, /getDocumentLanguage/);
  assert.match(source, /pickByResolvedLanguage/);
  assert.match(source, /Preparing the sign-in environment/);
  assert.match(source, /Syncing your workspace setup/);
  assert.doesNotMatch(source, /API connectivity/);
  assert.match(source, /KK Studio is entering the workspace/);
});
