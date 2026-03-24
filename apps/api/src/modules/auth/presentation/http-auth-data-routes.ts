import { randomUUID } from "node:crypto";

import {
  buildRequestMeta,
  type ReplaceKeyManagerCloudStateRequestDto,
  type ApiErrorDetail,
  type ReplaceUserApiEntriesRequestDto,
} from "../../../../../../packages/contracts/src/index.ts";
import {
  resolveAuthenticatedUserEmail,
  resolveAuthenticatedUserId,
} from "../../../../../../packages/shared/src/index.ts";
import type { AuthDataService } from "../application/auth-data-service.ts";

function resolveUserId(headers: Record<string, string>): string | undefined {
  return resolveAuthenticatedUserId(headers);
}

function resolveUserEmail(headers: Record<string, string>): string | undefined {
  return resolveAuthenticatedUserEmail(headers);
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
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
      details.push({ field: `entries[${index}]`, reason: "Each entry must be an object." });
      return;
    }

    if (!entry.id || typeof entry.id !== "string") {
      details.push({ field: `entries[${index}].id`, reason: "id is required." });
    }

    if (typeof entry.key !== "string") {
      details.push({ field: `entries[${index}].key`, reason: "key is required." });
    }

    if (!entry.name || typeof entry.name !== "string") {
      details.push({ field: `entries[${index}].name`, reason: "name is required." });
    }

    if (!entry.provider || typeof entry.provider !== "string") {
      details.push({ field: `entries[${index}].provider`, reason: "provider is required." });
    }

    if (entry.type !== "official" && entry.type !== "proxy" && entry.type !== "third-party") {
      details.push({ field: `entries[${index}].type`, reason: "type must be official, proxy, or third-party." });
    }

    if (entry.format !== "gemini" && entry.format !== "openai" && entry.format !== "auto" && entry.format !== "claude") {
      details.push({ field: `entries[${index}].format`, reason: "format must be gemini, openai, auto, or claude." });
    }

    if (!Array.isArray(entry.supportedModels)) {
      details.push({ field: `entries[${index}].supportedModels`, reason: "supportedModels must be an array." });
    }

    if (typeof entry.disabled !== "boolean") {
      details.push({ field: `entries[${index}].disabled`, reason: "disabled must be a boolean." });
    }

    if (typeof entry.createdAt !== "number" || typeof entry.updatedAt !== "number") {
      details.push({ field: `entries[${index}].timestamps`, reason: "createdAt and updatedAt must be numbers." });
    }
  });

  return details;
}

export function validateReplaceKeyManagerCloudStateRequest(body: unknown): ApiErrorDetail[] {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return [{ field: "body", reason: "Request body must be an object." }];
  }

  const candidate = body as Partial<ReplaceKeyManagerCloudStateRequestDto>;
  const details: ApiErrorDetail[] = [];

  if (!Array.isArray(candidate.slots)) {
    details.push({ field: "slots", reason: "slots must be an array." });
  }

  if (candidate.providers !== undefined && !Array.isArray(candidate.providers)) {
    details.push({ field: "providers", reason: "providers must be an array when provided." });
  }

  if (candidate.version !== undefined && typeof candidate.version !== "number") {
    details.push({ field: "version", reason: "version must be a number when provided." });
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

  return {
    statusCode: 200,
    body: await service.replaceUserApiEntries(
      userId,
      resolveUserEmail(headers),
      body,
      requestId,
      clientVersion,
    ),
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

  return {
    statusCode: 200,
    body: await service.replaceKeyManagerCloudState(
      userId,
      resolveUserEmail(headers),
      body,
      requestId,
      clientVersion,
    ),
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
