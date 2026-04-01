import type { SupabaseClient, User } from 'https://esm.sh/@supabase/supabase-js@2';

import { createSupabaseFunctionClients, requireAuthenticatedUser } from './_shared/auth.ts';

type WechatAuthMode = 'login' | 'bind';

type WechatAuthStartResponseDto = {
  provider: 'wechat';
  mode: WechatAuthMode;
  authorizationUrl: string;
  callbackUrl: string;
  state: string;
  expiresAt: string;
};

type WechatEdgeEnvelope<T> = {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
  };
};

type WechatCodeExchangeResponse = {
  access_token?: string;
  expires_in?: number;
  refresh_token?: string;
  openid?: string;
  scope?: string;
  unionid?: string;
  errcode?: number;
  errmsg?: string;
};

type WechatUserInfoResponse = {
  openid?: string;
  nickname?: string;
  headimgurl?: string;
  unionid?: string;
  errcode?: number;
  errmsg?: string;
  [key: string]: unknown;
};

type ExternalIdentityRow = {
  id: string;
  user_id: string;
  provider: string;
  provider_appid: string;
  provider_unionid: string | null;
  provider_openid: string;
  nickname: string | null;
  avatar_url: string | null;
  raw_profile: Record<string, unknown> | null;
  last_login_at: string | null;
  created_at: string;
  updated_at: string;
};

type ProfileLookupRow = {
  id: string;
  email: string | null;
};

type SignedWechatState = {
  v: 1;
  mode: WechatAuthMode;
  redirectTo: string;
  userId?: string;
  nonce: string;
  issuedAt: string;
  expiresAt: string;
};

type WechatConfig = {
  providerAppId: string;
  providerSecret: string;
  callbackUrl: string;
  stateSigningSecret: string;
  allowedRedirectOrigins: string[];
  defaultRedirectUrl?: string;
  stateTtlMs: number;
};

type StartWechatAuthPayload = {
  action?: string;
  redirectTo?: string;
};

type WechatCallbackResult = {
  redirectTo?: string;
  errorCode?: string;
  errorDescription?: string;
};

class WechatFunctionError extends Error {
  status: number;
  code: string;

  constructor(status: number, code: string, message: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
};

const encoder = new TextEncoder();
const decoder = new TextDecoder();
const DEFAULT_STATE_TTL_MS = 10 * 60 * 1000;

function jsonResponse<T>(status: number, body: WechatEdgeEnvelope<T>): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json',
    },
  });
}

function successResponse<T>(data: T, status = 200): Response {
  return jsonResponse(status, {
    success: true,
    data,
  });
}

function errorResponse(
  code: string,
  message: string,
  status = 400,
): Response {
  return jsonResponse(status, {
    success: false,
    error: {
      code,
      message,
    },
  });
}

function normalizeOptionalString(value: unknown): string | undefined {
  if (typeof value !== 'string') {
    return undefined;
  }

  const normalized = value.trim();
  return normalized || undefined;
}

function normalizeRequiredString(value: unknown, code: string, message: string): string {
  const normalized = normalizeOptionalString(value);
  if (!normalized) {
    throw new WechatFunctionError(400, code, message);
  }

  return normalized;
}

function resolveFunctionRoutePath(pathname: string): string {
  const marker = '/wechat-auth';
  const markerIndex = pathname.indexOf(marker);
  if (markerIndex === -1) {
    return pathname || '/';
  }

  const suffix = pathname.slice(markerIndex + marker.length);
  return suffix || '/';
}

