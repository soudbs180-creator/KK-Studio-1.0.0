const { OAuthFlowError } = require('./oauthError');

const PROVIDER_CONFIG = {
  google: {
    clientId: 'GOOGLE_OAUTH_CLIENT_ID',
    clientSecret: 'GOOGLE_OAUTH_CLIENT_SECRET',
    redirectUris: ['GOOGLE_OAUTH_REDIRECT_URI'],
    allowedOrigins: 'GOOGLE_ALLOWED_REDIRECT_ORIGINS',
  },
  wechat: {
    clientId: 'WECHAT_OPEN_APP_ID',
    clientSecret: 'WECHAT_OPEN_APP_SECRET',
    redirectUris: ['WECHAT_OPEN_REDIRECT_URI', 'WECHAT_OAUTH_REDIRECT_URI'],
    allowedOrigins: 'WECHAT_ALLOWED_REDIRECT_ORIGINS',
  },
};

function readFirstEnv(env, names) {
  return names.map((name) => String(env[name] || '').trim()).find(Boolean) || '';
}

function readProviderConfig(provider, env = process.env) {
  const keys = PROVIDER_CONFIG[provider];
  if (!keys) {
    throw new OAuthFlowError('OAUTH_PROVIDER_UNSUPPORTED', '不支持的登录方式。', 404);
  }

  const config = {
    provider,
    clientId: String(env[keys.clientId] || '').trim(),
    clientSecret: String(env[keys.clientSecret] || '').trim(),
    redirectUri: readFirstEnv(env, keys.redirectUris),
  };
  if (!config.clientId || !config.clientSecret || !config.redirectUri) {
    throw new OAuthFlowError(
      'OAUTH_PROVIDER_NOT_CONFIGURED',
      `${provider === 'google' ? 'Google' : '微信'}登录尚未完成服务端配置。`,
      503,
    );
  }
  try {
    const callbackUrl = new URL(config.redirectUri);
    const invalidCallback = !['http:', 'https:'].includes(callbackUrl.protocol)
      || callbackUrl.username
      || callbackUrl.password
      || callbackUrl.hash;
    if (invalidCallback || config.clientId.length > 255) throw new Error('invalid callback');
  } catch {
    throw new OAuthFlowError(
      'OAUTH_PROVIDER_CONFIG_INVALID',
      `${provider === 'google' ? 'Google' : '微信'}登录回调配置无效。`,
      503,
    );
  }
  return config;
}

function collectAllowedOrigins(provider, env = process.env) {
  const providerKey = PROVIDER_CONFIG[provider]?.allowedOrigins;
  const values = [
    providerKey ? env[providerKey] : '',
    env.OAUTH_ALLOWED_REDIRECT_ORIGINS,
    env.ALLOWED_ORIGINS,
    env.PUBLIC_APP_URL,
    env.KK_PUBLIC_APP_URL,
    env.WEB_PUBLIC_URL,
  ];
  return new Set(values
    .flatMap((value) => String(value || '').split(','))
    .map((value) => value.trim())
    .filter(Boolean)
    .map((value) => {
      try {
        return new URL(value).origin;
      } catch {
        return '';
      }
    })
    .filter(Boolean));
}

function resolveDefaultRedirect(env = process.env) {
  const publicUrl = readFirstEnv(env, ['PUBLIC_APP_URL', 'KK_PUBLIC_APP_URL', 'WEB_PUBLIC_URL']);
  if (!publicUrl) {
    throw new OAuthFlowError(
      'OAUTH_REDIRECT_NOT_CONFIGURED',
      '第三方登录回跳地址尚未配置。',
      503,
    );
  }
  return new URL('/auth/callback', publicUrl).toString();
}

function resolveSafeRedirectTo(rawRedirect, provider, env = process.env) {
  let redirectUrl;
  try {
    redirectUrl = new URL(String(rawRedirect || '').trim() || resolveDefaultRedirect(env));
  } catch {
    throw new OAuthFlowError('OAUTH_REDIRECT_INVALID', '登录回跳地址无效。', 400);
  }

  const allowedOrigins = collectAllowedOrigins(provider, env);
  const invalidProtocol = !['http:', 'https:'].includes(redirectUrl.protocol);
  if (invalidProtocol || redirectUrl.username || redirectUrl.password || !allowedOrigins.has(redirectUrl.origin)) {
    throw new OAuthFlowError('OAUTH_REDIRECT_NOT_ALLOWED', '登录回跳地址不在允许列表中。', 400);
  }
  redirectUrl.hash = '';
  return redirectUrl.toString();
}

function resolveStateTtlSeconds(env = process.env) {
  const configured = Number(env.OAUTH_STATE_TTL_SECONDS || 600);
  return Number.isFinite(configured) ? Math.min(900, Math.max(120, Math.round(configured))) : 600;
}

module.exports = {
  collectAllowedOrigins,
  readProviderConfig,
  resolveSafeRedirectTo,
  resolveStateTtlSeconds,
};
