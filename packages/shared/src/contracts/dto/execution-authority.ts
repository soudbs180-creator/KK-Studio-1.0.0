import { z } from 'zod';

/** The only execution-lane vocabulary shared by Web, Desktop, mobile, and server. */
export const AgentExecutionTargetSchema = z.enum([
  'local-desktop',
  'paired-desktop',
  'cloud',
]);
export type AgentExecutionTarget = z.infer<typeof AgentExecutionTargetSchema>;

export const SideEffectClassSchema = z.enum([
  'idempotent',
  'deduplicated',
  'reconcilable',
  'non_retryable_ambiguous',
]);
export type SideEffectClass = z.infer<typeof SideEffectClassSchema>;

export const ConfirmationClassSchema = z.enum([
  'none',
  'standard',
  'cost',
  'destructive',
  'external_publish',
  'credential_change',
  'filesystem_write',
  'authority_transfer',
  'irreversible',
]);
export type ConfirmationClass = z.infer<typeof ConfirmationClassSchema>;

const addContractIssue = (
  context: z.RefinementCtx,
  path: string[],
  message: string,
): void => {
  context.addIssue({ code: z.ZodIssueCode.custom, path, message });
};

const ExecutionAuthorityBaseShape = {
  schemaVersion: z.literal(1),
  authorityState: z.literal('authoritative'),
  ownerId: z.string().min(1).max(200),
  runId: z.string().min(1).max(200),
  authorityRuntimeId: z.string().min(1).max(200),
  globalCoordinationEpoch: z.number().int().positive(),
  issuedAt: z.iso.datetime(),
};

const LocalExecutionAuthorityDtoSchema = z.object({
  ...ExecutionAuthorityBaseShape,
  authorityKind: z.literal('installation-local'),
  executionTarget: z.literal('local-desktop'),
  installationId: z.string().min(1).max(200),
  localJournalEpoch: z.number().int().positive(),
  singleInstanceLockId: z.string().min(1).max(200),
}).strict();

const ServerLeaseExecutionAuthorityDtoSchema = z.object({
  ...ExecutionAuthorityBaseShape,
  authorityKind: z.literal('server-lease'),
  executionTarget: z.enum(['paired-desktop', 'cloud']),
  executionFencingToken: z.number().int().positive(),
  attempt: z.number().int().positive().max(1000),
  leaseExpiresAt: z.iso.datetime(),
}).strict();

/**
 * Read models deliberately cannot carry an executable epoch, fence, lease, or proof.
 * Consumers must positively match an authoritative variant before executing.
 */
export const ExecutionAuthorityProjectionDtoSchema = z.object({
  schemaVersion: z.literal(1),
  authorityKind: z.literal('projection-only'),
  authorityState: z.literal('projection-only'),
  projectionSource: z.enum(['server', 'paired-runtime', 'import']),
  canExecute: z.literal(false),
  executionTarget: AgentExecutionTargetSchema,
  ownerId: z.string().min(1).max(200),
  runId: z.string().min(1).max(200),
  authorityRuntimeId: z.string().min(1).max(200).optional(),
  observedAt: z.iso.datetime(),
}).strict();

/** Validates an authoritative envelope's shape; it does not grant permission to execute. */
export const AuthoritativeExecutionAuthorityEnvelopeDtoSchema = z.discriminatedUnion('authorityKind', [
  LocalExecutionAuthorityDtoSchema,
  ServerLeaseExecutionAuthorityDtoSchema,
]).superRefine((authority, context) => {
  if (
    authority.authorityKind === 'server-lease'
    && Date.parse(authority.leaseExpiresAt) <= Date.parse(authority.issuedAt)
  ) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['leaseExpiresAt'],
      message: 'Server execution lease must expire after it is issued.',
    });
  }
});

export const ExecutionAuthorityDtoSchema = z.union([
  AuthoritativeExecutionAuthorityEnvelopeDtoSchema,
  ExecutionAuthorityProjectionDtoSchema,
]);

export type ExecutionAuthorityProjectionDto = z.infer<typeof ExecutionAuthorityProjectionDtoSchema>;
export type AuthoritativeExecutionAuthorityEnvelopeDto = z.infer<
  typeof AuthoritativeExecutionAuthorityEnvelopeDtoSchema
>;
export type ExecutionAuthorityDto = z.infer<typeof ExecutionAuthorityDtoSchema>;

