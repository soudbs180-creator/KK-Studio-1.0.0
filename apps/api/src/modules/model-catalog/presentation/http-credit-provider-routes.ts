import { randomUUID } from "node:crypto";

import {
  buildRequestMeta,
  type ApiErrorDetail,
  type SaveAdminCreditProviderRequestDto,
  type UpsertProviderPricingCacheRequestDto,
} from "../../../../../../packages/contracts/src/index.ts";
import {
  resolveAuthenticatedAdminSession,
  resolveAuthenticatedUserId,
  resolveAuthenticatedUserRole,
} from "../../../../../../packages/shared/src/index.ts";
import type { CreditProviderService } from "../application/credit-provider-service.ts";

function resolveUserId(headers: Record<string, string>): string | undefined {
  return resolveAuthenticatedUserId(headers);
}

function isAdminRequest(headers: Record<string, string>): boolean {
  return resolveAuthenticatedUserRole(headers) === "admin";
}

function hasElevatedAdminSession(headers: Record<string, string>): boolean {
  return resolveAuthenticatedAdminSession(headers).active;
}

function buildUnauthorizedResult<T>(requestId: string, clientVersion?: string) {
  return {
    statusCode: 401,
    body: {
      success: false as const,
      error: {
        code: "AUTH_REQUIRED",
        message: "Admin credit provider requests require an authenticated user context.",
      },
      meta: buildRequestMeta(requestId, clientVersion),
    },
  };
}

function buildAdminForbiddenResult<T>(requestId: string, clientVersion?: string) {
  return {
    statusCode: 403,
    body: {
      success: false as const,
      error: {
        code: "ADMIN_FORBIDDEN",
        message: "Admin role is required to manage credit providers.",
      },
      meta: buildRequestMeta(requestId, clientVersion),
    },
  };
}

function buildAdminElevationRequiredResult<T>(requestId: string, clientVersion?: string) {
  return {
    statusCode: 403,
    body: {
      success: false as const,
      error: {
        code: "ADMIN_ELEVATION_REQUIRED",
        message: "A verified admin session is required to mutate credit provider settings.",
      },
      meta: buildRequestMeta(requestId, clientVersion),
    },
  };
}

export function validateSaveAdminCreditProviderRequest(body: unknown): ApiErrorDetail[] {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return [{ field: "body", reason: "Request body must be an object." }];
  }

  const candidate = body as Partial<SaveAdminCreditProviderRequestDto>;
  const details: ApiErrorDetail[] = [];

  if (!candidate.providerName || typeof candidate.providerName !== "string") {
    details.push({ field: "providerName", reason: "providerName is required." });
  }

  if (!candidate.baseUrl || typeof candidate.baseUrl !== "string") {
    details.push({ field: "baseUrl", reason: "baseUrl is required." });
  }

  if (!Array.isArray(candidate.apiKeys)) {
    details.push({ field: "apiKeys", reason: "apiKeys must be an array." });
  } else if (candidate.apiKeys.some((item) => typeof item !== "string")) {
    details.push({ field: "apiKeys", reason: "apiKeys must contain only strings." });
  }

  if (
    candidate.retainApiKeyFingerprints !== undefined
    && !Array.isArray(candidate.retainApiKeyFingerprints)
  ) {
    details.push({
      field: "retainApiKeyFingerprints",
      reason: "retainApiKeyFingerprints must be an array when provided.",
    });
  } else if (
    Array.isArray(candidate.retainApiKeyFingerprints)
    && candidate.retainApiKeyFingerprints.some((item) => typeof item !== "string")
  ) {
    details.push({
      field: "retainApiKeyFingerprints",
      reason: "retainApiKeyFingerprints must contain only strings.",
    });
  }

  if (!Array.isArray(candidate.models) || candidate.models.length === 0) {
    details.push({ field: "models", reason: "models must contain at least one model." });
  } else {
    candidate.models.forEach((model, index) => {
      if (!model || typeof model !== "object" || Array.isArray(model)) {
        details.push({ field: `models[${index}]`, reason: "Each model must be an object." });
        return;
      }

      if (!model.modelId || typeof model.modelId !== "string") {
        details.push({ field: `models[${index}].modelId`, reason: "modelId is required." });
      }

      if (!model.displayName || typeof model.displayName !== "string") {
        details.push({ field: `models[${index}].displayName`, reason: "displayName is required." });
      }

      if (!model.endpointType || typeof model.endpointType !== "string") {
        details.push({ field: `models[${index}].endpointType`, reason: "endpointType is required." });
      }

      if (typeof model.creditCost !== "number" || model.creditCost < 1) {
        details.push({
          field: `models[${index}].creditCost`,
          reason: "creditCost must be a positive number.",
        });
      }

      if (!model.color || typeof model.color !== "string") {
        details.push({ field: `models[${index}].color`, reason: "color is required." });
      }

      if (model.textColor !== "white" && model.textColor !== "black") {
        details.push({
          field: `models[${index}].textColor`,
          reason: "textColor must be white or black.",
        });
      }

      if (typeof model.priority !== "number" || !Number.isFinite(model.priority)) {
        details.push({
          field: `models[${index}].priority`,
          reason: "priority must be a finite number.",
        });
      }

      if (typeof model.weight !== "number" || !Number.isFinite(model.weight)) {
        details.push({
          field: `models[${index}].weight`,
          reason: "weight must be a finite number.",
        });
      }

      if (typeof model.isActive !== "boolean") {
        details.push({
          field: `models[${index}].isActive`,
          reason: "isActive must be a boolean.",
        });
      }

      if (typeof model.advancedEnabled !== "boolean") {
        details.push({
          field: `models[${index}].advancedEnabled`,
          reason: "advancedEnabled must be a boolean.",
        });
      }

      if (typeof model.mixWithSameModel !== "boolean") {
        details.push({
          field: `models[${index}].mixWithSameModel`,
          reason: "mixWithSameModel must be a boolean.",
        });
      }

      if (!model.qualityPricing || typeof model.qualityPricing !== "object" || Array.isArray(model.qualityPricing)) {
        details.push({
          field: `models[${index}].qualityPricing`,
          reason: "qualityPricing must be an object.",
        });
      }
    });
  }

  return details;
}

