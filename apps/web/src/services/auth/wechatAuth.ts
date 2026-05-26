import type { WechatAuthStartResponseDto } from "../../../../../packages/shared/src/index.ts";

import { buildAuthRedirectUrl, resolveAuthRedirectOrigin } from "../../config/authRedirect.ts";
import { kkWebApiClient } from "../api/kkApiClient.ts";
import { resolveWechatStartErrorMessage } from "./wechatAuthUtils.ts";

export type WechatFlowMode = "login" | "bind";

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

function validateWechatStartPayload(
  payload: Partial<WechatAuthStartResponseDto> | undefined,
): WechatAuthStartResponseDto {
  if (!payload?.authorizationUrl || typeof payload.authorizationUrl !== "string") {
    throw new Error(resolveWechatStartErrorMessage(
      "INVALID_RESPONSE_PAYLOAD",
      "The WeChat auth endpoint did not return a valid authorization URL.",
    ));
  }

  return payload as WechatAuthStartResponseDto;
}

async function startWechatFlow(mode: WechatFlowMode): Promise<WechatAuthStartResponseDto> {
  const redirectTo = buildWechatCallbackUrl(mode);
  const response = mode === "login"
    ? await kkWebApiClient.startWechatLogin(redirectTo)
    : await kkWebApiClient.startWechatBind(redirectTo);

  if (!response.success) {
    throw new Error(
      resolveWechatStartErrorMessage(
        response.error.code,
        response.error.message || "Unable to start WeChat authentication.",
      ),
    );
  }

  return validateWechatStartPayload(response.data as Partial<WechatAuthStartResponseDto> | undefined);
}

export async function startWechatLogin(): Promise<WechatAuthStartResponseDto> {
  return startWechatFlow("login");
}

export async function startWechatBind(): Promise<WechatAuthStartResponseDto> {
  return startWechatFlow("bind");
}