const projectAuthorityForRead = (
  authority: ExecutionAuthorityDto,
): ExecutionAuthorityProjectionDto => {
  if (authority.authorityState === 'projection-only') return authority;
  return {
    schemaVersion: 1,
    authorityKind: 'projection-only',
    authorityState: 'projection-only',
    projectionSource: 'server',
    canExecute: false,
    executionTarget: authority.executionTarget,
    ownerId: authority.ownerId,
    runId: authority.runId,
    authorityRuntimeId: authority.authorityRuntimeId,
    observedAt: authority.issuedAt,
  };
};

/**
 * Additive read compatibility for legacy Run payloads. Authoritative inputs are
 * irreversibly stripped to a projection before they enter public client state.
 */
export const AgentRunAuthorityReadProjectionCompatibilityDtoSchema = ExecutionAuthorityDtoSchema
  .transform(projectAuthorityForRead);

const ExecutionAuthorityEvaluationContextBaseShape = {
  now: z.iso.datetime(),
  expectedOwnerId: z.string().min(1).max(200),
  expectedRunId: z.string().min(1).max(200),
  expectedAuthorityRuntimeId: z.string().min(1).max(200),
  currentGlobalCoordinationEpoch: z.number().int().positive(),
};

const LocalExecutionAuthorityEvaluationContextSchema = z.object({
  ...ExecutionAuthorityEvaluationContextBaseShape,
  expectedExecutionTarget: z.literal('local-desktop'),
  expectedInstallationId: z.string().min(1).max(200),
  currentLocalJournalEpoch: z.number().int().positive(),
  currentSingleInstanceLockId: z.string().min(1).max(200),
}).strict();

const serverEvaluationContextShape = {
  ...ExecutionAuthorityEvaluationContextBaseShape,
  currentExecutionFencingToken: z.number().int().positive(),
  currentAttempt: z.number().int().positive().max(1000),
};

const PairedExecutionAuthorityEvaluationContextSchema = z.object({
  ...serverEvaluationContextShape,
  expectedExecutionTarget: z.literal('paired-desktop'),
}).strict();

const CloudExecutionAuthorityEvaluationContextSchema = z.object({
  ...serverEvaluationContextShape,
  expectedExecutionTarget: z.literal('cloud'),
}).strict();

export const ExecutionAuthorityEvaluationContextSchema = z.discriminatedUnion(
  'expectedExecutionTarget',
  [
    LocalExecutionAuthorityEvaluationContextSchema,
    PairedExecutionAuthorityEvaluationContextSchema,
    CloudExecutionAuthorityEvaluationContextSchema,
  ],
);
export type ExecutionAuthorityEvaluationContext = z.infer<
  typeof ExecutionAuthorityEvaluationContextSchema
>;

export const ExecutionAuthorityEvaluationFailureReasonSchema = z.enum([
  'invalid_authority_shape',
  'invalid_evaluation_context',
  'authority_not_yet_valid',
  'lease_expired',
  'owner_mismatch',
  'run_mismatch',
  'target_mismatch',
  'runtime_mismatch',
  'global_epoch_stale',
  'installation_mismatch',
  'local_journal_epoch_stale',
  'single_instance_lock_stale',
  'fencing_token_stale',
  'attempt_stale',
]);
export type ExecutionAuthorityEvaluationFailureReason = z.infer<
  typeof ExecutionAuthorityEvaluationFailureReasonSchema
>;

export type ExecutionAuthorityEvaluationResult =
  | {
    authorized: true;
    authorityEnvelope: AuthoritativeExecutionAuthorityEnvelopeDto;
  }
  | {
    authorized: false;
    reason: ExecutionAuthorityEvaluationFailureReason;
  };

const rejectAuthority = (
  reason: ExecutionAuthorityEvaluationFailureReason,
): ExecutionAuthorityEvaluationResult => ({ authorized: false, reason });

const evaluateAuthorityIdentity = (
  authority: AuthoritativeExecutionAuthorityEnvelopeDto,
  context: ExecutionAuthorityEvaluationContext,
): ExecutionAuthorityEvaluationFailureReason | undefined => {
  if (authority.ownerId !== context.expectedOwnerId) return 'owner_mismatch';
  if (authority.runId !== context.expectedRunId) return 'run_mismatch';
  if (authority.executionTarget !== context.expectedExecutionTarget) return 'target_mismatch';
  if (authority.authorityRuntimeId !== context.expectedAuthorityRuntimeId) return 'runtime_mismatch';
  if (authority.globalCoordinationEpoch !== context.currentGlobalCoordinationEpoch) {
    return 'global_epoch_stale';
  }
  return undefined;
};

