import { randomUUID } from "node:crypto";

import { buildRequestMeta } from "../../../../../../packages/contracts/src/index.ts";
import { resolveAuthenticatedUserId } from "../../../../../../packages/shared/src/index.ts";
import {
  LocalSystemProxyError,
  type LocalSystemProxyRequest,
  type LocalSystemProxyService,
} from "../application/local-system-proxy-service.ts";

function buildUnauthorizedResult(requestId: string, clientVersion?: string) {
  return {
    statusCode: 401,
    body: {
      success: false as const,
      error: {
        code: "AUTH_REQUIRED",
        message: "Authentication is required for local system proxy requests.",
      },
      meta: buildRequestMeta(requestId, clientVersion),
    },
  };
}

export async function handleInvokeLocalSystemProxy(
  service: LocalSystemProxyService,
  body: LocalSystemProxyRequest,
  headers: Record<string, string>,
) {
  const requestId = headers["x-request-id"] || randomUUID();
  const clientVersion = headers["x-client-version"];
  const userId = resolveAuthenticatedUserId(headers);

  if (!userId) {
    return buildUnauthorizedResult(requestId, clientVersion);
  }

  try {
    const result = await service.invoke(userId, body);
    return {
      statusCode: 200,
      body: {
        success: true as const,
        data: result,
        meta: buildRequestMeta(requestId, clientVersion),
      },
    };
  } catch (error) {
    if (error instanceof LocalSystemProxyError) {
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
          code: "LOCAL_SYSTEM_PROXY_ERROR",
          message: error instanceof Error ? error.message : "Local system proxy failed.",
        },
        meta: buildRequestMeta(requestId, clientVersion),
      },
    };
  }
}
