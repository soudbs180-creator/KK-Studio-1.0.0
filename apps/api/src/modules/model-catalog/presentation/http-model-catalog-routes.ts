import { randomUUID } from "node:crypto";

import {
  ModelAvailability,
  buildRequestMeta,
  type ApiErrorDetail,
  type CreateAdminModelRequestDto,
  type ModelKind,
} from "../../../../../../packages/contracts/src/index.ts";
import {
  resolveAuthenticatedAdminSession,
  resolveAuthenticatedUserId,
  resolveAuthenticatedUserRole,
} from "../../../../../../packages/shared/src/index.ts";
import type { ModelCatalogService } from "../application/model-catalog-service.ts";

const supportedModelKinds = new Set<ModelKind>(["chat", "image", "video", "audio", "embedding"]);
const supportedAvailability = new Set<string>(Object.values(ModelAvailability));

function isAdminRequest(headers: Record<string, string>): boolean {
  return resolveAuthenticatedUserRole(headers) === "admin";
}

function hasElevatedAdminSession(headers: Record<string, string>): boolean {
  return resolveAuthenticatedAdminSession(headers).active;
}

function resolveUserId(headers: Record<string, string>): string | undefined {
  return resolveAuthenticatedUserId(headers);
}

export function validateCreateAdminModelRequest(body: unknown): ApiErrorDetail[] {
  const details: ApiErrorDetail[] = [];

  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return [{ field: "body", reason: "Request body must be an object." }];
  }

  const candidate = body as Partial<CreateAdminModelRequestDto>;

  if (!candidate.modelCode || typeof candidate.modelCode !== "string") {
    details.push({ field: "modelCode", reason: "modelCode is required." });
  }

  if (!candidate.displayName || typeof candidate.displayName !== "string") {
    details.push({ field: "displayName", reason: "displayName is required." });
  }

  if (!candidate.kind || typeof candidate.kind !== "string" || !supportedModelKinds.has(candidate.kind as ModelKind)) {
    details.push({
      field: "kind",
      reason: `kind must be one of: ${Array.from(supportedModelKinds).join(", ")}.`,
    });
  }

  if (
    !candidate.availability
    || typeof candidate.availability !== "string"
    || !supportedAvailability.has(candidate.availability)
  ) {
    details.push({
      field: "availability",
      reason: `availability must be one of: ${Array.from(supportedAvailability).join(", ")}.`,
    });
  }

  if (typeof candidate.billingMode !== "undefined" && candidate.billingMode !== "credits" && candidate.billingMode !== "currency") {
    details.push({ field: "billingMode", reason: "billingMode must be credits or currency when provided." });
  }

  if (
    typeof candidate.defaultCreditCost !== "undefined"
    && (typeof candidate.defaultCreditCost !== "number" || candidate.defaultCreditCost < 0)
  ) {
    details.push({ field: "defaultCreditCost", reason: "defaultCreditCost must be a non-negative number when provided." });
  }

  return details;
}

export async function handleListModels(
  service: ModelCatalogService,
  kind: string | undefined,
  headers: Record<string, string>,
) {
  const requestId = headers["x-request-id"] || randomUUID();
  const clientVersion = headers["x-client-version"];

  if (typeof kind !== "undefined" && !supportedModelKinds.has(kind as ModelKind)) {
    return {
      statusCode: 400,
      body: {
        success: false as const,
        error: {
          code: "INVALID_REQUEST",
          message: "Model list request validation failed.",
          details: [{ field: "kind", reason: `kind must be one of: ${Array.from(supportedModelKinds).join(", ")}.` }],
        },
        meta: buildRequestMeta(requestId, clientVersion),
      },
    };
  }

  return {
    statusCode: 200,
    body: await service.listModels(kind as ModelKind | undefined, requestId, clientVersion),
  };
}

export async function handleCreateAdminModel(
  service: ModelCatalogService,
  body: CreateAdminModelRequestDto,
  headers: Record<string, string>,
) {
  const requestId = headers["x-request-id"] || randomUUID();
  const clientVersion = headers["x-client-version"];
  const userId = resolveUserId(headers);

  if (!userId) {
    return {
      statusCode: 401,
      body: {
        success: false as const,
        error: {
          code: "AUTH_REQUIRED",
          message: "Admin model requests require an authenticated user context.",
        },
        meta: buildRequestMeta(requestId, clientVersion),
      },
    };
  }

  if (!isAdminRequest(headers)) {
    return {
      statusCode: 403,
      body: {
        success: false as const,
        error: {
          code: "ADMIN_FORBIDDEN",
          message: "Admin role is required to manage model catalog items.",
        },
        meta: buildRequestMeta(requestId, clientVersion),
      },
    };
  }

  if (!hasElevatedAdminSession(headers)) {
    return {
      statusCode: 403,
      body: {
        success: false as const,
        error: {
          code: "ADMIN_ELEVATION_REQUIRED",
          message: "A verified admin session is required to manage model catalog items.",
        },
        meta: buildRequestMeta(requestId, clientVersion),
      },
    };
  }

  const validationErrors = validateCreateAdminModelRequest(body);
  if (validationErrors.length > 0) {
    return {
      statusCode: 400,
      body: {
        success: false as const,
        error: {
          code: "INVALID_REQUEST",
          message: "Admin model request validation failed.",
          details: validationErrors,
        },
        meta: buildRequestMeta(requestId, clientVersion),
      },
    };
  }

  const result = await service.createAdminModel(body, userId, requestId, clientVersion);
  return {
    statusCode: result.success ? 201 : 409,
    body: result,
  };
}
