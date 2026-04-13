import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { test } from "node:test";

const ROOT_DIR = process.cwd();

function readSource(relativePath: string): string {
  return readFileSync(path.join(ROOT_DIR, relativePath), "utf-8");
}

test("postgres migration scripts exist for Supabase runtime export and VPS import", () => {
  const envTemplate = "scripts/postgres/runtime-migration.env.example";
  const exportScript = "scripts/postgres/export-supabase-runtime.sh";
  const importScript = "scripts/postgres/import-runtime-into-vps.sh";
  const migrateScript = "scripts/postgres/migrate-supabase-runtime.sh";
  const bootstrapSql = "scripts/postgres/bootstrap-kk-vps.sql";

  [envTemplate, exportScript, importScript, migrateScript, bootstrapSql].forEach((relativePath) => {
    assert.equal(existsSync(path.join(ROOT_DIR, relativePath)), true, `${relativePath} should exist`);
  });

  const envSource = readSource(envTemplate);
  assert.match(envSource, /SUPABASE_DB_URL=/);
  assert.match(envSource, /TARGET_DATABASE_URL=/);
  assert.match(envSource, /external_identities/);
  assert.match(envSource, /temp_users/);
  assert.match(envSource, /credit_transactions/);
  assert.match(envSource, /generation_tasks/);
  assert.match(envSource, /payment_orders/);

  const exportSource = readSource(exportScript);
  assert.match(exportSource, /pg_dump/);
  assert.match(exportSource, /--schema-only/);
  assert.match(exportSource, /runtime-schema\.sql/);
  assert.match(exportSource, /runtime-data\.sql/);
  assert.match(exportSource, /runtime-manifest\.json/);
  assert.match(exportSource, /provider_pricing_cache/);
  assert.match(exportSource, /external_identities/);

  const importSource = readSource(importScript);
  assert.match(importSource, /psql/);
  assert.match(importSource, /bootstrap-kk-vps\.sql/);
  assert.match(importSource, /runtime-schema\.sql/);
  assert.match(importSource, /runtime-data\.sql/);
  assert.match(importSource, /TARGET_DATABASE_URL is required/);

  const migrateSource = readSource(migrateScript);
  assert.match(migrateSource, /export-supabase-runtime\.sh/);
  assert.match(migrateSource, /import-runtime-into-vps\.sh/);
  assert.match(migrateSource, /set -euo pipefail/);
});
