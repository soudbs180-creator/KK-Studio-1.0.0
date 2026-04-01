import type { WechatAuthStartResponseDto } from "../../../packages/contracts/src/index.ts";
import { supabase } from "../../lib/supabase.ts";
import { legacyWebApiClient, shouldUseLegacyWebApiFallback } from "../api/kkApiClient.ts";
import { buildAuthRedirectUrl, resolveAuthRedirectOrigin } from "../../config/authRedirect.ts";
import { resolveWechatStartErrorMessage } from "./wechatAuthUtils.ts";

export type WechatFlowMode = "login" | "bind";

type WechatEdgeAction = "start-login" | "start-bind";

type WechatErrorEnvelope = {
  code?: string;
  message?: string;
} | string | null | undefined;

type WechatEdgeEnvelope<T> = {
  success?: boolean;
  data?: T;
  error?: WechatErrorEnvelope;
};

class WechatStartError extends Error {
  code?: string;

  constructor(code: string | undefined, message: string) {
    super(message);
    this.name = "WechatStartError";
    this.code = code;
  }
}

function resolveBrowserOrigin(): string {
  return resolveAuthRedirectOrigin();
}

export function buildWechatCallbackUrl(mode: WechatFlowMode): string {
  const callbackUrl = new URL(buildAuthRedirectUrl(), `${resolveBrowserOrigin()}/`);

  if (mode === "bind") {
    callbackUrl.searchParams.set("mode", "wechat-bind");
  }

  return callbackUrl.toString();
}

function normalizeWechatErrorMessage(error: WechatErrorEnvelope, fallback: string): string {
  if (typeof error === "string") {
    return error.trim() || fallback;
  }

  if (typeof error === "object" && error) {
    const message = String(error.message || "").trim();
    if (message) {
      return message;
    }
  }

  return fallback;
}

function normalizeWechatErrorCode(
  error: WechatErrorEnvelope,
  fallback: string,
): string {
  if (typeof error === "object" && error) {
    const code = String(error.code || "").trim();
    if (code) {
      return code;
    }
  }

  return fallback;
}

function toWechatStartError(error: unknown): WechatStartError {
  if (error instanceof WechatStartError) {
    return error;
  }

  if (error instanceof Error) {
    return new WechatStartError(undefined, error.message || "Failed to start WeChat authentication.");
  }

  return new WechatStartError(undefined, "Failed to start WeChat authentication.");
}

function validateWechatStartPayload(
  payload: Partial<WechatAuthStartResponseDto> | undefined,
): WechatAuthStartResponseDto {
  if (!payload?.authorizationUrl || typeof payload.authorizationUrl !== "string") {
    throw new WechatStartError(
      "INVALID_RESPONSE_PAYLOAD",
      "WeChat authentication service did not return an authorization URL.",
    );
  }

  return payload as WechatAuthStartResponseDto;
}

async function invokeWechatAuthEdgeFunction(
  action: WechatEdgeAction,
  redirectTo: string,
): Promise<WechatAuthStartResponseDto> {
  const {
    data: { session },
    error: sessionError,
  } = await supabase.auth.getSession();

  if (sessionError) {
    throw new WechatStartError("NETWORK_ERROR", sessionError.message || "Failed to resolve the active session.");
  }

  if (action === "start-bind" && !session?.access_token) {
    throw new WechatStartError("AUTH_REQUIRED", "Authentication is required to bind a WeChat account.");
  }

  const invokeHeaders = session?.access_token
    ? { Authorization: `Bearer ${session.access_token}` }
    : undefined;

  const { data, error } = await supabase.functions.invoke("wechat-auth", {
    body: {
      action,
      redirectTo,
    },
    headers: invokeHeaders,
  });

  if (error) {
    throw new WechatStartError(
      "EDGE_FUNCTION_UNAVAILABLE",
      error.message || "Failed to invoke the wechat-auth Edge Function.",
    );
  }

  if (!data || typeof data !== "object" || Array.isArray(data)) {
    throw new WechatStartError(
      "INVALID_RESPONSE_PAYLOAD",
      "Supabase Edge Function returned an invalid payload.",
    );
  }

  const envelope = data as WechatEdgeEnvelope<WechatAuthStartResponseDto>;
  if (envelope.success !== true) {
    throw new WechatStartError(
      normalizeWechatErrorCode(envelope.error, "WECHAT_START_INVALID"),
      normalizeWechatErrorMessage(envelope.error, "Unable to start WeChat authentication."),
    );
  }

  return validateWechatStartPayload(envelope.data);
}

function shouldFallbackToLegacyWechat(error: WechatStartError): boolean {
  const normalizedCode = String(error.code || "").trim().toUpperCase();
  return normalizedCode === "WECHAT_AUTH_UNAVAILABLE"
    || normalizedCode === "EDGE_FUNCTION_UNAVAILABLE"
    || normalizedCode === "NETWORK_ERROR"
    || normalizedCode === "INVALID_RESPONSE_PAYLOAD";
}

async function invokeLegacyWechatStart(
  mode: WechatFlowMode,
  redirectTo: string,
): Promise<WechatAuthStartResponseDto> {
  const response = mode === "login"
    ? await legacyWebApiClient.startWechatLogin(redirectTo)
    : await legacyWebApiClient.startWechatBind(redirectTo);

  if (!response.success) {
    throw new WechatStartError(
      response.error?.code,
      response.error?.message || "Unable to start WeChat authentication through the legacy API.",
    );
  }

  return validateWechatStartPayload(response.data as Partial<WechatAuthStartResponseDto> | undefined);
}

async function startWechatFlow(mode: WechatFlowMode): Promise<WechatAuthStartResponseDto> {
  const redirectTo = buildWechatCallbackUrl(mode);

  try {
    return await invokeWechatAuthEdgeFunction(mode === "login" ? "start-login" : "start-bind", redirectTo);
  } catch (edgeError) {
    const resolvedEdgeError = toWechatStartError(edgeError);

    if (shouldUseLegacyWebApiFallback() && shouldFallbackToLegacyWechat(resolvedEdgeError)) {
      try {
        return await invokeLegacyWechatStart(mode, redirectTo);
      } catch (legacyError) {
        const resolvedLegacyError = toWechatStartError(legacyError);
        throw new Error(
          resolveWechatStartErrorMessage(resolvedLegacyError.code, resolvedLegacyError.message),
        );
      }
    }

    throw new Error(
      resolveWechatStartErrorMessage(resolvedEdgeError.code, resolvedEdgeError.message),
    );
  }
}

export async function startWechatLogin(): Promise<WechatAuthStartResponseDto> {
  return startWechatFlow("login");
}

export async function startWechatBind(): Promise<WechatAuthStartResponseDto> {
  return startWechatFlow("bind");
}
