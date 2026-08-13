import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import {
  AgentExecutionTargetSchema,
  AgentRunDtoSchema,
  ExecutionAuthorityDtoSchema,
  ExecutionCheckpointRefDtoSchema,
  ExecutionConfirmationGrantEnvelopeDtoSchema,
  ExecutionConfirmationGrantProjectionDtoSchema,
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

test('checkpoint and authoritative confirmation envelopes remain bound to exact authority', () => {
  assert.equal(ExecutionCheckpointRefDtoSchema.safeParse({
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
  }).success, true);

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

test('Agent Run additions are optional but reject cross-run, cross-target, and cross-runtime authority', () => {
  const baseRun = {
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
  assert.equal(AgentRunDtoSchema.safeParse({
    ...baseRun,
    executionAuthorityEnvelope: pairedAuthority,
    confirmationGrant: projection,
  }).success, true);
  assert.equal(AgentRunDtoSchema.safeParse({
    ...baseRun,
    executionAuthorityEnvelope: { ...pairedAuthority, runId: 'run-other' },
  }).success, false);
  assert.equal(AgentRunDtoSchema.safeParse({
    ...baseRun,
    executionAuthorityEnvelope: { ...pairedAuthority, authorityRuntimeId: 'runtime-other' },
  }).success, false);
  assert.equal(AgentRunDtoSchema.safeParse({
    ...baseRun,
    executionTarget: 'cloud',
    pairedRuntimeId: undefined,
    executionAuthorityEnvelope: pairedAuthority,
  }).success, false);
  for (const status of ['verifying', 'verification_required', 'manual_reconcile'] as const) {
    assert.equal(AgentRunDtoSchema.safeParse({ ...baseRun, status }).success, true);
  }
});
