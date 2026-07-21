// packages/shared/src/generation-v3/quote.ts
// 中文注释：GenerationQuoteDto 与报价请求/响应契约（Phase 1）

import { z } from 'zod';

export const GenerationChannelSchema = z.enum([
  'byok',
  'cloud-key',
  'platform-credits',
  'web-membership',
  'setup-required',
]);

export type GenerationChannel = z.infer<typeof GenerationChannelSchema>;

export const MediaTypeSchema = z.enum(['image', 'video', 'audio', 'ppt', 'browser']);

export type MediaType = z.infer<typeof MediaTypeSchema>;

export const ProviderRouteSnapshotSchema = z.object({
  providerId: z.string().min(1),
  connectionId: z.string().uuid().optional(),
  modelId: z.string().min(1),
  capabilityId: z.string().min(1).optional(),
  channel: GenerationChannelSchema.optional(),
  requestProfile: z.string().min(1).optional(),
  adapterId: z.string().min(1),
  adapterVersion: z.string().min(1),
  baseUrl: z.string().optional(),
  capabilityVersion: z.string().min(1),
  connectionUpdatedAt: z.string().datetime().optional(),
  bindingUpdatedAt: z.string().datetime().optional(),
});

export type ProviderRouteSnapshot = z.infer<typeof ProviderRouteSnapshotSchema>;

export const GenerationQuoteCostSchema = z.object({
  credits: z.number().int().nonnegative().optional(),
  providerQuota: z.number().int().nonnegative().optional(),
  priceVersion: z.string().min(1),
});

export type GenerationQuoteCost = z.infer<typeof GenerationQuoteCostSchema>;

export const GenerationQuoteDtoSchema = z.object({
  quoteId: z.string().uuid(),
  mediaType: MediaTypeSchema,
  model: z.string().min(1),
  count: z.number().int().positive(),
  routeSnapshot: ProviderRouteSnapshotSchema,
  channel: GenerationChannelSchema,
  cost: GenerationQuoteCostSchema,
  expiresAt: z.string().datetime(),
  createdAt: z.string().datetime(),
  ownerId: z.string().min(1),
});

export type GenerationQuoteDto = z.infer<typeof GenerationQuoteDtoSchema>;

export const CreateQuoteRequestSchema = z.object({
  mediaType: MediaTypeSchema,
  model: z.string().min(1),
  count: z.number().int().positive().default(1),
  preferredChannel: GenerationChannelSchema.optional(),
  // 用于 BYOK / cloud-key 时指定用户 Key Slot；platform-credits 时忽略
  keySlotId: z.string().optional(),
  // 可选：显式指定 Provider；否则由 RouteEngine 按 model 选择
  providerHint: z.string().optional(),
  connectionId: z.string().uuid().optional(),
  capabilityId: z.string().min(1).max(100).optional(),
}).superRefine((request, context) => {
  if (request.connectionId && !request.capabilityId) {
    context.addIssue({ code: 'custom', path: ['capabilityId'], message: 'capabilityId is required with connectionId.' });
  }
});

export type CreateQuoteRequest = z.infer<typeof CreateQuoteRequestSchema>;

export const CreateQuoteResponseSchema = z.object({
  success: z.literal(true),
  data: GenerationQuoteDtoSchema,
});

export type CreateQuoteResponse = z.infer<typeof CreateQuoteResponseSchema>;

export const QuoteErrorCodeSchema = z.enum([
  'UNAUTHORIZED',
  'INVALID_INPUT',
  'MODEL_UNAVAILABLE',
  'CHANNEL_UNAVAILABLE',
  'INSUFFICIENT_CREDITS',
  'SETUP_REQUIRED',
  'QUOTE_EXPIRED',
  'INTERNAL_ERROR',
]);

export type QuoteErrorCode = z.infer<typeof QuoteErrorCodeSchema>;