function normalizeAllowedRedirectOrigins(
  rawOrigins: string | undefined,
): string[] {
  const candidates = String(rawOrigins || '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);

  if (candidates.length === 0) {
    return [];
  }

  return Array.from(
    new Set(
      candidates.map((origin) => {
        const url = new URL(origin);
        if (url.protocol !== 'http:' && url.protocol !== 'https:') {
          throw new WechatFunctionError(
            500,
            'WECHAT_AUTH_UNAVAILABLE',
            'Allowed WeChat redirect origins must use http or https.',
          );
        }

        return url.origin;
      }),
    ),
  );
}

function resolveWechatConfig(): WechatConfig {
  const providerAppId = String(Deno.env.get('WECHAT_OPEN_APP_ID') || '').trim();
  const providerSecret = String(Deno.env.get('WECHAT_OPEN_APP_SECRET') || '').trim();
  const callbackUrl = String(Deno.env.get('WECHAT_OPEN_REDIRECT_URI') || '').trim();
  const stateSigningSecret = String(Deno.env.get('WECHAT_STATE_SIGNING_SECRET') || '').trim();
  const defaultRedirectUrl = normalizeOptionalString(Deno.env.get('WECHAT_DEFAULT_REDIRECT_URL'));
  const stateTtlMs = Math.max(
    60_000,
    Number(Deno.env.get('WECHAT_STATE_TTL_MS') || DEFAULT_STATE_TTL_MS) || DEFAULT_STATE_TTL_MS,
  );

  if (!providerAppId || !providerSecret || !callbackUrl || !stateSigningSecret) {
    throw new WechatFunctionError(
      503,
      'WECHAT_AUTH_UNAVAILABLE',
      'WeChat auth function secrets are missing. Configure WECHAT_OPEN_APP_ID, WECHAT_OPEN_APP_SECRET, WECHAT_OPEN_REDIRECT_URI, and WECHAT_STATE_SIGNING_SECRET.',
    );
  }

  const callback = new URL(callbackUrl);
  if (callback.protocol !== 'http:' && callback.protocol !== 'https:') {
    throw new WechatFunctionError(
      503,
      'WECHAT_AUTH_UNAVAILABLE',
      'WECHAT_OPEN_REDIRECT_URI must use http or https.',
    );
  }

  const allowedRedirectOrigins = normalizeAllowedRedirectOrigins(
    Deno.env.get('WECHAT_ALLOWED_REDIRECT_ORIGINS') || undefined,
  );

  return {
    providerAppId,
    providerSecret,
    callbackUrl: callback.toString(),
    stateSigningSecret,
    allowedRedirectOrigins,
    defaultRedirectUrl: defaultRedirectUrl ? normalizeRedirectUrl(defaultRedirectUrl, allowedRedirectOrigins) : undefined,
    stateTtlMs,
  };
}

function normalizeRedirectUrl(value: string, allowedRedirectOrigins: string[]): string {
  const url = new URL(value);
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new WechatFunctionError(400, 'WECHAT_START_INVALID', 'redirectTo must use http or https.');
  }

  if (allowedRedirectOrigins.length > 0 && !allowedRedirectOrigins.includes(url.origin)) {
    throw new WechatFunctionError(
      400,
      'WECHAT_START_INVALID',
      'redirectTo origin is not allowed for WeChat authentication.',
    );
  }

  return url.toString();
}

function buildDefaultRedirectUrl(config: WechatConfig): string | undefined {
  if (config.defaultRedirectUrl) {
    return config.defaultRedirectUrl;
  }

  const firstAllowedOrigin = config.allowedRedirectOrigins[0];
  if (!firstAllowedOrigin) {
    return undefined;
  }

  return new URL('/auth/callback', firstAllowedOrigin).toString();
}

function appendQueryParams(url: string, params: Record<string, string>): string {
  const nextUrl = new URL(url);
  Object.entries(params).forEach(([key, value]) => {
    nextUrl.searchParams.set(key, value);
  });
  return nextUrl.toString();
}

function bytesToBase64Url(bytes: Uint8Array): string {
  let binary = '';
  bytes.forEach((value) => {
    binary += String.fromCharCode(value);
  });

  return btoa(binary)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');
}

function base64UrlToBytes(value: string): Uint8Array {
  const normalized = value
    .replace(/-/g, '+')
    .replace(/_/g, '/')
    .padEnd(Math.ceil(value.length / 4) * 4, '=');

  const binary = atob(normalized);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

async function createStateSignature(encodedPayload: string, secret: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );

  const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(encodedPayload));
  return bytesToBase64Url(new Uint8Array(signature));
}

