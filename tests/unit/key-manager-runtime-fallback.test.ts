import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';

const ROOT_DIR = process.cwd();

function readSource(relativePath: string): string {
  return readFileSync(path.join(ROOT_DIR, relativePath), 'utf-8');
}

test('keyManager only uses legacy key-manager cloud routes when runtime fallback is explicitly allowed', () => {
  const source = readSource('src/services/auth/keyManager.ts');

  assert.match(source, /shouldUseLegacyWebApiFallback/);
  assert.match(source, /const canUseLegacyApi = shouldUseLegacyWebApiFallback\(\) \|\| this\.authIsTempUser;/);
  assert.match(source, /if \(canUseLegacyApi\) \{/);
  assert.match(source, /const accessToken = await getPreferredKkApiAccessToken\(\);/);
  assert.match(source, /legacyWebApiClient\.getKeyManagerCloudState\(\{ accessToken \}\)/);
  assert.match(source, /if \(canUseLegacyApi && apiDensity === 0 && supabaseDensity > 0\) \{/);
  assert.match(source, /void legacyWebApiClient\.replaceKeyManagerCloudState\(/);
  assert.match(source, /const response = await legacyWebApiClient\.replaceKeyManagerCloudState\(/);
});
