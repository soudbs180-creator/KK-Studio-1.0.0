import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import {
  AgentExecutionTargetSchema,
  AgentRunDtoSchema,
  AgentRunAuthorityReadProjectionCompatibilityDtoSchema,
  AuthoritativeExecutionAuthorityEnvelopeDtoSchema,
  ExecutionAuthorityDtoSchema,
  ExecutionAuthorityCheckpointBindingDtoSchema,
  ExecutionCheckpointRefDtoSchema,
  ExecutionConfirmationGrantEnvelopeDtoSchema,
  ExecutionConfirmationGrantProjectionDtoSchema,
  evaluateCurrentExecutionAuthority,
} from '../../packages/shared/src/index.ts';
import { workspacePath } from '../support/workspacePaths.js';

const NOW = '2026-08-13T00:00:00.000Z';
const LATER = '2026-08-13T00:05:00.000Z';
const RUNTIME_ID = '11111111-1111-4111-8111-111111111111';

const localAuthority = {
  schemaVersion: 1,
  authorityKind: 'installation-local',
  authorityState: 'authoritative',
  executionTarget: 'local-desktop',
  ownerId: 'owner-1',
  runId: 'run-1',
  installationId: 'installation-1',
  authorityRuntimeId: 'desktop-runtime-1',
  globalCoordinationEpoch: 7,
  localJournalEpoch: 11,
  singleInstanceLockId: 'lock-1',
  issuedAt: NOW,
} as const;

const pairedAuthority = {
  schemaVersion: 1,
  authorityKind: 'server-lease',
  authorityState: 'authoritative',
  executionTarget: 'paired-desktop',
  ownerId: 'owner-1',
  runId: 'run-1',
  authorityRuntimeId: RUNTIME_ID,
  globalCoordinationEpoch: 7,
  executionFencingToken: 19,
  attempt: 2,
  issuedAt: NOW,
  leaseExpiresAt: LATER,
} as const;

const pairedEvaluationContext = {
  now: '2026-08-13T00:01:00.000Z',
  expectedOwnerId: 'owner-1',
  expectedRunId: 'run-1',
  expectedExecutionTarget: 'paired-desktop',
  expectedAuthorityRuntimeId: RUNTIME_ID,
  currentGlobalCoordinationEpoch: 7,
  currentExecutionFencingToken: 19,
  currentAttempt: 2,
} as const;

const localEvaluationContext = {
  now: '2026-08-13T00:01:00.000Z',
  expectedOwnerId: 'owner-1',
  expectedRunId: 'run-1',
  expectedExecutionTarget: 'local-desktop',
  expectedAuthorityRuntimeId: 'desktop-runtime-1',
  expectedInstallationId: 'installation-1',
  currentGlobalCoordinationEpoch: 7,
  currentLocalJournalEpoch: 11,
  currentSingleInstanceLockId: 'lock-1',
} as const;

const basePairedRun = {
  id: 'run-1',
  userMessage: 'continue',
  intent: 'agent',
  plan: {},
  status: 'waiting_for_device',
  toolCalls: [],
  createdAt: NOW,
  updatedAt: NOW,
  executionTarget: 'paired-desktop',
  pairedRuntimeId: RUNTIME_ID,
} as const;

const pairedCheckpoint = {
  schemaVersion: 1,
  checkpointId: 'checkpoint-1',
  checkpointVersion: 3,
  runId: 'run-1',
  stepId: 'step-1',
  executionTarget: 'paired-desktop',
  authorityRuntimeId: RUNTIME_ID,
  globalCoordinationEpoch: 7,
  executionFencingToken: 19,
  attempt: 2,
  idempotencyKey: 'run-1:step-1',
  recordedAt: NOW,
} as const;