export function validateUpsertProviderPricingCacheRequest(body: unknown): ApiErrorDetail[] {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return [{ field: "body", reason: "Request body must be an object." }];
  }

  const candidate = body as Partial<UpsertProviderPricingCacheRequestDto>;
  const details: ApiErrorDetail[] = [];

  if (!Array.isArray(candidate.pricing)) {
    details.push({ field: "pricing", reason: "pricing must be an array." });
    return details;
  }

  candidate.pricing.forEach((item, index) => {
    if (!item || typeof item !== "object" || Array.isArray(item)) {
      details.push({ field: `pricing[${index}]`, reason: "Each pricing item must be an object." });
      return;
    }

    if (!item.modelId || typeof item.modelId !== "string") {
      details.push({ field: `pricing[${index}].modelId`, reason: "modelId is required." });
    }

    if (!item.modelName || typeof item.modelName !== "string") {
      details.push({ field: `pricing[${index}].modelName`, reason: "modelName is required." });
    }

    if (typeof item.inputPrice !== "number" || !Number.isFinite(item.inputPrice) || item.inputPrice < 0) {
      details.push({
        field: `pricing[${index}].inputPrice`,
        reason: "inputPrice must be a non-negative finite number.",
      });
    }

    if (typeof item.outputPrice !== "number" || !Number.isFinite(item.outputPrice) || item.outputPrice < 0) {
      details.push({
        field: `pricing[${index}].outputPrice`,
        reason: "outputPrice must be a non-negative finite number.",
      });
    }

    if (typeof item.isPerToken !== "boolean") {
      details.push({
        field: `pricing[${index}].isPerToken`,
        reason: "isPerToken must be a boolean.",
      });
    }

    if (!item.currency || typeof item.currency !== "string") {
      details.push({ field: `pricing[${index}].currency`, reason: "currency is required." });
    }

    if (typeof item.groupRatio !== "undefined" && (
      typeof item.groupRatio !== "number"
      || !Number.isFinite(item.groupRatio)
      || item.groupRatio < 0
    )) {
      details.push({
        field: `pricing[${index}].groupRatio`,
        reason: "groupRatio must be a non-negative finite number when provided.",
      });
    }
  });

  return details;
}

function validateSharedPricingBaseUrl(baseUrl: string, requestId: string, clientVersion?: string) {
  const normalizedBaseUrl = String(baseUrl || "").trim();
  if (normalizedBaseUrl) {
    return null;
  }

  return {
    statusCode: 400,
    body: {
      success: false as const,
      error: {
        code: "INVALID_REQUEST",
        message: "Shared pricing cache request validation failed.",
        details: [{ field: "baseUrl", reason: "baseUrl query parameter is required." }],
      },
      meta: buildRequestMeta(requestId, clientVersion),
    },
  };
}

export async function handleListActiveCreditModels(
  service: CreditProviderService,
  headers: Record<string, string>,
) {
  const requestId = headers["x-request-id"] || randomUUID();
  const clientVersion = headers["x-client-version"];
  return {
    statusCode: 200,
    body: await service.listActiveCreditModels(requestId, clientVersion),
  };
}

export async function handleListAdminCreditProviders(
  service: CreditProviderService,
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

  return {
    statusCode: 200,
    body: await service.listAdminProviders(requestId, clientVersion),
  };
}

export async function handleSaveAdminCreditProvider(
  service: CreditProviderService,
  providerId: string,
  body: SaveAdminCreditProviderRequestDto,
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

  const normalizedProviderId = String(providerId || "").trim();
  if (!normalizedProviderId) {
    return {
      statusCode: 400,
      body: {
        success: false as const,
        error: {
          code: "INVALID_REQUEST",
          message: "Credit provider request validation failed.",
          details: [{ field: "providerId", reason: "providerId path parameter is required." }],
        },
        meta: buildRequestMeta(requestId, clientVersion),
      },
    };
  }

  const validationErrors = validateSaveAdminCreditProviderRequest(body);
  if (validationErrors.length > 0) {
    return {
      statusCode: 400,
      body: {
        success: false as const,
        error: {
          code: "INVALID_REQUEST",
          message: "Credit provider request validation failed.",
          details: validationErrors,
        },
        meta: buildRequestMeta(requestId, clientVersion),
      },
    };
  }

  const result = await service.saveAdminProvider(
    normalizedProviderId,
    body,
    userId,
    requestId,
    clientVersion,
  );

  return {
    statusCode: 200,
    body: result,
  };
}