function constantTimeStringEquals(left: string, right: string): boolean {
  if (left.length !== right.length) {
    return false;
  }

  let diff = 0;
  for (let index = 0; index < left.length; index += 1) {
    diff |= left.charCodeAt(index) ^ right.charCodeAt(index);
  }

  return diff === 0;
}

async function signWechatState(
  payload: SignedWechatState,
  secret: string,
): Promise<string> {
  const encodedPayload = bytesToBase64Url(encoder.encode(JSON.stringify(payload)));
  const signature = await createStateSignature(encodedPayload, secret);
  return `${encodedPayload}.${signature}`;
}

async function verifyWechatState(
  state: string,
  config: WechatConfig,
): Promise<SignedWechatState> {
  const [encodedPayload, signature] = state.split('.');
  if (!encodedPayload || !signature) {
    throw new Error('Invalid WeChat state format.');
  }

  const expectedSignature = await createStateSignature(encodedPayload, config.stateSigningSecret);
  if (!constantTimeStringEquals(signature, expectedSignature)) {
    throw new Error('WeChat state signature verification failed.');
  }

  const payload = JSON.parse(decoder.decode(base64UrlToBytes(encodedPayload))) as SignedWechatState;
  if (payload.v !== 1) {
    throw new Error('Unsupported WeChat state version.');
  }

  const expiresAt = new Date(payload.expiresAt);
  if (Number.isNaN(expiresAt.getTime()) || expiresAt.getTime() < Date.now()) {
    throw new Error('The WeChat login state has expired.');
  }

  payload.redirectTo = normalizeRedirectUrl(payload.redirectTo, config.allowedRedirectOrigins);
  return payload;
}

async function buildWechatAuthorizationPayload(
  config: WechatConfig,
  mode: WechatAuthMode,
  redirectTo: string,
  userId?: string,
): Promise<WechatAuthStartResponseDto> {
  const issuedAt = new Date();
  const expiresAt = new Date(issuedAt.getTime() + config.stateTtlMs);
  const state = await signWechatState(
    {
      v: 1,
      mode,
      redirectTo,
      userId,
      nonce: crypto.randomUUID().replace(/-/g, '').slice(0, 24),
      issuedAt: issuedAt.toISOString(),
      expiresAt: expiresAt.toISOString(),
    },
    config.stateSigningSecret,
  );

  const authorizationUrl = new URL('https://open.weixin.qq.com/connect/qrconnect');
  authorizationUrl.searchParams.set('appid', config.providerAppId);
  authorizationUrl.searchParams.set('redirect_uri', config.callbackUrl);
  authorizationUrl.searchParams.set('response_type', 'code');
  authorizationUrl.searchParams.set('scope', 'snsapi_login');
  authorizationUrl.searchParams.set('state', state);
  authorizationUrl.searchParams.set('lang', 'cn');

  return {
    provider: 'wechat',
    mode,
    authorizationUrl: `${authorizationUrl.toString()}#wechat_redirect`,
    callbackUrl: config.callbackUrl,
    state,
    expiresAt: expiresAt.toISOString(),
  };
}

