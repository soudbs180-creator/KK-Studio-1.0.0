import { getDocumentLanguage, pickByResolvedLanguage, type ResolvedLanguage } from "../../utils/localeText.ts";

export interface ParsedWechatAuthorizationUrl {
  appId: string;
  redirectUri: string;
  scope: string;
  state: string;
  language?: 'en';
}

export function parseWechatAuthorizationUrl(
  authorizationUrl?: string | null,
): ParsedWechatAuthorizationUrl | null {
  if (!authorizationUrl) {
    return null;
  }

  try {
    const url = new URL(authorizationUrl);
    const appId = url.searchParams.get('appid');
    const redirectUri = url.searchParams.get('redirect_uri');
    const scope = url.searchParams.get('scope');
    const state = url.searchParams.get('state');
    const language = url.searchParams.get('lang');

    if (
      url.origin !== 'https://open.weixin.qq.com'
      || url.pathname !== '/connect/qrconnect'
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
      language: language === 'en' ? 'en' : undefined,
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
  if (code === 'WECHAT_AUTH_UNAVAILABLE') {
    return pickByResolvedLanguage(
      language,
      '微信扫码登录尚未在 Supabase Edge Function 中完成配置。请补齐 Function Secrets 和微信开放平台参数后再试。',
      'WeChat sign-in is not configured in the Supabase Edge Function yet. Add the required function secrets and WeChat Open Platform settings, then try again.',
    );
  }

  if (code === 'EDGE_FUNCTION_UNAVAILABLE') {
    return pickByResolvedLanguage(
      language,
      '无法连接微信登录所需的 Supabase Edge Function。请确认 wechat-auth 已部署，并检查 Supabase 网络连通性。',
      'Unable to reach the Supabase Edge Function required for WeChat sign-in. Confirm that wechat-auth is deployed and that Supabase is reachable.',
    );
  }

  if (code === 'INVALID_RESPONSE_PAYLOAD') {
    return pickByResolvedLanguage(
      language,
      '微信登录服务返回了无法识别的数据。请确认 wechat-auth Edge Function 与回调地址配置正确。',
      'The WeChat sign-in service returned an invalid payload. Check the wechat-auth Edge Function and callback URL configuration.',
    );
  }

  const normalizedMessage = String(message || '').toLowerCase();
  if (code === 'NETWORK_ERROR' || normalizedMessage.includes('failed to fetch') || normalizedMessage.includes('network')) {
    return pickByResolvedLanguage(
      language,
      '无法连接微信登录服务。请检查 Supabase Edge Function 或本地代理是否可用。',
      'Unable to reach the WeChat sign-in service. Check whether the Supabase Edge Function or local proxy is available.',
    );
  }

  if (normalizedMessage.includes('redirectto origin is not allowed')) {
    return pickByResolvedLanguage(
      language,
      '当前站点地址不在 WECHAT_ALLOWED_REDIRECT_ORIGINS 白名单中，请先补齐函数侧配置。',
      'The current site origin is not listed in WECHAT_ALLOWED_REDIRECT_ORIGINS. Update the function configuration first.',
    );
  }

  if (normalizedMessage.includes('redirectto is required')) {
    return pickByResolvedLanguage(
      language,
      '微信登录回跳地址缺失，请刷新页面后重试。',
      'The WeChat sign-in redirect URL is missing. Refresh the page and try again.',
    );
  }

  if (message?.trim()) {
    return message;
  }

  return pickByResolvedLanguage(
    language,
    '暂时无法发起微信扫码登录，请稍后重试。',
    'Unable to start WeChat QR sign-in right now. Please try again shortly.',
  );
}
