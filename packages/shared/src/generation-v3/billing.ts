// packages/shared/src/generation-v3/billing.ts
// 中文注释：Phase 1 计费契约——预扣、结算、退款、余额查询

import { z } from 'zod';

export const LedgerEntryTypeSchema = z.enum(['reserve', 'charge', 'refund', 'adjust']);

export type LedgerEntryType = z.infer<typeof LedgerEntryTypeSchema>;

export const LedgerEntryStatusSchema = z.enum(['pending', 'committed', 'failed', 'reversed']);

export type LedgerEntryStatus = z.infer<typeof LedgerEntryStatusSchema>;

export const LedgerEntryDtoSchema = z.object({
  ledgerId: z.string().uuid(),
  userId: z.string().min(1),
  quoteId: z.string().uuid().optional(),
  itemId: z.string().uuid().optional(),
  jobId: z.string().uuid().optional(),
  type: LedgerEntryTypeSchema,
  amount: z.number().int(),
  currency: z.string().min(1),
  status: LedgerEntryStatusSchema,
  metadata: z.record(z.string(), z.unknown()).default({}),
  createdAt: z.string().datetime(),
});

export type LedgerEntryDto = z.infer<typeof LedgerEntryDtoSchema>;

export const BalanceDtoSchema = z.object({
  userId: z.string().min(1),
  credits: z.number().int().nonnegative(),
  reservedCredits: z.number().int().nonnegative().default(0),
});

export type BalanceDto = z.infer<typeof BalanceDtoSchema>;

export const BillingErrorCodeSchema = z.enum([
  'INSUFFICIENT_CREDITS',
  'RESERVATION_FAILED',
  'REFUND_FAILED',
  'LEDGER_NOT_FOUND',
  'ALREADY_CHARGED',
  'ALREADY_REFUNDED',
  'INTERNAL_ERROR',
]);

export type BillingErrorCode = z.infer<typeof BillingErrorCodeSchema>;
