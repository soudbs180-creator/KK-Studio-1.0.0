import { randomUUID } from "node:crypto";

import {
  buildRequestMeta,
  type ApiErrorDetail,
  type ApplyPaymentSettlementRequestDto,
} from "../../../../../../packages/contracts/src/index.ts";
import type { CreditAccountService } from "../application/credit-account-service.ts";

function isInternalSettlementRequest(headers: Record<string, string>): boolean {
  const configuredToken = String(process.env.PAYMENT_SIDECAR_INTERNAL_TOKEN || "").trim();
  if (!configuredToken) {
    return false;
  }

  const headerToken = String(headers["x-internal-token"] || "").trim();
  const authorization = String(headers.authorization || "").trim();
  const bearerToken = authorization.toLowerCase().startsWith("bearer ")
    ? authorization.slice(7).trim()
    : "";

  return headerToken === configuredToken || bearerToken === configuredToken;
}

export function validateApplyPaymentSettlementRequest(body: unknown): ApiErrorDetail[] {
  const details: ApiErrorDetail[] = [];
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return [{ field: "body", reason: "Request body must be an object." }];
  }

  const candidate = body as Partial<ApplyPaymentSettlementRequestDto>;
  if (!candidate.paymentOrderId || typeof candidate.paymentOrderId !== "string") {
    details.push({ field: "paymentOrderId", reason: "paymentOrderId is required." });
  }
  if (!candidate.merchantOrderNo || typeof candidate.merchantOrderNo !== "string") {
    details.push({ field: "merchantOrderNo", reason: "merchantOrderNo is required." });
  }
  if (!candidate.userId || typeof candidate.userId !== "string") {
    details.push({ field: "userId", reason: "userId is required." });
  }
  if (!candidate.providerCode || typeof candidate.providerCode !== "string") {
    details.push({ field: "providerCode", reason: "providerCode is required." });
  }
  if (!candidate.callbackId || typeof candidate.callbackId !== "string") {
    details.push({ field: "callbackId", reason: "callbackId is required." });
  }
  if (typeof candidate.creditAmount !== "number" || candidate.creditAmount < 1) {
    details.push({ field: "creditAmount", reason: "creditAmount must be a positive number." });
  }
  if (!candidate.amount || typeof candidate.amount !== "object") {
    details.push({ field: "amount", reason: "amount is required." });
  } else {
    if (!candidate.amount.amount || typeof candidate.amount.amount !== "string") {
      details.push({ field: "amount.amount", reason: "amount.amount is required." });
    }
    if (!candidate.amount.currency || typeof candidate.amount.currency !== "string") {
      details.push({ field: "amount.currency", reason: "amount.currency is required." });
    }
  }

  return details;
}

export async function handleApplyPaymentSettlement(
  service: CreditAccountService,
  body: ApplyPaymentSettlementRequestDto,
  headers: Record<string, string>,
) {
  const requestId = headers["x-request-id"] || randomUUID();
  const clientVersion = headers["x-client-version"];

  if (!isInternalSettlementRequest(headers)) {
    return {
      statusCode: 401,
      body: {
        success: false as const,
        error: {
          code: "INTERNAL_AUTH_REQUIRED",
          message: "Valid internal settlement credentials are required.",
        },
        meta: buildRequestMeta(requestId, clientVersion),
      },
    };
  }

  const validationErrors = validateApplyPaymentSettlementRequest(body);
  if (validationErrors.length > 0) {
    return {
      statusCode: 400,
      body: {
        success: false as const,
        error: {
          code: "INVALID_REQUEST",
          message: "Payment settlement request validation failed.",
          details: validationErrors,
        },
        meta: buildRequestMeta(requestId, clientVersion),
      },
    };
  }

  const result = await service.applyPaymentSettlement(body, requestId, clientVersion);
  return {
    statusCode: 200,
    body: result,
  };
}
