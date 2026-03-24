import { BillingRouter, type BillingRequest } from "../../../../../../billing/router.ts";
import { PointsChargeHandler } from "../../../../../../billing/points/charge_points.ts";
import { TokenUsageHandler } from "../../../../../../billing/token/usage_token.ts";
import type { BillingGateway } from "../application/billing-service.ts";

export class LegacyBillingRouterAdapter implements BillingGateway {
  private readonly router: BillingRouter;

  constructor() {
    this.router = new BillingRouter(new PointsChargeHandler(), new TokenUsageHandler());
  }

  route(request: BillingRequest): Promise<unknown> {
    return this.router.route(request);
  }
}
