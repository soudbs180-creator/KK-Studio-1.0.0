import { randomUUID } from "node:crypto";

import {
  buildRequestMeta,
  type ReplaceKeyManagerCloudStateRequestDto,
  type ReplaceUserApisPayloadRequestDto,
  type ApiErrorDetail,
  type ReplaceUserApiEntriesRequestDto,
} from "../../../../../../packages/contracts/src/index.ts";
import {
  resolveAuthenticatedUserEmail,
  resolveAuthenticatedUserId,
} from "../../../../../../packages/shared/src/index.ts";
import type { AuthDataService } from "../application/auth-data-service.ts";

type JsonRecord = Record<string, unknown>;

function isRecord(value: unknown): value is JsonRecord {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function validateRequiredString(
  value: unknown,
  field: string,
  details: ApiErrorDetail[],
) {
  if (typeof value !== "string" || value.trim().length === 0) {
    details.push({ field, reason: `${field.split(".").pop()} is required.` });
  }
}

function validateOptionalString(
  value: unknown,
  field: string,
  details: ApiErrorDetail[],
) {
  if (typeof value !== "undefined" && value !== null && typeof value !== "string") {
    details.push({ field, reason: `${field.split(".").pop()} must be a string when provided.` });
  }
}

function validateRequiredFiniteNumber(
  value: unknown,
  field: string,
  details: ApiErrorDetail[],
) {
  if (!isFiniteNumber(value)) {
    details.push({ field, reason: `${field.split(".").pop()} must be a finite number.` });
  }
}

function validateNullableFiniteNumber(
  value: unknown,
  field: string,
  details: ApiErrorDetail[],
) {
  if (value !== null && !isFiniteNumber(value)) {
    details.push({ field, reason: `${field.split(".").pop()} must be a finite number or null.` });
  }
}

function validateStringArray(
  value: unknown,
  field: string,
  details: ApiErrorDetail[],
) {
  if (!Array.isArray(value) || value.some((item) => typeof item !== "string")) {
    details.push({ field, reason: `${field.split(".").pop()} must be an array of strings.` });
  }
}

function validateUserApiEntry(
  entry: unknown,
  index: number,
  details: ApiErrorDetail[],
) {
  const prefix = `entries[${index}]`;
  if (!isRecord(entry)) {
    details.push({ field: prefix, reason: "Each entry must be an object." });
    return;
  }

  validateRequiredString(entry.id, `${prefix}.id`, details);
  validateRequiredString(entry.key, `${prefix}.key`, details);
  validateRequiredString(entry.name, `${prefix}.name`, details);
  validateRequiredString(entry.provider, `${prefix}.provider`, details);

  if (entry.type !== "official" && entry.type !== "proxy" && entry.type !== "third-party") {
    details.push({ field: `${prefix}.type`, reason: "type must be official, proxy, or third-party." });
  }

  if (entry.format !== "gemini" && entry.format !== "openai" && entry.format !== "auto" && entry.format !== "claude") {
    details.push({ field: `${prefix}.format`, reason: "format must be gemini, openai, auto, or claude." });
  }

  validateOptionalString(entry.baseUrl, `${prefix}.baseUrl`, details);
  validateStringArray(entry.supportedModels, `${prefix}.supportedModels`, details);

  if (typeof entry.disabled !== "boolean") {
    details.push({ field: `${prefix}.disabled`, reason: "disabled must be a boolean." });
  }

  validateRequiredFiniteNumber(entry.createdAt, `${prefix}.createdAt`, details);
  validateRequiredFiniteNumber(entry.updatedAt, `${prefix}.updatedAt`, details);

  if (entry.status !== "valid" && entry.status !== "invalid" && entry.status !== "rate_limited" && entry.status !== "unknown") {
    details.push({ field: `${prefix}.status`, reason: "status must be valid, invalid, rate_limited, or unknown." });
  }

  validateRequiredFiniteNumber(entry.failCount, `${prefix}.failCount`, details);
  validateRequiredFiniteNumber(entry.successCount, `${prefix}.successCount`, details);
  validateRequiredFiniteNumber(entry.totalCost, `${prefix}.totalCost`, details);
  validateRequiredFiniteNumber(entry.budgetLimit, `${prefix}.budgetLimit`, details);
  validateRequiredFiniteNumber(entry.tokenLimit, `${prefix}.tokenLimit`, details);
  validateRequiredFiniteNumber(entry.usedTokens, `${prefix}.usedTokens`, details);

  if (!("lastUsed" in entry)) {
    details.push({ field: `${prefix}.lastUsed`, reason: "lastUsed must be present." });
  } else {
    validateNullableFiniteNumber(entry.lastUsed, `${prefix}.lastUsed`, details);
  }

  if (!("lastError" in entry)) {
    details.push({ field: `${prefix}.lastError`, reason: "lastError must be present." });
  } else if (entry.lastError !== null && typeof entry.lastError !== "string") {
    details.push({ field: `${prefix}.lastError`, reason: "lastError must be a string or null." });
  }
}

function validateRouteRecordArray(
  value: unknown,
  field: "slots" | "providers",
  details: ApiErrorDetail[],
) {
  if (!Array.isArray(value)) {
    details.push({ field, reason: `${field} must be an array.` });
    return;
  }

  value.forEach((record, index) => {
    const prefix = `${field}[${index}]`;
    if (!isRecord(record)) {
      details.push({ field: prefix, reason: `Each ${field.slice(0, -1)} must be an object.` });
      return;
    }

    validateRequiredString(record.id, `${prefix}.id`, details);
    validateRequiredString(record[field === "slots" ? "key" : "apiKey"], `${prefix}.${field === "slots" ? "key" : "apiKey"}`, details);
    validateOptionalString(record.name, `${prefix}.name`, details);
    validateOptionalString(record.provider, `${prefix}.provider`, details);
    validateOptionalString(record.baseUrl ?? record.base_url, `${prefix}.baseUrl`, details);

    if (typeof record.format !== "undefined"
      && record.format !== "gemini"
      && record.format !== "openai"
      && record.format !== "auto"
      && record.format !== "claude") {
      details.push({ field: `${prefix}.format`, reason: "format must be gemini, openai, auto, or claude when provided." });
    }

    if (typeof record.authMethod !== "undefined" && record.authMethod !== "header" && record.authMethod !== "query") {
      details.push({ field: `${prefix}.authMethod`, reason: "authMethod must be header or query when provided." });
    }

    validateOptionalString(record.headerName, `${prefix}.headerName`, details);

    if (
      typeof record.compatibilityMode !== "undefined"
      && record.compatibilityMode !== "standard"
      && record.compatibilityMode !== "chat"
    ) {
      details.push({ field: `${prefix}.compatibilityMode`, reason: "compatibilityMode must be standard or chat when provided." });
    }

    if (typeof record.models !== "undefined") {
      validateStringArray(record.models, `${prefix}.models`, details);
    }

    if (typeof record.supportedModels !== "undefined") {
      validateStringArray(record.supportedModels, `${prefix}.supportedModels`, details);
    }
  });
}

function resolveWriteFailureStatusCode(
  response: {
    success: boolean;
    error?: { code?: string | null };
  },
): number {
  if (response.success) {
    return 200;
  }

  if (String(response.error?.code || "").trim().toUpperCase() === "CLOUD_MIRROR_FAILED") {
    return 503;
  }

  return 500;
}

function resolveUserId(headers: Record<string, string>): string | undefined {
  return resolveAuthenticatedUserId(headers);
}

function resolveUserEmail(headers: Record<string, string>): string | undefined {
  return resolveAuthenticatedUserEmail(headers);
}

function resolveBearerAccessToken(headers: Record<string, string>): string | undefined {
  const authorization = String(headers.authorization || "").trim();
  if (!authorization) {
    return undefined;
  }

  if (authorization.toLowerCase().startsWith("bearer ")) {
    return authorization.slice(7).trim() || undefined;
  }

  return authorization;
}

function buildUnauthorizedResult<T>(requestId: string, clientVersion?: string) {
  return {
    statusCode: 401,
    body: {
      success: false as const,
      error: {
        code: "AUTH_REQUIRED",
        message: "Authentication is required for profile user API storage.",
      },
      meta: buildRequestMeta(requestId, clientVersion),
    },
  };
}

export function validateReplaceUserApiEntriesRequest(body: unknown): ApiErrorDetail[] {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return [{ field: "body", reason: "Request body must be an object." }];
  }

  const candidate = body as Partial<ReplaceUserApiEntriesRequestDto>;
  if (!Array.isArray(candidate.entries)) {
    return [{ field: "entries", reason: "entries must be an array." }];
  }

  const details: ApiErrorDetail[] = [];
  candidate.entries.forEach((entry, index) => {
    validateUserApiEntry(entry, index, details);
  });

  return details;
}

