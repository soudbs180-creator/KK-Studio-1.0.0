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

  assert.match(
    serverSource,
    /authData:\s*buildCriticalPersistenceState\([\s\S]*authData: \["supabase", "local-file"\]/,
  );
  assert.match(
    serverSource,
    /billing:\s*buildCriticalPersistenceState\([\s\S]*creditAccounts: \["supabase", "local-file"\][\s\S]*creditExchangeRates: \["supabase", "local-file"\]/,
  );
  assert.match(serverSource, /req\.method === "POST" && pathname === "\/api\/v1\/profile\/password"/);
  assert.match(serverSource, /code: "AUTH_ROUTE_DISABLED"/);
});

test('local runtime UI keeps billing management surfaces behind the feature flag while balance reads can use canonical local storage', () => {
  const billingContextSource = readSource('src/context/BillingContext.tsx');
  const profileModalSource = readSource('src/components/modals/UserProfileModal.tsx');
  const routesSource = readSource('src/routes/settingsRoutes.tsx');

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
  assert.match(profileModalSource, /const billingFeatureEnabled = KKAI_FEATURE_FLAGS\.billing;/);
  assert.match(profileModalSource, /const passwordChangeEnabled = false;/);
  assert.match(
    routesSource,
    /const billingSettingsRouteElement = KKAI_FEATURE_FLAGS\.billing \? <CostEstimation embedded \/> : <Navigate to="\/settings" replace \/>;/,
  );
});
