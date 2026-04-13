import { randomUUID } from "node:crypto";

import {
  buildRequestMeta,
  type GoogleAuthStartResponseDto,
} from "../../../../../../packages/contracts/src/index.ts";
import type { AuthService } from "../application/auth-service.ts";
import type { GoogleAuthService } from "../application/google-auth-service.ts";

export async function handleStartGoogleLogin(
  service: GoogleAuthService | undefined,
  query: URLSearchParams,
  headers: Record<string, string>,
): Promise<{
  statusCode: number;
  body: {
    success: boolean;
    data?: GoogleAuthStartResponseDto;
    error?: { code: string; message: string };
    meta: ReturnType<typeof buildRequestMeta>;
  };
}> {
  const requestId = headers["x-request-id"] || randomUUID();
  const clientVersion = headers["x-client-version"];
  if (!service) {
    return {
      statusCode: 503,
      body: {
        success: false,
        error: {
          code: "GOOGLE_AUTH_UNAVAILABLE",
          message: "Google auth is not configured on the KK API server.",
        },
        meta: buildRequestMeta(requestId, clientVersion),
      },
    };
  }

  try {
    const result = service.start({
      mode: "login",
      redirectTo: String(query.get("redirectTo") || ""),
    });
    return {
      statusCode: 200,
      body: {
        success: true,
        data: result,
        meta: buildRequestMeta(requestId, clientVersion),
      },
    };
  } catch (error) {
    return {
      statusCode: 400,
      body: {
        success: false,
        error: {
          code: "GOOGLE_AUTH_INVALID_REQUEST",
          message: error instanceof Error ? error.message : "Unable to start Google auth.",
        },
        meta: buildRequestMeta(requestId, clientVersion),
      },
    };
  }
}

export async function handleStartGoogleBind(
  service: GoogleAuthService | undefined,
  _query: URLSearchParams,
  headers: Record<string, string>,
): Promise<{
  statusCode: number;
  body: {
    success: boolean;
    data?: GoogleAuthStartResponseDto;
    error?: { code: string; message: string };
    meta: ReturnType<typeof buildRequestMeta>;
  };
}> {
  const requestId = headers["x-request-id"] || randomUUID();
  const clientVersion = headers["x-client-version"];

  if (!service) {
    return {
      statusCode: 503,
      body: {
        success: false,
        error: {
          code: "GOOGLE_AUTH_UNAVAILABLE",
          message: "Google auth is not configured on the KK API server.",
        },
        meta: buildRequestMeta(requestId, clientVersion),
      },
    };
  }

  return {
    statusCode: 501,
    body: {
      success: false,
      error: {
        code: "GOOGLE_BIND_UNAVAILABLE",
        message: "Google bind is not persisted on the VPS runtime yet.",
      },
      meta: buildRequestMeta(requestId, clientVersion),
    },
  };
}

export async function handleGoogleCallback(
  service: GoogleAuthService | undefined,
  authService: AuthService,
  query: URLSearchParams,
): Promise<{ redirectTo: string }> {
  if (!service) {
    return {
      redirectTo: "/auth/callback?error=google_auth_unavailable",
    };
  }

  return await service.handleCallback(authService, {
    code: query.get("code") || undefined,
    state: query.get("state") || undefined,
  });
}
