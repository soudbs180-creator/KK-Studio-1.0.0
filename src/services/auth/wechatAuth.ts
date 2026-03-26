import type { WechatAuthStartResponseDto } from "../../../packages/contracts/src/index.ts";
import { legacyWebApiClient } from "../api/kkApiClient.ts";
import { buildAuthRedirectUrl, resolveAuthRedirectOrigin } from "../../config/authRedirect.ts";
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

async function startWechatFlow(mode: WechatFlowMode): Promise<WechatAuthStartResponseDto> {
  const redirectTo = buildWechatCallbackUrl(mode);
  const response = mode === "login"
    ? await legacyWebApiClient.startWechatLogin(redirectTo)
    : await legacyWebApiClient.startWechatBind(redirectTo);

  if (!response.success) {
    throw new Error(resolveWechatStartErrorMessage(response.error?.code, response.error?.message));
  }

  const payload = response.data as Partial<WechatAuthStartResponseDto> | undefined;
  if (!payload?.authorizationUrl || typeof payload.authorizationUrl !== "string") {
    throw new Error(
      "微信登录接口没有返回二维码地址。请确认 KK API 服务已启动，并检查 VITE_KK_API_BASE_URL 或本地 3001 端口。",
    );
  }

  return payload as WechatAuthStartResponseDto;
}

export async function startWechatLogin(): Promise<WechatAuthStartResponseDto> {
  return startWechatFlow("login");
}

export async function startWechatBind(): Promise<WechatAuthStartResponseDto> {
  return startWechatFlow("bind");
}
