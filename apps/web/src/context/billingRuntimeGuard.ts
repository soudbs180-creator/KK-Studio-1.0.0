import { KKAI_FEATURE_FLAGS } from '../app/kkaiFeatureFlags.ts';

export const BILLING_DISABLED_MESSAGE = 'Billing disabled in current runtime';

export interface BillingRuntimeGuard {
  billingEnabled: boolean;
  activeBillingUserId: string | null;
  shouldBootstrapBilling: boolean;
}

export function createBillingRuntimeGuard(input: {
  userId: string | null | undefined;
  isTempUser: boolean;
  hasSession: boolean;
}): BillingRuntimeGuard {
  const userId = String(input.userId || '').trim();
  const billingEnabled = KKAI_FEATURE_FLAGS.billing;
  const activeBillingUserId = billingEnabled && userId && !input.isTempUser && input.hasSession
    ? userId
    : null;

  return {
    billingEnabled,
    activeBillingUserId,
    shouldBootstrapBilling: Boolean(activeBillingUserId),
  };
}

export function createBillingDisabledConsumeResult(_count: number): {
  success: true;
  message: string;
} {
  return {
    success: true,
    message: BILLING_DISABLED_MESSAGE,
  };
}

export function createBillingDisabledRefundResult(): {
  success: true;
  message: string;
} {
  return {
    success: true,
    message: BILLING_DISABLED_MESSAGE,
  };
}