const evaluateAuthorityLane = (
  authority: AuthoritativeExecutionAuthorityEnvelopeDto,
  context: ExecutionAuthorityEvaluationContext,
): ExecutionAuthorityEvaluationFailureReason | undefined => {
  if (authority.authorityKind === 'installation-local') {
    if (context.expectedExecutionTarget !== 'local-desktop') return 'target_mismatch';
    if (authority.installationId !== context.expectedInstallationId) return 'installation_mismatch';
    if (authority.localJournalEpoch !== context.currentLocalJournalEpoch) {
      return 'local_journal_epoch_stale';
    }
    if (authority.singleInstanceLockId !== context.currentSingleInstanceLockId) {
      return 'single_instance_lock_stale';
    }
    return undefined;
  }
  if (context.expectedExecutionTarget === 'local-desktop') return 'target_mismatch';
  if (authority.executionFencingToken !== context.currentExecutionFencingToken) {
    return 'fencing_token_stale';
  }
  return authority.attempt === context.currentAttempt ? undefined : 'attempt_stale';
};

/**
 * The sole shared authority decision. Callers must supply current identity,
 * epochs, fence/attempt or local lock, and an injected clock value.
 */
export const evaluateCurrentExecutionAuthority = (
  candidate: unknown,
  evaluationContext: ExecutionAuthorityEvaluationContext,
): ExecutionAuthorityEvaluationResult => {
  const parsedContext = ExecutionAuthorityEvaluationContextSchema.safeParse(evaluationContext);
  if (!parsedContext.success) return rejectAuthority('invalid_evaluation_context');
  const parsedAuthority = AuthoritativeExecutionAuthorityEnvelopeDtoSchema.safeParse(candidate);
  if (!parsedAuthority.success) return rejectAuthority('invalid_authority_shape');

  const authority = parsedAuthority.data;
  const context = parsedContext.data;
  if (Date.parse(authority.issuedAt) > Date.parse(context.now)) {
    return rejectAuthority('authority_not_yet_valid');
  }
  if (
    authority.authorityKind === 'server-lease'
    && Date.parse(authority.leaseExpiresAt) <= Date.parse(context.now)
  ) {
    return rejectAuthority('lease_expired');
  }
  const mismatch = evaluateAuthorityIdentity(authority, context)
    || evaluateAuthorityLane(authority, context);
  return mismatch
    ? rejectAuthority(mismatch)
    : { authorized: true, authorityEnvelope: authority };
};

const ExecutionCheckpointBaseShape = {
  schemaVersion: z.literal(1),
  checkpointId: z.string().min(1).max(200),
  checkpointVersion: z.number().int().positive(),
  runId: z.string().min(1).max(200),
  stepId: z.string().min(1).max(200).optional(),
  authorityRuntimeId: z.string().min(1).max(200),
  globalCoordinationEpoch: z.number().int().positive(),
  idempotencyKey: z.string().min(1).max(255),
  recordedAt: z.iso.datetime(),
};

const LocalExecutionCheckpointRefDtoSchema = z.object({
  ...ExecutionCheckpointBaseShape,
  executionTarget: z.literal('local-desktop'),
  localJournalEpoch: z.number().int().positive(),
}).strict();

const PairedExecutionCheckpointRefDtoSchema = z.object({
  ...ExecutionCheckpointBaseShape,
  executionTarget: z.literal('paired-desktop'),
  executionFencingToken: z.number().int().positive(),
  attempt: z.number().int().positive().max(1000),
}).strict();

const CloudExecutionCheckpointRefDtoSchema = z.object({
  ...ExecutionCheckpointBaseShape,
  executionTarget: z.literal('cloud'),
  executionFencingToken: z.number().int().positive(),
  attempt: z.number().int().positive().max(1000),
}).strict();

export const ExecutionCheckpointRefDtoSchema = z.discriminatedUnion('executionTarget', [
  LocalExecutionCheckpointRefDtoSchema,
  PairedExecutionCheckpointRefDtoSchema,
  CloudExecutionCheckpointRefDtoSchema,
]);
export type ExecutionCheckpointRefDto = z.infer<typeof ExecutionCheckpointRefDtoSchema>;

const ExecutionAuthorityCheckpointBindingBaseSchema = z.object({
  authorityEnvelope: AuthoritativeExecutionAuthorityEnvelopeDtoSchema,
  checkpoint: ExecutionCheckpointRefDtoSchema,
}).strict();
type ParsedAuthorityCheckpointBinding = z.infer<
  typeof ExecutionAuthorityCheckpointBindingBaseSchema
>;

