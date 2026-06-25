import { readSource } from '../support/workspacePaths.js';
import assert from 'node:assert/strict';
import { test } from 'node:test';

test('server exposes typed admin credit provider routes with DB-backed admin auth', () => {
  const source = readSource('server/routes/admin.js');

  assert.match(source, /router\.get\('\/v1\/admin\/credit-providers', adminAuth\(2\)/);
  assert.match(source, /router\.put\('\/v1\/admin\/credit-providers\/:providerId', adminAuth\(2\)/);
  assert.match(source, /router\.delete\('\/v1\/admin\/credit-providers\/:providerId', adminAuth\(2\)/);
  assert.match(source, /SELECT COALESCE\(admin_level, 0\) AS admin_level FROM public\.users WHERE id = \$1/);
  assert.doesNotMatch(source, /req\.user\.adminLevel|decoded\.adminLevel|payload\.adminLevel/);
});

test('shared provider pricing cache is writable only by signed-in users', () => {
  const source = readSource('server/routes/admin.js');

  assert.match(source, /function userAuth\(\)/);
  assert.match(source, /router\.put\('\/v1\/provider-pricing-cache', userAuth\(\)/);
  assert.match(source, /SELECT id FROM public\.users WHERE id = \$1/);
});

test('admin credit provider save route persists pricing with parameterized SQL and retains key fingerprints', () => {
  const source = readSource('server/routes/admin.js');

  assert.match(source, /retainApiKeyFingerprints/);
  assert.match(source, /ON CONFLICT \(provider_id, model_id\) DO UPDATE SET/);
  assert.match(source, /quality_pricing = EXCLUDED\.quality_pricing/);
  assert.match(source, /JSON\.stringify\(model\.qualityPricing \|\| \{\}\)/);
  assert.match(source, /\$4::jsonb/);
  assert.doesNotMatch(source, /`[^`]*\$\{[^`]*(SELECT|INSERT|UPDATE|DELETE)[^`]*`/i);
});

test('admin credit model schema lives in migrations', () => {
  const migration = readSource('migrations/007_admin_credit_models.sql');

  assert.match(migration, /CREATE TABLE IF NOT EXISTS public\.admin_credit_models/);
  assert.match(migration, /quality_pricing jsonb/);
  assert.match(migration, /UNIQUE \(provider_id, model_id\)/);
  assert.match(migration, /CREATE TABLE IF NOT EXISTS public\.provider_pricing_cache/);
});
