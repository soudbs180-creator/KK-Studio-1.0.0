import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';

import {
  REHEARSAL_ACKNOWLEDGEMENT,
  assertRehearsalTarget,
  buildWorkspaceRuntimeMigrationPlan,
  redactSensitiveText,
} from '../../scripts/ops/postgres/rehearse-workspace-runtime-v4.mjs';

const REPO_ROOT = process.cwd();

test('workspace runtime rehearsal plan is ordered through migrations 029-031', () => {
  const plan = buildWorkspaceRuntimeMigrationPlan(REPO_ROOT);

  assert.equal(path.basename(plan.bootstrapPath), 'bootstrap-kk-vps.sql');
  assert.equal(plan.preTargetMigrations.length, 28);
  assert.equal(path.basename(plan.preTargetMigrations[0]), '001_points_schema.sql');
  assert.equal(path.basename(plan.preTargetMigrations.at(-1) || ''), '028_payment_recharge_hardening.sql');
  assert.deepEqual(plan.targetMigrations.map((filePath) => path.basename(filePath)), [
    '029_provider_connection_routing_priority.sql',
    '030_paired_runtimes.sql',
    '031_agent_extensions.sql',
  ]);
});

test('workspace runtime rehearsal inherits the strict isolated database gate', () => {
  assert.throws(() => assertRehearsalTarget({
    actualDatabaseName: 'kk_production',
    expectedDatabaseName: 'kk_production',
    acknowledgement: REHEARSAL_ACKNOWLEDGEMENT,
  }), /rehearsal/i);
  assert.doesNotThrow(() => assertRehearsalTarget({
    actualDatabaseName: 'kk_workspace_v4_rehearsal',
    expectedDatabaseName: 'kk_workspace_v4_rehearsal',
    acknowledgement: REHEARSAL_ACKNOWLEDGEMENT,
  }));
});

test('workspace runtime rehearsal verifies populated repeat safety and redacts credentials', () => {
  const source = fs.readFileSync(
    path.join(REPO_ROOT, 'scripts/ops/postgres/rehearse-workspace-runtime-v4.mjs'),
    'utf8',
  );
  const packageJson = JSON.parse(fs.readFileSync(path.join(REPO_ROOT, 'package.json'), 'utf8'));
  const redacted = redactSensitiveText('postgresql://operator:secret@localhost/kk_workspace_v4_rehearsal');

  assert.match(source, /assertDatabaseIsEmpty/);
  assert.match(source, /seedPreTargetState/);
  assert.match(source, /seedPostTargetState/);
  assert.match(source, /snapshotTargetState/);
  assert.match(source, /029-031 repeat changed sentinel state/);
  assert.doesNotMatch(source, /drop\s+(?:database|schema)|truncate\s+/i);
  assert.doesNotMatch(redacted, /operator|secret/);
  assert.equal(
    packageJson.scripts['rehearse:migration:029-031'],
    'node scripts/ops/postgres/rehearse-workspace-runtime-v4.mjs',
  );
});

test('workspace runtime rehearsal ships a dedicated non-production environment template', () => {
  const envTemplate = fs.readFileSync(
    path.join(REPO_ROOT, 'scripts/ops/postgres/migration-029-031-rehearsal.env.example'),
    'utf8',
  );

  assert.match(envTemplate, /^KK_MIGRATION_DATABASE_URL=/m);
  assert.match(envTemplate, /^KK_MIGRATION_REHEARSAL_DATABASE=kk_workspace_v4_rehearsal$/m);
  assert.match(envTemplate, new RegExp(`^KK_MIGRATION_REHEARSAL_ACK=${REHEARSAL_ACKNOWLEDGEMENT}$`, 'm'));
  assert.doesNotMatch(envTemplate, /^DATABASE_URL=/m);
});
