import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';

const ROOT_DIR = process.cwd();

function readSource(relativePath: string): string {
  return readFileSync(path.join(ROOT_DIR, relativePath), 'utf-8');
}

test('runtime-sensitive services keep legacy fallback guarded while routing guest and workspace flows through the API layer', () => {
  const userApiCloudRecordSource = readSource('src/services/api/userApiCloudRecordStorage.ts');
  const userApiProfileSource = readSource('src/services/api/userApiProfileStorage.ts');
  const keyManagerSource = readSource('src/services/auth/keyManager.ts');
  const billingContextSource = readSource('src/context/BillingContext.tsx');
  const syncServiceSource = readSource('src/services/system/syncService.ts');
  const tempUserServiceSource = readSource('src/services/auth/tempUserService.ts');

  assert.match(userApiCloudRecordSource, /shouldUseLegacyWebApiFallback/);
  assert.match(userApiCloudRecordSource, /if \(!shouldUseLegacyWebApiFallback\(\)\) \{/);
  assert.match(userApiProfileSource, /const canUseLegacyWebApi = shouldUseLegacyWebApiFallback\(\);/);
  assert.match(userApiProfileSource, /if \(canUseLegacyWebApi\) \{\s*try \{\s*localEntries = await loadLocalUserApiEntriesViaApi\(\);/);
  assert.match(userApiProfileSource, /const mergedEntries = mergeUserApiEntrySets\(localEntries, cloudEntries\);/);
  assert.match(userApiProfileSource, /entries: mergedEntries,/);
  assert.match(keyManagerSource, /const canUseLegacyApi = shouldUseLegacyWebApiFallback\(\) \|\| this\.authIsTempUser;/);
  assert.match(keyManagerSource, /const response = await legacyWebApiClient\.getKeyManagerCloudState\(\{ accessToken \}\);/);
  assert.match(keyManagerSource, /legacyWebApiClient\.replaceKeyManagerCloudState\(\{/);
  assert.match(billingContextSource, /import \{ kkWebApiClient \} from '\.\.\/services\/api\/kkApiClient';/);
  assert.match(billingContextSource, /kkWebApiClient\.getCreditBalance\(buildBillingRequestOptions\(apiAccessToken\)\)/);
  assert.match(billingContextSource, /kkWebApiClient\.listCreditTransactions\(/);
  assert.match(billingContextSource, /kkWebApiClient\.debitCredits\(\{/);
  assert.match(billingContextSource, /kkWebApiClient\.refundCredits\(\{/);
  assert.doesNotMatch(billingContextSource, /shouldUseLegacyWebApiFallback/);
  assert.doesNotMatch(billingContextSource, /import \{ supabase \} from '\.\.\/lib\/supabase';/);
  assert.doesNotMatch(billingContextSource, /\.channel\(/);
  assert.doesNotMatch(syncServiceSource, /import \{ supabase \} from '\.\.\/\.\.\/lib\/supabase';/);
  assert.match(syncServiceSource, /import \{ kkWebApiClient \} from '\.\.\/api\/kkApiClient';/);
  assert.match(syncServiceSource, /kkWebApiClient\.saveWorkspaceLayout/);
  assert.match(syncServiceSource, /kkWebApiClient\.getWorkspaceLayout/);
  assert.match(syncServiceSource, /kkWebApiClient\.cleanupCloudImages/);
  assert.doesNotMatch(syncServiceSource, /\.storage\s*\.\s*from\(/);
  assert.doesNotMatch(tempUserServiceSource, /import \{ supabase \} from '\.\.\/\.\.\/lib\/supabase';/);
  assert.match(tempUserServiceSource, /import \{ kkWebApiClient \} from '\.\.\/api\/kkApiClient';/);
  assert.match(tempUserServiceSource, /kkWebApiClient\.createTempUser/);
  assert.doesNotMatch(tempUserServiceSource, /\.from\('temp_users'\)\s*\.insert\(/);
});

test('admin UI entrypoints use the shared web API client without Supabase fallback bridges', () => {
  const adminConsoleSource = readSource('src/components/settings/AdminConsoleSettings.tsx');
  const adminSystemSource = readSource('src/components/settings/AdminSystem.tsx');
  const adminRoleSource = readSource('src/hooks/useAdminRole.ts');

  assert.match(adminConsoleSource, /kkWebApiClient\.changeAdminPassword/);
  assert.match(adminConsoleSource, /kkWebApiClient\.adminRechargeCredits/);
  assert.match(adminConsoleSource, /kkWebApiClient\.setUserRole/);
  assert.doesNotMatch(adminConsoleSource, /shouldUseLegacyWebApiFallback/);
  assert.doesNotMatch(adminConsoleSource, /ViaSupabase/);
  assert.doesNotMatch(adminConsoleSource, /supabaseAdminFallbackService/);

  assert.match(adminSystemSource, /kkWebApiClient\.verifyAdminPassword/);
  assert.doesNotMatch(adminSystemSource, /shouldUseLegacyWebApiFallback/);
  assert.doesNotMatch(adminSystemSource, /ViaSupabase/);
  assert.doesNotMatch(adminSystemSource, /supabaseAdminFallbackService/);

  assert.match(adminRoleSource, /kkWebApiClient/);
  assert.match(adminRoleSource, /\.getAdminAccess\(buildAdminRequestOptions\(\)\)/);
  assert.doesNotMatch(adminRoleSource, /shouldUseLegacyWebApiFallback/);
  assert.doesNotMatch(adminRoleSource, /getKkApiServerHealth/);
  assert.doesNotMatch(adminRoleSource, /resolveSupabaseAdminAccess/);
});

test('register form follows the Supabase-hosted auth path instead of the legacy register API', () => {
  const registerFormSource = readSource('src/components/auth/RegisterForm.tsx');

  assert.match(registerFormSource, /import \{ supabase \} from "\.\.\/\.\.\/lib\/supabase";/);
  assert.match(registerFormSource, /await supabase\.auth\.signUp\(/);
  assert.match(registerFormSource, /captchaToken: turnstileToken/);
  assert.doesNotMatch(registerFormSource, /legacyWebApiClient\.register/);
});
