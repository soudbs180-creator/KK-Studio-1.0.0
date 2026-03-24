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
): string {
  if (code === "WECHAT_AUTH_UNAVAILABLE") {
    return "微信扫码登录尚未在 API 服务端完成配置。请补齐 Supabase Service Role Key 和微信开放平台参数后再试。";
  }

  if (code === "INVALID_RESPONSE_PAYLOAD") {
    return "微信登录接口返回了网页而不是 JSON。请确认前端已代理到 KK API，或检查 VITE_KK_API_BASE_URL 配置。";
  }

  const normalizedMessage = String(message || "").toLowerCase();
  if (code === "NETWORK_ERROR" || normalizedMessage.includes("failed to fetch") || normalizedMessage.includes("network")) {
    return "无法连接 KK API 服务。请确认本地 3001 API 已启动，或检查 VITE_KK_API_BASE_URL 配置。";
  }

  if (normalizedMessage.includes("redirectto origin is not allowed")) {
    return "当前站点地址不在 WECHAT_ALLOWED_REDIRECT_ORIGINS 白名单中，请先补充服务端配置。";
  }

  if (normalizedMessage.includes("redirectto is required")) {
    return "微信登录回跳地址缺失，请刷新页面后重试。";
  }

  if (message?.trim()) {
    return message;
  }

  return "暂时无法发起微信扫码登录，请稍后重试。";
}
