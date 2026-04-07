import { randomUUID } from "node:crypto";

import {
  type AdminRechargeCreditsRequestDto,
  buildRequestMeta,
  type ApiErrorDetail,
  type ApiResponse,
  type DebitCreditsRequestDto,
  type ListCreditTransactionsQueryDto,
  type RefundCreditsRequestDto,
} from "../../../../../../packages/contracts/src/index.ts";
import {
  resolveAuthenticatedAdminSession,
  resolveAuthenticatedUserId,
  resolveAuthenticatedUserRole,
} from "../../../../../../packages/shared/src/index.ts";
import type { CreditAccountService } from "../application/credit-account-service.ts";

interface HttpBillingRouteResult<T> {
  statusCode: number;
  body: ApiResponse<T>;
}

function resolveUserId(headers: Record<string, string>): string | undefined {
  return resolveAuthenticatedUserId(headers);
}

function buildUnauthorizedResult<T>(
  requestId: string,
  clientVersion?: string,
): HttpBillingRouteResult<T> {
  return {
    statusCode: 401,
    body: {
      success: false,
      error: {
        code: "AUTH_REQUIRED",
        message: "Billing requests require an authenticated user context.",
      },
      meta: buildRequestMeta(requestId, clientVersion),
    },
  };
}

function isAdminRequest(headers: Record<string, string>): boolean {
  return resolveAuthenticatedUserRole(headers) === "admin";
}

function hasElevatedAdminSession(headers: Record<string, string>): boolean {
  return resolveAuthenticatedAdminSession(headers).active;
}

function buildAdminForbiddenResult<T>(
  requestId: string,
  clientVersion?: string,
): HttpBillingRouteResult<T> {
  return {
    statusCode: 403,
    body: {
      success: false,
      error: {
        code: "ADMIN_FORBIDDEN",
        message: "Admin role is required to manage billing recharges.",
      },
      meta: buildRequestMeta(requestId, clientVersion),
    },
  };
}

function buildAdminElevationRequiredResult<T>(
  requestId: string,
  clientVersion?: string,
): HttpBillingRouteResult<T> {
  return {
    statusCode: 403,
    body: {
      success: false,
      error: {
        code: "ADMIN_ELEVATION_REQUIRED",
        message: "A verified admin session is required to manage billing recharges.",
      },
      meta: buildRequestMeta(requestId, clientVersion),
    },
  };
}

export function validateDebitCreditsRequest(body: unknown): ApiErrorDetail[] {
  const details: ApiErrorDetail[] = [];

  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return [{ field: "body", reason: "Request body must be an object." }];
  }

  const candidate = body as Partial<DebitCreditsRequestDto>;

  if (!candidate.businessRefType || typeof candidate.businessRefType !== "string") {
    details.push({ field: "businessRefType", reason: "businessRefType is required." });
  }

  if (!candidate.businessRefId || typeof candidate.businessRefId !== "string") {
    details.push({ field: "businessRefId", reason: "businessRefId is required." });
  }

  if (
    typeof candidate.creditAmount !== "number"
    || !Number.isInteger(candidate.creditAmount)
    || candidate.creditAmount < 1
  ) {
    details.push({ field: "creditAmount", reason: "creditAmount must be a positive integer." });
  }

  if (!candidate.idempotencyKey || typeof candidate.idempotencyKey !== "string") {
    details.push({ field: "idempotencyKey", reason: "idempotencyKey is required." });
  }

  if (typeof candidate.modelCode !== "undefined" && typeof candidate.modelCode !== "string") {
    details.push({ field: "modelCode", reason: "modelCode must be a string when provided." });
  }

  return details;
}

export function validateRefundCreditsRequest(body: unknown): ApiErrorDetail[] {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return [{ field: "body", reason: "Request body must be an object." }];
  }

  const candidate = body as Partial<RefundCreditsRequestDto>;
  const details: ApiErrorDetail[] = [];

  if (!candidate.transactionId || typeof candidate.transactionId !== "string") {
    details.push({ field: "transactionId", reason: "transactionId is required." });
  }

  if (typeof candidate.reason !== "undefined" && typeof candidate.reason !== "string") {
    details.push({ field: "reason", reason: "reason must be a string when provided." });
  }

  return details;
}

