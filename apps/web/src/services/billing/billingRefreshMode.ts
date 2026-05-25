export interface BillingRefreshModeInput {
  hasVisibleBillingSeed: boolean;
  silent: boolean;
}

export interface BillingRefreshMode {
  markRefreshing: boolean;
  showBlockingLoading: boolean;
}

export function resolveBillingRefreshMode(
  input: BillingRefreshModeInput,
): BillingRefreshMode {
  if (input.silent) {
    return {
      markRefreshing: true,
      showBlockingLoading: false,
    };
  }

  return {
    markRefreshing: false,
    showBlockingLoading: !input.hasVisibleBillingSeed,
  };
}
