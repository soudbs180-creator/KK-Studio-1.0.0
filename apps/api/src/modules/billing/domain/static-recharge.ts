import { randomUUID } from "node:crypto";

import type {
  CreditExchangeRateDto,
  RechargeSubmissionDto,
  SubmitRechargeRequestDto,
} from "../../../../../../packages/contracts/src/index.ts";

export interface RechargeSubmissionRecord extends RechargeSubmissionDto {
  userId: string;
  creditAmount: number;
  creditsPerUnit: number;
  reviewActorUserId?: string;
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

export function roundRechargeAmount(amount: number): number {
  return Math.max(0, Math.round((Number(amount) + Number.EPSILON) * 100) / 100);
}

export function calculateRechargeCreditAmount(amount: number, creditsPerUnit: number): number {
  return Math.max(1, Math.round(roundRechargeAmount(amount) * Math.max(0.000001, Number(creditsPerUnit) || 0)));
}

export function resolveRechargeRate(
  rates: CreditExchangeRateDto[],
  currencyCode: SubmitRechargeRequestDto["currencyCode"],
): CreditExchangeRateDto | undefined {
  return rates.find((rate) => rate.currencyCode === currencyCode && rate.isActive !== false);
}

export function createRechargeSubmission(
  userId: string,
  input: SubmitRechargeRequestDto,
  rate: CreditExchangeRateDto,
  submittedAt: string,
): RechargeSubmissionRecord {
  return {
    submissionId: randomUUID(),
    userId,
    amount: roundRechargeAmount(input.amount),
    currencyCode: input.currencyCode,
    paymentChannel: input.paymentChannel,
    transferReferenceLast4: input.transferReferenceLast4,
    note: input.note,
    status: "pending",
    submittedAt,
    reviewedAt: null,
    creditAmount: calculateRechargeCreditAmount(input.amount, rate.creditsPerUnit),
    creditsPerUnit: rate.creditsPerUnit,
  };
}

export function markRechargeSubmissionCredited(
  submission: RechargeSubmissionRecord,
  actorUserId: string,
  reviewedAt: string,
): RechargeSubmissionRecord {
  if (submission.status !== "pending") {
    throw new RechargeSubmissionNotPendingError(submission.submissionId, submission.status);
  }

  return {
    ...submission,
    status: "credited",
    reviewedAt,
    reviewActorUserId: actorUserId,
  };
}

export function buildStaticRechargeDescription(submission: RechargeSubmissionRecord): string {
  return `Static recharge approved: ${submission.submissionId}`;
}

export function toRechargeSubmissionDto(submission: RechargeSubmissionRecord): RechargeSubmissionDto {
  return {
    submissionId: submission.submissionId,
    amount: submission.amount,
    currencyCode: submission.currencyCode,
    paymentChannel: submission.paymentChannel,
    transferReferenceLast4: submission.transferReferenceLast4,
    note: submission.note,
    status: submission.status,
    submittedAt: submission.submittedAt,
    reviewedAt: submission.reviewedAt ?? null,
  };
}
