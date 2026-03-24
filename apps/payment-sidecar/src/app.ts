import type { RequestMeta } from "../../../packages/contracts/src/http/envelope.ts";
import { consoleLogger } from "../../../packages/shared/src/logging/logger.ts";

export type PaymentModuleLayer = "presentation" | "application" | "domain" | "infrastructure";

export interface PaymentModuleDefinition {
  name: "payment";
  description: string;
  layers: Record<PaymentModuleLayer, string>;
  currentSources: string[];
}

export const paymentModules: PaymentModuleDefinition[] = [
  {
    name: "payment",
    description: "Payment order creation, callback handling, settlement write-back, and legacy compatibility routes.",
    layers: {
      presentation: "HTTP payment routes, callback endpoints, and legacy /api/pay compatibility handlers",
      application: "payment orchestration, idempotency, callback-to-settlement flow",
      domain: "payment order state, provider status mapping, and settlement invariants",
      infrastructure: "payment order repositories and main API settlement adapters",
    },
    currentSources: [
      "payment-server/index.js",
      "payment-server/webhook.js",
      "src/components/modals/RechargeModal.tsx",
    ],
  },
];

export const paymentLogger = consoleLogger.child({ service: "apps/payment-sidecar" });

export function buildPaymentManifest(requestId: string, clientVersion?: string) {
  const meta: RequestMeta = {
    requestId,
    clientVersion,
    timestamp: new Date().toISOString(),
  };

  return {
    success: true as const,
    data: {
      service: "kk-studio-payment-sidecar",
      architecture: "sidecar",
      modules: paymentModules,
    },
    meta,
  };
}
