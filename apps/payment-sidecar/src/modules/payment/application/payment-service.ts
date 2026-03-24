import {
  buildRequestMeta,
  type AlipayCallbackRequestDto,
  type ApiResponse,
  type CreatePaymentOrderRequestDto,
  type PaymentCallbackResultDto,
  type PaymentOrderDto,
  type PaymentOrderStatusViewDto,
  PaymentOrderStatus,
} from "../../../../../../packages/contracts/src/index.ts";
import { consoleLogger } from "../../../../../../packages/shared/src/index.ts";
import {
  applyAlipayCallbackToOrder,
  applySettlementToOrder,
  buildMerchantOrderNo,
  createPaymentOrder,
  createPaymentCallbackRecord,
  isSupportedProviderCode,
  markPaymentCallbackApplied,
  markPaymentCallbackFailed,
  markPaymentCallbackIgnored,
  toLegacyTradeStatus,
  type PaymentOrderRecord,
} from "../domain/payment-order.ts";
import type { PaymentCreditAmountResolver } from "../infrastructure/payment-credit-amount-resolver.ts";
import type { PaymentOrderRepository } from "../infrastructure/in-memory-payment-order-repository.ts";
import type { PaymentSettlementWriter } from "../infrastructure/http-main-api-settlement-writer.ts";

export interface CreatePaymentOrderContext {
  requestId: string;
  clientVersion?: string;
  userId: string;
  paymentUrlFactory: (merchantOrderNo: string) => string;
}

export class PaymentService {
  private readonly logger = consoleLogger.child({ module: "payment-sidecar.payment" });
  private readonly repository: PaymentOrderRepository;
  private readonly settlementWriter: PaymentSettlementWriter;
  private readonly creditAmountResolver: PaymentCreditAmountResolver;

  constructor(
    repository: PaymentOrderRepository,
    settlementWriter: PaymentSettlementWriter,
    creditAmountResolver: PaymentCreditAmountResolver,
  ) {
    this.repository = repository;
    this.settlementWriter = settlementWriter;
    this.creditAmountResolver = creditAmountResolver;
  }

  async createOrder(
    input: CreatePaymentOrderRequestDto,
    context: CreatePaymentOrderContext,
  ): Promise<ApiResponse<PaymentOrderDto>> {
    const existing = await this.repository.findByIdempotencyKey(context.userId, input.idempotencyKey);
    if (existing) {
      return {
        success: true,
        data: this.toOrderDto(existing),
        meta: buildRequestMeta(context.requestId, context.clientVersion),
      };
    }

    const createdAt = new Date().toISOString();
    const merchantOrderNo = buildMerchantOrderNo(Date.parse(createdAt) || Date.now());
    const resolvedCreditAmount = await this.creditAmountResolver.resolve({
      amount: input.amount,
      currency: input.currency,
    });

    if (
      typeof input.creditAmount === "number"
      && Number.isFinite(input.creditAmount)
      && Math.round(input.creditAmount) !== resolvedCreditAmount
    ) {
      this.logger.warn("Ignoring mismatched client-supplied credit amount", {
        userId: context.userId,
        requestedCreditAmount: input.creditAmount,
        resolvedCreditAmount,
        currency: input.currency,
        amount: input.amount,
      });
    }

    const order = createPaymentOrder({
      ...input,
      creditAmount: resolvedCreditAmount,
      userId: context.userId,
      merchantOrderNo,
      paymentUrl: context.paymentUrlFactory(merchantOrderNo),
    }, createdAt);

    await this.repository.save(order);

    this.logger.info("Payment order created in sidecar", {
      userId: context.userId,
      paymentOrderId: order.id,
      merchantOrderNo: order.merchantOrderNo,
      providerCode: order.providerCode,
    });

    return {
      success: true,
      data: this.toOrderDto(order),
      meta: buildRequestMeta(context.requestId, context.clientVersion),
    };
  }

