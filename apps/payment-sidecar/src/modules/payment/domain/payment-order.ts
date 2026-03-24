import { randomUUID } from "node:crypto";

import {
  PaymentOrderStatus,
  type ApplyPaymentSettlementRequestDto,
  type CreatePaymentOrderRequestDto,
  type PaymentOrderDto,
  type PaymentOrderStatus as PaymentOrderStatusValue,
} from "../../../../../../packages/contracts/src/index.ts";

export const SupportedPaymentProvider = {
  Alipay: "alipay",
  Wechat: "wechat",
  Paypal: "paypal",
} as const;

export type SupportedPaymentProvider =
  (typeof SupportedPaymentProvider)[keyof typeof SupportedPaymentProvider];

export interface PaymentOrderRecord extends PaymentOrderDto {
  providerCode: string;
  userId: string;
  idempotencyKey: string;
  returnUrl: string;
  notifyUrl: string;
  createdAt: string;
  updatedAt: string;
  lastCallbackId?: string;
  settlementAppliedAt?: string;
  settlementLedgerId?: string;
}

export interface PaymentSettlementApplied {
  ledgerId: string;
  balanceAfter: number;
}

export const PaymentCallbackSettlementStatus = {
  Pending: "pending",
  Applied: "applied",
  Failed: "failed",
  Ignored: "ignored",
} as const;

export type PaymentCallbackSettlementStatus =
  (typeof PaymentCallbackSettlementStatus)[keyof typeof PaymentCallbackSettlementStatus];

export interface PaymentCallbackRecord {
  paymentOrderId: string;
  providerCode: string;
  callbackId: string;
  verified: boolean;
  tradeStatus: string;
  payload: Record<string, unknown>;
  settlementStatus: PaymentCallbackSettlementStatus;
  settlementError?: string;
  receivedAt: string;
  processedAt?: string;
}

export interface PaymentCallbackMutation {
  order: PaymentOrderRecord;
  requiresSettlement: boolean;
  settlementRequest?: ApplyPaymentSettlementRequestDto;
}

export function normalizeProviderCode(providerCode: string): string {
  return String(providerCode || "").trim().toLowerCase();
}

export function isSupportedProviderCode(providerCode: string): providerCode is SupportedPaymentProvider {
  const normalized = normalizeProviderCode(providerCode);
  return normalized === SupportedPaymentProvider.Alipay
    || normalized === SupportedPaymentProvider.Wechat
    || normalized === SupportedPaymentProvider.Paypal;
}

export function isValidAmount(amount: string): boolean {
  if (typeof amount !== "string" || !amount.trim()) {
    return false;
  }

  const parsed = Number(amount);
  return Number.isFinite(parsed) && parsed > 0;
}

export function normalizeAmount(amount: string): string {
  return Number(amount).toFixed(2);
}

export function buildMerchantOrderNo(now = Date.now()): string {
  const entropy = Math.random().toString(36).slice(2, 8).toUpperCase();
  return `ORDER_${now}_${entropy}`;
}

export function createPaymentOrder(
  input: CreatePaymentOrderRequestDto & {
    creditAmount: number;
    userId: string;
    merchantOrderNo: string;
    paymentUrl: string;
  },
  createdAt: string,
): PaymentOrderRecord {
  return {
    id: randomUUID(),
    merchantOrderNo: input.merchantOrderNo,
    status: PaymentOrderStatus.Created,
    amount: normalizeAmount(input.amount),
    currency: String(input.currency || "").trim().toUpperCase(),
    creditAmount: Math.round(input.creditAmount),
    paymentUrl: input.paymentUrl,
    providerCode: normalizeProviderCode(input.providerCode),
    userId: input.userId,
    idempotencyKey: input.idempotencyKey,
    returnUrl: input.returnUrl,
    notifyUrl: input.notifyUrl,
    createdAt,
    updatedAt: createdAt,
  };
}

