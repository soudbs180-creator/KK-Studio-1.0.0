import type { PromptNode } from '../types';

interface BuildBilledPromptNodePatchArgs {
  billingAttemptId: string;
  isCreditModel: boolean;
  paymentTransactionId?: string;
  perImageCreditCost: number;
  requiredCredits: number;
  useServerSideCreditSettlement: boolean;
}

export function buildBilledPromptNodePatch({
  billingAttemptId,
  isCreditModel,
  paymentTransactionId,
  perImageCreditCost,
  requiredCredits,
  useServerSideCreditSettlement,
}: BuildBilledPromptNodePatchArgs): Pick<
  PromptNode,
  | 'refundStatus'
  | 'billingMode'
  | 'creditCost'
  | 'creditSettlement'
  | 'billingAttemptId'
  | 'cost'
  | 'isPaymentProcessed'
  | 'paymentTransactionId'
> {
  return {
    refundStatus: undefined,
    billingMode: isCreditModel ? 'credits' : 'currency',
    creditCost: isCreditModel ? perImageCreditCost : undefined,
    creditSettlement: useServerSideCreditSettlement ? 'server' : 'client',
    billingAttemptId,
    cost: requiredCredits,
    isPaymentProcessed: Boolean(paymentTransactionId),
    paymentTransactionId,
  };
}