  async handleAlipayCallback(
    input: AlipayCallbackRequestDto,
    context: { requestId: string; clientVersion?: string },
  ): Promise<ApiResponse<PaymentCallbackResultDto>> {
    const order = await this.repository.findByMerchantOrderNo(input.merchantOrderNo);
    if (!order) {
      return {
        success: false,
        error: {
          code: "PAYMENT_ORDER_NOT_FOUND",
          message: "The payment order could not be found for this callback.",
          details: [{ field: "merchantOrderNo", reason: "No payment order matches the provided merchantOrderNo." }],
        },
        meta: buildRequestMeta(context.requestId, context.clientVersion),
      };
    }

    const existingCallback = await this.repository.findCallbackById(input.callbackId);
    if (existingCallback && existingCallback.paymentOrderId === order.id) {
      return {
        success: true,
        data: {
          accepted: true,
          paymentOrderStatus: order.status,
        },
        meta: buildRequestMeta(context.requestId, context.clientVersion),
      };
    }

    const receivedAt = new Date().toISOString();
    const callbackRecord = createPaymentCallbackRecord(order, input, receivedAt);
    const callbackMutation = applyAlipayCallbackToOrder(order, input, receivedAt);
    if (!callbackMutation.requiresSettlement || !callbackMutation.settlementRequest) {
      await this.repository.save(callbackMutation.order);
      await this.repository.saveCallback(markPaymentCallbackIgnored(callbackRecord, new Date().toISOString()));
      return {
        success: true,
        data: {
          accepted: true,
          paymentOrderStatus: callbackMutation.order.status,
        },
        meta: buildRequestMeta(context.requestId, context.clientVersion),
      };
    }

    try {
      const settlement = await this.settlementWriter.write(callbackMutation.settlementRequest, {
        requestId: context.requestId,
        clientVersion: context.clientVersion,
      });

      const settledOrder = applySettlementToOrder(
        callbackMutation.order,
        input.callbackId,
        settlement,
        new Date().toISOString(),
      );
      await this.repository.save(settledOrder);
      await this.repository.saveCallback(markPaymentCallbackApplied(callbackRecord, new Date().toISOString()));

      this.logger.info("Payment settlement applied through main API", {
        paymentOrderId: settledOrder.id,
        merchantOrderNo: settledOrder.merchantOrderNo,
        ledgerId: settlement.ledgerId,
      });

      return {
        success: true,
        data: {
          accepted: true,
          paymentOrderStatus: PaymentOrderStatus.Paid,
        },
        meta: buildRequestMeta(context.requestId, context.clientVersion),
      };
    } catch (error: any) {
      await this.repository.save(callbackMutation.order);
      await this.repository.saveCallback(markPaymentCallbackFailed(
        callbackRecord,
        error?.message || "Payment callback settlement failed.",
        new Date().toISOString(),
      ));
      return {
        success: false,
        error: {
          code: "PAYMENT_SETTLEMENT_FAILED",
          message: error?.message || "Payment callback was received but settlement write-back failed.",
        },
        meta: buildRequestMeta(context.requestId, context.clientVersion),
      };
    }
  }

  async getOrderStatus(merchantOrderNo: string): Promise<PaymentOrderStatusViewDto | undefined> {
    const order = await this.repository.findByMerchantOrderNo(merchantOrderNo);
    if (!order) {
      return undefined;
    }

    const settlementApplied = Boolean(order.settlementAppliedAt);
    return {
      merchantOrderNo: order.merchantOrderNo,
      paymentOrderId: order.id,
      paymentOrderStatus: order.status,
      tradeStatus: settlementApplied ? toLegacyTradeStatus(order.status) : "WAITING",
      creditAmount: order.creditAmount,
      amount: order.amount,
      currency: order.currency,
      settlementApplied,
      settlementLedgerId: order.settlementLedgerId,
    };
  }

  async getOrder(merchantOrderNo: string): Promise<PaymentOrderRecord | undefined> {
    return this.repository.findByMerchantOrderNo(merchantOrderNo);
  }

  isProviderSupported(providerCode: string): boolean {
    return isSupportedProviderCode(providerCode);
  }

  private toOrderDto(order: PaymentOrderRecord): PaymentOrderDto {
    return {
      id: order.id,
      merchantOrderNo: order.merchantOrderNo,
      status: order.status,
      amount: order.amount,
      currency: order.currency,
      creditAmount: order.creditAmount,
      paymentUrl: order.paymentUrl,
      providerCode: order.providerCode,
      userId: order.userId,
    };
  }
}
