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

export type BillingSummaryWindow = "today" | "30d";

export interface GetBillingSummaryQueryDto {
  window?: BillingSummaryWindow;
}

export interface BillingSummaryActivityDto {
  transactionId: EntityId;
  transactionType: string;
  amount: number;
  credits?: number;
  costUsd?: number;
  tokens?: number;
  providerCode?: string | null;
  modelCode?: string | null;
  description?: string | null;
  status?: string | null;
  createdAt: string;
}

export interface BillingProfileSnapshotDto {
  dailyCostUsd?: number;
  dailyTokens?: number;
  totalBudget?: number;
  totalUsed?: number;
}

export interface BillingSummaryDto {
  window: BillingSummaryWindow;
  generatedAt: string;
  periodStart: string;
  periodEnd: string;
  source: "credit_transactions";
  activityCount: number;
  totals: {
    spendCredits: number;
    spendUsd: number;
    creditsConsumed: number;
    refunds: number;
    recharges: number;
    tokens: number;
    tokenTotals: number;
    transactionCount: number;
    netCredits: number;
  };
  latestActivity: BillingSummaryActivityDto | null;
  profileSnapshot?: BillingProfileSnapshotDto;
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

export interface AdminCreditAccountLookupDto {
  identity: string;
  subjectId: EntityId;
  subjectEmail?: string;
  balance: number;
  frozenBalance: number;
  transactions: CreditTransactionDto[];
}

export type SupportedRechargeCurrencyDto = "CNY" | "USD";

export interface CreditExchangeRateDto {
  currencyCode: SupportedRechargeCurrencyDto;
  creditsPerUnit: number;
  minAmount: number | null;
  maxAmount: number | null;
  isActive: boolean;
  updatedAt?: string | null;
}

export interface CreditExchangeRateListDto {
  items: CreditExchangeRateDto[];
}

export interface UpsertCreditExchangeRateRequestDto {
  currencyCode: SupportedRechargeCurrencyDto;
  creditsPerUnit: number;
  minAmount: number | null;
  maxAmount: number | null;
  isActive: boolean;
}

export type RechargeSubmissionStatusDto = "created" | "pending" | "approved" | "rejected" | "credited" | "paying" | "expired";
export type RechargePaymentChannelDto = "alipay" | "wechat" | "paypal" | "bank" | "manual";
export type ManualRechargeProviderDto = "alipay" | "wechat";
export type ReviewRechargeSubmissionDecisionDto = "credit" | "reject";

export interface RechargePaymentChannelConfigDto {
  channel: RechargePaymentChannelDto;
  label: string;
  qrImageDataUrl?: string | null;
  qrImagePath?: string | null;
  instructionText?: string | null;
  isActive: boolean;
}

export interface RechargePaymentChannelConfigListDto {
  items: RechargePaymentChannelConfigDto[];
}

export interface CreateRechargeSubmissionRequestDto {
  amount: number;
  currencyCode: SupportedRechargeCurrencyDto;
  paymentChannel: RechargePaymentChannelDto;
  manualProvider?: ManualRechargeProviderDto;
  note?: string;
}

export interface SubmitRechargeProofRequestDto {
  transferReferenceLast4: string;
  note?: string;
}

export interface SubmitRechargeRequestDto {
  amount: number;
  currencyCode: SupportedRechargeCurrencyDto;
  paymentChannel: RechargePaymentChannelDto;
  transferReferenceLast4: string;
  note?: string;
}

export interface RechargeSubmissionDto {
  submissionId: EntityId;
  userId?: EntityId;
  amount: number;
  baseAmount?: number;
  serviceFee?: number;
  payableAmount?: number;
  baseCredits?: number;
  bonusCredits?: number;
  creditAmount?: number;
  creditsPerUnit?: number;
  currencyCode: SupportedRechargeCurrencyDto;
  paymentChannel: RechargePaymentChannelDto;
  manualProvider?: ManualRechargeProviderDto | null;
  transferReferenceLast4?: string | null;
  note?: string;
  status: RechargeSubmissionStatusDto;
  createdAt: string;
  expiresAt?: string | null;
  paymentMarkedAt?: string | null;
  submittedAt?: string | null;
  reviewedAt?: string | null;
}

export interface AdminRechargeSubmissionDto extends RechargeSubmissionDto {
  userId: EntityId;
  creditAmount: number;
  creditsPerUnit: number;
  reviewActorUserId?: EntityId | null;
}

export interface CreateRechargeSubmissionResponseDto {
  submission: RechargeSubmissionDto;
}

export interface SubmitRechargeProofResponseDto {
  submission: RechargeSubmissionDto;
}

export interface SubmitRechargeResponseDto {
  submission: RechargeSubmissionDto;
}

export interface GetAdminRechargeSubmissionResponseDto {
  submission: AdminRechargeSubmissionDto;
}

export interface ListAdminRechargeSubmissionsResponseDto {
  items: AdminRechargeSubmissionDto[];
}

export interface MarkRechargeSubmissionPaidResponseDto {
  submission: RechargeSubmissionDto;
}

export interface ReviewRechargeSubmissionRequestDto {
  decision: ReviewRechargeSubmissionDecisionDto;
  note?: string;
}

export interface ReviewRechargeSubmissionResponseDto {
  submission: AdminRechargeSubmissionDto;
  recharge: AdminRechargeCreditsResponseDto | null;
  creditAmount: number;
}
