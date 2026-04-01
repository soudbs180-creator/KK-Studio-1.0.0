import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';

const ROOT_DIR = process.cwd();

function readSource(relativePath: string): string {
  return readFileSync(path.join(ROOT_DIR, relativePath), 'utf-8');
}

test('runtime-sensitive services keep legacy fallback guarded while routing guest and workspace flows through the API layer', () => {
  const supabaseUserApiSource = readSource('src/services/api/supabaseUserApiCloudStorage.ts');
  const userApiProfileSource = readSource('src/services/api/userApiProfileStorage.ts');
  const keyManagerSource = readSource('src/services/auth/keyManager.ts');
  const billingContextSource = readSource('src/context/BillingContext.tsx');
  const syncServiceSource = readSource('src/services/system/syncService.ts');
  const tempUserServiceSource = readSource('src/services/auth/tempUserService.ts');

  assert.match(supabaseUserApiSource, /shouldUseLegacyWebApiFallback/);
  assert.match(supabaseUserApiSource, /if \(!shouldUseLegacyWebApiFallback\(\)\) \{/);
  assert.match(userApiProfileSource, /const canUseLegacyWebApi = shouldUseLegacyWebApiFallback\(\);/);
  assert.match(userApiProfileSource, /canUseLegacyWebApi\s*&&\s*\(localEntries.length === 0 \|\| !areEntrySetsEquivalent\(localEntries, mergedEntries\)\)/);
  assert.match(keyManagerSource, /const canUseLegacyApi = shouldUseLegacyWebApiFallback\(\);/);
  assert.match(keyManagerSource, /if \(canUseLegacyApi\) \{[\s\S]*legacyWebApiClient\.getKeyManagerCloudState/);
  assert.match(keyManagerSource, /if \(canUseLegacyApi && apiDensity === 0 && supabaseDensity > 0\) \{/);
  assert.match(keyManagerSource, /if \(canUseLegacyApi\) \{[\s\S]*legacyWebApiClient\.replaceKeyManagerCloudState/);
  assert.match(billingContextSource, /import \{ legacyWebApiClient, shouldUseLegacyWebApiFallback \} from '\.\.\/services\/api\/kkApiClient';/);
  assert.match(
    billingContextSource,
    /if \(shouldUseLegacyWebApiFallback\(\)\) \{\s*if \(!\(await isKkApiBillingPersistedViaSupabase\(\)\)\) \{\s*return fetchBalanceDirectlyFromSupabase\(user\.id\);\s*\}/,
  );
  assert.match(
    billingContextSource,
    /if \(shouldUseLegacyWebApiFallback\(\)\) \{\s*if \(!\(await isKkApiBillingPersistedViaSupabase\(\)\)\) \{\s*const rows = await loadCreditTransactionsDirectlyFromSupabase\(user\.id\);/,
  );
  assert.doesNotMatch(syncServiceSource, /import \{ supabase \} from '\.\.\/\.\.\/lib\/supabase';/);
  assert.match(syncServiceSource, /import \{ legacyWebApiClient \} from '\.\.\/api\/kkApiClient';/);
  assert.match(syncServiceSource, /legacyWebApiClient\.saveWorkspaceLayout/);
  assert.match(syncServiceSource, /legacyWebApiClient\.getWorkspaceLayout/);
  assert.match(syncServiceSource, /legacyWebApiClient\.cleanupCloudImages/);
  assert.doesNotMatch(syncServiceSource, /\.storage\s*\.\s*from\(/);
  assert.doesNotMatch(tempUserServiceSource, /import \{ supabase \} from '\.\.\/\.\.\/lib\/supabase';/);
  assert.match(tempUserServiceSource, /import \{ legacyWebApiClient \} from '\.\.\/api\/kkApiClient';/);
  assert.match(tempUserServiceSource, /legacyWebApiClient\.createTempUser/);
  assert.doesNotMatch(tempUserServiceSource, /\.from\('temp_users'\)\s*\.insert\(/);
});

test('admin UI entrypoints skip legacy Web API probes when runtime fallback is disabled', () => {
  const adminConsoleSource = readSource('src/components/settings/AdminConsoleSettings.tsx');
  const adminSystemSource = readSource('src/components/settings/AdminSystem.tsx');
  const adminRoleSource = readSource('src/hooks/useAdminRole.ts');

  assert.match(adminConsoleSource, /const canUseLegacyAdminApi = shouldUseLegacyWebApiFallback\(\);/);
  assert.match(adminConsoleSource, /if \(canUseLegacyAdminApi\) \{[\s\S]*legacyWebApiClient\.changeAdminPassword/);
  assert.match(adminConsoleSource, /if \(canUseLegacyAdminApi\) \{[\s\S]*legacyWebApiClient\.adminRechargeCredits/);
  assert.match(adminConsoleSource, /if \(canUseLegacyAdminApi\) \{[\s\S]*legacyWebApiClient\.setUserRole/);
  assert.match(adminSystemSource, /const canUseLegacyAdminApi = shouldUseLegacyWebApiFallback\(\);/);
  assert.match(adminSystemSource, /if \(canUseLegacyAdminApi\) \{[\s\S]*legacyWebApiClient\.verifyAdminPassword/);
  assert.match(adminRoleSource, /const canUseLegacyAdminAccess = shouldUseLegacyWebApiFallback\(\);/);
  assert.match(
    adminRoleSource,
    /canUseLegacyAdminAccess\s*\?\s*getKkApiServerHealth\(\)\.catch\(\(\) => null\)\s*:\s*Promise\.resolve\(null\)/,
  );
  assert.match(
    adminRoleSource,
    /const bypassLocalAdminAccess = !canUseLegacyAdminAccess \|\| shouldBypassLocalAdminAccess\(health\);/,
  );
});

test('register form follows the Supabase-hosted auth path instead of the legacy register API', () => {
  const registerFormSource = readSource('src/components/auth/RegisterForm.tsx');

  assert.match(registerFormSource, /import \{ supabase \} from "\.\.\/\.\.\/lib\/supabase";/);
  assert.match(registerFormSource, /await supabase\.auth\.signUp\(/);
  assert.match(registerFormSource, /captchaToken: turnstileToken/);
  assert.doesNotMatch(registerFormSource, /legacyWebApiClient\.register/);
});