async function fetchWechatJson<T>(url: string): Promise<T> {
  const response = await fetch(url, {
    method: 'GET',
    headers: {
      accept: 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error(`WeChat API request failed with HTTP ${response.status}.`);
  }

  return await response.json() as T;
}

async function exchangeWechatCode(
  config: WechatConfig,
  code: string,
): Promise<Required<Pick<WechatCodeExchangeResponse, 'access_token' | 'openid'>> & WechatCodeExchangeResponse> {
  const url = new URL('https://api.weixin.qq.com/sns/oauth2/access_token');
  url.searchParams.set('appid', config.providerAppId);
  url.searchParams.set('secret', config.providerSecret);
  url.searchParams.set('code', code);
  url.searchParams.set('grant_type', 'authorization_code');

  const data = await fetchWechatJson<WechatCodeExchangeResponse>(url.toString());
  if (data.errcode || !data.access_token || !data.openid) {
    throw new Error(data.errmsg || 'Failed to exchange WeChat authorization code.');
  }

  return data as Required<Pick<WechatCodeExchangeResponse, 'access_token' | 'openid'>> & WechatCodeExchangeResponse;
}

async function fetchWechatUserProfile(
  accessToken: string,
  openId: string,
): Promise<WechatUserInfoResponse> {
  const url = new URL('https://api.weixin.qq.com/sns/userinfo');
  url.searchParams.set('access_token', accessToken);
  url.searchParams.set('openid', openId);
  url.searchParams.set('lang', 'zh_CN');

  const data = await fetchWechatJson<WechatUserInfoResponse>(url.toString());
  if (data.errcode || !data.openid) {
    throw new Error(data.errmsg || 'Failed to fetch WeChat user profile.');
  }

  return data;
}

async function sha256Hex(value: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', encoder.encode(value));
  return Array.from(new Uint8Array(digest))
    .map((item) => item.toString(16).padStart(2, '0'))
    .join('');
}

async function buildWechatShadowEmail(
  providerAppId: string,
  providerOpenId: string,
  providerUnionId?: string,
): Promise<string> {
  const key = providerUnionId || providerOpenId;
  const digest = await sha256Hex(`wechat:${providerAppId}:${key}`);
  return `wechat-${digest.slice(0, 32)}@users.kkstudio.local`;
}

async function findWechatIdentityByUnionId(
  serviceClient: SupabaseClient,
  unionId: string,
): Promise<ExternalIdentityRow | undefined> {
  const { data, error } = await serviceClient
    .from('external_identities')
    .select('*')
    .eq('provider', 'wechat')
    .eq('provider_unionid', unionId)
    .maybeSingle<ExternalIdentityRow>();

  if (error) {
    throw error;
  }

  return data || undefined;
}

async function findWechatIdentityByOpenId(
  serviceClient: SupabaseClient,
  providerAppId: string,
  openId: string,
): Promise<ExternalIdentityRow | undefined> {
  const { data, error } = await serviceClient
    .from('external_identities')
    .select('*')
    .eq('provider', 'wechat')
    .eq('provider_appid', providerAppId)
    .eq('provider_openid', openId)
    .maybeSingle<ExternalIdentityRow>();

  if (error) {
    throw error;
  }

  return data || undefined;
}

async function resolveWechatIdentity(
  serviceClient: SupabaseClient,
  providerAppId: string,
  providerOpenId: string,
  providerUnionId?: string,
): Promise<ExternalIdentityRow | undefined> {
  const byUnionId = providerUnionId
    ? await findWechatIdentityByUnionId(serviceClient, providerUnionId)
    : undefined;
  const byOpenId = await findWechatIdentityByOpenId(serviceClient, providerAppId, providerOpenId);

  if (byUnionId && byOpenId && byUnionId.user_id !== byOpenId.user_id) {
    throw new Error('WeChat identity conflict detected between unionid and openid mappings.');
  }

  return byUnionId || byOpenId;
}

async function findProviderIdentityForUser(
  serviceClient: SupabaseClient,
  userId: string,
  provider: string,
): Promise<ExternalIdentityRow | undefined> {
  const { data, error } = await serviceClient
    .from('external_identities')
    .select('*')
    .eq('user_id', userId)
    .eq('provider', provider)
    .maybeSingle<ExternalIdentityRow>();

  if (error) {
    throw error;
  }

  return data || undefined;
}

async function findProfileByEmail(
  serviceClient: SupabaseClient,
  email: string,
): Promise<ProfileLookupRow | undefined> {
  const { data, error } = await serviceClient
    .from('profiles')
    .select('id, email')
    .eq('email', email)
    .maybeSingle<ProfileLookupRow>();

  if (error) {
    throw error;
  }

  return data || undefined;
}

function buildWechatUserMetadata(input: {
  providerAppId: string;
  providerOpenId: string;
  providerUnionId?: string;
  nickname?: string;
  avatarUrl?: string;
  existingMetadata?: Record<string, unknown> | null;
}): Record<string, unknown> {
  const existingMetadata = input.existingMetadata && typeof input.existingMetadata === 'object'
    ? { ...input.existingMetadata }
    : {};

  const nextMetadata: Record<string, unknown> = {
    ...existingMetadata,
    auth_provider: 'wechat',
    wechat_appid: input.providerAppId,
    wechat_openid: input.providerOpenId,
  };

  if (input.providerUnionId) {
    nextMetadata.wechat_unionid = input.providerUnionId;
  }

  if (input.nickname) {
    nextMetadata.full_name = input.nickname;
  }

  if (input.avatarUrl) {
    nextMetadata.avatar_url = input.avatarUrl;
  }

  return nextMetadata;
}

async function createOrGetWechatUser(
  serviceClient: SupabaseClient,
  input: {
    providerAppId: string;
    providerOpenId: string;
    providerUnionId?: string;
    nickname?: string;
    avatarUrl?: string;
  },
): Promise<{ userId: string; email: string }> {
  const email = await buildWechatShadowEmail(
    input.providerAppId,
    input.providerOpenId,
    input.providerUnionId,
  );

  const result = await serviceClient.auth.admin.createUser({
    email,
    password: `${crypto.randomUUID()}${crypto.randomUUID()}`,
    email_confirm: true,
    user_metadata: buildWechatUserMetadata(input),
  });

  if (result.error) {
    const existingProfile = await findProfileByEmail(serviceClient, email);
    if (existingProfile?.email) {
      return {
        userId: existingProfile.id,
        email: existingProfile.email,
      };
    }

    throw result.error;
  }

  if (!result.data.user?.id || !result.data.user.email) {
    throw new Error('Supabase did not return a valid WeChat shadow user.');
  }

  return {
    userId: result.data.user.id,
    email: result.data.user.email,
  };
}

async function getUserById(
  serviceClient: SupabaseClient,
  userId: string,
): Promise<User | undefined> {
  const result = await serviceClient.auth.admin.getUserById(userId);
  if (result.error) {
    throw result.error;
  }

  return result.data.user || undefined;
}

async function syncWechatProfile(
  serviceClient: SupabaseClient,
  input: {
    userId: string;
    email?: string;
    providerAppId: string;
    providerOpenId: string;
    providerUnionId?: string;
    nickname?: string;
    avatarUrl?: string;
  },
): Promise<void> {
  const existingUser = await getUserById(serviceClient, input.userId);
  if (!existingUser) {
    throw new Error(`Supabase user ${input.userId} was not found.`);
  }

  const updateUserResult = await serviceClient.auth.admin.updateUserById(input.userId, {
    user_metadata: buildWechatUserMetadata({
      ...input,
      existingMetadata: existingUser.user_metadata as Record<string, unknown> | null | undefined,
    }),
  });

  if (updateUserResult.error) {
    throw updateUserResult.error;
  }

  const profilePayload: Record<string, unknown> = {
    id: input.userId,
    email: input.email || existingUser.email || null,
    updated_at: new Date().toISOString(),
  };

  if (typeof input.nickname !== 'undefined') {
    profilePayload.nickname = input.nickname || null;
  }

  if (typeof input.avatarUrl !== 'undefined') {
    profilePayload.avatar_url = input.avatarUrl || null;
  }

  const { error } = await serviceClient
    .from('profiles')
    .upsert(profilePayload, {
      onConflict: 'id',
      ignoreDuplicates: false,
    });

  if (error) {
    throw error;
  }
}

async function upsertWechatIdentity(
  serviceClient: SupabaseClient,
  input: {
    userId: string;
    providerAppId: string;
    providerOpenId: string;
    providerUnionId?: string;
    nickname?: string;
    avatarUrl?: string;
    rawProfile: Record<string, unknown>;
    lastLoginAt: string;
  },
): Promise<void> {
  const existingIdentity = await resolveWechatIdentity(
    serviceClient,
    input.providerAppId,
    input.providerOpenId,
    input.providerUnionId,
  );

  const { error } = await serviceClient
    .from('external_identities')
    .upsert({
      id: existingIdentity?.id,
      user_id: input.userId,
      provider: 'wechat',
      provider_appid: input.providerAppId,
      provider_unionid: input.providerUnionId || null,
      provider_openid: input.providerOpenId,
      nickname: input.nickname || null,
      avatar_url: input.avatarUrl || null,
      raw_profile: input.rawProfile,
      last_login_at: input.lastLoginAt,
      updated_at: new Date().toISOString(),
    }, {
      onConflict: 'provider,provider_appid,provider_openid',
      ignoreDuplicates: false,
    });

  if (error) {
    throw error;
  }
}

async function createMagicLink(
  serviceClient: SupabaseClient,
  email: string,
  redirectTo: string,
): Promise<string> {
  const result = await serviceClient.auth.admin.generateLink({
    type: 'magiclink',
    email,
    options: {
      redirectTo,
    },
  });

  if (result.error) {
    throw result.error;
  }

  const actionLink = result.data.properties?.action_link;
  if (!actionLink) {
    throw new Error('Supabase did not return a magic link action URL.');
  }

  return actionLink;
}

async function resolveExistingUserIdentity(
  serviceClient: SupabaseClient,
  userId: string,
): Promise<{ userId: string; email: string }> {
  const user = await getUserById(serviceClient, userId);
  if (!user?.email) {
    throw new Error(`Supabase user ${userId} is missing an email anchor for session bootstrap.`);
  }

  return {
    userId: user.id,
    email: user.email,
  };
}

async function loadWechatUserProfileWithFallback(
  accessToken: string,
  openId: string,
  existingIdentity?: ExternalIdentityRow,
): Promise<WechatUserInfoResponse> {
  try {
    return await fetchWechatUserProfile(accessToken, openId);
  } catch (error) {
    if (existingIdentity?.nickname || existingIdentity?.avatar_url) {
      return {
        openid: openId,
        nickname: existingIdentity.nickname || undefined,
        headimgurl: existingIdentity.avatar_url || undefined,
        unionid: existingIdentity.provider_unionid || undefined,
      };
    }

    throw error;
  }
}

async function handleWechatLoginFlow(
  serviceClient: SupabaseClient,
  config: WechatConfig,
  state: SignedWechatState,
  input: {
    resolvedIdentity?: ExternalIdentityRow;
    providerOpenId: string;
    providerUnionId?: string;
    nickname?: string;
    avatarUrl?: string;
    rawProfile: Record<string, unknown>;
    lastLoginAt: string;
  },
): Promise<WechatCallbackResult> {
  const userIdentity = input.resolvedIdentity
    ? await resolveExistingUserIdentity(serviceClient, input.resolvedIdentity.user_id)
    : await createOrGetWechatUser(serviceClient, {
      providerAppId: config.providerAppId,
      providerOpenId: input.providerOpenId,
      providerUnionId: input.providerUnionId,
      nickname: input.nickname,
      avatarUrl: input.avatarUrl,
    });

  await syncWechatProfile(serviceClient, {
    userId: userIdentity.userId,
    email: userIdentity.email,
    providerAppId: config.providerAppId,
    providerOpenId: input.providerOpenId,
    providerUnionId: input.providerUnionId,
    nickname: input.nickname,
    avatarUrl: input.avatarUrl,
  });

  await upsertWechatIdentity(serviceClient, {
    userId: userIdentity.userId,
    providerAppId: config.providerAppId,
    providerOpenId: input.providerOpenId,
    providerUnionId: input.providerUnionId,
    nickname: input.nickname,
    avatarUrl: input.avatarUrl,
    rawProfile: input.rawProfile,
    lastLoginAt: input.lastLoginAt,
  });

  return {
    redirectTo: await createMagicLink(serviceClient, userIdentity.email, state.redirectTo),
  };
}

async function handleWechatBindFlow(
  serviceClient: SupabaseClient,
  config: WechatConfig,
  state: SignedWechatState,
  input: {
    resolvedIdentity?: ExternalIdentityRow;
    providerOpenId: string;
    providerUnionId?: string;
    nickname?: string;
    avatarUrl?: string;
    rawProfile: Record<string, unknown>;
    lastLoginAt: string;
  },
): Promise<WechatCallbackResult> {
  const targetUserId = state.userId;
  if (!targetUserId) {
    throw new Error('WeChat bind callback is missing the target user id.');
  }

  if (input.resolvedIdentity && input.resolvedIdentity.user_id !== targetUserId) {
    throw new Error('This WeChat account is already linked to a different KK Studio user.');
  }

  const existingProviderIdentity = await findProviderIdentityForUser(
    serviceClient,
    targetUserId,
    'wechat',
  );

  if (
    existingProviderIdentity
    && existingProviderIdentity.provider_openid !== input.providerOpenId
    && existingProviderIdentity.provider_unionid !== (input.providerUnionId || null)
  ) {
    throw new Error('The current KK Studio account is already linked to another WeChat account.');
  }

  const targetUser = await resolveExistingUserIdentity(serviceClient, targetUserId);

  await syncWechatProfile(serviceClient, {
    userId: targetUser.userId,
    email: targetUser.email,
    providerAppId: config.providerAppId,
    providerOpenId: input.providerOpenId,
    providerUnionId: input.providerUnionId,
    nickname: input.nickname,
    avatarUrl: input.avatarUrl,
  });

  await upsertWechatIdentity(serviceClient, {
    userId: targetUser.userId,
    providerAppId: config.providerAppId,
    providerOpenId: input.providerOpenId,
    providerUnionId: input.providerUnionId,
    nickname: input.nickname,
    avatarUrl: input.avatarUrl,
    rawProfile: input.rawProfile,
    lastLoginAt: input.lastLoginAt,
  });

  return {
    redirectTo: appendQueryParams(state.redirectTo, {
      wechat_bind: 'success',
    }),
  };
}

function buildCallbackFailureResult(
  config: WechatConfig,
  redirectTo: string | undefined,
  errorCode: string,
  errorDescription: string,
): WechatCallbackResult {
  const target = redirectTo || buildDefaultRedirectUrl(config);
  if (target) {
    return {
      redirectTo: appendQueryParams(target, {
        error: errorCode,
        error_description: errorDescription,
      }),
    };
  }

  return {
    errorCode: errorCode.toUpperCase(),
    errorDescription,
  };
}

async function handleWechatCallback(
  serviceClient: SupabaseClient,
  config: WechatConfig,
  url: URL,
): Promise<WechatCallbackResult> {
  let state: SignedWechatState;

  try {
    state = await verifyWechatState(url.searchParams.get('state') || '', config);
  } catch (error: any) {
    return buildCallbackFailureResult(
      config,
      undefined,
      'wechat_state_invalid',
      error?.message || 'WeChat callback state validation failed.',
    );
  }

  const callbackError = normalizeOptionalString(url.searchParams.get('error'));
  if (callbackError) {
    return buildCallbackFailureResult(
      config,
      state.redirectTo,
      'wechat_login_failed',
      normalizeOptionalString(url.searchParams.get('error_description')) || callbackError,
    );
  }

  const code = normalizeOptionalString(url.searchParams.get('code'));
  if (!code) {
    return buildCallbackFailureResult(
      config,
      state.redirectTo,
      'wechat_code_missing',
      'WeChat callback did not include an authorization code.',
    );
  }

  try {
    const tokenData = await exchangeWechatCode(config, code);
    const resolvedIdentity = await resolveWechatIdentity(
      serviceClient,
      config.providerAppId,
      tokenData.openid,
      tokenData.unionid,
    );
    const profileData = await loadWechatUserProfileWithFallback(
      tokenData.access_token,
      tokenData.openid,
      resolvedIdentity,
    );

    const providerUnionId = tokenData.unionid || profileData.unionid;
    const nickname = normalizeOptionalString(profileData.nickname)
      || resolvedIdentity?.nickname
      || undefined;
    const avatarUrl = normalizeOptionalString(profileData.headimgurl)
      || resolvedIdentity?.avatar_url
      || undefined;
    const rawProfile = {
      token: tokenData,
      profile: profileData,
    };
    const lastLoginAt = new Date().toISOString();

    if (state.mode === 'bind') {
      return await handleWechatBindFlow(serviceClient, config, state, {
        resolvedIdentity,
        providerOpenId: tokenData.openid,
        providerUnionId,
        nickname,
        avatarUrl,
        rawProfile,
        lastLoginAt,
      });
    }

    return await handleWechatLoginFlow(serviceClient, config, state, {
      resolvedIdentity,
      providerOpenId: tokenData.openid,
      providerUnionId,
      nickname,
      avatarUrl,
      rawProfile,
      lastLoginAt,
    });
  } catch (error: any) {
    return buildCallbackFailureResult(
      config,
      state.redirectTo,
      'wechat_login_failed',
      error?.message || 'WeChat login failed unexpectedly.',
    );
  }
}

async function handleStartRequest(req: Request): Promise<Response> {
  let payload: StartWechatAuthPayload;
  try {
    payload = await req.json() as StartWechatAuthPayload;
  } catch {
    return errorResponse('INVALID_REQUEST', 'Request body must be valid JSON.', 400);
  }

  const action = normalizeRequiredString(payload.action, 'INVALID_REQUEST', 'action is required.');
  const config = resolveWechatConfig();
  const redirectTo = normalizeRedirectUrl(
    normalizeRequiredString(payload.redirectTo, 'WECHAT_REDIRECT_REQUIRED', 'redirectTo is required to start WeChat authentication.'),
    config.allowedRedirectOrigins,
  );

  if (action === 'start-login') {
    return successResponse(await buildWechatAuthorizationPayload(config, 'login', redirectTo));
  }

  if (action === 'start-bind') {
    const { userClient } = createSupabaseFunctionClients(req);
    const user = await requireAuthenticatedUser(userClient);
    return successResponse(
      await buildWechatAuthorizationPayload(config, 'bind', redirectTo, user.id),
    );
  }

  throw new WechatFunctionError(400, 'INVALID_REQUEST', `Unsupported action "${action}".`);
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', {
      headers: corsHeaders,
    });
  }

  try {
    const url = new URL(req.url);
    const routePath = resolveFunctionRoutePath(url.pathname);

    if (req.method === 'POST' && routePath === '/') {
      return await handleStartRequest(req);
    }

    if (req.method === 'GET' && routePath === '/callback') {
      const { serviceClient } = createSupabaseFunctionClients(req);
      const config = resolveWechatConfig();
      const callbackResult = await handleWechatCallback(serviceClient, config, url);

      if (callbackResult.redirectTo) {
        return Response.redirect(callbackResult.redirectTo, 302);
      }

      return errorResponse(
        callbackResult.errorCode || 'WECHAT_CALLBACK_INVALID',
        callbackResult.errorDescription || 'The WeChat callback did not include enough information to continue.',
        400,
      );
    }

    return errorResponse('NOT_FOUND', 'wechat-auth route not found.', 404);
  } catch (error) {
    if (error instanceof WechatFunctionError) {
      return errorResponse(error.code, error.message, error.status);
    }

    const message =
      typeof error === 'object' && error && 'message' in error
        ? String((error as { message?: unknown }).message || '').trim() || 'Internal server error'
        : 'Internal server error';

    return errorResponse('INTERNAL_SERVER_ERROR', message, 500);
  }
});
