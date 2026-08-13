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

export const ExecutableExecutionAuthorityDtoSchema = z.discriminatedUnion('authorityKind', [
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
  ExecutableExecutionAuthorityDtoSchema,
  ExecutionAuthorityProjectionDtoSchema,
]);

export type ExecutionAuthorityProjectionDto = z.infer<typeof ExecutionAuthorityProjectionDtoSchema>;
export type ExecutableExecutionAuthorityDto = z.infer<typeof ExecutableExecutionAuthorityDtoSchema>;
export type ExecutionAuthorityDto = z.infer<typeof ExecutionAuthorityDtoSchema>;

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
  executionAuthority: ExecutableExecutionAuthorityDtoSchema,
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
        message: `${field} must match the executable authority.`,
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
