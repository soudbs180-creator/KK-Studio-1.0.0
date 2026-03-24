import {
  type AdminRechargeCreditsRequestDto,
  type AdminRechargeCreditsResponseDto,
  type ApplyPaymentSettlementRequestDto,
  type ApplyPaymentSettlementResponseDto,
  buildRequestMeta,
  type ApiResponse,
  type CreditBalanceDto,
  type CreditTransactionListDto,
  type DebitCreditsRequestDto,
  type DebitCreditsResponseDto,
  type ListCreditTransactionsQueryDto,
  type RefundCreditsRequestDto,
  type RefundCreditsResponseDto,
} from "../../../../../../packages/contracts/src/index.ts";
import { consoleLogger } from "../../../../../../packages/shared/src/index.ts";
import {
  applyDebitCredits,
  applyPaymentSettlementCredits,
  buildPaymentSettlementApplied,
  buildBillingCreditDebitedEvent,
} from "../domain/credit-account.ts";
import {
  CreditBalanceInsufficientError,
  type CreditAccountRepository,
  CreditTransactionNotFoundError,
  CreditTransactionNotRefundableError,
} from "../infrastructure/in-memory-credit-account-repository.ts";

export class CreditAccountService {
  private readonly logger = consoleLogger.child({ module: "billing.credit-account" });
  private readonly repository: CreditAccountRepository;

  constructor(repository: CreditAccountRepository) {
    this.repository = repository;
  }

  async getBalance(
    userId: string,
    requestId: string,
    clientVersion?: string,
  ): Promise<ApiResponse<CreditBalanceDto>> {
    const account = await this.repository.getOrCreate(userId);

    return {
      success: true,
      data: account,
      meta: buildRequestMeta(requestId, clientVersion),
    };
  }

  async debitCredits(
    userId: string,
    input: DebitCreditsRequestDto,
    requestId: string,
    clientVersion?: string,
  ): Promise<ApiResponse<DebitCreditsResponseDto>> {
    const existing = await this.repository.findDebitByIdempotencyKey(userId, input.idempotencyKey);
    if (existing) {
      return {
        success: true,
        data: {
          ledgerId: existing.ledgerId,
          balanceAfter: existing.balanceAfter,
          transactionType: existing.transactionType,
        },
        meta: buildRequestMeta(requestId, clientVersion),
      };
    }

    const account = await this.repository.getOrCreate(userId);
    if (account.balance < input.creditAmount) {
      return {
        success: false,
        error: {
          code: "CREDIT_BALANCE_INSUFFICIENT",
          message: "The current credit balance is insufficient for this debit request.",
          details: [
            {
              field: "creditAmount",
              reason: "Requested credit amount exceeds the available balance.",
              balance: account.balance,
              requested: input.creditAmount,
            },
          ],
        },
        meta: buildRequestMeta(requestId, clientVersion),
      };
    }

    const mutation = applyDebitCredits(account, input, new Date().toISOString());
    let persisted = mutation;

    try {
      persisted = await this.repository.saveDebit(mutation.account, mutation.ledger);
    } catch (error) {
      if (error instanceof CreditBalanceInsufficientError) {
        return {
          success: false,
          error: {
            code: "CREDIT_BALANCE_INSUFFICIENT",
            message: "The current credit balance is insufficient for this debit request.",
            details: [
              {
                field: "creditAmount",
                reason: "Requested credit amount exceeds the available balance.",
                balance: error.balance,
                requested: input.creditAmount,
              },
            ],
          },
          meta: buildRequestMeta(requestId, clientVersion),
        };
      }

      throw error;
    }

    this.logger.info("Credit debit accepted by migrated billing module", {
      userId,
      ledgerId: persisted.ledger.ledgerId,
      event: buildBillingCreditDebitedEvent(persisted.ledger),
    });

    return {
      success: true,
      data: {
        ledgerId: persisted.ledger.ledgerId,
        balanceAfter: persisted.ledger.balanceAfter,
        transactionType: persisted.ledger.transactionType,
      },
      meta: buildRequestMeta(requestId, clientVersion),
    };
  }

