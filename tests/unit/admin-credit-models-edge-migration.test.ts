import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';

const ROOT_DIR = process.cwd();

function readSource(relativePath: string): string {
  return readFileSync(path.join(ROOT_DIR, relativePath), 'utf-8');
}

test('documents the edge-function migration plan for admin credit models', () => {
  const target = path.join(ROOT_DIR, 'docs/architecture/edge-functions-migration-plan.md');
  assert.equal(existsSync(target), true);

  const source = readSource('docs/architecture/edge-functions-migration-plan.md');
  assert.match(source, /admin-credit-models/);
  assert.match(source, /SUPABASE_SERVICE_ROLE_KEY/);
  assert.match(source, /supabase functions serve admin-credit-models/);
});

test('admin credit model edge function uses service-role auth and keeps active-list output sanitized', () => {
  const source = readSource('supabase/functions/admin-credit-models/index.ts');
  const sharedAuthSource = readSource('supabase/functions/_shared/auth.ts');

  assert.match(sharedAuthSource, /SUPABASE_SERVICE_ROLE_KEY/);
  assert.match(sharedAuthSource, /requireElevatedAdminSession/);
  assert.match(sharedAuthSource, /admin_sessions/);
  assert.match(source, /requireAdminUser/);
  assert.match(source, /requireElevatedAdminSession/);
  assert.match(source, /get_active_credit_models/);
  assert.match(source, /get_admin_credit_models_full/);
  assert.match(source, /action === 'list-active'/);
  assert.match(source, /await listActiveCreditModels\(serviceClient\)/);
  assert.match(source, /await requireAdminUser\(serviceClient, user\.id\)/);
  assert.match(source, /await listAdminCreditModels\(userClient\)/);
  assert.match(source, /req\.headers\.get\('x-admin-session-token'\)/);
  assert.match(source, /await saveAdminCreditProvider\(userClient, body\.input\)/);
  assert.match(source, /await deleteAdminCreditProvider\(userClient, body\.providerId\)/);
  assert.match(source, /models: Array\.isArray\(row\.models\) \? row\.models : \[\]/);
  assert.doesNotMatch(source, /return\s+\{[^}]*api_keys[^}]*\}\s*;/s);
});

test('frontend services prefer admin-credit-models edge function but retain the previous fallbacks', () => {
  const providerServiceSource = readSource('src/services/api/adminCreditProviderService.ts');
  const adminModelServiceSource = readSource('src/services/model/adminModelService.ts');

  assert.match(providerServiceSource, /listAdminCreditProvidersViaEdgeFunction/);
  assert.match(providerServiceSource, /saveAdminCreditProviderViaEdgeFunction/);
  assert.match(providerServiceSource, /deleteAdminCreditProviderViaEdgeFunction/);
  assert.match(providerServiceSource, /listAdminCreditProvidersViaSupabase/);
  assert.match(providerServiceSource, /saveAdminCreditProviderViaSupabase/);
  assert.match(providerServiceSource, /deleteAdminCreditProviderViaSupabase/);
  assert.match(adminModelServiceSource, /listActiveCreditModelsViaEdgeFunction/);
  assert.match(adminModelServiceSource, /listActiveCreditModelsViaSupabase/);
});

test('latest public active-model migration keeps base_url and api_keys sanitized', () => {
  const source = readSource('supabase/migrations/20260401000001_resanitize_public_active_credit_models.sql');

  assert.match(source, /NULL::TEXT AS base_url/);
  assert.match(source, /NULL::TEXT\[\] AS api_keys/);
  assert.match(source, /COALESCE\(m\.visibility, 'public'\) = 'public'/);
  assert.match(source, /GRANT EXECUTE ON FUNCTION public\.get_active_credit_models\(\) TO anon/);
  assert.match(source, /GRANT EXECUTE ON FUNCTION public\.get_active_credit_models\(\) TO authenticated/);
});
