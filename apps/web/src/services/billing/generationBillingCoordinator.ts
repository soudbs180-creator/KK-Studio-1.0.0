export interface GenerationBillingAttempt {
  attemptId: string;
  businessRefId: string;
  idempotencyKey: string;
}

export interface GenerationBillingAttemptOptions {
  nodeId: string;
  scope?: 'initial' | 'retry' | 'ppt-single';
  phase?: 'initial' | 'retry' | 'ppt-single';
  pageIndex?: number;
  attemptId?: string;
  now?: number;
  nonce?: string;
}

export interface GenerationAttemptBillingTarget {
  id: string;
  billingMode?: 'credits' | 'currency';
  creditSettlement?: 'client' | 'server';
  isPaymentProcessed?: boolean;
  paymentTransactionId?: string;
  refundStatus?: 'pending' | 'success' | 'failed';
  cost?: number;
}

export interface GenerationAttemptBillingFailureState {
  refundStatus: GenerationAttemptBillingTarget['refundStatus'];
  isPaymentProcessed: boolean | undefined;
  paymentTransactionId: string | undefined;
}

export interface CreditRefundLikeResult {
  success: boolean;
  newBalance?: number;
  message: string;
}

function buildAttemptNonce(): string {
  const randomUuid = globalThis.crypto?.randomUUID?.();
  if (typeof randomUuid === 'string' && randomUuid.trim().length > 0) {
    return randomUuid.trim();
  }

  return Math.random().toString(36).slice(2, 10);
}

export function buildGenerationAttemptIdempotencyKey(attemptId: string): string {
  const normalizedAttemptId = String(attemptId || '').trim() || 'generation:unknown';
  return `credit-debit:${normalizedAttemptId}`;
}

export function buildGenerationBillingAttempt(
  options: GenerationBillingAttemptOptions,
): GenerationBillingAttempt {
  const explicitAttemptId = String(options.attemptId || '').trim();
  const nodeId = String(options.nodeId || '').trim() || 'unknown-node';

  const attemptId = explicitAttemptId || [
    'generation',
    String(options.scope || options.phase || 'initial').trim() || 'initial',
    nodeId,
    typeof options.pageIndex === 'number' && Number.isFinite(options.pageIndex)
      ? `p${Math.max(0, Math.trunc(options.pageIndex))}`
      : undefined,
    Number.isFinite(options.now) ? Math.trunc(options.now as number) : Date.now(),
    String(options.nonce || '').trim() || buildAttemptNonce(),
  ]
    .filter((part): part is string | number => (typeof part === 'string' ? part.length > 0 : true))
    .join(':');

  return {
    attemptId,
    businessRefId: attemptId,
    idempotencyKey: buildGenerationAttemptIdempotencyKey(attemptId),
  };
}

export function buildGenerationAttemptRequestId(attemptId: string, index: number): string {
  const normalizedAttemptId = String(attemptId || '').trim() || 'generation:unknown';
  const normalizedIndex = Number.isFinite(index) ? Math.max(0, Math.trunc(index)) : 0;
  return `${normalizedAttemptId}:${normalizedIndex}`;
}

export async function resolveGenerationAttemptFailureState(
  target: GenerationAttemptBillingTarget,
  dependencies: {
    refundCreditsByTransaction: (transactionId: string, reason: string) => Promise<CreditRefundLikeResult>;
    refreshBilling: () => Promise<void>;
  },
  options?: { forceServerRefundFailure?: boolean },
): Promise<GenerationAttemptBillingFailureState> {
  const refundableTransactionId = String(target.paymentTransactionId || '').trim();
  const shouldRefundCurrentAttempt =
    target.billingMode === 'credits'
    && target.creditSettlement === 'client'
    && target.isPaymentProcessed === true
    && refundableTransactionId.length > 0;
  const shouldRefreshServerSideAttempt =
    target.billingMode === 'credits'
    && target.creditSettlement === 'server'
    && Number(target.cost || 0) > 0;

  let refundStatus = target.refundStatus;
  let isPaymentProcessed = target.isPaymentProcessed;
  let paymentTransactionId = refundableTransactionId || undefined;

  if (shouldRefundCurrentAttempt) {
    const refundResult = await dependencies.refundCreditsByTransaction(
      refundableTransactionId,
      `退款 ${target.id}`,
    );
    refundStatus = refundResult.success ? 'success' : 'failed';
    if (refundResult.success) {
      isPaymentProcessed = false;
      paymentTransactionId = undefined;
    }
  } else if (shouldRefreshServerSideAttempt) {
    if (options?.forceServerRefundFailure) {
      refundStatus = 'failed';
    } else {
      try {
        await dependencies.refreshBilling();
        refundStatus = 'success';
      } catch {
        refundStatus = 'failed';
      }
    }
  }

  return {
    refundStatus,
    isPaymentProcessed,
    paymentTransactionId,
  };
}
