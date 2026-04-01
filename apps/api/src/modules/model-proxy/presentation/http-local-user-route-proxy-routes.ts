import { randomUUID } from "node:crypto";

import { buildRequestMeta } from "../../../../../../packages/contracts/src/index.ts";
import {
  resolveAuthenticatedUserEmail,
  resolveAuthenticatedUserId,
} from "../../../../../../packages/shared/src/index.ts";
import {
  LocalUserRouteProxyError,
  type LocalUserRouteProxyRequest,
  type LocalUserRouteProxyService,
} from "../application/local-user-route-proxy-service.ts";

function buildUnauthorizedResult(requestId: string, clientVersion?: string) {
  return {
    statusCode: 401,
    body: {
      success: false as const,
      error: {
        code: "AUTH_REQUIRED",
        message: "Authentication is required for local user-route proxy requests.",
      },
      meta: buildRequestMeta(requestId, clientVersion),
    },
  };
}

export async function handleInvokeLocalUserRouteProxy(
  service: LocalUserRouteProxyService,
  body: LocalUserRouteProxyRequest,
  headers: Record<string, string>,
) {
  const requestId = headers["x-request-id"] || randomUUID();
  const clientVersion = headers["x-client-version"];
  const userId = resolveAuthenticatedUserId(headers);
  const email = resolveAuthenticatedUserEmail(headers);

  if (!userId) {
    return buildUnauthorizedResult(requestId, clientVersion);
  }

  try {
    const result = await service.invoke(userId, email, headers, body);
    return {
      statusCode: 200,
      body: {
        success: true as const,
        data: result,
        meta: buildRequestMeta(requestId, clientVersion),
      },
    };
  } catch (error) {
    if (error instanceof LocalUserRouteProxyError) {
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
          code: "LOCAL_USER_ROUTE_PROXY_ERROR",
          message: error instanceof Error ? error.message : "Local user-route proxy failed.",
        },
        meta: buildRequestMeta(requestId, clientVersion),
      },
    };
  }
}