test('execution target has one canonical schema with a paired-runtime compatibility re-export', () => {
  const pairedRuntimeSource = readFileSync(
    workspacePath('packages/shared/src/contracts/dto/paired-runtime.ts'),
    'utf8',
  );
  assert.match(
    pairedRuntimeSource,
    /export\s*\{[\s\S]*?AgentExecutionTargetSchema[\s\S]*?\}\s*from\s*['"]\.\/execution-authority\.ts['"];/,
  );
  assert.deepEqual(AgentExecutionTargetSchema.options, [
    'local-desktop',
    'paired-desktop',
    'cloud',
  ]);
  assert.equal(AgentExecutionTargetSchema.safeParse('remote').success, false);
});

test('execution authority keeps coordination, journal, and fencing semantics distinct', () => {
  assert.equal(AuthoritativeExecutionAuthorityEnvelopeDtoSchema.safeParse(localAuthority).success, true);
  assert.equal(AuthoritativeExecutionAuthorityEnvelopeDtoSchema.safeParse(pairedAuthority).success, true);
  assert.equal(ExecutionAuthorityDtoSchema.safeParse(localAuthority).success, true);
  assert.equal(ExecutionAuthorityDtoSchema.safeParse(pairedAuthority).success, true);
  assert.equal(ExecutionAuthorityDtoSchema.safeParse({
    ...localAuthority,
    executionFencingToken: 19,
  }).success, false);
  assert.equal(ExecutionAuthorityDtoSchema.safeParse({
    ...pairedAuthority,
    localJournalEpoch: 11,
  }).success, false);
  assert.equal(ExecutionAuthorityDtoSchema.safeParse({
    ...pairedAuthority,
    schemaVersion: 2,
  }).success, false);
  assert.equal(ExecutionAuthorityDtoSchema.safeParse({
    ...pairedAuthority,
    executionTarget: 'local-desktop',
  }).success, false);
});

test('authority shape parsing is not execution authorization', () => {
  const authoritySource = readFileSync(
    workspacePath('packages/shared/src/contracts/dto/execution-authority.ts'),
    'utf8',
  );
  assert.doesNotMatch(authoritySource, /ExecutableExecutionAuthority/);
  assert.equal(evaluateCurrentExecutionAuthority(pairedAuthority, pairedEvaluationContext).authorized, true);
});

test('server authority evaluator rejects every stale identity, epoch, fence, attempt, and lease', () => {
  const staleContexts = [
    [{ currentGlobalCoordinationEpoch: 8 }, 'global_epoch_stale'],
    [{ currentExecutionFencingToken: 20 }, 'fencing_token_stale'],
    [{ currentAttempt: 3 }, 'attempt_stale'],
    [{ expectedOwnerId: 'owner-other' }, 'owner_mismatch'],
    [{ expectedRunId: 'run-other' }, 'run_mismatch'],
    [{ expectedAuthorityRuntimeId: 'runtime-other' }, 'runtime_mismatch'],
  ] as const;
  for (const [override, reason] of staleContexts) {
    const result = evaluateCurrentExecutionAuthority(
      pairedAuthority,
      { ...pairedEvaluationContext, ...override },
    );
    assert.deepEqual(result, { authorized: false, reason });
  }
  assert.deepEqual(evaluateCurrentExecutionAuthority(pairedAuthority, {
    ...pairedEvaluationContext,
    expectedExecutionTarget: 'cloud',
  }), { authorized: false, reason: 'target_mismatch' });
  assert.deepEqual(evaluateCurrentExecutionAuthority(pairedAuthority, {
    ...pairedEvaluationContext,
    now: LATER,
  }), { authorized: false, reason: 'lease_expired' });
});

test('local authority evaluator rejects stale journal, coordination, installation, and lock state', () => {
  assert.equal(evaluateCurrentExecutionAuthority(localAuthority, localEvaluationContext).authorized, true);
  for (const [override, reason] of [
    [{ currentGlobalCoordinationEpoch: 8 }, 'global_epoch_stale'],
    [{ currentLocalJournalEpoch: 12 }, 'local_journal_epoch_stale'],
    [{ currentSingleInstanceLockId: 'lock-stale' }, 'single_instance_lock_stale'],
    [{ expectedInstallationId: 'installation-other' }, 'installation_mismatch'],
  ] as const) {
    const result = evaluateCurrentExecutionAuthority(
      localAuthority,
      { ...localEvaluationContext, ...override },
    );
    assert.deepEqual(result, { authorized: false, reason });
  }
});

test('server, paired-runtime, and import projections are explicitly non-authoritative', () => {
  for (const projectionSource of ['server', 'paired-runtime', 'import'] as const) {
    const parsed = ExecutionAuthorityDtoSchema.parse({
      schemaVersion: 1,
      authorityKind: 'projection-only',
      authorityState: 'projection-only',
      projectionSource,
      canExecute: false,
      executionTarget: 'paired-desktop',
      ownerId: 'owner-1',
      runId: 'run-1',
      authorityRuntimeId: RUNTIME_ID,
      observedAt: NOW,
    });
    assert.equal(parsed.authorityState, 'projection-only');
    assert.equal(parsed.canExecute, false);
  }
  assert.equal(ExecutionAuthorityDtoSchema.safeParse({
    schemaVersion: 1,
    authorityKind: 'projection-only',
    authorityState: 'authoritative',
    projectionSource: 'server',
    canExecute: true,
    executionTarget: 'cloud',
    ownerId: 'owner-1',
    runId: 'run-1',
    observedAt: NOW,
  }).success, false);
});

test('checkpoints remain bound to exact local and server authority counters', () => {
  assert.equal(ExecutionCheckpointRefDtoSchema.safeParse(pairedCheckpoint).success, true);
  assert.equal(ExecutionAuthorityCheckpointBindingDtoSchema.safeParse({
    authorityEnvelope: pairedAuthority,
    checkpoint: pairedCheckpoint,
  }).success, true);
  for (const staleCheckpoint of [
    { ...pairedCheckpoint, globalCoordinationEpoch: 8 },
    { ...pairedCheckpoint, executionFencingToken: 20 },
    { ...pairedCheckpoint, attempt: 3 },
  ]) {
    assert.equal(ExecutionAuthorityCheckpointBindingDtoSchema.safeParse({
      authorityEnvelope: pairedAuthority,
      checkpoint: staleCheckpoint,
    }).success, false);
  }

  const localCheckpoint = {
    schemaVersion: 1,
    checkpointId: 'checkpoint-local-1',
    checkpointVersion: 1,
    runId: 'run-1',
    executionTarget: 'local-desktop',
    authorityRuntimeId: 'desktop-runtime-1',
    globalCoordinationEpoch: 7,
    localJournalEpoch: 11,
    idempotencyKey: 'run-1:local-step-1',
    recordedAt: NOW,
  } as const;
  assert.equal(ExecutionAuthorityCheckpointBindingDtoSchema.safeParse({
    authorityEnvelope: localAuthority,
    checkpoint: localCheckpoint,
  }).success, true);
  assert.equal(ExecutionAuthorityCheckpointBindingDtoSchema.safeParse({
    authorityEnvelope: localAuthority,
    checkpoint: { ...localCheckpoint, localJournalEpoch: 12 },
  }).success, false);
});

test('authoritative confirmation envelopes preserve issuer and attempt binding', () => {
  const envelope = {
    schemaVersion: 1,
    grantId: 'grant-1',
    status: 'granted',
    issuer: 'server',
    binding: {
      ownerId: 'owner-1',
      runId: 'run-1',
      stepId: 'step-1',
      planHash: 'plan-hash-1',
      toolName: 'generation.createBatchJob',
      targetSnapshotHash: 'target-hash-1',
      executionTarget: 'paired-desktop',
      authorityRuntimeId: RUNTIME_ID,
      allowedAttempt: 2,
      executionAuthority: pairedAuthority,
    },
    issuedAt: NOW,
    expiresAt: LATER,
    proof: {
      proofKind: 'server-issued',
      opaqueProof: 'p'.repeat(32),
    },
  } as const;
  assert.equal(ExecutionConfirmationGrantEnvelopeDtoSchema.safeParse(envelope).success, true);
  assert.equal(ExecutionConfirmationGrantEnvelopeDtoSchema.safeParse({
    ...envelope,
    issuer: 'installation-local-broker',
  }).success, false);
  assert.equal(ExecutionConfirmationGrantEnvelopeDtoSchema.safeParse({
    ...envelope,
    binding: { ...envelope.binding, allowedAttempt: 3 },
  }).success, false);
});

test('public Agent Run reads downgrade legacy authority to a non-executable projection', () => {
  const projection = ExecutionConfirmationGrantProjectionDtoSchema.parse({
    schemaVersion: 1,
    grantId: 'grant-1',
    authorityState: 'projection-only',
    canExecute: false,
    status: 'granted',
    runId: 'run-1',
    stepId: 'step-1',
    executionTarget: 'paired-desktop',
    expiresAt: LATER,
    projectedAt: NOW,
  });
  const legacyCompatible = AgentRunDtoSchema.safeParse({
    ...basePairedRun,
    executionAuthorityEnvelope: pairedAuthority,
    confirmationGrant: projection,
  });
  assert.equal(legacyCompatible.success, true);
  assert.equal(
    legacyCompatible.success && legacyCompatible.data.executionAuthorityEnvelope?.authorityState,
    'projection-only',
  );
  assert.equal(
    legacyCompatible.success
      && 'executionFencingToken' in (legacyCompatible.data.executionAuthorityEnvelope || {}),
    false,
  );
  assert.equal(
    AgentRunAuthorityReadProjectionCompatibilityDtoSchema.parse(pairedAuthority).canExecute,
    false,
  );
  assert.equal(
    evaluateCurrentExecutionAuthority(
      AgentRunAuthorityReadProjectionCompatibilityDtoSchema.parse(pairedAuthority),
      pairedEvaluationContext,
    ).authorized,
    false,
  );
});

test('Agent Run input compatibility rejects stale checkpoints and cross-boundary authority', () => {
  assert.equal(AgentRunDtoSchema.safeParse({
    ...basePairedRun,
    executionAuthorityEnvelope: pairedAuthority,
    executionCheckpoint: pairedCheckpoint,
  }).success, true);
  assert.equal(AgentRunDtoSchema.safeParse({
    ...basePairedRun,
    executionAuthorityEnvelope: pairedAuthority,
    executionCheckpoint: { ...pairedCheckpoint, globalCoordinationEpoch: 8 },
  }).success, false);
  assert.equal(AgentRunDtoSchema.safeParse({
    ...basePairedRun,
    executionAuthorityEnvelope: { ...pairedAuthority, runId: 'run-other' },
  }).success, false);
  assert.equal(AgentRunDtoSchema.safeParse({
    ...basePairedRun,
    executionAuthorityEnvelope: { ...pairedAuthority, authorityRuntimeId: 'runtime-other' },
  }).success, false);
  assert.equal(AgentRunDtoSchema.safeParse({
    ...basePairedRun,
    executionTarget: 'cloud',
    pairedRuntimeId: undefined,
    executionAuthorityEnvelope: pairedAuthority,
  }).success, false);
  for (const status of ['verifying', 'verification_required', 'manual_reconcile'] as const) {
    assert.equal(AgentRunDtoSchema.safeParse({ ...basePairedRun, status }).success, true);
  }
});