export function validateReplaceUserApisPayloadRequest(body: unknown): ApiErrorDetail[] {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return [{ field: "body", reason: "Request body must be an object." }];
  }

  const candidate = body as Partial<ReplaceUserApisPayloadRequestDto>;
  const details: ApiErrorDetail[] = [];

  if (candidate.version !== undefined && (!isFiniteNumber(candidate.version) || !Number.isInteger(candidate.version) || candidate.version < 1)) {
    details.push({ field: "version", reason: "version must be a positive integer when provided." });
  }

  validateRouteRecordArray(candidate.slots, "slots", details);
  validateRouteRecordArray(candidate.providers, "providers", details);

  details.push(...validateReplaceUserApiEntriesRequest({
    entries: candidate.entries,
  }).map((detail) => ({
    ...detail,
    field: detail.field === "body" ? "entries" : detail.field,
  })));

  return details;
}

export function validateReplaceKeyManagerCloudStateRequest(body: unknown): ApiErrorDetail[] {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return [{ field: "body", reason: "Request body must be an object." }];
  }

  const candidate = body as Partial<ReplaceKeyManagerCloudStateRequestDto>;
  const details: ApiErrorDetail[] = [];

  validateRouteRecordArray(candidate.slots, "slots", details);

  if (candidate.providers !== undefined) {
    validateRouteRecordArray(candidate.providers, "providers", details);
  }

  if (candidate.version !== undefined && (!isFiniteNumber(candidate.version) || !Number.isInteger(candidate.version) || candidate.version < 1)) {
    details.push({ field: "version", reason: "version must be a positive integer when provided." });
  }

  return details;
}

