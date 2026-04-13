export * from "./application/billing-service.ts";
export * from "./application/credit-exchange-rate-service.ts";
export * from "./application/credit-account-service.ts";
export * from "./application/static-recharge-service.ts";
export * from "./domain/billing-auth-policy.ts";
export * from "./domain/credit-account.ts";
export * from "./domain/static-recharge.ts";
export * from "./infrastructure/file-backed-credit-account-repository.ts";
export * from "./infrastructure/file-backed-credit-exchange-rate-repository.ts";
export * from "./infrastructure/file-backed-recharge-submission-repository.ts";
export * from "./infrastructure/in-memory-credit-account-repository.ts";
export * from "./infrastructure/in-memory-credit-exchange-rate-repository.ts";
export * from "./infrastructure/in-memory-recharge-submission-repository.ts";
export * from "./infrastructure/legacy-billing-router-adapter.ts";
export * from "./infrastructure/postgres-credit-account-repository.ts";
export * from "./infrastructure/postgres-credit-exchange-rate-repository.ts";
export * from "./infrastructure/supabase-credit-account-repository.ts";
export * from "./infrastructure/supabase-credit-exchange-rate-repository.ts";
export * from "./presentation/http-billing-routes.ts";
export * from "./presentation/http-credit-exchange-rate-routes.ts";
export * from "./presentation/http-payment-settlement-routes.ts";
export * from "./presentation/http-static-recharge-routes.ts";
export * from "./presentation/mount-legacy-billing-routes.ts";

import { BillingService } from "./application/billing-service.ts";
import { LegacyBillingRouterAdapter } from "./infrastructure/legacy-billing-router-adapter.ts";

export function createLegacyBillingService(): BillingService {
  return new BillingService(new LegacyBillingRouterAdapter());
}
