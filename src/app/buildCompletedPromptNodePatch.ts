import type { PromptNode } from '../types';

export function buildCompletedPromptNodePatch(): Pick<
  PromptNode,
  'refundStatus' | 'isPaymentProcessed' | 'paymentTransactionId' | 'error' | 'errorDetails'
> {
  return {
    refundStatus: undefined,
    isPaymentProcessed: false,
    paymentTransactionId: undefined,
    error: undefined,
    errorDetails: undefined,
  };
}
