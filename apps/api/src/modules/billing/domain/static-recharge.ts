import { randomUUID } from "node:crypto";

import type {
  AdminRechargeSubmissionDto,
  CreateRechargeSubmissionRequestDto,
  CreditExchangeRateDto,
  ManualRechargeProviderDto,
  RechargeSubmissionDto,
  SubmitRechargeProofRequestDto,
  SubmitRechargeRequestDto,
} from "../../../../../../packages/contracts/src/index.ts";

export interface RechargeSubmissionRecord extends RechargeSubmissionDto {
  userId: string;
  creditAmount: number;
  creditsPerUnit: number;
  reviewActorUserId?: string | null;
}

export class RechargeSubmissionNotFoundError extends Error {
  readonly code = "RECHARGE_SUBMISSION_NOT_FOUND";

  constructor(submissionId: string) {
    super(`Recharge submission ${submissionId} could not be found.`);
  }
}

export class RechargeSubmissionNotPendingError extends Error {
  readonly code = "RECHARGE_SUBMISSION_NOT_PENDING";

  constructor(submissionId: string, status: string) {
    super(`Recharge submission ${submissionId} is not pending. Current status: ${status}.`);
  }
}

export class RechargeSubmissionNotPayingError extends Error {
  readonly code = "RECHARGE_SUBMISSION_NOT_PAYING";

  constructor(submissionId: string, status: string) {
    super(`Recharge submission ${submissionId} is not paying. Current status: ${status}.`);
  }
}

export class RechargeSubmissionExpiredError extends Error {
  readonly code = "RECHARGE_SUBMISSION_EXPIRED";

  constructor(submissionId: string) {
    super(`Recharge submission ${submissionId} has expired.`);
  }
}

export class RechargeSubmissionNotCreatedError extends Error {
  readonly code = "RECHARGE_SUBMISSION_NOT_CREATED";

  constructor(submissionId: string, status: string) {
    super(`Recharge submission ${submissionId} is not awaiting proof. Current status: ${status}.`);
  }
}

export function roundRechargeAmount(amount: number): number {
  return Math.max(0, Math.round((Number(amount) + Number.EPSILON) * 100) / 100);
}

export function normalizeManualRechargeServiceFee(amount: number): number {
  return Math.min(0.4, Math.max(0.01, roundRechargeAmount(amount)));
}

export function calculateManualRechargeBonusCredits(serviceFee: number): number {
  return normalizeManualRechargeServiceFee(serviceFee) <= 0.2 ? 1 : 2;
}

export function calculateRechargeCreditAmount(amount: number, creditsPerUnit: number): number {
  return Math.max(1, Math.round(roundRechargeAmount(amount) * Math.max(0.000001, Number(creditsPerUnit) || 0)));
}

export function isManualRechargeProvider(value: unknown): value is ManualRechargeProviderDto {
  return value === "alipay" || value === "wechat";
}

export function resolveRechargeRate(
  rates: CreditExchangeRateDto[],
  currencyCode: CreateRechargeSubmissionRequestDto["currencyCode"],
): CreditExchangeRateDto | undefined {
  return rates.find((rate) => rate.currencyCode === currencyCode && rate.isActive !== false);
}

export function createRechargeSubmission(
  userId: string,
  input: CreateRechargeSubmissionRequestDto,
  rate: CreditExchangeRateDto,
  createdAt: string,
  options: {
    serviceFee?: number;
    expiresAt?: string;
  } = {},
): RechargeSubmissionRecord {
  const baseAmount = roundRechargeAmount(input.amount);
  const baseCredits = calculateRechargeCreditAmount(baseAmount, rate.creditsPerUnit);
  const isManualPayingOrder = input.paymentChannel === "manual" && isManualRechargeProvider(input.manualProvider);
  const serviceFee = isManualPayingOrder
    ? normalizeManualRechargeServiceFee(options.serviceFee ?? 0.01)
    : 0;
  const bonusCredits = isManualPayingOrder ? calculateManualRechargeBonusCredits(serviceFee) : 0;
  const creditAmount = baseCredits + bonusCredits;

  return {
    submissionId: randomUUID(),
    userId,
    amount: isManualPayingOrder ? roundRechargeAmount(baseAmount + serviceFee) : baseAmount,
    baseAmount,
    serviceFee,
    payableAmount: isManualPayingOrder ? roundRechargeAmount(baseAmount + serviceFee) : baseAmount,
    baseCredits,
    bonusCredits,
    creditAmount,
    creditsPerUnit: rate.creditsPerUnit,
    currencyCode: input.currencyCode,
    paymentChannel: input.paymentChannel,
    manualProvider: isManualPayingOrder ? input.manualProvider : null,
    transferReferenceLast4: null,
    note: input.note,
    status: isManualPayingOrder ? "paying" : "created",
    createdAt,
    expiresAt: isManualPayingOrder ? options.expiresAt ?? null : null,
    paymentMarkedAt: null,
    submittedAt: null,
    reviewedAt: null,
    reviewActorUserId: null,
  };
}

