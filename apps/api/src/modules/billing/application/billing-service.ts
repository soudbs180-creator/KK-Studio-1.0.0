import { consoleLogger } from "../../../../../../packages/shared/src/index.ts";

export interface BillingGateway {
  route(request: { headers: Record<string, string>; body: unknown }): Promise<unknown>;
}

export interface BillingExecutionResult {
  statusCode: number;
  body: {
    success: boolean;
    data?: unknown;
    error?: string;
  };
}

export class BillingService {
  private readonly logger = consoleLogger.child({ module: "billing" });
  private readonly gateway: BillingGateway;

  constructor(gateway: BillingGateway) {
    this.gateway = gateway;
  }

  async route(body: unknown, headers: Record<string, string>): Promise<BillingExecutionResult> {
    try {
      const result = await this.gateway.route({
        headers,
        body,
      });

      this.logger.info("Billing request routed by migrated billing module", {
        mode: (body as any)?.billing_mode,
        providerId: headers["x-provider-id"] || headers["X-Provider-Id"] || (body as any)?.provider_id,
      });

      return {
        statusCode: 200,
        body: {
          success: true,
          data: result,
        },
      };
    } catch (error: any) {
      return {
        statusCode: 400,
        body: {
          success: false,
          error: error?.message || String(error),
        },
      };
    }
  }
}
