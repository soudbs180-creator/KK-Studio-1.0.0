import type {
  PaymentCallbackRecord,
  PaymentOrderRecord,
} from "../domain/payment-order.ts";

export interface PaymentOrderRepository {
  findByIdempotencyKey(userId: string, idempotencyKey: string): Promise<PaymentOrderRecord | undefined>;
  findByMerchantOrderNo(merchantOrderNo: string): Promise<PaymentOrderRecord | undefined>;
  findCallbackById(callbackId: string): Promise<PaymentCallbackRecord | undefined>;
  save(order: PaymentOrderRecord): Promise<void>;
  saveCallback(callback: PaymentCallbackRecord): Promise<void>;
}

export class InMemoryPaymentOrderRepository implements PaymentOrderRepository {
  private readonly ordersByMerchantOrderNo = new Map<string, PaymentOrderRecord>();
  private readonly ordersByIdempotencyKey = new Map<string, string>();
  private readonly callbacksById = new Map<string, PaymentCallbackRecord>();

  async findByIdempotencyKey(
    userId: string,
    idempotencyKey: string,
  ): Promise<PaymentOrderRecord | undefined> {
    const merchantOrderNo = this.ordersByIdempotencyKey.get(this.buildIdempotencyKey(userId, idempotencyKey));
    if (!merchantOrderNo) {
      return undefined;
    }

    return this.findByMerchantOrderNo(merchantOrderNo);
  }

  async findByMerchantOrderNo(merchantOrderNo: string): Promise<PaymentOrderRecord | undefined> {
    const existing = this.ordersByMerchantOrderNo.get(merchantOrderNo);
    return existing ? { ...existing } : undefined;
  }

  async findCallbackById(callbackId: string): Promise<PaymentCallbackRecord | undefined> {
    const existing = this.callbacksById.get(callbackId);
    return existing ? { ...existing, payload: { ...existing.payload } } : undefined;
  }

  async save(order: PaymentOrderRecord): Promise<void> {
    this.ordersByMerchantOrderNo.set(order.merchantOrderNo, { ...order });
    this.ordersByIdempotencyKey.set(
      this.buildIdempotencyKey(order.userId, order.idempotencyKey),
      order.merchantOrderNo,
    );
  }

  async saveCallback(callback: PaymentCallbackRecord): Promise<void> {
    this.callbacksById.set(callback.callbackId, {
      ...callback,
      payload: { ...callback.payload },
    });
  }

  private buildIdempotencyKey(userId: string, idempotencyKey: string): string {
    return `${userId}:${idempotencyKey}`;
  }
}
