import { createLegacyBillingService, mountLegacyBillingRoutes } from "../apps/api/src/modules/billing/index.ts";

export function mountBillingRoutes(app: any) {
  mountLegacyBillingRoutes(app, createLegacyBillingService());
}
