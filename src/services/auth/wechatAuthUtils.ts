import { getDocumentLanguage, pickByResolvedLanguage, type ResolvedLanguage } from "../../utils/localeText.ts";

export interface ParsedWechatAuthorizationUrl {
  appId: string;
  redirectUri: string;
  scope: string;
  state: string;
  language?: "en";
}

export function parseWechatAuthorizationUrl(
  authorizationUrl?: string | null,
): ParsedWechatAuthorizationUrl | null {
  if (!authorizationUrl) {
    return null;
  }

  try {
    const url = new URL(authorizationUrl);
    const appId = url.searchParams.get("appid");
    const redirectUri = url.searchParams.get("redirect_uri");
    const scope = url.searchParams.get("scope");
    const state = url.searchParams.get("state");
    const language = url.searchParams.get("lang");

    if (
      url.origin !== "https://open.weixin.qq.com"
      || url.pathname !== "/connect/qrconnect"
      || !appId
      || !redirectUri
      || !scope
      || !state
    ) {
      return null;
    }

    return {
      appId,
      redirectUri,
      scope,
      state,
      language: language === "en" ? "en" : undefined,
    };
  } catch {
    return null;
  }
}

export function resolveWechatStartErrorMessage(
  code: string | undefined,
  message: string | undefined,
  language: ResolvedLanguage = getDocumentLanguage(),
): string {
  if (code === "WECHAT_AUTH_UNAVAILABLE") {
    return pickByResolvedLanguage(
      language,
      "微信登录接口尚未在 KK API 中完成配置，请先补齐本地认证服务和微信开放平台参数。",
      "The WeChat sign-in route is not configured in the KK API yet. Finish the local auth service and WeChat Open Platform setup first.",
    );
  }

  if (code === "EDGE_FUNCTION_UNAVAILABLE") {
    return pickByResolvedLanguage(
      language,
      "无法连接微信登录所需的 KK API 路由，请确认本地 API 服务正在运行。",
      "Unable to reach the KK API route required for WeChat sign-in. Confirm that the local API service is running.",
    );
  }

  if (code === "INVALID_RESPONSE_PAYLOAD") {
    return pickByResolvedLanguage(
      language,
      "微信登录接口返回了无法识别的数据，请检查 KK API 回包和回调地址配置。",
      "The WeChat sign-in route returned an invalid payload. Check the KK API response and callback URL configuration.",
    );
  }

  if (code === "AUTH_REQUIRED" || code === "HTTP_401" || code === "HTTP_403") {
    return pickByResolvedLanguage(
      language,
      "当前账号还没有可用的 KK API 登录会话，暂时无法绑定微信。",
      "The current account does not have an active KK API session yet, so WeChat binding is unavailable.",
    );
  }

  if (code === "HTTP_404" || code === "HTTP_405" || code === "AUTH_ROUTE_DISABLED") {
    return pickByResolvedLanguage(
      language,
      "微信登录接口尚未在本地运行时就绪，请等待后端认证链路接通后再试。",
      "The WeChat auth route is not ready in the local runtime yet. Try again after the backend auth flow is wired up.",
    );
  }

  const normalizedMessage = String(message || "").toLowerCase();
  if (code === "NETWORK_ERROR" || normalizedMessage.includes("failed to fetch") || normalizedMessage.includes("network")) {
    return pickByResolvedLanguage(
      language,
      "无法连接微信登录服务，请检查本地 API 是否可用。",
      "Unable to reach the WeChat sign-in service. Check whether the local API is available.",
    );
  }

  if (normalizedMessage.includes("redirectto origin is not allowed")) {
    return pickByResolvedLanguage(
      language,
      "当前站点地址不在微信回调白名单中，请先补齐本地认证服务配置。",
      "The current site origin is not on the WeChat redirect allowlist. Update the local auth configuration first.",
    );
  }

  if (normalizedMessage.includes("redirectto is required")) {
    return pickByResolvedLanguage(
      language,
      "微信登录回跳地址缺失，请刷新页面后重试。",
      "The WeChat sign-in redirect URL is missing. Refresh the page and try again.",
    );
  }

  if (message?.trim()) {
    return message;
  }

  return pickByResolvedLanguage(
    language,
    "暂时无法发起微信扫码登录，请稍后重试。",
    "Unable to start WeChat QR sign-in right now. Please try again shortly.",
  );
}
