import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';

const ROOT_DIR = process.cwd();

function readSource(relativePath: string): string {
  return readFileSync(path.join(ROOT_DIR, relativePath), 'utf-8');
}

test('admin credit model runtime is served by the VPS API and PostgreSQL bootstrap', () => {
  const appSource = readSource('apps/api/src/app.ts');
  const serverSource = readSource('apps/api/src/server.ts');
  const bootstrapSql = readSource('scripts/postgres/bootstrap-kk-vps.sql');

  assert.match(appSource, /scripts\/postgres\/bootstrap-kk-vps\.sql/);
  assert.match(serverSource, /handleListActiveCreditModels/);
  assert.match(serverSource, /handleCreateAdminModel/);
  assert.match(serverSource, /handleSaveAdminCreditProvider/);
  assert.match(bootstrapSql, /admin_credit_models/);
  assert.match(bootstrapSql, /provider_pricing_cache/);
});

test('frontend services route admin credit providers and active models through the shared web API client', () => {
  const adminModelServiceSource = readSource('src/services/model/adminModelService.ts');

  assert.equal(existsSync(path.join(ROOT_DIR, 'src/services/api/adminCreditProviderService.ts')), false);
  assert.match(adminModelServiceSource, /kkWebApiClient\.listActiveCreditModels\(\{\s*accessToken:\s*''\s*\}\)/);
  assert.doesNotMatch(adminModelServiceSource, /listActiveCreditModelsViaEdgeFunction/);
  assert.doesNotMatch(adminModelServiceSource, /listActiveCreditModelsViaSupabase/);
  assert.doesNotMatch(adminModelServiceSource, /shouldUseLegacyWebApiFallback/);
});

test('active admin credit model code no longer depends on edge functions', () => {
  const appSource = readSource('apps/api/src/app.ts');
  const serverSource = readSource('apps/api/src/server.ts');
  const adminModelServiceSource = readSource('src/services/model/adminModelService.ts');

  assert.doesNotMatch(appSource, /functions\.invoke/);
  assert.doesNotMatch(serverSource, /functions\.invoke/);
  assert.doesNotMatch(adminModelServiceSource, /functions\.invoke/);
});
