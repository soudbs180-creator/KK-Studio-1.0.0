import { z } from 'zod';

/** Server-owned lifecycle states for a durable image generation lease. */
export const GenerationWorkerLeaseStatusSchema = z.enum([
  'queued',
  'leased',
  'polling',
  'completed',
  'failed',
  'cancelled',
  'timed_out',
]);

export type GenerationWorkerLeaseStatus = z.infer<typeof GenerationWorkerLeaseStatusSchema>;

/** Internal claim contract shared by the lease store and worker runtime. */
export const GenerationWorkerClaimSchema = z.object({
  attemptCount: z.number().int().positive(),
  enqueuedAt: z.string().datetime(),
  failureCount: z.number().int().nonnegative(),
  itemId: z.string().uuid(),
  jobId: z.string().uuid(),
  leaseToken: z.string().uuid(),
  payload: z.record(z.string(), z.unknown()),
  providerTaskId: z.string().optional(),
  quoteId: z.string().uuid(),
  userId: z.string().min(1),
});

export type GenerationWorkerClaim = z.infer<typeof GenerationWorkerClaimSchema>;
