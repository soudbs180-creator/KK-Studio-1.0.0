import assert from 'node:assert/strict';
import test from 'node:test';
import {
  PlatformRuntimeCapabilitySnapshotDtoSchema,
  PlatformRuntimeResultDtoSchema,
  PlatformUpdateStateDtoSchema,
  ToolExecutionControlDtoSchema,
} from '../../packages/shared/src/index.ts';

const NOW = '2026-08-13T00:00:00.000Z';

test('mutations must declare a known side-effect class and explicit execution targets', () => {
  const mutation = {
    schemaVersion: 1,
    effect: 'mutation',
    sideEffectClass: 'deduplicated',
    confirmationClass: 'cost',
    allowedExecutionTargets: ['local-desktop', 'cloud'],
    cloudSafe: true,
    requiresIdempotencyKey: true,
  } as const;
  assert.equal(ToolExecutionControlDtoSchema.safeParse(mutation).success, true);
  assert.equal(ToolExecutionControlDtoSchema.safeParse({
    ...mutation,
    sideEffectClass: undefined,
  }).success, false);
  assert.equal(ToolExecutionControlDtoSchema.safeParse({
    ...mutation,
    sideEffectClass: 'best-effort',
  }).success, false);
  assert.equal(ToolExecutionControlDtoSchema.safeParse({
    ...mutation,
    cloudSafe: false,
  }).success, false);
  assert.equal(ToolExecutionControlDtoSchema.safeParse({
    ...mutation,
    allowedExecutionTargets: ['local-desktop', 'local-desktop'],
  }).success, false);
});

test('read-only controls cannot smuggle mutation or confirmation semantics', () => {
  const readOnly = {
    schemaVersion: 1,
    effect: 'read',
    confirmationClass: 'none',
    allowedExecutionTargets: ['local-desktop', 'paired-desktop', 'cloud'],
    cloudSafe: true,
    requiresIdempotencyKey: false,
  } as const;
  assert.equal(ToolExecutionControlDtoSchema.safeParse(readOnly).success, true);
  assert.equal(ToolExecutionControlDtoSchema.safeParse({
    ...readOnly,
    sideEffectClass: 'idempotent',
  }).success, false);
  assert.equal(ToolExecutionControlDtoSchema.safeParse({
    ...readOnly,
    confirmationClass: 'destructive',
  }).success, false);
});

test('platform runtime snapshots and operation results are strict JSON-only DTOs', () => {
  assert.equal(PlatformRuntimeCapabilitySnapshotDtoSchema.safeParse({
    schemaVersion: 1,
    runtimeKind: 'browser',
    operatingSystem: 'browser',
    appVersion: '1.6.1',
    releaseChannel: 'stable',
    capabilities: [{
      capability: 'workspace-export',
      availability: 'supported',
    }],
    observedAt: NOW,
  }).success, true);
  assert.equal(PlatformRuntimeCapabilitySnapshotDtoSchema.safeParse({
    schemaVersion: 1,
    runtimeKind: 'browser',
    operatingSystem: 'browser',
    appVersion: '1.6.1',
    releaseChannel: 'stable',
    capabilities: [{ capability: 'arbitrary-shell', availability: 'supported' }],
    observedAt: NOW,
  }).success, false);
  assert.equal(PlatformRuntimeResultDtoSchema.safeParse({
    schemaVersion: 1,
    status: 'unsupported',
    operation: 'install-update',
    reasonCode: 'desktop_only',
    recoveryActions: ['open_documentation'],
  }).success, true);
  assert.equal(PlatformRuntimeResultDtoSchema.safeParse({
    schemaVersion: 1,
    status: 'success',
    operation: 'save-file',
    value: { path: 'project/output.zip', count: 2 },
  }).success, true);
  assert.equal(PlatformRuntimeResultDtoSchema.safeParse({
    schemaVersion: 1,
    status: 'success',
    operation: 'save-file',
    value: { invalid: new Date() },
  }).success, false);
});

test('update health states require explicit post-relaunch evidence', () => {
  const healthVerification = {
    rendererArtifactMatch: 'passed',
    localStoreVerified: 'passed',
    expectedCanvasRestored: 'not_applicable',
    sidecarProtocolCompatible: 'passed',
    noOrphanProcess: 'passed',
    optionalServices: 'healthy',
  } as const;
  const healthy = {
    schemaVersion: 1,
    phase: 'healthy',
    currentVersion: '1.7.0',
    targetVersion: '1.7.0',
    releaseChannel: 'stable',
    affectedTaskIds: [],
    safeActions: [],
    healthVerification,
    updatedAt: NOW,
  } as const;
  assert.equal(PlatformUpdateStateDtoSchema.safeParse(healthy).success, true);
  assert.equal(PlatformUpdateStateDtoSchema.safeParse({
    ...healthy,
    healthVerification: { ...healthVerification, localStoreVerified: 'failed' },
  }).success, false);
  assert.equal(PlatformUpdateStateDtoSchema.safeParse({
    ...healthy,
    phase: 'degraded',
    healthVerification: { ...healthVerification, optionalServices: 'degraded' },
  }).success, true);
  assert.equal(PlatformUpdateStateDtoSchema.safeParse({
    ...healthy,
    phase: 'recovery',
    healthVerification: { ...healthVerification, sidecarProtocolCompatible: 'failed' },
    safeActions: ['open_recovery'],
  }).success, true);
  assert.equal(PlatformUpdateStateDtoSchema.safeParse({
    ...healthy,
    phase: 'recovery',
  }).success, false);
});
