import {
  buildRequestMeta,
  type ApiResponse,
  type CreateRechargeSubmissionRequestDto,
  type CreateRechargeSubmissionResponseDto,
  type GetAdminRechargeSubmissionResponseDto,
  type ListAdminRechargeSubmissionsResponseDto,
  type MarkRechargeSubmissionPaidResponseDto,
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
  isRechargeSubmissionExpired,
  markRechargeSubmissionPaid,
  markRechargeSubmissionRejected,
  markRechargeSubmissionCredited,
  RechargeSubmissionExpiredError,
  RechargeSubmissionNotCreatedError,
  RechargeSubmissionNotPendingError,
  RechargeSubmissionNotPayingError,
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
  manualRechargeFeeGenerator?: () => number;
  nowProvider?: () => Date;
}

export class StaticRechargeService {
  private readonly submissionRepository: RechargeSubmissionRepository;
  private readonly exchangeRateRepository: CreditExchangeRateRepository;
  private readonly creditAccountService: CreditAccountService;
  private readonly manualRechargeFeeGenerator: () => number;
  private readonly nowProvider: () => Date;

  constructor(options: StaticRechargeServiceOptions) {
    this.submissionRepository = options.submissionRepository;
    this.exchangeRateRepository = options.exchangeRateRepository;
    this.creditAccountService = options.creditAccountService;
    this.manualRechargeFeeGenerator = options.manualRechargeFeeGenerator || (() => {
      const cents = Math.floor(Math.random() * 40) + 1;
      return cents / 100;
    });
    this.nowProvider = options.nowProvider || (() => new Date());
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

  private buildRechargeSubmissionExpired(
    requestId: string,
    clientVersion?: string,
  ): ApiResponse<never> {
    return {
      success: false,
      error: {
        code: "RECHARGE_SUBMISSION_EXPIRED",
        message: "The requested recharge submission has expired.",
      },
      meta: buildRequestMeta(requestId, clientVersion),
    };
  }

  private now(): Date {
    return this.nowProvider();
  }

  private nowIso(): string {
    return this.now().toISOString();
  }

  private buildManualRechargeExpiresAt(now: Date): string {
    return new Date(now.getTime() + 5 * 60 * 1000).toISOString();
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

    const now = this.now();
    const submission = createRechargeSubmission(userId, input, rate, now.toISOString(), {
      serviceFee: this.manualRechargeFeeGenerator(),
      expiresAt: this.buildManualRechargeExpiresAt(now),
    });
    const persistedSubmission = await this.submissionRepository.save(submission);

    return {
      success: true,
      data: {
        submission: toRechargeSubmissionDto(persistedSubmission, { now }),
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
        this.nowIso(),
      );
      const persistedSubmission = await this.submissionRepository.save(updatedSubmission);

      return {
        success: true,
        data: {
          submission: toRechargeSubmissionDto(persistedSubmission, { now: this.now() }),
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

  async listAdminRechargeSubmissions(
    requestId: string,
    clientVersion?: string,
  ): Promise<ApiResponse<ListAdminRechargeSubmissionsResponseDto>> {
    const since = new Date(this.now().getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();
    const submissions = await this.submissionRepository.listRecent(since);
    const now = this.now();
    const items = submissions
      .map((submission) => toAdminRechargeSubmissionDto(submission, { now }))
      .sort((left, right) => {
        const leftPaid = left.status === "paying" && Boolean(left.paymentMarkedAt);
        const rightPaid = right.status === "paying" && Boolean(right.paymentMarkedAt);
        if (leftPaid !== rightPaid) {
          return leftPaid ? -1 : 1;
        }

        const leftPaying = left.status === "paying";
        const rightPaying = right.status === "paying";
        if (leftPaying !== rightPaying) {
          return leftPaying ? -1 : 1;
        }

        return new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime();
      });

    return {
      success: true,
      data: {
        items,
      },
      meta: buildRequestMeta(requestId, clientVersion),
    };
  }

  async markRechargeSubmissionPaid(
    userId: string,
    submissionId: string,
    requestId: string,
    clientVersion?: string,
  ): Promise<ApiResponse<MarkRechargeSubmissionPaidResponseDto>> {
    const submission = await this.submissionRepository.findById(submissionId);
    if (!submission) {
      return this.buildRechargeSubmissionNotFound(requestId, clientVersion);
    }

    if (submission.userId !== userId) {
      return this.buildRechargeSubmissionForbidden(requestId, clientVersion);
    }

    if (isRechargeSubmissionExpired(submission, this.now())) {
      return this.buildRechargeSubmissionExpired(requestId, clientVersion);
    }

    try {
      const updatedSubmission = markRechargeSubmissionPaid(submission, this.nowIso());
      const persistedSubmission = await this.submissionRepository.save(updatedSubmission);
      return {
        success: true,
        data: {
          submission: toRechargeSubmissionDto(persistedSubmission, { now: this.now() }),
        },
        meta: buildRequestMeta(requestId, clientVersion),
      };
    } catch (error) {
      if (error instanceof RechargeSubmissionNotPayingError) {
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
          this.nowIso(),
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

      if (isRechargeSubmissionExpired(submission, this.now())) {
        throw new RechargeSubmissionExpiredError(submission.submissionId);
      }

      const recharge = await this.creditAccountService.adminApplyManualRecharge({
        userId: submission.userId,
        creditAmount: submission.creditAmount,
        submissionId: submission.submissionId,
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
        submission.reviewedAt ?? this.nowIso(),
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

      if (error instanceof RechargeSubmissionExpiredError) {
        return this.buildRechargeSubmissionExpired(requestId, clientVersion);
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
