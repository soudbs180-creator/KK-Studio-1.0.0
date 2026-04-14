import {
  buildRequestMeta,
  type ApiResponse,
  type CreateRechargeSubmissionRequestDto,
  type CreateRechargeSubmissionResponseDto,
  type GetAdminRechargeSubmissionResponseDto,
  type ReviewRechargeSubmissionDecisionDto,
  type ReviewRechargeSubmissionRequestDto,
  type ReviewRechargeSubmissionResponseDto,
  type SubmitRechargeProofRequestDto,
  type SubmitRechargeProofResponseDto,
  type SubmitRechargeRequestDto,
  type SubmitRechargeResponseDto,
} from "../../../../../../packages/contracts/src/index.ts";
import { CreditAccountService } from "./credit-account-service.ts";
import type { CreditExchangeRateRepository } from "../infrastructure/in-memory-credit-exchange-rate-repository.ts";
import type { RechargeSubmissionRepository } from "../infrastructure/in-memory-recharge-submission-repository.ts";
import {
  buildStaticRechargeDescription,
  createRechargeSubmission,
  markRechargeSubmissionRejected,
  markRechargeSubmissionCredited,
  RechargeSubmissionNotCreatedError,
  RechargeSubmissionNotPendingError,
  resolveRechargeRate,
  roundRechargeAmount,
  submitRechargeSubmissionProof,
  toAdminRechargeSubmissionDto,
  toRechargeSubmissionDto,
} from "../domain/static-recharge.ts";

