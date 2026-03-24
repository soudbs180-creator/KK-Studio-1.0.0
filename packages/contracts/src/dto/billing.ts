import type { CreditTransactionType } from "../enums/status.ts";
import type { AuditFieldsDto, EntityId, IdempotentRequestDto } from "./common.ts";

export interface BillingCommandDto {
  idempotencyKey?: string;
}

export interface ChargePointsRequestDto extends BillingCommandDto {
  accountId: string;
  amountPoints: number;
  providerId?: string;
  referenceId?: string | null;
  action?: string;
}

export interface TokenUsageRequestDto extends BillingCommandDto {
  userAccountId: string;
  tokensUsed: number;
  costUsd: number;
  providerId?: string;
  usageId?: string | null;
  actionId?: string | null;
}

export interface CreditBalanceDto extends AuditFieldsDto {
  accountId: EntityId;
  userId: EntityId;
  balance: number;
  frozenBalance: number;
}

export interface DebitCreditsRequestDto extends IdempotentRequestDto {
  businessRefType: string;
  businessRefId: EntityId;
  creditAmount: number;
  modelCode?: string;
}

export interface DebitCreditsResponseDto {
  ledgerId: EntityId;
  balanceAfter: number;
  transactionType: CreditTransactionType;
}

export interface ListCreditTransactionsQueryDto {
  transactionType?: string;
  status?: string;
  limit?: number;
}

export interface CreditTransactionDto {
  id: EntityId;
  userId?: EntityId;
  transactionType: string;
  amount: number;
  balanceAfter?: number | null;
  modelCode?: string | null;
  modelName?: string | null;
  providerCode?: string | null;
  description?: string | null;
  status?: string | null;
  metadata?: Record<string, unknown> | null;
  businessRefType?: string | null;
  businessRefId?: string | null;
  createdAt: string;
  completedAt?: string | null;
}

export interface CreditTransactionListDto {
  items: CreditTransactionDto[];
}

export interface RefundCreditsRequestDto {
  transactionId: EntityId;
  reason?: string;
}

export interface RefundCreditsResponseDto {
  originalTransactionId: EntityId;
  refundedLedgerId?: EntityId;
  balanceAfter: number;
  transactionType: CreditTransactionType;
}

export interface AdminRechargeCreditsRequestDto {
  identity: string;
  creditAmount: number;
  description?: string;
}

export interface AdminRechargeCreditsResponseDto {
  identity: string;
  subjectId: EntityId;
  balanceAfter: number;
  creditedAmount: number;
  subjectEmail?: string;
}