  async listTransactions(
    userId: string,
    input: ListCreditTransactionsQueryDto | undefined,
    requestId: string,
    clientVersion?: string,
  ): Promise<ApiResponse<CreditTransactionListDto>> {
    const items = await this.repository.listTransactions(userId, input);

    return {
      success: true,
      data: {
        items,
      },
      meta: buildRequestMeta(requestId, clientVersion),
    };
  }

  async refundCredits(
    userId: string,
    input: RefundCreditsRequestDto,
    requestId: string,
    clientVersion?: string,
  ): Promise<ApiResponse<RefundCreditsResponseDto>> {
    try {
      const result = await this.repository.refundTransaction(userId, input.transactionId, input.reason);
      return {
        success: true,
        data: result,
        meta: buildRequestMeta(requestId, clientVersion),
      };
    } catch (error) {
      if (error instanceof CreditTransactionNotFoundError) {
        return {
          success: false,
          error: {
            code: error.code,
            message: "The requested credit transaction could not be found.",
            details: [
              {
                field: "transactionId",
                reason: "No refundable transaction matches the supplied transactionId.",
              },
            ],
          },
          meta: buildRequestMeta(requestId, clientVersion),
        };
      }

      if (error instanceof CreditTransactionNotRefundableError) {
        return {
          success: false,
          error: {
            code: error.code,
            message: "The requested credit transaction cannot be refunded.",
            details: [
              {
                field: "transactionId",
                reason: "Only completed debit transactions can be refunded once.",
              },
            ],
          },
          meta: buildRequestMeta(requestId, clientVersion),
        };
      }

      throw error;
    }
  }

  async adminRechargeCredits(
    input: AdminRechargeCreditsRequestDto,
    actorUserId: string,
    requestId: string,
    clientVersion?: string,
  ): Promise<ApiResponse<AdminRechargeCreditsResponseDto>> {
    const result = await this.repository.adminRechargeByIdentity(
      input.identity,
      input.creditAmount,
      input.description,
    );

    this.logger.info("Admin recharge applied by migrated billing module", {
      actorUserId,
      identity: input.identity,
      subjectId: result.subjectId,
      creditedAmount: input.creditAmount,
      balanceAfter: result.balanceAfter,
    });

    return {
      success: true,
      data: result,
      meta: buildRequestMeta(requestId, clientVersion),
    };
  }

  async applyPaymentSettlement(
    input: ApplyPaymentSettlementRequestDto,
    requestId: string,
    clientVersion?: string,
  ): Promise<ApiResponse<ApplyPaymentSettlementResponseDto>> {
    const existing = await this.repository.findRechargeByIdempotencyKey(input.userId, input.callbackId);
    if (existing) {
      return {
        success: true,
        data: {
          ledgerId: existing.ledgerId,
          balanceAfter: existing.balanceAfter,
          paymentOrderId: input.paymentOrderId,
          merchantOrderNo: input.merchantOrderNo,
        },
        meta: buildRequestMeta(requestId, clientVersion),
      };
    }

    const account = await this.repository.getOrCreate(input.userId);
    const recharge = applyPaymentSettlementCredits(account, input, new Date().toISOString());
    const persisted = await this.repository.saveRecharge(recharge.account, recharge.ledger);

    this.logger.info("Payment settlement applied to credit account", {
      userId: input.userId,
      paymentOrderId: input.paymentOrderId,
      merchantOrderNo: input.merchantOrderNo,
      ledgerId: persisted.ledger.ledgerId,
    });

    return {
      success: true,
      data: buildPaymentSettlementApplied(input, persisted),
      meta: buildRequestMeta(requestId, clientVersion),
    };
  }
}
