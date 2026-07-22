import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';

import {
  REHEARSAL_ACKNOWLEDGEMENT,
  assertRehearsalTarget,
  buildMigrationPlan,
  redactSensitiveText,
} from '../../scripts/ops/postgres/rehearse-generation-image-worker.mjs';

const REPO_ROOT = process.cwd();

test('migration 019 rehearsal plan is ordered from bootstrap through 019', () => {
  const plan = buildMigrationPlan(REPO_ROOT);

  assert.equal(path.basename(plan.bootstrapPath), 'bootstrap-kk-vps.sql');
  assert.equal(plan.preTargetMigrations.length, 18);
  assert.equal(path.basename(plan.preTargetMigrations[0]), '001_points_schema.sql');
  assert.equal(path.basename(plan.preTargetMigrations.at(-1) || ''), '018_capability_graph_foundation.sql');
  assert.equal(path.basename(plan.targetMigrationPath), '019_generation_image_worker.sql');
});

test('migration rehearsal target fails closed unless name and acknowledgement are exact', () => {
  assert.throws(
    () => assertRehearsalTarget({
      actualDatabaseName: 'kk_production',
      expectedDatabaseName: 'kk_production',
      acknowledgement: REHEARSAL_ACKNOWLEDGEMENT,
    }),
    /rehearsal/i,
  );
  assert.throws(
    () => assertRehearsalTarget({
      actualDatabaseName: 'kk_worker_rehearsal',
      expectedDatabaseName: 'another_rehearsal',
      acknowledgement: REHEARSAL_ACKNOWLEDGEMENT,
    }),
    /does not match/i,
  );
  assert.throws(
    () => assertRehearsalTarget({
      actualDatabaseName: 'kk_worker_rehearsal',
      expectedDatabaseName: 'kk_worker_rehearsal',
      acknowledgement: 'yes',
    }),
    /acknowledgement/i,
  );
  assert.doesNotThrow(() => assertRehearsalTarget({
    actualDatabaseName: 'kk_worker_rehearsal',
    expectedDatabaseName: 'kk_worker_rehearsal',
    acknowledgement: REHEARSAL_ACKNOWLEDGEMENT,
  }));
});

test('migration rehearsal output redacts credentials and locks 018 sentinel verification', () => {
  const connectionString = 'postgresql://operator:do-not-print@db.example/kk_worker_rehearsal';
  const redacted = redactSensitiveText(`failed ${connectionString}`);
  const source = fs.readFileSync(
    path.join(REPO_ROOT, 'scripts/ops/postgres/rehearse-generation-image-worker.mjs'),
    'utf8',
  );
  const packageJson = JSON.parse(fs.readFileSync(path.join(REPO_ROOT, 'package.json'), 'utf8'));

  assert.doesNotMatch(redacted, /operator|do-not-print/);
  assert.match(redacted, /\[REDACTED_DATABASE_URL\]/);
  assert.match(source, /assertDatabaseIsEmpty/);
  assert.match(source, /snapshotCapabilityGraph/);
  assert.match(source, /assertSnapshotsEqual/);
  assert.match(source, /targetMigrationPath[\s\S]*targetMigrationPath/);
  assert.equal(
    packageJson.scripts['rehearse:migration:019'],
    'node scripts/ops/postgres/rehearse-generation-image-worker.mjs',
  );
});

test('migration rehearsal ships a dedicated environment template instead of reusing DATABASE_URL', () => {
  const envTemplate = fs.readFileSync(
    path.join(REPO_ROOT, 'scripts/ops/postgres/migration-019-rehearsal.env.example'),
    'utf8',
  );

  assert.match(envTemplate, /^KK_MIGRATION_DATABASE_URL=/m);
  assert.match(envTemplate, /^KK_MIGRATION_REHEARSAL_DATABASE=kk_worker_rehearsal$/m);
  assert.match(envTemplate, new RegExp(`^KK_MIGRATION_REHEARSAL_ACK=${REHEARSAL_ACKNOWLEDGEMENT}$`, 'm'));
  assert.doesNotMatch(envTemplate, /^DATABASE_URL=/m);
});
