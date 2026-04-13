import { randomUUID } from "node:crypto";

import {
  buildRequestMeta,
  type ApiErrorDetail,
  type RechargePaymentChannelDto,
  type SubmitRechargeRequestDto,
  type SupportedRechargeCurrencyDto,
} from "../../../../../../packages/contracts/src/index.ts";
import { resolveAuthenticatedUserId } from "../../../../../../packages/shared/src/index.ts";
import type { StaticRechargeService } from "../application/static-recharge-service.ts";

const supportedCurrencies = new Set<SupportedRechargeCurrencyDto>(["CNY", "USD"]);
const supportedPaymentChannels = new Set<RechargePaymentChannelDto>([
  "alipay",
  "wechat",
  "paypal",
  "bank",
  "manual",
]);

function buildUnauthorizedResult(requestId: string, clientVersion?: string) {
  return {
    statusCode: 401,
    body: {
      success: false as const,
      error: {
        code: "AUTH_REQUIRED",
        message: "Recharge submissions require an authenticated user context.",
      },
      meta: buildRequestMeta(requestId, clientVersion),
    },
  };
}

export function validateSubmitRechargeRequest(body: unknown): ApiErrorDetail[] {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return [{ field: "body", reason: "Request body must be an object." }];
  }

  const candidate = body as Partial<SubmitRechargeRequestDto>;
  const details: ApiErrorDetail[] = [];

  if (typeof candidate.amount !== "number" || !Number.isFinite(candidate.amount) || candidate.amount <= 0) {
    details.push({
      field: "amount",
      reason: "amount must be a positive number.",
    });
  }

  if (
    !candidate.currencyCode
    || typeof candidate.currencyCode !== "string"
    || !supportedCurrencies.has(candidate.currencyCode as SupportedRechargeCurrencyDto)
  ) {
    details.push({
      field: "currencyCode",
      reason: `currencyCode must be one of: ${Array.from(supportedCurrencies).join(", ")}.`,
    });
  }

  if (
    !candidate.paymentChannel
    || typeof candidate.paymentChannel !== "string"
    || !supportedPaymentChannels.has(candidate.paymentChannel as RechargePaymentChannelDto)
  ) {
    details.push({
      field: "paymentChannel",
      reason: `paymentChannel must be one of: ${Array.from(supportedPaymentChannels).join(", ")}.`,
    });
  }

  if (
    !candidate.transferReferenceLast4
    || typeof candidate.transferReferenceLast4 !== "string"
    || !/^\d{4}$/.test(candidate.transferReferenceLast4)
  ) {
    details.push({
      field: "transferReferenceLast4",
      reason: "transferReferenceLast4 must be a four-digit string.",
    });
  }

  if (typeof candidate.note !== "undefined" && typeof candidate.note !== "string") {
    details.push({
      field: "note",
      reason: "note must be a string when provided.",
    });
  }

  return details;
}

export async function handleSubmitRecharge(
  service: StaticRechargeService,
  body: SubmitRechargeRequestDto,
  headers: Record<string, string>,
) {
  const requestId = headers["x-request-id"] || randomUUID();
  const clientVersion = headers["x-client-version"];
  const userId = resolveAuthenticatedUserId(headers);

  if (!userId) {
    return buildUnauthorizedResult(requestId, clientVersion);
  }

  const validationErrors = validateSubmitRechargeRequest(body);
  if (validationErrors.length > 0) {
    return {
      statusCode: 400,
      body: {
        success: false as const,
        error: {
          code: "INVALID_REQUEST",
          message: "Recharge submission validation failed.",
          details: validationErrors,
        },
        meta: buildRequestMeta(requestId, clientVersion),
      },
    };
  }

  const result = await service.submitRecharge(userId, body, requestId, clientVersion);
  if (result.success === false) {
    return {
      statusCode: result.error.code === "RECHARGE_CONFIG_UNAVAILABLE" ? 409 : 400,
      body: result,
    };
  }

  return {
    statusCode: 200,
    body: result,
  };
}
