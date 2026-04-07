import { randomUUID } from "node:crypto";

import {
  buildRequestMeta,
  type ApiErrorDetail,
  type ChangeAdminPasswordRequestDto,
  type SetUserRoleRequestDto,
  type VerifyAdminPasswordRequestDto,
} from "../../../../../../packages/contracts/src/index.ts";
import {
  resolveAdminSessionToken,
  resolveAuthenticatedUserId,
} from "../../../../../../packages/shared/src/index.ts";
import type { AdminConsoleService } from "../application/admin-console-service.ts";

interface HttpAdminConsoleRouteResult<T> {
  statusCode: number;
  body: T;
}

function buildUnauthorizedResult<T>(
  requestId: string,
  clientVersion?: string,
): HttpAdminConsoleRouteResult<T> {
  return {
    statusCode: 401,
    body: {
      success: false,
      error: {
        code: "AUTH_REQUIRED",
        message: "Admin console requests require an authenticated user context.",
      },
      meta: buildRequestMeta(requestId, clientVersion),
    } as T,
  };
}

function resolveUserId(headers: Record<string, string>): string | undefined {
  return resolveAuthenticatedUserId(headers);
}

export function validateVerifyAdminPasswordRequest(body: unknown): ApiErrorDetail[] {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return [{ field: "body", reason: "Request body must be an object." }];
  }

  const candidate = body as Partial<VerifyAdminPasswordRequestDto>;
  const details: ApiErrorDetail[] = [];

  if (!candidate.password || typeof candidate.password !== "string") {
    details.push({ field: "password", reason: "password is required." });
  }

  return details;
}

export function validateChangeAdminPasswordRequest(body: unknown): ApiErrorDetail[] {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return [{ field: "body", reason: "Request body must be an object." }];
  }

  const candidate = body as Partial<ChangeAdminPasswordRequestDto>;
  const details: ApiErrorDetail[] = [];

  if (!candidate.oldPassword || typeof candidate.oldPassword !== "string") {
    details.push({ field: "oldPassword", reason: "oldPassword is required." });
  }

  if (!candidate.newPassword || typeof candidate.newPassword !== "string") {
    details.push({ field: "newPassword", reason: "newPassword is required." });
  } else if (candidate.newPassword.length < 8) {
    details.push({ field: "newPassword", reason: "newPassword must be at least 8 characters long." });
  }

  return details;
}

export function validateSetUserRoleRequest(body: unknown): ApiErrorDetail[] {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return [{ field: "body", reason: "Request body must be an object." }];
  }

  const candidate = body as Partial<SetUserRoleRequestDto>;
  const details: ApiErrorDetail[] = [];

  if (!candidate.identity || typeof candidate.identity !== "string") {
    details.push({ field: "identity", reason: "identity is required." });
  }

  if (candidate.role !== "admin" && candidate.role !== "user") {
    details.push({ field: "role", reason: "role must be admin or user." });
  }

  return details;
}

function buildInvalidRequestResult<T>(
  requestId: string,
  clientVersion: string | undefined,
  message: string,
  details: ApiErrorDetail[],
): HttpAdminConsoleRouteResult<T> {
  return {
    statusCode: 400,
    body: {
      success: false,
      error: {
        code: "INVALID_REQUEST",
        message,
        details,
      },
      meta: buildRequestMeta(requestId, clientVersion),
    } as T,
  };
}

export async function handleGetAdminAccess(
  service: AdminConsoleService,
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
    body: await service.getAccess(
      userId,
      requestId,
      clientVersion,
      resolveAdminSessionToken(headers),
    ),
  };
}

export async function handleVerifyAdminPassword(
  service: AdminConsoleService,
  body: VerifyAdminPasswordRequestDto,
  headers: Record<string, string>,
) {
  const requestId = headers["x-request-id"] || randomUUID();
  const clientVersion = headers["x-client-version"];
  const userId = resolveUserId(headers);

  if (!userId) {
    return buildUnauthorizedResult(requestId, clientVersion);
  }

  const validationErrors = validateVerifyAdminPasswordRequest(body);
  if (validationErrors.length > 0) {
    return buildInvalidRequestResult(
      requestId,
      clientVersion,
      "Admin password verification request validation failed.",
      validationErrors,
    );
  }

  const result = await service.verifyAdminPassword(userId, body, requestId, clientVersion);
  if (!result.success) {
    return {
      statusCode: result.error.code === "ADMIN_FORBIDDEN" ? 403 : 409,
      body: result,
    };
  }

  return {
    statusCode: 200,
    body: result,
  };
}

export async function handleChangeAdminPassword(
  service: AdminConsoleService,
  body: ChangeAdminPasswordRequestDto,
  headers: Record<string, string>,
) {
  const requestId = headers["x-request-id"] || randomUUID();
  const clientVersion = headers["x-client-version"];
  const userId = resolveUserId(headers);

  if (!userId) {
    return buildUnauthorizedResult(requestId, clientVersion);
  }

  const validationErrors = validateChangeAdminPasswordRequest(body);
  if (validationErrors.length > 0) {
    return buildInvalidRequestResult(
      requestId,
      clientVersion,
      "Admin password change request validation failed.",
      validationErrors,
    );
  }

  const result = await service.changeAdminPassword(
    userId,
    body,
    requestId,
    clientVersion,
    resolveAdminSessionToken(headers),
  );
  if (!result.success) {
    return {
      statusCode:
        result.error.code === "ADMIN_FORBIDDEN" || result.error.code === "ADMIN_ELEVATION_REQUIRED"
          ? 403
          : 409,
      body: result,
    };
  }

  return {
    statusCode: 200,
    body: result,
  };
}

export async function handleSetUserRole(
  service: AdminConsoleService,
  body: SetUserRoleRequestDto,
  headers: Record<string, string>,
) {
  const requestId = headers["x-request-id"] || randomUUID();
  const clientVersion = headers["x-client-version"];
  const userId = resolveUserId(headers);

  if (!userId) {
    return buildUnauthorizedResult(requestId, clientVersion);
  }

  const validationErrors = validateSetUserRoleRequest(body);
  if (validationErrors.length > 0) {
    return buildInvalidRequestResult(
      requestId,
      clientVersion,
      "Set user role request validation failed.",
      validationErrors,
    );
  }

  const result = await service.setUserRole(
    userId,
    body,
    requestId,
    clientVersion,
    resolveAdminSessionToken(headers),
  );
  if (!result.success) {
    return {
      statusCode:
        result.error.code === "ADMIN_FORBIDDEN" || result.error.code === "ADMIN_ELEVATION_REQUIRED"
          ? 403
          : result.error.code === "ADMIN_TARGET_NOT_FOUND"
            ? 404
            : 409,
      body: result,
    };
  }

  return {
    statusCode: 200,
    body: result,
  };
}
