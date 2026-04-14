import { randomUUID } from "node:crypto";

import {
  buildRequestMeta,
  type ApiErrorDetail,
  type CreateRechargeSubmissionRequestDto,
  type CreateRechargeSubmissionResponseDto,
  type GetAdminRechargeSubmissionResponseDto,
  type RechargePaymentChannelDto,
  type ReviewRechargeSubmissionRequestDto,
  type ReviewRechargeSubmissionResponseDto,
  type SubmitRechargeProofRequestDto,
  type SubmitRechargeProofResponseDto,
  type SubmitRechargeRequestDto,
  type SubmitRechargeResponseDto,
  type SupportedRechargeCurrencyDto,
} from "../../../../../../packages/contracts/src/index.ts";
import {
  resolveAuthenticatedAdminSession,
  resolveAuthenticatedUserId,
  resolveAuthenticatedUserRole,
} from "../../../../../../packages/shared/src/index.ts";
import type { StaticRechargeService } from "../application/static-recharge-service.ts";

const supportedCurrencies = new Set<SupportedRechargeCurrencyDto>(["CNY", "USD"]);
const supportedPaymentChannels = new Set<RechargePaymentChannelDto>([
  "alipay",
  "wechat",
  "paypal",
  "bank",
  "manual",
]);
const supportedReviewDecisions = new Set(["credit", "reject"]);

function isRechargeReferenceTail(value: string): boolean {
  return /^[0-9A-Z]{4}$/.test(value);
}

function mapRechargeFailureStatus(errorCode?: string): number {
  switch (String(errorCode || "").trim().toUpperCase()) {
    case "RECHARGE_SUBMISSION_NOT_FOUND":
      return 404;
    case "RECHARGE_SUBMISSION_FORBIDDEN":
      return 403;
    case "RECHARGE_CONFIG_UNAVAILABLE":
      return 409;
    case "RECHARGE_AMOUNT_OUT_OF_RANGE":
    case "RECHARGE_SUBMISSION_NOT_CREATED":
    case "RECHARGE_SUBMISSION_NOT_PENDING":
      return 409;
    default:
      return 400;
  }
}

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

function isAdminRequest(headers: Record<string, string>): boolean {
  return resolveAuthenticatedUserRole(headers) === "admin";
}

function hasElevatedAdminSession(headers: Record<string, string>): boolean {
  return resolveAuthenticatedAdminSession(headers).active;
}

function buildAdminForbiddenResult(requestId: string, clientVersion?: string) {
  return {
    statusCode: 403,
    body: {
      success: false as const,
      error: {
        code: "ADMIN_FORBIDDEN",
        message: "Admin role is required to manage recharge submissions.",
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
        message: "A verified admin session is required to review recharge submissions.",
      },
      meta: buildRequestMeta(requestId, clientVersion),
    },
  };
}

export function validateCreateRechargeSubmissionRequest(body: unknown): ApiErrorDetail[] {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return [{ field: "body", reason: "Request body must be an object." }];
  }

  const candidate = body as Partial<CreateRechargeSubmissionRequestDto>;
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

  if (typeof candidate.note !== "undefined" && typeof candidate.note !== "string") {
    details.push({
      field: "note",
      reason: "note must be a string when provided.",
    });
  }

  return details;
}

