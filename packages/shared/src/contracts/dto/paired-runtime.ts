import { z } from 'zod';

export const AgentExecutionTargetSchema = z.enum([
  'local-desktop',
  'paired-desktop',
  'cloud',
]);

export const PairedRuntimeCapabilityManifestSchema = z.object({
  schemaVersion: z.literal(1),
  runtimeVersion: z.string().min(1).max(120),
  tools: z.array(z.string().min(1).max(200)).max(200),
  siteAdapters: z.array(z.string().min(1).max(200)).max(200),
}).strict();

export const RegisterPairedRuntimeRequestSchema = z.object({
  displayName: z.string().trim().min(1).max(120),
  capabilityManifest: PairedRuntimeCapabilityManifestSchema,
}).strict();

export const RegisterPairedRuntimeResponseSchema = z.object({
  runtimeId: z.string().uuid(),
  credential: z.string().min(32).max(512),
  credentialExpiresAt: z.iso.datetime(),
}).strict();

export const PairedRuntimeHeartbeatRequestSchema = z.object({
  capabilityManifest: PairedRuntimeCapabilityManifestSchema,
  observedAt: z.iso.datetime(),
}).strict();

export const PairedRuntimeHeartbeatResponseSchema = z.object({
  runtimeId: z.string().uuid(),
  status: z.literal('online'),
  lastHeartbeatAt: z.iso.datetime(),
}).strict();

/** The first paired-runtime slice is read-only until signed confirmation grants exist. */
export const PairedRuntimeOpencliCommandSchema = z.object({
  kind: z.enum(['inspect_page', 'extract_product']),
  target: z.string().trim().url().max(2048),
  payload: z.record(z.string(), z.unknown()).optional(),
}).strict();

export const PairedRuntimeExecutionEnvelopeSchema = z.object({
  schemaVersion: z.literal(1),
  kind: z.literal('agent_run'),
  runId: z.string().min(1).max(200),
  commands: z.array(PairedRuntimeOpencliCommandSchema).min(1).max(20),
}).strict();

export const PairedRuntimeCommandSchema = z.object({
  commandId: z.string().uuid(),
  runId: z.string().min(1).max(200),
  kind: z.literal('agent_run'),
  leaseToken: z.string().min(32).max(512),
  leaseExpiresAt: z.iso.datetime(),
  attempt: z.number().int().positive().max(20),
  executionEnvelope: PairedRuntimeExecutionEnvelopeSchema,
}).strict();

export const CompletePairedRuntimeCommandRequestSchema = z.object({
  leaseToken: z.string().min(32).max(512),
  status: z.enum(['completed', 'failed']),
  resultSummary: z.string().max(1000).optional(),
  errorCode: z.string().max(120).optional(),
}).strict().superRefine((input, context) => {
  if (input.status === 'failed' && !input.errorCode) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['errorCode'],
      message: 'Failed paired runtime commands require an error code.',
    });
  }
});

export type AgentExecutionTarget = z.infer<typeof AgentExecutionTargetSchema>;
export type PairedRuntimeCapabilityManifest = z.infer<typeof PairedRuntimeCapabilityManifestSchema>;
export type RegisterPairedRuntimeRequest = z.infer<typeof RegisterPairedRuntimeRequestSchema>;
export type RegisterPairedRuntimeResponse = z.infer<typeof RegisterPairedRuntimeResponseSchema>;
export type PairedRuntimeHeartbeatRequest = z.infer<typeof PairedRuntimeHeartbeatRequestSchema>;
export type PairedRuntimeHeartbeatResponse = z.infer<typeof PairedRuntimeHeartbeatResponseSchema>;
export type PairedRuntimeOpencliCommand = z.infer<typeof PairedRuntimeOpencliCommandSchema>;
export type PairedRuntimeExecutionEnvelope = z.infer<typeof PairedRuntimeExecutionEnvelopeSchema>;
export type PairedRuntimeCommand = z.infer<typeof PairedRuntimeCommandSchema>;
export type CompletePairedRuntimeCommandRequest = z.infer<typeof CompletePairedRuntimeCommandRequestSchema>;
