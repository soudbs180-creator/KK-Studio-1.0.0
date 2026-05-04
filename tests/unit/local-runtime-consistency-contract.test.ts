import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';

const ROOT_DIR = process.cwd();

function readSource(relativePath: string): string {
  return readFileSync(path.join(ROOT_DIR, relativePath), 'utf-8');
}

test('server local-file readiness contract keeps auth and billing capabilities available', () => {
  const serverSource = readSource('apps/api/src/server.ts');
  const authRoutesSource = readSource('apps/api/src/modules/auth/presentation/http-auth-routes.ts');
  const healthSource = readSource('src/services/api/kkApiServerHealth.ts');

  assert.match(
    serverSource,
    /authData:\s*localOnly\s*\?\s*\["postgres", "local-file", "memory"\]\s*:\s*\["postgres"\]/,
  );
  assert.match(
    serverSource,
    /creditAccounts:\s*localOnly\s*\?\s*\["postgres", "local-file"\]\s*:\s*\["postgres"\][\s\S]*creditExchangeRates:\s*localOnly\s*\?\s*\["postgres", "local-file"\]\s*:\s*\["postgres"\]/,
  );
  assert.match(healthSource, /health\.repositories\.authData === 'local-file'/);
  assert.match(healthSource, /health\.repositories\.creditAccounts === 'local-file'/);
  assert.match(serverSource, /req\.method === "POST" && pathname === "\/api\/v1\/profile\/password"/);
  assert.match(authRoutesSource, /AUTH_ROUTE_DISABLED/);
});

test('local runtime UI keeps billing management surfaces behind the feature flag while balance reads can use canonical local storage', () => {
  const billingContextSource = readSource('src/context/BillingContext.tsx');
  const profileModalSource = readSource('src/components/modals/UserProfileModal.tsx');
  const routeConfigSource = readSource('src/components/settings/settingsRouteConfig.tsx');

  assert.match(
    billingContextSource,
    /import \{ KKAI_FEATURE_FLAGS \} from '\.\.\/app\/kkaiFeatureFlags';/,
  );
  assert.match(
    billingContextSource,
    /import \{ isKkApiBillingAvailable \} from '\.\.\/services\/api\/kkApiServerHealth';/,
  );
  assert.match(
    billingContextSource,
    /if \(!\(await isKkApiBillingAvailable\(\)\)\) \{\s*return undefined;\s*\}/,
  );
  assert.match(
    profileModalSource,
    /import \{ KKAI_FEATURE_FLAGS \} from '\.\.\/\.\.\/app\/kkaiFeatureFlags';/,
  );
  assert.match(profileModalSource, /const billingUiEnabled = KKAI_FEATURE_FLAGS\.billing;/);
  assert.doesNotMatch(profileModalSource, /billingFeatureEnabled/);
  assert.match(
    profileModalSource,
    /const canChangePassword = Boolean\(user\?\.email\) && !isTempUser && !isShadowWechatEmail;/,
  );
  assert.doesNotMatch(profileModalSource, /const passwordChangeEnabled = false;/);
  assert.match(
    routeConfigSource,
    /case 'billing':[\s\S]*return KKAI_FEATURE_FLAGS\.billing[\s\S]*<CostEstimation key=\{routeRefreshKey\} embedded \/>[\s\S]*<Navigate to=\{\(options\.dashboardBasePath \|\| '\/settings'\)\} replace \/>;/,
  );
});