export type StaticRechargeApprovalDto = ReviewRechargeSubmissionResponseDto;

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

  private buildRechargeConfigUnavailable(
    requestId: string,
    clientVersion?: string,
  ): ApiResponse<never> {
    return {
      success: false,
      error: {
        code: "RECHARGE_CONFIG_UNAVAILABLE",
        message: "The requested recharge currency is not currently available.",
      },
      meta: buildRequestMeta(requestId, clientVersion),
    };
  }

  private buildRechargeAmountOutOfRange(
    rate: { minAmount: number | null; maxAmount: number | null; currencyCode: string },
    requestId: string,
    clientVersion?: string,
  ): ApiResponse<never> {
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

  private buildRechargeSubmissionNotFound(
    requestId: string,
    clientVersion?: string,
  ): ApiResponse<never> {
    return {
      success: false,
      error: {
        code: "RECHARGE_SUBMISSION_NOT_FOUND",
        message: "The requested recharge submission could not be found.",
      },
      meta: buildRequestMeta(requestId, clientVersion),
    };
  }

  private buildRechargeSubmissionForbidden(
    requestId: string,
    clientVersion?: string,
  ): ApiResponse<never> {
    return {
      success: false,
      error: {
        code: "RECHARGE_SUBMISSION_FORBIDDEN",
        message: "Recharge submissions can only be updated by the original requester.",
      },
      meta: buildRequestMeta(requestId, clientVersion),
    };
  }

  async createRechargeSubmission(
    userId: string,
    input: CreateRechargeSubmissionRequestDto,
    requestId: string,
    clientVersion?: string,
  ): Promise<ApiResponse<CreateRechargeSubmissionResponseDto>> {
    const rates = await this.exchangeRateRepository.list();
    const rate = resolveRechargeRate(rates, input.currencyCode);
    if (!rate) {
      return this.buildRechargeConfigUnavailable(requestId, clientVersion);
    }

    const normalizedAmount = roundRechargeAmount(input.amount);
    if ((typeof rate.minAmount === "number" && normalizedAmount < rate.minAmount)
      || (typeof rate.maxAmount === "number" && normalizedAmount > rate.maxAmount)) {
      return this.buildRechargeAmountOutOfRange(rate, requestId, clientVersion);
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

  async submitRechargeProof(
    userId: string,
    submissionId: string,
    input: SubmitRechargeProofRequestDto,
    requestId: string,
    clientVersion?: string,
  ): Promise<ApiResponse<SubmitRechargeProofResponseDto>> {
    const submission = await this.submissionRepository.findById(submissionId);
    if (!submission) {
      return this.buildRechargeSubmissionNotFound(requestId, clientVersion);
    }

    if (submission.userId !== userId) {
      return this.buildRechargeSubmissionForbidden(requestId, clientVersion);
    }

    try {
      const updatedSubmission = submitRechargeSubmissionProof(
        submission,
        input,
        new Date().toISOString(),
      );
      const persistedSubmission = await this.submissionRepository.save(updatedSubmission);

      return {
        success: true,
        data: {
          submission: toRechargeSubmissionDto(persistedSubmission),
        },
        meta: buildRequestMeta(requestId, clientVersion),
      };
    } catch (error) {
      if (error instanceof RechargeSubmissionNotCreatedError) {
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

  async submitRecharge(
    userId: string,
    input: SubmitRechargeRequestDto,
    requestId: string,
    clientVersion?: string,
  ): Promise<ApiResponse<SubmitRechargeResponseDto>> {
    const created = await this.createRechargeSubmission(userId, {
      amount: input.amount,
      currencyCode: input.currencyCode,
      paymentChannel: input.paymentChannel,
    }, requestId, clientVersion);

    if (!created.success) {
      return created;
    }

    const proof = await this.submitRechargeProof(
      userId,
      created.data.submission.submissionId,
      {
        transferReferenceLast4: input.transferReferenceLast4,
        note: input.note,
      },
      requestId,
      clientVersion,
    );

    if (!proof.success) {
      return proof;
    }

    return {
      success: true,
      data: {
        submission: proof.data.submission,
      },
      meta: buildRequestMeta(requestId, clientVersion),
    };
  }

  async getAdminRechargeSubmission(
    submissionId: string,
    requestId: string,
    clientVersion?: string,
  ): Promise<ApiResponse<GetAdminRechargeSubmissionResponseDto>> {
    const submission = await this.submissionRepository.findById(submissionId);
    if (!submission) {
      return this.buildRechargeSubmissionNotFound(requestId, clientVersion);
    }

    return {
      success: true,
      data: {
        submission: toAdminRechargeSubmissionDto(submission),
      },
      meta: buildRequestMeta(requestId, clientVersion),
    };
  }

  async reviewRechargeSubmission(
    submissionId: string,
    input: ReviewRechargeSubmissionRequestDto | ReviewRechargeSubmissionDecisionDto,
    actorUserId: string,
    requestId: string,
    clientVersion?: string,
  ): Promise<ApiResponse<ReviewRechargeSubmissionResponseDto>> {
    const submission = await this.submissionRepository.findById(submissionId);
    if (!submission) {
      return this.buildRechargeSubmissionNotFound(requestId, clientVersion);
    }

    try {
      const decision = typeof input === "string" ? input : input.decision;

      if (decision === "reject") {
        const rejectedSubmission = markRechargeSubmissionRejected(
          submission,
          actorUserId,
          new Date().toISOString(),
        );
        const persistedSubmission = await this.submissionRepository.save(rejectedSubmission);

        return {
          success: true,
          data: {
            submission: toAdminRechargeSubmissionDto(persistedSubmission),
            recharge: null,
            creditAmount: submission.creditAmount,
          },
          meta: buildRequestMeta(requestId, clientVersion),
        };
      }

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
          submission: toAdminRechargeSubmissionDto(persistedSubmission),
          recharge: recharge.data,
          creditAmount: submission.creditAmount,
        },
        meta: buildRequestMeta(requestId, clientVersion),
      };
    } catch (error) {
      if (error instanceof RechargeSubmissionNotPendingError) {
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

  async applyApprovedRechargeSubmission(
    submissionId: string,
    actorUserId: string,
    requestId: string,
    clientVersion?: string,
  ): Promise<ApiResponse<StaticRechargeApprovalDto>> {
    return this.reviewRechargeSubmission(
      submissionId,
      { decision: "credit" },
      actorUserId,
      requestId,
      clientVersion,
    );
  }
}
