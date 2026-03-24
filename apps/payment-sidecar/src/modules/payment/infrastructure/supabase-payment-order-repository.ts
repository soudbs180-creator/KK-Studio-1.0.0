import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import type {
  PaymentCallbackRecord,
  PaymentOrderRecord,
} from "../domain/payment-order.ts";
import type { PaymentOrderRepository } from "./in-memory-payment-order-repository.ts";

interface PaymentOrderRow {
  id: string;
  user_id: string;
  provider_code: string;
  merchant_order_no: string;
  status: string;
  amount: string | number;
  currency: string;
  credit_amount: number;
  idempotency_key: string;
  payment_url: string;
  return_url: string;
  notify_url: string;
  last_callback_id: string | null;
  settlement_applied_at: string | null;
  settlement_ledger_id: string | null;
  created_at: string;
  updated_at: string;
  paid_at: string | null;
}

interface PaymentCallbackRow {
  payment_order_id: string;
  provider_code: string;
  callback_id: string;
  verified: boolean;
  trade_status: string;
  payload: Record<string, unknown>;
  settlement_status: string;
  settlement_error: string | null;
  received_at: string;
  processed_at: string | null;
}

export interface SupabasePaymentOrderRepositoryOptions {
  supabaseUrl: string;
  serviceRoleKey: string;
}

function toPaymentOrderRecord(row: PaymentOrderRow): PaymentOrderRecord {
  return {
    id: row.id,
    userId: row.user_id,
    providerCode: row.provider_code,
    merchantOrderNo: row.merchant_order_no,
    status: row.status as PaymentOrderRecord["status"],
    amount: typeof row.amount === "number" ? row.amount.toFixed(2) : String(row.amount),
    currency: row.currency,
    creditAmount: row.credit_amount,
    idempotencyKey: row.idempotency_key,
    paymentUrl: row.payment_url,
    returnUrl: row.return_url,
    notifyUrl: row.notify_url,
    lastCallbackId: row.last_callback_id || undefined,
    settlementAppliedAt: row.settlement_applied_at || undefined,
    settlementLedgerId: row.settlement_ledger_id || undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function toPaymentOrderRow(order: PaymentOrderRecord): PaymentOrderRow {
  return {
    id: order.id,
    user_id: order.userId,
    provider_code: order.providerCode,
    merchant_order_no: order.merchantOrderNo,
    status: order.status,
    amount: order.amount,
    currency: order.currency,
    credit_amount: order.creditAmount,
    idempotency_key: order.idempotencyKey,
    payment_url: order.paymentUrl,
    return_url: order.returnUrl,
    notify_url: order.notifyUrl,
    last_callback_id: order.lastCallbackId || null,
    settlement_applied_at: order.settlementAppliedAt || null,
    settlement_ledger_id: order.settlementLedgerId || null,
    created_at: order.createdAt,
    updated_at: order.updatedAt,
    paid_at: order.status === "paid" ? (order.settlementAppliedAt || order.updatedAt) : null,
  };
}

function toPaymentCallbackRecord(row: PaymentCallbackRow): PaymentCallbackRecord {
  return {
    paymentOrderId: row.payment_order_id,
    providerCode: row.provider_code,
    callbackId: row.callback_id,
    verified: row.verified,
    tradeStatus: row.trade_status,
    payload: row.payload || {},
    settlementStatus: row.settlement_status as PaymentCallbackRecord["settlementStatus"],
    settlementError: row.settlement_error || undefined,
    receivedAt: row.received_at,
    processedAt: row.processed_at || undefined,
  };
}

function toPaymentCallbackRow(callback: PaymentCallbackRecord): PaymentCallbackRow {
  return {
    payment_order_id: callback.paymentOrderId,
    provider_code: callback.providerCode,
    callback_id: callback.callbackId,
    verified: callback.verified,
    trade_status: callback.tradeStatus,
    payload: callback.payload,
    settlement_status: callback.settlementStatus,
    settlement_error: callback.settlementError || null,
    received_at: callback.receivedAt,
    processed_at: callback.processedAt || null,
  };
}

export class SupabasePaymentOrderRepository implements PaymentOrderRepository {
  private readonly client: SupabaseClient;

  constructor(options: SupabasePaymentOrderRepositoryOptions) {
    this.client = createClient(options.supabaseUrl, options.serviceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });
  }

  async findByIdempotencyKey(userId: string, idempotencyKey: string): Promise<PaymentOrderRecord | undefined> {
    const { data, error } = await this.client
      .from("payment_orders")
      .select("*")
      .eq("user_id", userId)
      .eq("idempotency_key", idempotencyKey)
      .maybeSingle<PaymentOrderRow>();

    if (error) {
      throw error;
    }

    return data ? toPaymentOrderRecord(data) : undefined;
  }

  async findByMerchantOrderNo(merchantOrderNo: string): Promise<PaymentOrderRecord | undefined> {
    const { data, error } = await this.client
      .from("payment_orders")
      .select("*")
      .eq("merchant_order_no", merchantOrderNo)
      .maybeSingle<PaymentOrderRow>();

    if (error) {
      throw error;
    }

    return data ? toPaymentOrderRecord(data) : undefined;
  }

  async findCallbackById(callbackId: string): Promise<PaymentCallbackRecord | undefined> {
    const { data, error } = await this.client
      .from("payment_callbacks")
      .select("*")
      .eq("callback_id", callbackId)
      .maybeSingle<PaymentCallbackRow>();

    if (error) {
      throw error;
    }

    return data ? toPaymentCallbackRecord(data) : undefined;
  }

  async save(order: PaymentOrderRecord): Promise<void> {
    const { error } = await this.client
      .from("payment_orders")
      .upsert(toPaymentOrderRow(order), {
        onConflict: "id",
      });

    if (error) {
      throw error;
    }
  }

  async saveCallback(callback: PaymentCallbackRecord): Promise<void> {
    const { error } = await this.client
      .from("payment_callbacks")
      .upsert(toPaymentCallbackRow(callback), {
        onConflict: "callback_id",
      });

    if (error) {
      throw error;
    }
  }
}