export function normalizeTradeStatus(tradeStatus: string): PaymentOrderStatusValue {
  const normalized = String(tradeStatus || "").trim().toUpperCase();

  if (
    normalized === "TRADE_SUCCESS"
    || normalized === "TRADE_FINISHED"
    || normalized === "SUCCESS"
    || normalized === "PAID"
  ) {
    return PaymentOrderStatus.Paid;
  }

  if (
    normalized === "TRADE_CLOSED"
    || normalized === "CLOSED"
    || normalized === "CANCELLED"
    || normalized === "CANCELED"
  ) {
    return PaymentOrderStatus.Cancelled;
  }

  if (normalized === "TRADE_FAILED" || normalized === "FAILED") {
    return PaymentOrderStatus.Failed;
  }

  return PaymentOrderStatus.Pending;
}

export function applyAlipayCallbackToOrder(
  order: PaymentOrderRecord,
  callback: {
    callbackId: string;
    tradeStatus: string;
  },
  updatedAt: string,
): PaymentCallbackMutation {
  if (order.lastCallbackId === callback.callbackId) {
    return {
      order,
      requiresSettlement: false,
    };
  }

  const nextStatus = normalizeTradeStatus(callback.tradeStatus);
  const nextOrder: PaymentOrderRecord = {
    ...order,
    status: nextStatus,
    updatedAt,
  };

  if (nextStatus !== PaymentOrderStatus.Paid) {
    nextOrder.lastCallbackId = callback.callbackId;
    return {
      order: nextOrder,
      requiresSettlement: false,
    };
  }

  if (order.settlementAppliedAt) {
    nextOrder.lastCallbackId = callback.callbackId;
    return {
      order: nextOrder,
      requiresSettlement: false,
    };
  }

  return {
    order: nextOrder,
    requiresSettlement: true,
    settlementRequest: {
      paymentOrderId: order.id,
      merchantOrderNo: order.merchantOrderNo,
      userId: order.userId,
      providerCode: order.providerCode,
      amount: {
        amount: order.amount,
        currency: order.currency,
      },
      creditAmount: order.creditAmount,
      callbackId: callback.callbackId,
    },
  };
}

export function applySettlementToOrder(
  order: PaymentOrderRecord,
  callbackId: string,
  settlement: PaymentSettlementApplied,
  updatedAt: string,
): PaymentOrderRecord {
  return {
    ...order,
    status: PaymentOrderStatus.Paid,
    updatedAt,
    lastCallbackId: callbackId,
    settlementAppliedAt: updatedAt,
    settlementLedgerId: settlement.ledgerId,
  };
}

export function createPaymentCallbackRecord(
  order: PaymentOrderRecord,
  callback: {
    callbackId: string;
    tradeStatus: string;
    payload: Record<string, unknown>;
  },
  receivedAt: string,
): PaymentCallbackRecord {
  return {
    paymentOrderId: order.id,
    providerCode: order.providerCode,
    callbackId: callback.callbackId,
    verified: true,
    tradeStatus: callback.tradeStatus,
    payload: callback.payload,
    settlementStatus: PaymentCallbackSettlementStatus.Pending,
    receivedAt,
  };
}

export function markPaymentCallbackIgnored(
  record: PaymentCallbackRecord,
  processedAt: string,
): PaymentCallbackRecord {
  return {
    ...record,
    settlementStatus: PaymentCallbackSettlementStatus.Ignored,
    processedAt,
  };
}

export function markPaymentCallbackApplied(
  record: PaymentCallbackRecord,
  processedAt: string,
): PaymentCallbackRecord {
  return {
    ...record,
    settlementStatus: PaymentCallbackSettlementStatus.Applied,
    processedAt,
  };
}

export function markPaymentCallbackFailed(
  record: PaymentCallbackRecord,
  settlementError: string,
  processedAt: string,
): PaymentCallbackRecord {
  return {
    ...record,
    settlementStatus: PaymentCallbackSettlementStatus.Failed,
    settlementError,
    processedAt,
  };
}

export function toLegacyTradeStatus(status: PaymentOrderStatusValue): string {
  if (status === PaymentOrderStatus.Paid) {
    return "TRADE_SUCCESS";
  }

  if (status === PaymentOrderStatus.Cancelled || status === PaymentOrderStatus.Failed) {
    return "TRADE_CLOSED";
  }

  return "WAITING";
}
