import { getSharedPostgresPool, hasPostgresConfig, type PostgresQueryable } from "../../../lib/postgres.ts";
import type {
  PaymentCallbackRecord,
  PaymentOrderRecord,
} from "../domain/payment-order.ts";
import { InMemoryPaymentOrderRepository, type PaymentOrderRepository } from "./in-memory-payment-order-repository.ts";

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
}

interface PaymentCallbackRow {
  payment_order_id: string;
  provider_code: string;
  callback_id: string;
  verified: boolean;
  trade_status: string;
  payload_json: Record<string, unknown>;
  settlement_status: string;
  settlement_error: string | null;
  received_at: string;
  processed_at: string | null;
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
  };
}

function toPaymentCallbackRecord(row: PaymentCallbackRow): PaymentCallbackRecord {
  return {
    paymentOrderId: row.payment_order_id,
    providerCode: row.provider_code,
    callbackId: row.callback_id,
    verified: row.verified,
    tradeStatus: row.trade_status,
    payload: row.payload_json || {},
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
    payload_json: callback.payload,
    settlement_status: callback.settlementStatus,
    settlement_error: callback.settlementError || null,
    received_at: callback.receivedAt,
    processed_at: callback.processedAt || null,
  };
}

export class PostgresPaymentOrderRepository implements PaymentOrderRepository {
  private readonly queryable: PostgresQueryable;

  constructor(queryable: PostgresQueryable) {
    this.queryable = queryable;
  }

  async findByIdempotencyKey(userId: string, idempotencyKey: string): Promise<PaymentOrderRecord | undefined> {
    const result = await this.queryable.query(
      `select *
         from payment_orders
        where user_id = $1
          and idempotency_key = $2
        limit 1`,
      [userId, idempotencyKey],
    );
    const row = result.rows[0] as PaymentOrderRow | undefined;
    return row ? toPaymentOrderRecord(row) : undefined;
  }

  async findByMerchantOrderNo(merchantOrderNo: string): Promise<PaymentOrderRecord | undefined> {
    const result = await this.queryable.query(
      `select *
         from payment_orders
        where merchant_order_no = $1
        limit 1`,
      [merchantOrderNo],
    );
    const row = result.rows[0] as PaymentOrderRow | undefined;
    return row ? toPaymentOrderRecord(row) : undefined;
  }

  async findCallbackById(callbackId: string): Promise<PaymentCallbackRecord | undefined> {
    const result = await this.queryable.query(
      `select *
         from payment_callbacks
        where callback_id = $1
        limit 1`,
      [callbackId],
    );
    const row = result.rows[0] as PaymentCallbackRow | undefined;
    return row ? toPaymentCallbackRecord(row) : undefined;
  }

  async save(order: PaymentOrderRecord): Promise<void> {
    const row = toPaymentOrderRow(order);
    await this.queryable.query(
      `insert into payment_orders (
         id,
         user_id,
         provider_code,
         merchant_order_no,
         status,
         amount,
         currency,
         credit_amount,
         idempotency_key,
         payment_url,
         return_url,
         notify_url,
         last_callback_id,
         settlement_applied_at,
         settlement_ledger_id,
         created_at,
         updated_at
       ) values (
         $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17
       )
       on conflict (id) do update
         set user_id = excluded.user_id,
             provider_code = excluded.provider_code,
             merchant_order_no = excluded.merchant_order_no,
             status = excluded.status,
             amount = excluded.amount,
             currency = excluded.currency,
             credit_amount = excluded.credit_amount,
             idempotency_key = excluded.idempotency_key,
             payment_url = excluded.payment_url,
             return_url = excluded.return_url,
             notify_url = excluded.notify_url,
             last_callback_id = excluded.last_callback_id,
             settlement_applied_at = excluded.settlement_applied_at,
             settlement_ledger_id = excluded.settlement_ledger_id,
             created_at = excluded.created_at,
             updated_at = excluded.updated_at`,
      [
        row.id,
        row.user_id,
        row.provider_code,
        row.merchant_order_no,
        row.status,
        row.amount,
        row.currency,
        row.credit_amount,
        row.idempotency_key,
        row.payment_url,
        row.return_url,
        row.notify_url,
        row.last_callback_id,
        row.settlement_applied_at,
        row.settlement_ledger_id,
        row.created_at,
        row.updated_at,
      ],
    );
  }

  async saveCallback(callback: PaymentCallbackRecord): Promise<void> {
    const row = toPaymentCallbackRow(callback);
    await this.queryable.query(
      `insert into payment_callbacks (
         payment_order_id,
         provider_code,
         callback_id,
         verified,
         trade_status,
         payload_json,
         settlement_status,
         settlement_error,
         received_at,
         processed_at
       ) values (
         $1, $2, $3, $4, $5, $6::jsonb, $7, $8, $9, $10
       )
       on conflict (callback_id) do update
         set payment_order_id = excluded.payment_order_id,
             provider_code = excluded.provider_code,
             verified = excluded.verified,
             trade_status = excluded.trade_status,
             payload_json = excluded.payload_json,
             settlement_status = excluded.settlement_status,
             settlement_error = excluded.settlement_error,
             received_at = excluded.received_at,
             processed_at = excluded.processed_at`,
      [
        row.payment_order_id,
        row.provider_code,
        row.callback_id,
        row.verified,
        row.trade_status,
        JSON.stringify(row.payload_json || {}),
        row.settlement_status,
        row.settlement_error,
        row.received_at,
        row.processed_at,
      ],
    );
  }
}

export function createPaymentOrderRepositoryFromEnv(options: {
  createPostgresRepository?: () => PaymentOrderRepository;
} = {}): PaymentOrderRepository {
  if (!hasPostgresConfig()) {
    return new InMemoryPaymentOrderRepository();
  }

  if (options.createPostgresRepository) {
    return options.createPostgresRepository();
  }

  return new PostgresPaymentOrderRepository(getSharedPostgresPool());
}