export async function handleGetAdminCreditProviderPricingCache(
  service: CreditProviderService,
  providerId: string,
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

  const normalizedProviderId = String(providerId || "").trim();
  if (!normalizedProviderId) {
    return {
      statusCode: 400,
      body: {
        success: false as const,
        error: {
          code: "INVALID_REQUEST",
          message: "Credit provider pricing cache request validation failed.",
          details: [{ field: "providerId", reason: "providerId path parameter is required." }],
        },
        meta: buildRequestMeta(requestId, clientVersion),
      },
    };
  }

  const result = await service.getProviderPricingCache(
    normalizedProviderId,
    requestId,
    clientVersion,
  );

  return {
    statusCode: result.success ? 200 : 404,
    body: result,
  };
}

export async function handleGetSharedProviderPricingCache(
  service: CreditProviderService,
  baseUrl: string,
  headers: Record<string, string>,
) {
  const requestId = headers["x-request-id"] || randomUUID();
  const clientVersion = headers["x-client-version"];
  const userId = resolveUserId(headers);

  if (!userId) {
    return buildUnauthorizedResult(requestId, clientVersion);
  }

  const validationResult = validateSharedPricingBaseUrl(baseUrl, requestId, clientVersion);
  if (validationResult) {
    return validationResult;
  }

  const result = await service.getSharedProviderPricingCache(
    baseUrl,
    requestId,
    clientVersion,
  );

  return {
    statusCode: result.success ? 200 : 404,
    body: result,
  };
}

export async function handleUpsertAdminCreditProviderPricingCache(
  service: CreditProviderService,
  providerId: string,
  body: UpsertProviderPricingCacheRequestDto,
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

  const normalizedProviderId = String(providerId || "").trim();
  if (!normalizedProviderId) {
    return {
      statusCode: 400,
      body: {
        success: false as const,
        error: {
          code: "INVALID_REQUEST",
          message: "Credit provider pricing cache request validation failed.",
          details: [{ field: "providerId", reason: "providerId path parameter is required." }],
        },
        meta: buildRequestMeta(requestId, clientVersion),
      },
    };
  }

  const validationErrors = validateUpsertProviderPricingCacheRequest(body);
  if (validationErrors.length > 0) {
    return {
      statusCode: 400,
      body: {
        success: false as const,
        error: {
          code: "INVALID_REQUEST",
          message: "Credit provider pricing cache request validation failed.",
          details: validationErrors,
        },
        meta: buildRequestMeta(requestId, clientVersion),
      },
    };
  }

  const result = await service.saveProviderPricingCache(
    normalizedProviderId,
    body,
    userId,
    requestId,
    clientVersion,
  );

  return {
    statusCode: 200,
    body: result,
  };
}

export async function handleUpsertSharedProviderPricingCache(
  service: CreditProviderService,
  baseUrl: string,
  body: UpsertProviderPricingCacheRequestDto,
  headers: Record<string, string>,
) {
  const requestId = headers["x-request-id"] || randomUUID();
  const clientVersion = headers["x-client-version"];
  const userId = resolveUserId(headers);

  if (!userId) {
    return buildUnauthorizedResult(requestId, clientVersion);
  }

  const validationResult = validateSharedPricingBaseUrl(baseUrl, requestId, clientVersion);
  if (validationResult) {
    return validationResult;
  }

  const validationErrors = validateUpsertProviderPricingCacheRequest(body);
  if (validationErrors.length > 0) {
    return {
      statusCode: 400,
      body: {
        success: false as const,
        error: {
          code: "INVALID_REQUEST",
          message: "Shared pricing cache request validation failed.",
          details: validationErrors,
        },
        meta: buildRequestMeta(requestId, clientVersion),
      },
    };
  }

  const result = await service.saveSharedProviderPricingCache(
    baseUrl,
    body,
    userId,
    requestId,
    clientVersion,
  );

  return {
    statusCode: 200,
    body: result,
  };
}

export async function handleDeleteAdminCreditProvider(
  service: CreditProviderService,
  providerId: string,
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

  const normalizedProviderId = String(providerId || "").trim();
  if (!normalizedProviderId) {
    return {
      statusCode: 400,
      body: {
        success: false as const,
        error: {
          code: "INVALID_REQUEST",
          message: "Credit provider request validation failed.",
          details: [{ field: "providerId", reason: "providerId path parameter is required." }],
        },
        meta: buildRequestMeta(requestId, clientVersion),
      },
    };
  }

  const result = await service.deleteAdminProvider(
    normalizedProviderId,
    userId,
    requestId,
    clientVersion,
  );

  return {
    statusCode: result.success ? 200 : 404,
    body: result,
  };
}