export async function handleGetUserApiEntries(
  service: AuthDataService,
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
    body: await service.listUserApiEntries(
      userId,
      resolveUserEmail(headers),
      requestId,
      clientVersion,
      resolveBearerAccessToken(headers),
    ),
  };
}

export async function handleReplaceUserApiEntries(
  service: AuthDataService,
  body: ReplaceUserApiEntriesRequestDto,
  headers: Record<string, string>,
) {
  const requestId = headers["x-request-id"] || randomUUID();
  const clientVersion = headers["x-client-version"];
  const userId = resolveUserId(headers);

  if (!userId) {
    return buildUnauthorizedResult(requestId, clientVersion);
  }

  const validationErrors = validateReplaceUserApiEntriesRequest(body);
  if (validationErrors.length > 0) {
    return {
      statusCode: 400,
      body: {
        success: false as const,
        error: {
          code: "INVALID_REQUEST",
          message: "User API entries request validation failed.",
          details: validationErrors,
        },
        meta: buildRequestMeta(requestId, clientVersion),
      },
    };
  }

  const response = await service.replaceUserApiEntries(
    userId,
    resolveUserEmail(headers),
    body,
    requestId,
    clientVersion,
    resolveBearerAccessToken(headers),
  );

  return {
    statusCode: resolveWriteFailureStatusCode(response),
    body: response,
  };
}

export async function handleReplaceUserApisPayload(
  service: AuthDataService,
  body: ReplaceUserApisPayloadRequestDto,
  headers: Record<string, string>,
) {
  const requestId = headers["x-request-id"] || randomUUID();
  const clientVersion = headers["x-client-version"];
  const userId = resolveUserId(headers);

  if (!userId) {
    return buildUnauthorizedResult(requestId, clientVersion);
  }

  const validationErrors = validateReplaceUserApisPayloadRequest(body);
  if (validationErrors.length > 0) {
    return {
      statusCode: 400,
      body: {
        success: false as const,
        error: {
          code: "INVALID_REQUEST",
          message: "User API payload request validation failed.",
          details: validationErrors,
        },
        meta: buildRequestMeta(requestId, clientVersion),
      },
    };
  }

  const response = await service.replaceUserApisPayload(
    userId,
    resolveUserEmail(headers),
    body,
    requestId,
    clientVersion,
    resolveBearerAccessToken(headers),
  );

  return {
    statusCode: resolveWriteFailureStatusCode(response),
    body: response,
  };
}

export async function handleGetKeyManagerCloudState(
  service: AuthDataService,
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
    body: await service.getKeyManagerCloudState(
      userId,
      resolveUserEmail(headers),
      requestId,
      clientVersion,
      resolveBearerAccessToken(headers),
    ),
  };
}

export async function handleReplaceKeyManagerCloudState(
  service: AuthDataService,
  body: ReplaceKeyManagerCloudStateRequestDto,
  headers: Record<string, string>,
) {
  const requestId = headers["x-request-id"] || randomUUID();
  const clientVersion = headers["x-client-version"];
  const userId = resolveUserId(headers);

  if (!userId) {
    return buildUnauthorizedResult(requestId, clientVersion);
  }

  const validationErrors = validateReplaceKeyManagerCloudStateRequest(body);
  if (validationErrors.length > 0) {
    return {
      statusCode: 400,
      body: {
        success: false as const,
        error: {
          code: "INVALID_REQUEST",
          message: "Key manager state request validation failed.",
          details: validationErrors,
        },
        meta: buildRequestMeta(requestId, clientVersion),
      },
    };
  }

  const response = await service.replaceKeyManagerCloudState(
    userId,
    resolveUserEmail(headers),
    body,
    requestId,
    clientVersion,
    resolveBearerAccessToken(headers),
  );

  return {
    statusCode: resolveWriteFailureStatusCode(response),
    body: response,
  };
}

export async function handleCreateTempUser(
  service: AuthDataService,
  headers: Record<string, string>,
) {
  const requestId = headers["x-request-id"] || randomUUID();
  const clientVersion = headers["x-client-version"];

  return {
    statusCode: 201,
    body: await service.createTempUser(headers["user-agent"], requestId, clientVersion),
  };
}
