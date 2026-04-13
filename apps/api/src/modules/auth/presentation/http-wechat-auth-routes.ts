import { randomUUID } from "node:crypto";

import {
  buildRequestMeta,
  type WechatAuthStartResponseDto,
} from "../../../../../../packages/contracts/src/index.ts";
import { resolveAuthenticatedUserId } from "../../../../../../packages/shared/src/index.ts";
import type { AuthService } from "../application/auth-service.ts";
import type {
  WechatAuthService,
  WechatCallbackResult,
} from "../application/wechat-auth-service.ts";

interface HttpWechatRouteResult<T> {
  statusCode: number;
  body?: {
    success: boolean;
    data?: T;
    error?: {
      code: string;
      message: string;
      details?: Array<Record<string, unknown>>;
    };
    meta: ReturnType<typeof buildRequestMeta>;
  };
  redirectTo?: string;
}

function buildErrorResult<T>(
  requestId: string,
  clientVersion: string | undefined,
  statusCode: number,
  code: string,
  message: string,
): HttpWechatRouteResult<T> {
  return {
    statusCode,
    body: {
      success: false,
      error: {
        code,
        message,
      },
      meta: buildRequestMeta(requestId, clientVersion),
    },
  };
}

function buildSuccessResult<T>(
  requestId: string,
  clientVersion: string | undefined,
  statusCode: number,
  data: T,
): HttpWechatRouteResult<T> {
  return {
    statusCode,
    body: {
      success: true,
      data,
      meta: buildRequestMeta(requestId, clientVersion),
    },
  };
}

function resolveRedirectTo(searchParams: URLSearchParams): string | undefined {
  const redirectTo = searchParams.get("redirectTo");
  return redirectTo && redirectTo.trim() ? redirectTo.trim() : undefined;
}

function buildCallbackResult(
  requestId: string,
  clientVersion: string | undefined,
  callbackResult: WechatCallbackResult,
): HttpWechatRouteResult<never> {
  if (callbackResult.redirectTo) {
    return {
      statusCode: 302,
      redirectTo: callbackResult.redirectTo,
    };
  }

  return buildErrorResult(
    requestId,
    clientVersion,
    400,
    callbackResult.errorCode || "WECHAT_CALLBACK_INVALID",
    callbackResult.errorDescription || "The WeChat callback did not include enough information to continue.",
  );
}

export async function handleStartWechatLogin(
  service: WechatAuthService,
  searchParams: URLSearchParams,
  headers: Record<string, string>,
): Promise<HttpWechatRouteResult<WechatAuthStartResponseDto>> {
  const requestId = headers["x-request-id"] || randomUUID();
  const clientVersion = headers["x-client-version"];
  const redirectTo = resolveRedirectTo(searchParams);

  if (!redirectTo) {
    return buildErrorResult(
      requestId,
      clientVersion,
      400,
      "WECHAT_REDIRECT_REQUIRED",
      "redirectTo is required to start WeChat login.",
    );
  }

  try {
    const data = service.start({
      mode: "login",
      redirectTo,
    });

    return buildSuccessResult(requestId, clientVersion, 200, data);
  } catch (error: any) {
    return buildErrorResult(
      requestId,
      clientVersion,
      400,
      "WECHAT_START_INVALID",
      error?.message || "Unable to start WeChat login.",
    );
  }
}

export async function handleStartWechatBind(
  service: WechatAuthService,
  searchParams: URLSearchParams,
  headers: Record<string, string>,
): Promise<HttpWechatRouteResult<WechatAuthStartResponseDto>> {
  const requestId = headers["x-request-id"] || randomUUID();
  const clientVersion = headers["x-client-version"];
  const redirectTo = resolveRedirectTo(searchParams);
  const userId = resolveAuthenticatedUserId(headers);

  if (!userId) {
    return buildErrorResult(
      requestId,
      clientVersion,
      401,
      "AUTH_REQUIRED",
      "Authentication is required to bind a WeChat account.",
    );
  }

  if (!redirectTo) {
    return buildErrorResult(
      requestId,
      clientVersion,
      400,
      "WECHAT_REDIRECT_REQUIRED",
      "redirectTo is required to start WeChat binding.",
    );
  }

  try {
    const data = service.start({
      mode: "bind",
      redirectTo,
      userId,
    });

    return buildSuccessResult(requestId, clientVersion, 200, data);
  } catch (error: any) {
    return buildErrorResult(
      requestId,
      clientVersion,
      400,
      "WECHAT_BIND_START_INVALID",
      error?.message || "Unable to start WeChat account binding.",
    );
  }
}

export async function handleWechatCallback(
  service: WechatAuthService,
  authService: AuthService,
  searchParams: URLSearchParams,
  headers: Record<string, string>,
): Promise<HttpWechatRouteResult<never>> {
  const requestId = headers["x-request-id"] || randomUUID();
  const clientVersion = headers["x-client-version"];

  const callbackResult = await service.handleCallback(authService, {
    code: searchParams.get("code") || undefined,
    state: searchParams.get("state") || undefined,
    error: searchParams.get("error") || undefined,
    errorDescription: searchParams.get("error_description") || undefined,
  });

  return buildCallbackResult(requestId, clientVersion, callbackResult);
}
