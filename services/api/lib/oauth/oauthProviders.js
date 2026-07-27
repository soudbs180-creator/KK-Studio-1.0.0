const { OAuthFlowError } = require('./oauthError');

const GOOGLE_AUTHORIZATION_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';
const GOOGLE_USERINFO_URL = 'https://openidconnect.googleapis.com/v1/userinfo';
const WECHAT_AUTHORIZATION_URL = 'https://open.weixin.qq.com/connect/qrconnect';
const WECHAT_TOKEN_URL = 'https://api.weixin.qq.com/sns/oauth2/access_token';
const WECHAT_USERINFO_URL = 'https://api.weixin.qq.com/sns/userinfo';

function readRequiredSubject(value, provider) {
  const subject = String(value || '').trim();
  if (!subject || subject.length > 255) {
    throw new OAuthFlowError(
      'OAUTH_PROVIDER_INVALID_PROFILE',
      `${provider} 未返回有效用户身份。`,
      502,
    );
  }
  return subject;
}

function readProfileText(value, fallback) {
  return String(value || '').trim().slice(0, 255) || fallback;
}

function readVerifiedEmail(profile) {
  const email = String(profile.email || '').trim().toLowerCase();
  const validEmail = email.length <= 255 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  return profile.email_verified === true && validEmail ? email : null;
}

function readAvatarUrl(value) {
  const rawUrl = String(value || '').trim();
  if (!rawUrl || rawUrl.length > 2048) return null;
  try {
    const avatarUrl = new URL(rawUrl);
    return ['http:', 'https:'].includes(avatarUrl.protocol) ? avatarUrl.toString() : null;
  } catch {
    return null;
  }
}

async function requestJson(fetchImpl, url, options = {}) {
  const abortController = new AbortController();
  const timeout = setTimeout(() => abortController.abort(), 10_000);
  try {
    const response = await fetchImpl(url, { ...options, signal: abortController.signal });
    const payload = await response.json();
    if (!response.ok) {
      throw new OAuthFlowError('OAUTH_PROVIDER_REJECTED', '第三方登录服务拒绝了授权请求。', 502);
    }
    return payload;
  } catch (error) {
    if (error instanceof OAuthFlowError) throw error;
    throw new OAuthFlowError('OAUTH_PROVIDER_REQUEST_FAILED', '无法连接第三方登录服务。', 502);
  } finally {
    clearTimeout(timeout);
  }
}

function buildGoogleAuthorizationUrl(config, state) {
  const url = new URL(GOOGLE_AUTHORIZATION_URL);
  url.search = new URLSearchParams({
    client_id: config.clientId,
    redirect_uri: config.redirectUri,
    response_type: 'code',
    scope: 'openid email profile',
    state,
    prompt: 'select_account',
  }).toString();
  return url.toString();
}

function buildWechatAuthorizationUrl(config, state) {
  const url = new URL(WECHAT_AUTHORIZATION_URL);
  url.search = new URLSearchParams({
    appid: config.clientId,
    redirect_uri: config.redirectUri,
    response_type: 'code',
    scope: 'snsapi_login',
    state,
  }).toString();
  return `${url.toString()}#wechat_redirect`;
}

function buildAuthorizationUrl(provider, config, state) {
  return provider === 'google'
    ? buildGoogleAuthorizationUrl(config, state)
    : buildWechatAuthorizationUrl(config, state);
}

async function exchangeGoogleCode(fetchImpl, config, code) {
  const tokenPayload = await requestJson(fetchImpl, GOOGLE_TOKEN_URL, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: config.clientId,
      client_secret: config.clientSecret,
      code,
      grant_type: 'authorization_code',
      redirect_uri: config.redirectUri,
    }),
  });
  if (!tokenPayload.access_token) {
    throw new OAuthFlowError('OAUTH_PROVIDER_INVALID_RESPONSE', 'Google 未返回有效登录凭据。', 502);
  }

  const profile = await requestJson(fetchImpl, GOOGLE_USERINFO_URL, {
    headers: { authorization: `Bearer ${tokenPayload.access_token}` },
  });
  const providerSubject = readRequiredSubject(profile.sub, 'Google');
  const email = readVerifiedEmail(profile);
  return {
    provider: 'google',
    providerAppId: config.clientId,
    providerSubject,
    email,
    emailVerified: Boolean(email),
    openId: null,
    unionId: null,
    displayName: readProfileText(profile.name, 'Google User'),
    avatarUrl: readAvatarUrl(profile.picture),
  };
}

function assertWechatPayload(payload, fallbackMessage) {
  if (payload.errcode || payload.error) {
    throw new OAuthFlowError('OAUTH_PROVIDER_REJECTED', fallbackMessage, 502);
  }
}

async function exchangeWechatCode(fetchImpl, config, code) {
  const tokenUrl = new URL(WECHAT_TOKEN_URL);
  tokenUrl.search = new URLSearchParams({
    appid: config.clientId,
    secret: config.clientSecret,
    code,
    grant_type: 'authorization_code',
  }).toString();
  const tokenPayload = await requestJson(fetchImpl, tokenUrl);
  assertWechatPayload(tokenPayload, '微信拒绝了授权码交换请求。');
  if (!tokenPayload.access_token || !tokenPayload.openid) {
    throw new OAuthFlowError('OAUTH_PROVIDER_INVALID_RESPONSE', '微信未返回有效登录凭据。', 502);
  }
  const openId = readRequiredSubject(tokenPayload.openid, '微信');

  const profileUrl = new URL(WECHAT_USERINFO_URL);
  profileUrl.search = new URLSearchParams({
    access_token: tokenPayload.access_token,
    openid: tokenPayload.openid,
    lang: 'zh_CN',
  }).toString();
  const profile = await requestJson(fetchImpl, profileUrl);
  assertWechatPayload(profile, '微信未返回有效用户资料。');
  const unionId = String(profile.unionid || tokenPayload.unionid || '').trim();
  if (unionId.length > 255) {
    throw new OAuthFlowError('OAUTH_PROVIDER_INVALID_PROFILE', '微信未返回有效用户身份。', 502);
  }
  return {
    provider: 'wechat',
    providerAppId: config.clientId,
    providerSubject: openId,
    email: null,
    emailVerified: false,
    openId,
    unionId: unionId || null,
    displayName: readProfileText(profile.nickname, '微信用户'),
    avatarUrl: readAvatarUrl(profile.headimgurl),
  };
}

function exchangeAuthorizationCode(provider, fetchImpl, config, code) {
  return provider === 'google'
    ? exchangeGoogleCode(fetchImpl, config, code)
    : exchangeWechatCode(fetchImpl, config, code);
}

module.exports = {
  buildAuthorizationUrl,
  exchangeAuthorizationCode,
  exchangeGoogleCode,
  exchangeWechatCode,
};
