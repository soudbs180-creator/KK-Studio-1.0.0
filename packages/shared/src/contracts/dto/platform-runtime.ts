import { z } from 'zod';

export type PlatformRuntimeJsonValue =
  | null
  | boolean
  | number
  | string
  | PlatformRuntimeJsonValue[]
  | { [key: string]: PlatformRuntimeJsonValue };

/** Serializable host boundary. Class instances, functions, and native handles are rejected. */
export const PlatformRuntimeJsonValueSchema: z.ZodType<PlatformRuntimeJsonValue> = z.lazy(() => z.union([
  z.null(),
  z.boolean(),
  z.number().finite(),
  z.string(),
  z.array(PlatformRuntimeJsonValueSchema),
  z.record(z.string(), PlatformRuntimeJsonValueSchema),
]));

export const PlatformRuntimeKindSchema = z.enum(['browser', 'desktop', 'mobile']);
export const PlatformOperatingSystemSchema = z.enum([
  'browser',
  'windows',
  'macos',
  'linux',
  'ios',
  'android',
]);
export const PlatformReleaseChannelSchema = z.enum([
  'development',
  'internal',
  'canary',
  'stable',
]);

export const PlatformRuntimeCapabilitySchema = z.enum([
  'app-info',
  'window-lifecycle',
  'file-open',
  'file-save',
  'workspace-import',
  'workspace-export',
  'deep-link',
  'app-update',
  'local-runner-health',
  'runtime-pairing',
  'os-notifications',
  'secure-credential-reference',
]);

export const PlatformRuntimeCapabilityAvailabilitySchema = z.enum([
  'supported',
  'degraded',
  'unsupported',
]);

const PlatformRuntimeCapabilityDtoSchema = z.object({
  capability: PlatformRuntimeCapabilitySchema,
  availability: PlatformRuntimeCapabilityAvailabilitySchema,
  reasonCode: z.enum([
    'desktop_only',
    'mobile_only',
    'browser_restricted',
    'permission_required',
    'runtime_unavailable',
    'policy_disabled',
  ]).optional(),
}).strict().superRefine((capability, context) => {
  if (capability.availability === 'supported' && capability.reasonCode) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['reasonCode'],
      message: 'Supported capabilities cannot include an unavailable reason.',
    });
  }
  if (capability.availability !== 'supported' && !capability.reasonCode) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['reasonCode'],
      message: 'Unavailable capabilities require a stable reason code.',
    });
  }
});

const isRuntimeOsPairValid = (runtimeKind: string, operatingSystem: string): boolean => {
  if (runtimeKind === 'browser') return operatingSystem === 'browser';
  if (runtimeKind === 'mobile') return operatingSystem === 'ios' || operatingSystem === 'android';
  return ['windows', 'macos', 'linux'].includes(operatingSystem);
};

export const PlatformRuntimeCapabilitySnapshotDtoSchema = z.object({
  schemaVersion: z.literal(1),
  runtimeKind: PlatformRuntimeKindSchema,
  operatingSystem: PlatformOperatingSystemSchema,
  appVersion: z.string().min(1).max(120),
  releaseChannel: PlatformReleaseChannelSchema,
  capabilities: z.array(PlatformRuntimeCapabilityDtoSchema).max(20),
  observedAt: z.iso.datetime(),
}).strict().superRefine((snapshot, context) => {
  if (!isRuntimeOsPairValid(snapshot.runtimeKind, snapshot.operatingSystem)) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['operatingSystem'],
      message: 'Runtime kind and operating system must describe the same host.',
    });
  }
  const capabilityIds = snapshot.capabilities.map((entry) => entry.capability);
  if (new Set(capabilityIds).size !== capabilityIds.length) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['capabilities'],
      message: 'Platform capabilities must be unique.',
    });
  }
});

export const PlatformRuntimeOperationSchema = z.enum([
  'get-app-info',
  'request-window-action',
  'open-file',
  'save-file',
  'import-workspace',
  'export-workspace',
  'handoff-deep-link',
  'check-update',
  'install-update',
  'get-local-runner-health',
  'pair-runtime',
  'show-notification',
  'store-credential-reference',
]);

export const PlatformRuntimeRecoveryActionSchema = z.enum([
  'retry',
  'request_permission',
  'open_settings',
  'open_documentation',
  'open_pairing',
]);

const PlatformRuntimeResultBaseShape = {
  schemaVersion: z.literal(1),
  operation: PlatformRuntimeOperationSchema,
};

const PlatformRuntimeSuccessResultDtoSchema = z.object({
  ...PlatformRuntimeResultBaseShape,
  status: z.literal('success'),
  value: PlatformRuntimeJsonValueSchema.optional(),
}).strict();

const PlatformRuntimeUnsupportedResultDtoSchema = z.object({
  ...PlatformRuntimeResultBaseShape,
  status: z.literal('unsupported'),
  reasonCode: z.enum([
    'desktop_only',
    'mobile_only',
    'browser_restricted',
    'capability_unavailable',
    'policy_disabled',
  ]),
  recoveryActions: z.array(PlatformRuntimeRecoveryActionSchema).max(4),
}).strict();