export function validateAdminRechargeCreditsRequest(body: unknown): ApiErrorDetail[] {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return [{ field: "body", reason: "Request body must be an object." }];
  }

  const candidate = body as Partial<AdminRechargeCreditsRequestDto>;
  const details: ApiErrorDetail[] = [];

  if (!candidate.identity || typeof candidate.identity !== "string") {
    details.push({ field: "identity", reason: "identity is required." });
  }

  if (
    typeof candidate.creditAmount !== "number"
    || !Number.isInteger(candidate.creditAmount)
    || candidate.creditAmount < 1
  ) {
    details.push({ field: "creditAmount", reason: "creditAmount must be a positive integer." });
  }

  if (typeof candidate.description !== "undefined" && typeof candidate.description !== "string") {
    details.push({ field: "description", reason: "description must be a string when provided." });
  }

  return details;
}

export async function handleGetCreditBalance(
  service: CreditAccountService,
  headers: Record<string, string>,
) {
  const requestId = headers["x-request-id"] || randomUUID();
  const clientVersion = headers["x-client-version"];
  const userId = resolveUserId(headers);

  if (!userId) {
    return buildUnauthorizedResult(requestId, clientVersion);
  }

  return {
    statusCode: 200,
    body: await service.getBalance(userId, requestId, clientVersion),
  };
}

export async function handleListCreditTransactions(
  service: CreditAccountService,
  query: ListCreditTransactionsQueryDto | undefined,
  headers: Record<string, string>,
) {
  const requestId = headers["x-request-id"] || randomUUID();
  const clientVersion = headers["x-client-version"];
  const userId = resolveUserId(headers);

  if (!userId) {
    return buildUnauthorizedResult(requestId, clientVersion);
  }

  return {
    statusCode: 200,
    body: await service.listTransactions(userId, query, requestId, clientVersion),
  };
}

export async function handleDebitCredits(
  service: CreditAccountService,
  body: DebitCreditsRequestDto,
  headers: Record<string, string>,
) {
  const requestId = headers["x-request-id"] || randomUUID();
  const clientVersion = headers["x-client-version"];
  const userId = resolveUserId(headers);

  if (!userId) {
    return buildUnauthorizedResult(requestId, clientVersion);
  }

  const validationErrors = validateDebitCreditsRequest(body);
  if (validationErrors.length > 0) {
    return {
      statusCode: 400,
      body: {
        success: false,
        error: {
          code: "INVALID_REQUEST",
          message: "Debit credits request validation failed.",
          details: validationErrors,
        },
        meta: buildRequestMeta(requestId, clientVersion),
      },
    };
  }

  const result = await service.debitCredits(userId, body, requestId, clientVersion);
  if (result.success === false) {
    return {
      statusCode: 409,
      body: result,
    };
  }

  return {
    statusCode: 200,
    body: result,
  };
}

export async function handleRefundCredits(
  service: CreditAccountService,
  body: RefundCreditsRequestDto,
  headers: Record<string, string>,
) {
  const requestId = headers["x-request-id"] || randomUUID();
  const clientVersion = headers["x-client-version"];
  const userId = resolveUserId(headers);

  if (!userId) {
    return buildUnauthorizedResult(requestId, clientVersion);
  }

  const validationErrors = validateRefundCreditsRequest(body);
  if (validationErrors.length > 0) {
    return {
      statusCode: 400,
      body: {
        success: false,
        error: {
          code: "INVALID_REQUEST",
          message: "Refund credits request validation failed.",
          details: validationErrors,
        },
        meta: buildRequestMeta(requestId, clientVersion),
      },
    };
  }

  const result = await service.refundCredits(userId, body, requestId, clientVersion);
  if (result.success === false) {
    return {
      statusCode: result.error.code === "CREDIT_TRANSACTION_NOT_FOUND" ? 404 : 409,
      body: result,
    };
  }

  return {
    statusCode: 200,
    body: result,
  };
}

export async function handleAdminRechargeCredits(
  service: CreditAccountService,
  body: AdminRechargeCreditsRequestDto,
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

  const validationErrors = validateAdminRechargeCreditsRequest(body);
  if (validationErrors.length > 0) {
    return {
      statusCode: 400,
      body: {
        success: false,
        error: {
          code: "INVALID_REQUEST",
          message: "Admin recharge request validation failed.",
          details: validationErrors,
        },
        meta: buildRequestMeta(requestId, clientVersion),
      },
    };
  }

  const result = await service.adminRechargeCredits(body, userId, requestId, clientVersion);
  if (result.success === false) {
    return {
      statusCode: 409,
      body: result,
    };
  }

  return {
    statusCode: 200,
    body: result,
  };
}
