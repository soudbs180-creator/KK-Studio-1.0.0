export interface ProviderManagerBusyState {
  creating: boolean;
  prefetchingPricingProviderId: string | null;
  refreshingAll: boolean;
  refreshingProviderId: string | null;
  updatingBalanceProviderId: string | null;
}

export const IDLE_PROVIDER_MANAGER_BUSY_STATE: ProviderManagerBusyState = {
  creating: false,
  prefetchingPricingProviderId: null,
  refreshingAll: false,
  refreshingProviderId: null,
  updatingBalanceProviderId: null,
};

export type ProviderManagerBusyAction =
  | { type: 'create' }
  | { type: 'refresh-all' }
  | { type: 'refresh-provider'; providerId: string }
  | { type: 'update-balance'; providerId: string }
  | { type: 'prefetch-pricing'; providerId: string };

export function startProviderManagerBusy(
  state: ProviderManagerBusyState,
  action: ProviderManagerBusyAction,
): ProviderManagerBusyState {
  switch (action.type) {
    case 'create':
      return { ...state, creating: true };
    case 'refresh-all':
      return { ...state, refreshingAll: true };
    case 'refresh-provider':
      return { ...state, refreshingProviderId: action.providerId };
    case 'update-balance':
      return { ...state, updatingBalanceProviderId: action.providerId };
    case 'prefetch-pricing':
      return { ...state, prefetchingPricingProviderId: action.providerId };
  }
}

export function finishProviderManagerBusy(
  state: ProviderManagerBusyState,
  action: ProviderManagerBusyAction,
): ProviderManagerBusyState {
  switch (action.type) {
    case 'create':
      return { ...state, creating: false };
    case 'refresh-all':
      return { ...state, refreshingAll: false };
    case 'refresh-provider':
      return state.refreshingProviderId === action.providerId
        ? { ...state, refreshingProviderId: null }
        : state;
    case 'update-balance':
      return state.updatingBalanceProviderId === action.providerId
        ? { ...state, updatingBalanceProviderId: null }
        : state;
    case 'prefetch-pricing':
      return state.prefetchingPricingProviderId === action.providerId
        ? { ...state, prefetchingPricingProviderId: null }
        : state;
  }
}

export function isAnyProviderManagerBusy(state: ProviderManagerBusyState): boolean {
  return state.creating
    || state.refreshingAll
    || Boolean(state.refreshingProviderId)
    || Boolean(state.updatingBalanceProviderId)
    || Boolean(state.prefetchingPricingProviderId);
}