const PlatformRuntimeFailedResultDtoSchema = z.object({
  ...PlatformRuntimeResultBaseShape,
  status: z.literal('failed'),
  errorCode: z.enum([
    'permission_denied',
    'invalid_input',
    'runtime_unavailable',
    'operation_cancelled',
    'io_failed',
    'update_blocked',
    'unknown_failure',
  ]),
  retryable: z.boolean(),
  recoveryActions: z.array(PlatformRuntimeRecoveryActionSchema).max(4),
}).strict();

export const PlatformRuntimeResultDtoSchema = z.discriminatedUnion('status', [
  PlatformRuntimeSuccessResultDtoSchema,
  PlatformRuntimeUnsupportedResultDtoSchema,
  PlatformRuntimeFailedResultDtoSchema,
]);

export const PlatformUpdatePhaseSchema = z.enum([
  'idle',
  'checking',
  'available',
  'downloading',
  'ready',
  'draining',
  'installing',
  'relaunching',
  'health_verifying',
  'healthy',
  'degraded',
  'recovery',
]);

const PlatformUpdateHealthVerificationDtoSchema = z.object({
  rendererArtifactMatch: z.enum(['passed', 'failed']),
  localStoreVerified: z.enum(['passed', 'failed']),
  expectedCanvasRestored: z.enum(['passed', 'failed', 'not_applicable']),
  sidecarProtocolCompatible: z.enum(['passed', 'failed']),
  noOrphanProcess: z.enum(['passed', 'failed']),
  optionalServices: z.enum(['healthy', 'degraded']),
}).strict();

export const PlatformUpdateSafeActionSchema = z.enum([
  'retry_check',
  'continue_waiting',
  'cancel_update',
  'force_exit',
  'open_task_details',
  'open_recovery',
]);

const HEALTH_PHASES = new Set(['healthy', 'degraded', 'recovery']);
const TARGET_PHASES = new Set([
  'available',
  'downloading',
  'ready',
  'draining',
  'installing',
  'relaunching',
  'health_verifying',
  'healthy',
  'degraded',
  'recovery',
]);

const hasFailedCoreHealthCheck = (
  health: z.infer<typeof PlatformUpdateHealthVerificationDtoSchema>,
): boolean => [
  health.rendererArtifactMatch,
  health.localStoreVerified,
  health.expectedCanvasRestored,
  health.sidecarProtocolCompatible,
  health.noOrphanProcess,
].includes('failed');

export const PlatformUpdateStateDtoSchema = z.object({
  schemaVersion: z.literal(1),
  phase: PlatformUpdatePhaseSchema,
  currentVersion: z.string().min(1).max(120),
  targetVersion: z.string().min(1).max(120).optional(),
  releaseChannel: PlatformReleaseChannelSchema,
  progressPercent: z.number().min(0).max(100).optional(),
  blockedReasonCode: z.enum([
    'active_non_checkpointable_work',
    'signature_invalid',
    'insufficient_disk_space',
    'process_shutdown_failed',
  ]).optional(),
  affectedTaskIds: z.array(z.string().min(1).max(200)).max(200),
  safeActions: z.array(PlatformUpdateSafeActionSchema).max(6),
  healthVerification: PlatformUpdateHealthVerificationDtoSchema.optional(),
  updatedAt: z.iso.datetime(),
}).strict().superRefine((update, context) => {
  if (TARGET_PHASES.has(update.phase) && !update.targetVersion) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['targetVersion'],
      message: 'Active update phases require a target version.',
    });
  }
  if (update.phase === 'downloading' && update.progressPercent === undefined) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['progressPercent'],
      message: 'Downloading state requires progress.',
    });
  }
  if (HEALTH_PHASES.has(update.phase) !== Boolean(update.healthVerification)) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['healthVerification'],
      message: 'Final health phases require exclusive post-relaunch health evidence.',
    });
    return;
  }
  const health = update.healthVerification;
  if (!health) return;
  const coreFailed = hasFailedCoreHealthCheck(health);
  const validHealthy = update.phase === 'healthy' && !coreFailed && health.optionalServices === 'healthy';
  const validDegraded = update.phase === 'degraded' && !coreFailed && health.optionalServices === 'degraded';
  const validRecovery = update.phase === 'recovery' && coreFailed;
  if (!validHealthy && !validDegraded && !validRecovery) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['phase'],
      message: 'Update phase does not match the supplied health evidence.',
    });
  }
});

export type PlatformRuntimeCapabilitySnapshotDto = z.infer<
  typeof PlatformRuntimeCapabilitySnapshotDtoSchema
>;
export type PlatformRuntimeResultDto = z.infer<typeof PlatformRuntimeResultDtoSchema>;
export type PlatformUpdateStateDto = z.infer<typeof PlatformUpdateStateDtoSchema>;
