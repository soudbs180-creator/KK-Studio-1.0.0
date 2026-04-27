import { randomUUID } from "node:crypto";

import { buildRequestMeta } from "../../../../../../packages/contracts/src/index.ts";
import type { UserRoutePricingSyncRequestDto } from "../../../../../../packages/contracts/src/index.ts";
import {
  resolveAuthenticatedUserEmail,
  resolveAuthenticatedUserId,
} from "../../../../../../packages/shared/src/index.ts";
import {
  UserRouteDiagnosticsError,
  type UserRouteDiagnosticsService,
} from "../application/user-route-diagnostics-service.ts";

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

function buildUnauthorizedResult(requestId: string, clientVersion?: string) {
  return {
    statusCode: 401,
    body: {
      success: false as const,
      error: {
        code: "AUTH_REQUIRED",
        message: "Authentication is required for user route diagnostics.",
      },
      meta: buildRequestMeta(requestId, clientVersion),
    },
  };
}

export async function handleCheckUserRouteConnectivity(
  service: UserRouteDiagnosticsService,
  routeId: string,
  headers: Record<string, string>,
) {
  const requestId = headers["x-request-id"] || randomUUID();
  const clientVersion = headers["x-client-version"];
  const userId = resolveAuthenticatedUserId(headers);

  if (!userId) {
    return buildUnauthorizedResult(requestId, clientVersion);
  }

  try {
    const result = await service.checkConnectivity(
      userId,
      resolveAuthenticatedUserEmail(headers),
      routeId,
      resolveBearerAccessToken(headers),
    );

    return {
      statusCode: 200,
      body: {
        success: true as const,
        data: result,
        meta: buildRequestMeta(requestId, clientVersion),
      },
    };
  } catch (error) {
    if (error instanceof UserRouteDiagnosticsError) {
      return {
        statusCode: error.statusCode,
        body: {
          success: false as const,
          error: {
            code: error.code,
            message: error.message,
          },
          meta: buildRequestMeta(requestId, clientVersion),
        },
      };
    }

    return {
      statusCode: 500,
      body: {
        success: false as const,
        error: {
          code: "USER_ROUTE_CONNECTIVITY_CHECK_FAILED",
          message: error instanceof Error ? error.message : "User route connectivity check failed.",
        },
        meta: buildRequestMeta(requestId, clientVersion),
      },
    };
  }
}

export async function handleSyncUserRoutePricing(
  service: UserRouteDiagnosticsService,
  routeId: string,
  headers: Record<string, string>,
  input?: UserRoutePricingSyncRequestDto,
) {
  const requestId = headers["x-request-id"] || randomUUID();
  const clientVersion = headers["x-client-version"];
  const userId = resolveAuthenticatedUserId(headers);

  if (!userId) {
    return buildUnauthorizedResult(requestId, clientVersion);
  }

  try {
    const result = await service.syncPricing(
      userId,
      resolveAuthenticatedUserEmail(headers),
      routeId,
      resolveBearerAccessToken(headers),
      input,
    );

    return {
      statusCode: 200,
      body: {
        success: true as const,
        data: result,
        meta: buildRequestMeta(requestId, clientVersion),
      },
    };
  } catch (error) {
    if (error instanceof UserRouteDiagnosticsError) {
      return {
        statusCode: error.statusCode,
        body: {
          success: false as const,
          error: {
            code: error.code,
            message: error.message,
          },
          meta: buildRequestMeta(requestId, clientVersion),
        },
      };
    }

    return {
      statusCode: 500,
      body: {
        success: false as const,
        error: {
          code: "USER_ROUTE_PRICING_SYNC_FAILED",
          message: error instanceof Error ? error.message : "User route pricing sync failed.",
        },
        meta: buildRequestMeta(requestId, clientVersion),
      },
    };
  }
}
