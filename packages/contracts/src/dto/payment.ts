import type { MoneyDto } from "./common.ts";
import type { PaymentOrderStatus } from "../enums/status.ts";

export interface CreatePaymentOrderRequestDto {
  providerCode: string;
  amount: string;
  currency: string;
  creditAmount?: number;
  returnUrl: string;
  notifyUrl: string;
  idempotencyKey: string;
  userId?: string;
}

export interface PaymentOrderDto {
  id: string;
  merchantOrderNo: string;
  status: PaymentOrderStatus;
  amount: string;
  currency: string;
  creditAmount: number;
  paymentUrl: string;
  providerCode?: string;
  userId?: string;
}

export interface AlipayCallbackRequestDto {
  callbackId: string;
  merchantOrderNo: string;
  tradeStatus: string;
  payload: Record<string, unknown>;
}

export interface PaymentCallbackResultDto {
  accepted: boolean;
  paymentOrderStatus: PaymentOrderStatus;
}

export interface PaymentOrderStatusViewDto {
  paymentOrderId: string;
  merchantOrderNo: string;
  paymentOrderStatus: PaymentOrderStatus;
  tradeStatus: string;
  creditAmount: number;
  amount: string;
  currency: string;
  settlementApplied: boolean;
  settlementLedgerId?: string;
}

export interface ApplyPaymentSettlementRequestDto {
  paymentOrderId: string;
  merchantOrderNo: string;
  userId: string;
  providerCode: string;
  amount: MoneyDto;
  creditAmount: number;
  callbackId: string;
}

export interface ApplyPaymentSettlementResponseDto {
  ledgerId: string;
  balanceAfter: number;
  paymentOrderId: string;
  merchantOrderNo: string;
}
