import { randomUUID } from "node:crypto";

import {
  buildRequestMeta,
  type ApiErrorDetail,
  type SupportedRechargeCurrencyDto,
  type UpsertCreditExchangeRateRequestDto,
} from "../../../../../../packages/contracts/src/index.ts";
import {
  resolveAuthenticatedAdminSession,
  resolveAuthenticatedUserId,
  resolveAuthenticatedUserRole,
} from "../../../../../../packages/shared/src/index.ts";
import type { CreditExchangeRateService } from "../application/credit-exchange-rate-service.ts";

const supportedCurrencies = new Set<SupportedRechargeCurrencyDto>(["CNY", "USD"]);

function resolveUserId(headers: Record<string, string>): string | undefined {
  return resolveAuthenticatedUserId(headers);
}

function isAdminRequest(headers: Record<string, string>): boolean {
  return resolveAuthenticatedUserRole(headers) === "admin";
}

function hasElevatedAdminSession(headers: Record<string, string>): boolean {
  return resolveAuthenticatedAdminSession(headers).active;
}

function buildUnauthorizedResult(requestId: string, clientVersion?: string) {
  return {
    statusCode: 401,
    body: {
      success: false as const,
      error: {
        code: "AUTH_REQUIRED",
        message: "Admin exchange-rate requests require an authenticated user context.",
      },
      meta: buildRequestMeta(requestId, clientVersion),
    },
  };
}

function buildAdminForbiddenResult(requestId: string, clientVersion?: string) {
  return {
    statusCode: 403,
    body: {
      success: false as const,
      error: {
        code: "ADMIN_FORBIDDEN",
        message: "Admin role is required to manage recharge exchange rates.",
      },
      meta: buildRequestMeta(requestId, clientVersion),
    },
  };
}

function buildAdminElevationRequiredResult(requestId: string, clientVersion?: string) {
  return {
    statusCode: 403,
    body: {
      success: false as const,
      error: {
        code: "ADMIN_ELEVATION_REQUIRED",
        message: "A verified admin session is required to mutate recharge exchange rates.",
      },
      meta: buildRequestMeta(requestId, clientVersion),
    },
  };
}

export function validateUpsertCreditExchangeRateRequest(body: unknown): ApiErrorDetail[] {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return [{ field: "body", reason: "Request body must be an object." }];
  }

  const candidate = body as Partial<UpsertCreditExchangeRateRequestDto>;
  const details: ApiErrorDetail[] = [];

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
    typeof candidate.creditsPerUnit !== "number"
    || !Number.isFinite(candidate.creditsPerUnit)
    || candidate.creditsPerUnit <= 0
  ) {
    details.push({
      field: "creditsPerUnit",
      reason: "creditsPerUnit must be a positive number.",
    });
  }

  if (candidate.minAmount !== null && typeof candidate.minAmount !== "undefined") {
    if (typeof candidate.minAmount !== "number" || !Number.isFinite(candidate.minAmount) || candidate.minAmount < 0) {
      details.push({
        field: "minAmount",
        reason: "minAmount must be a non-negative number or null.",
      });
    }
  }

  if (candidate.maxAmount !== null && typeof candidate.maxAmount !== "undefined") {
    if (typeof candidate.maxAmount !== "number" || !Number.isFinite(candidate.maxAmount) || candidate.maxAmount <= 0) {
      details.push({
        field: "maxAmount",
        reason: "maxAmount must be a positive number or null.",
      });
    }
  }

  if (
    typeof candidate.minAmount === "number"
    && typeof candidate.maxAmount === "number"
    && candidate.minAmount > candidate.maxAmount
  ) {
    details.push({
      field: "maxAmount",
      reason: "maxAmount must be greater than or equal to minAmount.",
    });
  }

  if (typeof candidate.isActive !== "boolean") {
    details.push({
      field: "isActive",
      reason: "isActive must be a boolean.",
    });
  }

  return details;
}

export async function handleListCreditExchangeRates(
  service: CreditExchangeRateService,
  headers: Record<string, string>,
) {
  const requestId = headers["x-request-id"] || randomUUID();
  const clientVersion = headers["x-client-version"];

  return {
    statusCode: 200,
    body: await service.listRates(requestId, clientVersion),
  };
}

export async function handleUpsertCreditExchangeRate(
  service: CreditExchangeRateService,
  body: UpsertCreditExchangeRateRequestDto,
  headers: Record<string, string>,
) {
  const requestId = headers["x-request-id"] || randomUUID();
  const clientVersion = headers["x-client-version"];
  const userId = resolveUserId(headers);

  if (!userId) {
    return buildUnauthorizedResult(requestId, clientVersion);
  }

  if (!isAdminRequest(headers)) {
    return buildAdminForbiddenResult(requestId, clientVersion);
  }

  if (!hasElevatedAdminSession(headers)) {
    return buildAdminElevationRequiredResult(requestId, clientVersion);
  }

  const validationErrors = validateUpsertCreditExchangeRateRequest(body);
  if (validationErrors.length > 0) {
    return {
      statusCode: 400,
      body: {
        success: false as const,
        error: {
          code: "INVALID_REQUEST",
          message: "Exchange-rate request validation failed.",
          details: validationErrors,
        },
        meta: buildRequestMeta(requestId, clientVersion),
      },
    };
  }

  return {
    statusCode: 200,
    body: await service.upsertRate(body, userId, requestId, clientVersion),
  };
}
