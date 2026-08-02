import { z } from 'zod';

export const PairedRuntimeCapabilityManifestSchema = z.object({
  schemaVersion: z.literal(1),
  runtimeVersion: z.string().min(1).max(120),
  tools: z.array(z.string().min(1).max(200)).max(200),
  siteAdapters: z.array(z.string().min(1).max(200)).max(200),
}).strict();

export const PairedRuntimeOpencliCommandSchema = z.object({
  kind: z.enum(['inspect_page', 'extract_product']),
  target: z.string().trim().url().max(2048),
  payload: z.record(z.unknown()).optional(),
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
  leaseExpiresAt: z.string().datetime(),
  attempt: z.number().int().positive().max(20),
  executionEnvelope: PairedRuntimeExecutionEnvelopeSchema,
}).strict().refine(
  (command) => command.executionEnvelope.runId === command.runId,
  { message: 'Paired runtime command and execution envelope run IDs must match.' },
);

export type PairedRuntimeCapabilityManifest = z.infer<typeof PairedRuntimeCapabilityManifestSchema>;
export type PairedRuntimeCommand = z.infer<typeof PairedRuntimeCommandSchema>;
export type PairedRuntimeOpencliCommand = z.infer<typeof PairedRuntimeOpencliCommandSchema>;
