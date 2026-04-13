import {
  buildRequestMeta,
  type ApiResponse,
  type SubmitRechargeRequestDto,
  type SubmitRechargeResponseDto,
} from "../../../../../../packages/contracts/src/index.ts";
import { CreditAccountService } from "./credit-account-service.ts";
import type { CreditExchangeRateRepository } from "../infrastructure/in-memory-credit-exchange-rate-repository.ts";
import type { RechargeSubmissionRepository } from "../infrastructure/in-memory-recharge-submission-repository.ts";
import {
  buildStaticRechargeDescription,
  createRechargeSubmission,
  markRechargeSubmissionCredited,
  RechargeSubmissionNotFoundError,
  RechargeSubmissionNotPendingError,
  resolveRechargeRate,
  roundRechargeAmount,
  toRechargeSubmissionDto,
} from "../domain/static-recharge.ts";

export interface StaticRechargeApprovalDto {
  submission: SubmitRechargeResponseDto["submission"];
  recharge: {
    identity: string;
    subjectId: string;
    balanceAfter: number;
    creditedAmount: number;
    subjectEmail?: string;
  };
  creditAmount: number;
}

export interface StaticRechargeServiceOptions {
  submissionRepository: RechargeSubmissionRepository;
  exchangeRateRepository: CreditExchangeRateRepository;
  creditAccountService: CreditAccountService;
}

export class StaticRechargeService {
  private readonly submissionRepository: RechargeSubmissionRepository;
  private readonly exchangeRateRepository: CreditExchangeRateRepository;
  private readonly creditAccountService: CreditAccountService;

  constructor(options: StaticRechargeServiceOptions) {
    this.submissionRepository = options.submissionRepository;
    this.exchangeRateRepository = options.exchangeRateRepository;
    this.creditAccountService = options.creditAccountService;
  }

  async submitRecharge(
    userId: string,
    input: SubmitRechargeRequestDto,
    requestId: string,
    clientVersion?: string,
  ): Promise<ApiResponse<SubmitRechargeResponseDto>> {
    const rates = await this.exchangeRateRepository.list();
    const rate = resolveRechargeRate(rates, input.currencyCode);
    if (!rate) {
      return {
        success: false,
        error: {
          code: "RECHARGE_CONFIG_UNAVAILABLE",
          message: "The requested recharge currency is not currently available.",
        },
        meta: buildRequestMeta(requestId, clientVersion),
      };
    }

    const normalizedAmount = roundRechargeAmount(input.amount);
    if ((typeof rate.minAmount === "number" && normalizedAmount < rate.minAmount)
      || (typeof rate.maxAmount === "number" && normalizedAmount > rate.maxAmount)) {
      return {
        success: false,
        error: {
          code: "RECHARGE_AMOUNT_OUT_OF_RANGE",
          message: "Recharge amount does not match the configured limits for this currency.",
          details: [{
            field: "amount",
            minAmount: rate.minAmount,
            maxAmount: rate.maxAmount,
            currencyCode: rate.currencyCode,
          }],
        },
        meta: buildRequestMeta(requestId, clientVersion),
      };
    }

    const submission = createRechargeSubmission(userId, input, rate, new Date().toISOString());
    const persistedSubmission = await this.submissionRepository.save(submission);

    return {
      success: true,
      data: {
        submission: toRechargeSubmissionDto(persistedSubmission),
      },
      meta: buildRequestMeta(requestId, clientVersion),
    };
  }

  async applyApprovedRechargeSubmission(
    submissionId: string,
    actorUserId: string,
    requestId: string,
    clientVersion?: string,
  ): Promise<ApiResponse<StaticRechargeApprovalDto>> {
    const submission = await this.submissionRepository.findById(submissionId);
    if (!submission) {
      return {
        success: false,
        error: {
          code: "RECHARGE_SUBMISSION_NOT_FOUND",
          message: "The requested recharge submission could not be found.",
        },
        meta: buildRequestMeta(requestId, clientVersion),
      };
    }

    try {
      const recharge = await this.creditAccountService.adminRechargeCredits({
        identity: submission.userId,
        creditAmount: submission.creditAmount,
        description: buildStaticRechargeDescription(submission),
      }, actorUserId, requestId, clientVersion);

      if (!recharge.success) {
        return {
          success: false,
          error: recharge.error,
          meta: buildRequestMeta(requestId, clientVersion),
        };
      }

      const creditedSubmission = markRechargeSubmissionCredited(
        submission,
        actorUserId,
        new Date().toISOString(),
      );
      const persistedSubmission = await this.submissionRepository.save(creditedSubmission);

      return {
        success: true,
        data: {
          submission: toRechargeSubmissionDto(persistedSubmission),
          recharge: recharge.data,
          creditAmount: submission.creditAmount,
        },
        meta: buildRequestMeta(requestId, clientVersion),
      };
    } catch (error) {
      if (error instanceof RechargeSubmissionNotFoundError || error instanceof RechargeSubmissionNotPendingError) {
        return {
          success: false,
          error: {
            code: error.code,
            message: error.message,
          },
          meta: buildRequestMeta(requestId, clientVersion),
        };
      }

      throw error;
    }
  }
}