export function validateSubmitRechargeProofRequest(body: unknown): ApiErrorDetail[] {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return [{ field: "body", reason: "Request body must be an object." }];
  }

  const candidate = body as Partial<SubmitRechargeProofRequestDto>;
  const details: ApiErrorDetail[] = [];

  if (
    !candidate.transferReferenceLast4
    || typeof candidate.transferReferenceLast4 !== "string"
    || !isRechargeReferenceTail(candidate.transferReferenceLast4.trim().toUpperCase())
  ) {
    details.push({
      field: "transferReferenceLast4",
      reason: "transferReferenceLast4 must be a four-character alphanumeric string.",
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

export function validateSubmitRechargeRequest(body: unknown): ApiErrorDetail[] {
  return [
    ...validateCreateRechargeSubmissionRequest(body),
    ...validateSubmitRechargeProofRequest(body),
  ];
}

export function validateReviewRechargeSubmissionRequest(body: unknown): ApiErrorDetail[] {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return [{ field: "body", reason: "Request body must be an object." }];
  }

  const candidate = body as Partial<ReviewRechargeSubmissionRequestDto>;
  const details: ApiErrorDetail[] = [];

  if (
    !candidate.decision
    || typeof candidate.decision !== "string"
    || !supportedReviewDecisions.has(candidate.decision)
  ) {
    details.push({
      field: "decision",
      reason: "decision must be either credit or reject.",
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

export async function handleCreateRechargeSubmission(
  service: StaticRechargeService,
  body: CreateRechargeSubmissionRequestDto,
  headers: Record<string, string>,
) {
  const requestId = headers["x-request-id"] || randomUUID();
  const clientVersion = headers["x-client-version"];
  const userId = resolveAuthenticatedUserId(headers);

  if (!userId) {
    return buildUnauthorizedResult(requestId, clientVersion);
  }

  const validationErrors = validateCreateRechargeSubmissionRequest(body);
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

  const result = await service.createRechargeSubmission(userId, body, requestId, clientVersion);
  return {
    statusCode: result.success ? 200 : mapRechargeFailureStatus(result.error.code),
    body: result,
  };
}

export async function handleSubmitRechargeProof(
  service: StaticRechargeService,
  submissionId: string,
  body: SubmitRechargeProofRequestDto,
  headers: Record<string, string>,
) {
  const requestId = headers["x-request-id"] || randomUUID();
  const clientVersion = headers["x-client-version"];
  const userId = resolveAuthenticatedUserId(headers);

  if (!userId) {
    return buildUnauthorizedResult(requestId, clientVersion);
  }

  const validationErrors = validateSubmitRechargeProofRequest(body);
  if (validationErrors.length > 0) {
    return {
      statusCode: 400,
      body: {
        success: false as const,
        error: {
          code: "INVALID_REQUEST",
          message: "Recharge proof validation failed.",
          details: validationErrors,
        },
        meta: buildRequestMeta(requestId, clientVersion),
      },
    };
  }

  const result = await service.submitRechargeProof(userId, submissionId, body, requestId, clientVersion);
  return {
    statusCode: result.success ? 200 : mapRechargeFailureStatus(result.error.code),
    body: result,
  };
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

export async function handleGetAdminRechargeSubmission(
  service: StaticRechargeService,
  submissionId: string,
  headers: Record<string, string>,
) {
  const requestId = headers["x-request-id"] || randomUUID();
  const clientVersion = headers["x-client-version"];
  const userId = resolveAuthenticatedUserId(headers);

  if (!userId) {
    return buildUnauthorizedResult(requestId, clientVersion);
  }

  if (!hasElevatedAdminSession(headers)) {
    return buildAdminElevationRequiredResult(requestId, clientVersion);
  }

  if (!isAdminRequest(headers)) {
    return buildAdminForbiddenResult(requestId, clientVersion);
  }

  const result = await service.getAdminRechargeSubmission(submissionId, requestId, clientVersion);
  return {
    statusCode: result.success ? 200 : mapRechargeFailureStatus(result.error.code),
    body: result,
  };
}

export async function handleReviewRechargeSubmission(
  service: StaticRechargeService,
  submissionId: string,
  body: ReviewRechargeSubmissionRequestDto,
  headers: Record<string, string>,
) {
  const requestId = headers["x-request-id"] || randomUUID();
  const clientVersion = headers["x-client-version"];
  const userId = resolveAuthenticatedUserId(headers);

  if (!userId) {
    return buildUnauthorizedResult(requestId, clientVersion);
  }

  if (!hasElevatedAdminSession(headers)) {
    return buildAdminElevationRequiredResult(requestId, clientVersion);
  }

  if (!isAdminRequest(headers)) {
    return buildAdminForbiddenResult(requestId, clientVersion);
  }

  const validationErrors = validateReviewRechargeSubmissionRequest(body);
  if (validationErrors.length > 0) {
    return {
      statusCode: 400,
      body: {
        success: false as const,
        error: {
          code: "INVALID_REQUEST",
          message: "Recharge review validation failed.",
          details: validationErrors,
        },
        meta: buildRequestMeta(requestId, clientVersion),
      },
    };
  }

  const result = await service.reviewRechargeSubmission(
    submissionId,
    body,
    userId,
    requestId,
    clientVersion,
  );
  return {
    statusCode: result.success ? 200 : mapRechargeFailureStatus(result.error.code),
    body: result,
  };
}
