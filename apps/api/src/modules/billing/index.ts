export * from "./application/billing-service.ts";
export * from "./application/credit-account-service.ts";
export * from "./domain/billing-auth-policy.ts";
export * from "./domain/credit-account.ts";
export * from "./infrastructure/in-memory-credit-account-repository.ts";
export * from "./infrastructure/legacy-billing-router-adapter.ts";
export * from "./infrastructure/supabase-credit-account-repository.ts";
export * from "./presentation/http-billing-routes.ts";
export * from "./presentation/http-payment-settlement-routes.ts";
export * from "./presentation/mount-legacy-billing-routes.ts";

import { BillingService } from "./application/billing-service.ts";
import { LegacyBillingRouterAdapter } from "./infrastructure/legacy-billing-router-adapter.ts";

export function createLegacyBillingService(): BillingService {
  return new BillingService(new LegacyBillingRouterAdapter());
}
