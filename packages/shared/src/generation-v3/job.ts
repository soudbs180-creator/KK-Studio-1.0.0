// packages/shared/src/generation-v3/job.ts
// 中文注释：GenerationJobDto v3、Item、Run 控制与事件契约（Phase 1）

import { z } from 'zod';
import { GenerationChannelSchema, MediaTypeSchema, GenerationQuoteDtoSchema } from './quote.ts';

export const JobStatusSchema = z.enum([
  'quoted',
  'reserved',
  'submitted',
  'running',
  'paused',
  'completed',
  'failed',
  'cancelled',
]);

export type JobStatus = z.infer<typeof JobStatusSchema>;

export const ItemStatusSchema = z.enum([
  'pending',
  'submitted',
  'running',
  'completed',
  'failed',
  'cancelled',
]);

export type ItemStatus = z.infer<typeof ItemStatusSchema>;

export const ReconciliationStatusSchema = z.enum([
  'pending',
  'matched',
  'mismatch',
  'resolved',
]);

export type ReconciliationStatus = z.infer<typeof ReconciliationStatusSchema>;

export const BillingReservationSchema = z.object({
  reservationId: z.string().uuid(),
  status: z.enum(['pending', 'held', 'released', 'converted']),
  amount: z.number().int().nonnegative(),
  currency: z.string().min(1),
  heldAt: z.string().datetime().optional(),
  releasedAt: z.string().datetime().optional(),
});

export type BillingReservation = z.infer<typeof BillingReservationSchema>;

export const LedgerEntrySummarySchema = z.object({
  ledgerId: z.string().uuid(),
  type: z.enum(['reserve', 'charge', 'refund', 'adjust']),
  amount: z.number().int(),
  currency: z.string().min(1),
  status: z.enum(['pending', 'committed', 'failed', 'reversed']),
});

export type LedgerEntrySummary = z.infer<typeof LedgerEntrySummarySchema>;

export const GenerationJobItemV3Schema = z.object({
  itemId: z.string().uuid(),
  sequence: z.number().int().nonnegative(),
  status: ItemStatusSchema,
  reservation: BillingReservationSchema.optional(),
  ledger: LedgerEntrySummarySchema.optional(),
  providerTaskId: z.string().optional(),
  reconciliation: ReconciliationStatusSchema,
  assetId: z.string().optional(),
  assetRecordId: z.string().uuid().optional(),
  assetUrl: z.string().min(1).optional(),
  assetMetadata: z.record(z.string(), z.unknown()).optional(),
  canvasNodeId: z.string().optional(),
  errorCode: z.string().optional(),
  errorMessage: z.string().optional(),
  payload: z.record(z.string(), z.unknown()).optional(),
});

export type GenerationJobItem = z.infer<typeof GenerationJobItemV3Schema>;

export const GenerationJobDtoV3Schema = z.object({
  jobId: z.string().uuid(),
  quoteId: z.string().uuid(),
  channel: GenerationChannelSchema,
  provider: z.string().min(1),
  model: z.string().min(1),
  anonymousKeySlotId: z.string().optional(),
  capabilityVersion: z.string().min(1),
  status: JobStatusSchema,
  items: z.array(GenerationJobItemV3Schema),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  ownerId: z.string().min(1),
  retryCount: z.number().int().nonnegative().default(0),
  maxRetries: z.number().int().nonnegative().default(3),
});

export type GenerationJobDto = z.infer<typeof GenerationJobDtoV3Schema>;

export const CreateJobRequestSchema = z.object({
  quoteId: z.string().uuid(),
  // 可选：覆盖 quote 中的部分参数；必须保持 channel 不变
  payload: z.record(z.string(), z.unknown()).optional(),
  // 可选：指定落卡节点 ID 列表（与 items 顺序对应）
  canvasNodeIds: z.array(z.string()).optional(),
});

export type CreateJobRequest = z.infer<typeof CreateJobRequestSchema>;

export const CreateJobResponseSchema = z.object({
  success: z.literal(true),
  data: GenerationJobDtoV3Schema,
});

export type CreateJobResponse = z.infer<typeof CreateJobResponseSchema>;

export const JobControlActionSchema = z.enum(['pause', 'resume', 'cancel']);

export type JobControlAction = z.infer<typeof JobControlActionSchema>;

export const JobControlRequestSchema = z.object({
  jobId: z.string().uuid(),
  action: JobControlActionSchema,
});

export type JobControlRequest = z.infer<typeof JobControlRequestSchema>;

export const JobEventTypeSchema = z.enum([
  'job_created',
  'job_status_changed',
  'item_status_changed',
  'item_completed',
  'item_failed',
  'job_failed',
  'job_completed',
  'job_cancelled',
]);

export type JobEventType = z.infer<typeof JobEventTypeSchema>;

export const GenerationJobEventSchema = z.object({
  eventId: z.string().uuid(),
  jobId: z.string().uuid(),
  type: JobEventTypeSchema,
  payload: z.unknown(),
  createdAt: z.string().datetime(),
});

export type GenerationJobEvent = z.infer<typeof GenerationJobEventSchema>;
