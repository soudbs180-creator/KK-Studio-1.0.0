import assert from 'node:assert/strict';
import test from 'node:test';
import { readSource } from '../support/workspacePaths.js';

const assertBefore = (source: string, before: string, after: string, label: string) => {
  const beforeIndex = source.indexOf(before);
  const afterIndex = source.indexOf(after);
  assert.ok(beforeIndex >= 0, `${label}: missing ${before}`);
  assert.ok(afterIndex >= 0, `${label}: missing ${after}`);
  assert.ok(beforeIndex < afterIndex, `${label}: ${before} must appear before ${after}`);
};

test('old 011 AI tables receive compatibility columns before scoped indexes are created', () => {
  const bootstrap = readSource('scripts/postgres/bootstrap-kk-vps.sql');
  assertBefore(bootstrap, 'ALTER TABLE public.agent_runs', 'CREATE INDEX IF NOT EXISTS agent_runs_user_updated_idx', 'agent_runs');
  assertBefore(bootstrap, 'ALTER TABLE public.agent_skills', 'CREATE UNIQUE INDEX IF NOT EXISTS agent_skills_user_name_idx', 'agent_skills');
  assertBefore(bootstrap, 'ALTER TABLE public.knowledge_documents', 'CREATE INDEX IF NOT EXISTS knowledge_documents_user_updated_idx', 'knowledge');
  assertBefore(bootstrap, 'ALTER TABLE public.canvas_runtime_snapshots', 'CREATE INDEX IF NOT EXISTS canvas_runtime_snapshots_user_canvas_idx', 'canvas snapshots');
});

test('every database entrypoint applies canonical bootstrap and migration 016 to one explicit target', () => {
  const linuxBootstrap = readSource('scripts/vps/bootstrap-kk-vps.sh');
  const windowsSetup = readSource('scripts/setup/setup-database.bat');
  const deploy = readSource('scripts/vps/deploy-kk-vps.sh');
  const runtimeImport = readSource('scripts/postgres/import-runtime-into-vps.sh');

  assertBefore(linuxBootstrap, '-f "${REPO_BOOTSTRAP_SQL}"', '-f "${AI_ASSISTANT_SCOPE_MIGRATION}"', 'Linux bootstrap');
  assert.match(linuxBootstrap, /realpath "\$\{REPO_BOOTSTRAP_SQL\}"/);
  assert.match(linuxBootstrap, /KK_PG_PASSWORD is required[\s\S]*exit 1/);
  assert.match(linuxBootstrap, /-c "SET ROLE \\"\$\{POSTGRES_USER\}\\""[\s\S]*-f "\$\{REPO_BOOTSTRAP_SQL\}"[\s\S]*-f "\$\{AI_ASSISTANT_SCOPE_MIGRATION\}"/);

  assertBefore(windowsSetup, 'psql "%DATABASE_URL%" -v ON_ERROR_STOP=1 -f "%BOOTSTRAP_SQL%"', 'psql "%DATABASE_URL%" -v ON_ERROR_STOP=1 -f "%AI_SCOPE_MIGRATION%"', 'Windows setup');
  assertBefore(runtimeImport, 'psql "${TARGET_DATABASE_URL}" -v ON_ERROR_STOP=1 -f "${BOOTSTRAP_SQL}"', 'psql "${TARGET_DATABASE_URL}" -v ON_ERROR_STOP=1 -f "${AI_ASSISTANT_SCOPE_MIGRATION}"', 'runtime import');
  assertBefore(deploy, 'psql "${MIGRATION_DATABASE_URL}" -v ON_ERROR_STOP=1 -f "${NEW_RELEASE_DIR}/${BOOTSTRAP_SQL_PATH}"', 'psql "${MIGRATION_DATABASE_URL}" -v ON_ERROR_STOP=1 -f "${NEW_RELEASE_DIR}/${AI_ASSISTANT_SCOPE_MIGRATION_PATH}"', 'deploy');
});