const validateCheckpointAuthorityIdentity = (
  binding: ParsedAuthorityCheckpointBinding,
  context: z.RefinementCtx,
): void => {
  const { authorityEnvelope: authority, checkpoint } = binding;
  const mismatches: Array<[string, boolean]> = [
    ['runId', checkpoint.runId !== authority.runId],
    ['executionTarget', checkpoint.executionTarget !== authority.executionTarget],
    ['authorityRuntimeId', checkpoint.authorityRuntimeId !== authority.authorityRuntimeId],
    ['globalCoordinationEpoch', checkpoint.globalCoordinationEpoch !== authority.globalCoordinationEpoch],
  ];
  for (const [field, mismatch] of mismatches) {
    if (mismatch) {
      addContractIssue(context, ['checkpoint', field], `${field} must match the authority envelope.`);
    }
  }
};

const validateCheckpointAuthorityLane = (
  binding: ParsedAuthorityCheckpointBinding,
  context: z.RefinementCtx,
): void => {
  const { authorityEnvelope: authority, checkpoint } = binding;
  if (authority.authorityKind === 'installation-local') {
    if (
      checkpoint.executionTarget === 'local-desktop'
      && checkpoint.localJournalEpoch !== authority.localJournalEpoch
    ) {
      addContractIssue(context, ['checkpoint', 'localJournalEpoch'], 'Local journal epoch is stale.');
    }
    return;
  }
  if (checkpoint.executionTarget === 'local-desktop') return;
  if (checkpoint.executionFencingToken !== authority.executionFencingToken) {
    addContractIssue(context, ['checkpoint', 'executionFencingToken'], 'Execution fence is stale.');
  }
  if (checkpoint.attempt !== authority.attempt) {
    addContractIssue(context, ['checkpoint', 'attempt'], 'Execution attempt is stale.');
  }
};

/** Exact checkpoint binding is structural only; current authority still requires the evaluator. */
export const ExecutionAuthorityCheckpointBindingDtoSchema = ExecutionAuthorityCheckpointBindingBaseSchema
  .superRefine((binding, context) => {
    validateCheckpointAuthorityIdentity(binding, context);
    validateCheckpointAuthorityLane(binding, context);
  });
export type ExecutionAuthorityCheckpointBindingDto = z.infer<
  typeof ExecutionAuthorityCheckpointBindingDtoSchema
>;

const ToolExecutionControlBaseSchema = z.object({
  schemaVersion: z.literal(1),
  effect: z.enum(['read', 'navigation', 'mutation']),
  sideEffectClass: SideEffectClassSchema.optional(),
  confirmationClass: ConfirmationClassSchema,
  allowedExecutionTargets: z.array(AgentExecutionTargetSchema).min(1).max(3),
  cloudSafe: z.boolean(),
  requiresIdempotencyKey: z.boolean(),
}).strict();

type ParsedToolExecutionControl = z.infer<typeof ToolExecutionControlBaseSchema>;

const validateControlTargets = (
  control: ParsedToolExecutionControl,
  context: z.RefinementCtx,
): void => {
  const uniqueTargets = new Set(control.allowedExecutionTargets);
  if (uniqueTargets.size !== control.allowedExecutionTargets.length) {
    addContractIssue(context, ['allowedExecutionTargets'], 'Execution targets must be unique.');
  }
  if (control.allowedExecutionTargets.includes('cloud') !== control.cloudSafe) {
    addContractIssue(
      context,
      ['cloudSafe'],
      'Cloud availability and cloud-safe classification must agree.',
    );
  }
};

const validateControlEffect = (
  control: ParsedToolExecutionControl,
  context: z.RefinementCtx,
): void => {
  if (control.effect === 'mutation' && !control.sideEffectClass) {
    addContractIssue(context, ['sideEffectClass'], 'Mutation controls must declare a side-effect class.');
  }
  if (control.effect !== 'mutation' && control.sideEffectClass) {
    addContractIssue(context, ['sideEffectClass'], 'Read and navigation controls cannot declare side effects.');
  }
  if (control.effect !== 'mutation' && control.confirmationClass !== 'none') {
    addContractIssue(
      context,
      ['confirmationClass'],
      'Read and navigation controls cannot request mutation confirmation.',
    );
  }
  if (control.effect === 'mutation' && !control.requiresIdempotencyKey) {
    addContractIssue(context, ['requiresIdempotencyKey'], 'Mutation controls must require an idempotency key.');
  }
};

export const ToolExecutionControlDtoSchema = ToolExecutionControlBaseSchema.superRefine((control, context) => {
  validateControlTargets(control, context);
  validateControlEffect(control, context);
});
export type ToolExecutionControlDto = z.infer<typeof ToolExecutionControlDtoSchema>;

