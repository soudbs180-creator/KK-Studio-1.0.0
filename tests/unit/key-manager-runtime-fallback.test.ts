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
  assert.match(source, /if \(this\.authIsTempUser\) \{\s*const accessToken = await getPreferredKkApiAccessToken\(\);/);
  assert.match(source, /const response = await legacyWebApiClient\.getKeyManagerCloudState\(\{ accessToken \}\);/);
  assert.match(source, /preferredPayload = await loadUserApisPayloadViaSupabase\(activeUserId\);/);
  assert.match(source, /if \(!this\.authIsTempUser && shouldUseLegacyWebApiFallback\(\) && !this\.hasHydratedCloudState && preferredDensity > 0\) \{/);
  assert.match(source, /void getPreferredKkApiAccessToken\(\)\.then\(\(accessToken\) => \(/);
  assert.match(source, /legacyWebApiClient\.replaceKeyManagerCloudState\(\{/);
  assert.match(source, /const response = await legacyWebApiClient\.replaceKeyManagerCloudState\(/);
});