test('migration 016 conditionally interprets every legacy AI timestamp as UTC', () => {
  const migration = readSource('migrations/016_ai_assistant_user_scope.sql');
  const legacyColumns = [
    ['agent_runs', 'created_at'],
    ['agent_runs', 'updated_at'],
    ['agent_tool_calls', 'started_at'],
    ['agent_tool_calls', 'completed_at'],
    ['agent_memory', 'created_at'],
    ['agent_memory', 'updated_at'],
    ['knowledge_documents', 'updated_at'],
    ['knowledge_chunks', 'created_at'],
    ['canvas_runtime_snapshots', 'created_at'],
    ['agent_skills', 'created_at'],
    ['agent_skills', 'updated_at'],
  ];
  for (const [tableName, columnName] of legacyColumns) {
    assert.ok(migration.includes(`('${tableName}', '${columnName}')`), `${tableName}.${columnName} missing`);
  }
  assert.match(migration, /data_type = 'timestamp without time zone'/);
  assert.match(migration, /TYPE timestamptz USING %I AT TIME ZONE ''UTC''/);
  assert.match(migration, /^BEGIN;/);
  assert.match(migration, /COMMIT;\s*$/);
});

test('deploy fails closed on source identity, database identity, DDL authority, and schema probes', () => {
  const deploy = readSource('scripts/vps/deploy-kk-vps.sh');
  assert.match(deploy, /git rev-parse --verify HEAD/);
  assert.match(deploy, /\^\[0-9a-fA-F\]\{40\}\$/);
  assert.match(deploy, /git status --porcelain --untracked-files=all/);
  assert.doesNotMatch(deploy, /COMMIT_SHA="\$\(git rev-parse[^\n]*unknown/);
  assert.match(deploy, /API_ENV_FILE="\$\{KK_API_ENV_FILE:-\$ENV_DIR\/kk-api\.env\}"/);
  assert.match(deploy, /MIGRATION_DATABASE_URL="\$\{KK_MIGRATION_DATABASE_URL:-\$\{RUNTIME_DATABASE_URL\}\}"/);
  assert.match(deploy, /runtime_identity[\s\S]*migration_identity[\s\S]*do not resolve to the same PostgreSQL database endpoint/);
  assert.match(deploy, /pg_has_role\(current_user, relowner, 'USAGE'\)/);

  const flowStart = deploy.lastIndexOf('\nrequire_repo_root\n');
  const runtimeTargetCheck = deploy.indexOf('require_runtime_database_target\n', flowStart);
  const stopServices = deploy.indexOf('stop_api_services_for_schema_cutover\n', flowStart);
  assert.ok(flowStart >= 0 && runtimeTargetCheck > flowStart && runtimeTargetCheck < stopServices);

  const probeIndex = deploy.indexOf("agent_runs.user_id is not present and NOT NULL");
  const cutoverIndex = deploy.indexOf('SCHEMA_CUTOVER_APPLIED=true', probeIndex);
  assert.ok(probeIndex >= 0 && cutoverIndex > probeIndex);
  assert.match(deploy, /agent_skill_versions is missing/);
  assert.match(deploy, /agent_skills_user_name_idx is missing its user-scope predicate/);
  assert.doesNotMatch(deploy, /echo[^\n]*\$\{(?:RUNTIME|MIGRATION)_DATABASE_URL\}/);
});

test('runtime export/import never persists credentials or replays a conflicting schema dump', () => {
  const runtimeExport = readSource('scripts/postgres/export-supabase-runtime.sh');
  const runtimeImport = readSource('scripts/postgres/import-runtime-into-vps.sh');
  const gitignore = readSource('.gitignore');

  assert.doesNotMatch(runtimeExport, /"source": "\$\{SUPABASE_DB_URL\}"/);
  assert.doesNotMatch(runtimeExport, /Source:\s*\n\s*\$\{SUPABASE_DB_URL\}/);
  assert.match(runtimeExport, /"sourceKind": "\$\{SOURCE_DATABASE_LABEL\}"/);
  assert.doesNotMatch(runtimeImport, /psql[^\n]*RUNTIME_SCHEMA_SQL/);
  assertBefore(runtimeImport, '-f "${BOOTSTRAP_SQL}"', '-f "${AI_ASSISTANT_SCOPE_MIGRATION}"', 'runtime import schema order');
  assertBefore(runtimeImport, '-f "${AI_ASSISTANT_SCOPE_MIGRATION}"', '-f "${RUNTIME_SQL}"', 'runtime import data order');
  assert.match(gitignore, /^\.tmp-postgres-migration\/$/m);
});
