import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

test('migration 018 adds tenant-scoped connection, binding, and lineage tables', () => {
  const migrationPath = 'migrations/018_capability_graph_foundation.sql';
  assert.equal(fs.existsSync(migrationPath), true);
  const migration = fs.readFileSync(migrationPath, 'utf8');

  assert.match(migration, /^BEGIN;$/m);
  assert.match(migration, /CREATE TABLE IF NOT EXISTS public\.provider_connections/);
  assert.match(migration, /secret_ref text NOT NULL/);
  assert.doesNotMatch(migration, /\bsecret text\b/);
  assert.match(migration, /UNIQUE \(user_id, connection_id\)/);
  assert.match(migration, /FOREIGN KEY \(user_id, connection_id\)[\s\S]*REFERENCES public\.provider_connections \(user_id, connection_id\)/);
  assert.match(migration, /CREATE TABLE IF NOT EXISTS public\.capability_bindings/);
  assert.match(migration, /CREATE TABLE IF NOT EXISTS public\.asset_lineage_relations/);
  assert.match(migration, /provider_connections_user_status_updated_idx/);
  assert.match(migration, /capability_bindings_user_capability_status_idx/);
  assert.match(migration, /asset_lineage_user_derived_idx/);
  assert.match(migration, /ENABLE ROW LEVEL SECURITY/);
  assert.match(migration, /FORCE ROW LEVEL SECURITY/);
  assert.match(migration, /current_setting\('app\.current_user_id', true\)/);
  assert.match(migration, /COMMIT;\s*$/);
});
