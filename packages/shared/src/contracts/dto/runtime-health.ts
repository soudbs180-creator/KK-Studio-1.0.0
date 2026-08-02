import { z } from 'zod';

export const RuntimeServiceIdSchema = z.enum([
  'api-gateway',
  'local-runner',
  'cliproxyapi',
  'opencli',
  'browser-bridge',
]);

export const RuntimeServiceStatusSchema = z.enum([
  'ready',
  'degraded',
  'offline',
  'disabled',
  'unknown',
]);

export const RuntimeRecoveryActionSchema = z.object({
  id: z.string().min(1).max(100),
  label: z.string().min(1).max(120),
  action: z.enum(['retry', 'open-settings', 'open-documentation']),
  target: z.string().max(2048).optional(),
}).strict();

export const RuntimeServiceHealthDtoSchema = z.object({
  serviceId: RuntimeServiceIdSchema,
  label: z.string().min(1).max(120),
  status: RuntimeServiceStatusSchema,
  reachable: z.boolean(),
  latencyMs: z.number().int().nonnegative().max(120_000).optional(),
  version: z.string().min(1).max(120).optional(),
  checkedAt: z.string().datetime(),
  message: z.string().max(500).optional(),
  recoveryActions: z.array(RuntimeRecoveryActionSchema).max(4),
}).strict().superRefine((service, context) => {
  if (service.status === 'ready' && !service.reachable) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['reachable'],
      message: 'A ready runtime service must be reachable.',
    });
  }
});

export const RuntimeHealthSnapshotDtoSchema = z.object({
  schemaVersion: z.literal(1),
  checkedAt: z.string().datetime(),
  services: z.array(RuntimeServiceHealthDtoSchema).min(1).max(10),
  build: z.object({
    version: z.string().min(1).max(120).optional(),
    commitSha: z.string().min(1).max(120).optional(),
    deploymentTarget: z.string().min(1).max(120).optional(),
  }).strict().optional(),
}).strict();

export type RuntimeServiceId = z.infer<typeof RuntimeServiceIdSchema>;
export type RuntimeServiceHealthDto = z.infer<typeof RuntimeServiceHealthDtoSchema>;
export type RuntimeHealthSnapshotDto = z.infer<typeof RuntimeHealthSnapshotDtoSchema>;