export function submitRechargeSubmissionProof(
  submission: RechargeSubmissionRecord,
  input: SubmitRechargeProofRequestDto,
  submittedAt: string,
): RechargeSubmissionRecord {
  if (submission.status !== "created") {
    throw new RechargeSubmissionNotCreatedError(submission.submissionId, submission.status);
  }

  return {
    ...submission,
    transferReferenceLast4: input.transferReferenceLast4,
    note: input.note,
    status: "pending",
    submittedAt,
  };
}

export function markRechargeSubmissionCredited(
  submission: RechargeSubmissionRecord,
  actorUserId: string,
  reviewedAt: string,
): RechargeSubmissionRecord {
  if (submission.status !== "pending" && submission.status !== "paying" && submission.status !== "credited") {
    throw new RechargeSubmissionNotPendingError(submission.submissionId, submission.status);
  }

  return {
    ...submission,
    status: "credited",
    reviewedAt,
    reviewActorUserId: actorUserId,
  };
}

export function markRechargeSubmissionRejected(
  submission: RechargeSubmissionRecord,
  actorUserId: string,
  reviewedAt: string,
): RechargeSubmissionRecord {
  if (submission.status !== "pending" && submission.status !== "paying") {
    throw new RechargeSubmissionNotPendingError(submission.submissionId, submission.status);
  }

  return {
    ...submission,
    status: "rejected",
    reviewedAt,
    reviewActorUserId: actorUserId,
  };
}

export function markRechargeSubmissionPaid(
  submission: RechargeSubmissionRecord,
  paymentMarkedAt: string,
): RechargeSubmissionRecord {
  if (submission.status !== "paying") {
    throw new RechargeSubmissionNotPayingError(submission.submissionId, submission.status);
  }

  return {
    ...submission,
    paymentMarkedAt: submission.paymentMarkedAt ?? paymentMarkedAt,
  };
}

export function isRechargeSubmissionExpired(
  submission: RechargeSubmissionRecord,
  now: string | Date,
): boolean {
  if (submission.status !== "paying" || !submission.expiresAt) {
    return false;
  }

  return new Date(submission.expiresAt).getTime() <= new Date(now).getTime();
}

export function buildStaticRechargeDescription(submission: RechargeSubmissionRecord): string {
  return `Manual recharge approved: ${submission.submissionId}`;
}

export function toRechargeSubmissionDto(
  submission: RechargeSubmissionRecord,
  options: { now?: string | Date } = {},
): RechargeSubmissionDto {
  const status = isRechargeSubmissionExpired(submission, options.now ?? new Date())
    ? "expired"
    : submission.status;

  return {
    submissionId: submission.submissionId,
    amount: submission.amount,
    baseAmount: submission.baseAmount,
    serviceFee: submission.serviceFee,
    payableAmount: submission.payableAmount,
    baseCredits: submission.baseCredits,
    bonusCredits: submission.bonusCredits,
    creditAmount: submission.creditAmount,
    creditsPerUnit: submission.creditsPerUnit,
    currencyCode: submission.currencyCode,
    paymentChannel: submission.paymentChannel,
    manualProvider: submission.manualProvider ?? null,
    transferReferenceLast4: submission.transferReferenceLast4,
    note: submission.note,
    status,
    createdAt: submission.createdAt,
    expiresAt: submission.expiresAt ?? null,
    paymentMarkedAt: submission.paymentMarkedAt ?? null,
    submittedAt: submission.submittedAt ?? null,
    reviewedAt: submission.reviewedAt ?? null,
  };
}

export function toAdminRechargeSubmissionDto(
  submission: RechargeSubmissionRecord,
  options: { now?: string | Date } = {},
): AdminRechargeSubmissionDto {
  return {
    ...toRechargeSubmissionDto(submission, options),
    userId: submission.userId,
    creditAmount: submission.creditAmount,
    creditsPerUnit: submission.creditsPerUnit,
    reviewActorUserId: submission.reviewActorUserId ?? null,
  };
}