const ConfirmationGrantBindingDtoSchema = z.object({
  ownerId: z.string().min(1).max(200),
  sessionId: z.string().min(1).max(200).optional(),
  runId: z.string().min(1).max(200),
  stepId: z.string().min(1).max(200),
  planHash: z.string().min(1).max(200),
  toolName: z.string().min(1).max(200),
  targetSnapshotHash: z.string().min(1).max(200),
  quoteId: z.string().min(1).max(200).optional(),
  maxCostCredits: z.number().int().nonnegative().optional(),
  executionTarget: AgentExecutionTargetSchema,
  authorityRuntimeId: z.string().min(1).max(200),
  allowedAttempt: z.number().int().positive().max(1000),
  executionAuthority: AuthoritativeExecutionAuthorityEnvelopeDtoSchema,
}).strict().superRefine((binding, context) => {
  const authority = binding.executionAuthority;
  const mismatches: Array<[string, boolean]> = [
    ['ownerId', binding.ownerId !== authority.ownerId],
    ['runId', binding.runId !== authority.runId],
    ['executionTarget', binding.executionTarget !== authority.executionTarget],
    ['authorityRuntimeId', binding.authorityRuntimeId !== authority.authorityRuntimeId],
  ];
  for (const [field, mismatch] of mismatches) {
    if (mismatch) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: [field],
        message: `${field} must match the authoritative authority envelope.`,
      });
    }
  }
  if (authority.authorityKind === 'server-lease' && binding.allowedAttempt !== authority.attempt) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['allowedAttempt'],
      message: 'Allowed attempt must match the server lease attempt.',
    });
  }
  if (binding.maxCostCredits !== undefined && !binding.quoteId) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['quoteId'],
      message: 'A bounded cost requires a Quote identifier.',
    });
  }
});

const ConfirmationGrantEnvelopeBaseShape = {
  schemaVersion: z.literal(1),
  grantId: z.string().min(1).max(200),
  status: z.literal('granted'),
  binding: ConfirmationGrantBindingDtoSchema,
  issuedAt: z.iso.datetime(),
  expiresAt: z.iso.datetime(),
};

const LocalConfirmationGrantEnvelopeDtoSchema = z.object({
  ...ConfirmationGrantEnvelopeBaseShape,
  issuer: z.literal('installation-local-broker'),
  proof: z.object({
    proofKind: z.literal('installation-local'),
    opaqueProof: z.string().min(32).max(4096),
  }).strict(),
}).strict();

const ServerConfirmationGrantEnvelopeDtoSchema = z.object({
  ...ConfirmationGrantEnvelopeBaseShape,
  issuer: z.literal('server'),
  proof: z.object({
    proofKind: z.literal('server-issued'),
    opaqueProof: z.string().min(32).max(4096),
  }).strict(),
}).strict();

/** An opaque proof plus exact binding is required; a grant ID alone is never authority. */
export const ExecutionConfirmationGrantEnvelopeDtoSchema = z.discriminatedUnion('issuer', [
  LocalConfirmationGrantEnvelopeDtoSchema,
  ServerConfirmationGrantEnvelopeDtoSchema,
]).superRefine((grant, context) => {
  const target = grant.binding.executionTarget;
  if (grant.issuer === 'installation-local-broker' && target !== 'local-desktop') {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['issuer'],
      message: 'Installation-local grants can authorize only local-desktop execution.',
    });
  }
  if (grant.issuer === 'server' && target === 'local-desktop') {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['issuer'],
      message: 'Server grants can authorize only paired-desktop or cloud execution.',
    });
  }
  if (Date.parse(grant.expiresAt) <= Date.parse(grant.issuedAt)) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['expiresAt'],
      message: 'Confirmation grant must expire after it is issued.',
    });
  }
});
export type ExecutionConfirmationGrantEnvelopeDto = z.infer<
  typeof ExecutionConfirmationGrantEnvelopeDtoSchema
>;

/** Safe Run/Task audit projection; it contains neither proof nor execution authority. */
export const ExecutionConfirmationGrantProjectionDtoSchema = z.object({
  schemaVersion: z.literal(1),
  grantId: z.string().min(1).max(200),
  authorityState: z.literal('projection-only'),
  canExecute: z.literal(false),
  status: z.enum(['pending', 'granted', 'rejected', 'expired', 'consumed']),
  runId: z.string().min(1).max(200),
  stepId: z.string().min(1).max(200),
  executionTarget: AgentExecutionTargetSchema,
  expiresAt: z.iso.datetime(),
  projectedAt: z.iso.datetime(),
}).strict();
export type ExecutionConfirmationGrantProjectionDto = z.infer<
  typeof ExecutionConfirmationGrantProjectionDtoSchema
>;
