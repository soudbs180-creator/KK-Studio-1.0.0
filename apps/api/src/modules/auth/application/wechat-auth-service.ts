import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

import type {
  WechatAuthMode,
  WechatAuthStartResponseDto,
} from "../../../../../../packages/contracts/src/index.ts";
import { consoleLogger } from "../../../../../../packages/shared/src/index.ts";
import type { AuthService } from "./auth-service.ts";

export interface ExternalIdentityRow {
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
}

export interface WechatAuthUserRecord {
  id: string;
  email?: string | null;
  user_metadata?: Record<string, unknown> | null;
}

export interface WechatAuthRepository {
  resolveWechatIdentity(
    providerAppId: string,
    providerOpenId: string,
    providerUnionId?: string,
  ): Promise<{ byOpenId?: ExternalIdentityRow; byUnionId?: ExternalIdentityRow; resolved?: ExternalIdentityRow }>;
  findProviderIdentityForUser(userId: string, provider: string): Promise<ExternalIdentityRow | undefined>;
  createOrGetWechatUser(input: {
    providerAppId: string;
    providerOpenId: string;
    providerUnionId?: string;
    nickname?: string;
    avatarUrl?: string;
  }): Promise<{ userId: string; email: string }>;
  getUserById(userId: string): Promise<WechatAuthUserRecord | undefined>;
  syncWechatProfile(input: {
    userId: string;
    email?: string;
    providerAppId: string;
    providerOpenId: string;
    providerUnionId?: string;
    nickname?: string;
    avatarUrl?: string;
  }): Promise<void>;
  upsertWechatIdentity(input: {
    userId: string;
    providerAppId: string;
    providerOpenId: string;
    providerUnionId?: string;
    nickname?: string;
    avatarUrl?: string;
    rawProfile: Record<string, unknown>;
    lastLoginAt: string;
  }): Promise<void>;
}

interface WechatCodeExchangeResponse {
  access_token?: string;
  expires_in?: number;
  refresh_token?: string;
  openid?: string;
  scope?: string;
  unionid?: string;
  errcode?: number;
  errmsg?: string;
}

interface WechatUserInfoResponse {
  openid?: string;
  nickname?: string;
  headimgurl?: string;
  unionid?: string;
  errcode?: number;
  errmsg?: string;
  [key: string]: unknown;
}

interface SignedWechatState {
  v: 1;
  mode: WechatAuthMode;
  redirectTo: string;
  userId?: string;
  nonce: string;
  issuedAt: string;
  expiresAt: string;
}

export interface WechatAuthServiceOptions {
  repository: WechatAuthRepository;
  providerAppId: string;
  providerSecret: string;
  callbackUrl: string;
  stateSigningSecret: string;
  allowedRedirectOrigins?: string[];
  defaultRedirectUrl?: string;
  stateTtlMs?: number;
  fetchImpl?: typeof fetch;
}

export interface StartWechatAuthInput {
  mode: WechatAuthMode;
  redirectTo: string;
  userId?: string;
}

export interface HandleWechatCallbackInput {
  code?: string;
  state?: string;
  error?: string;
  errorDescription?: string;
}

export interface WechatCallbackResult {
  redirectTo?: string;
  errorCode?: string;
  errorDescription?: string;
}

export class WechatAuthService {
  private readonly repository: WechatAuthRepository;
  private readonly providerAppId: string;
  private readonly providerSecret: string;
  private readonly callbackUrl: string;
  private readonly stateSigningSecret: string;
  private readonly allowedRedirectOrigins: string[];
  private readonly defaultRedirectUrl?: string;
  private readonly stateTtlMs: number;
  private readonly fetchImpl: typeof fetch;
  private readonly logger = consoleLogger.child({ module: "wechat-auth" });

  constructor(options: WechatAuthServiceOptions) {
    this.repository = options.repository;
    this.providerAppId = options.providerAppId;
    this.providerSecret = options.providerSecret;
    this.callbackUrl = options.callbackUrl;
    this.stateSigningSecret = options.stateSigningSecret;
    this.allowedRedirectOrigins = this.normalizeAllowedRedirectOrigins(
      options.allowedRedirectOrigins,
      options.callbackUrl,
    );
    this.defaultRedirectUrl = options.defaultRedirectUrl
      ? this.normalizeRedirectUrl(options.defaultRedirectUrl)
      : this.buildDefaultRedirectUrl();
    this.stateTtlMs = options.stateTtlMs || 10 * 60 * 1000;
    this.fetchImpl = options.fetchImpl || fetch;
  }

  start(input: StartWechatAuthInput): WechatAuthStartResponseDto {
    this.ensureConfigured();
    const redirectTo = this.normalizeRedirectUrl(input.redirectTo);

    if (input.mode === "bind" && !input.userId) {
      throw new Error("An authenticated user is required to start WeChat account binding.");
    }

    const issuedAt = new Date();
    const expiresAt = new Date(issuedAt.getTime() + this.stateTtlMs);
    const state = this.signState({
      v: 1,
      mode: input.mode,
      redirectTo,
      userId: input.userId,
      nonce: randomBytes(12).toString("hex"),
      issuedAt: issuedAt.toISOString(),
      expiresAt: expiresAt.toISOString(),
    });

    const authorizationUrl = new URL("https://open.weixin.qq.com/connect/qrconnect");
    authorizationUrl.searchParams.set("appid", this.providerAppId);
    authorizationUrl.searchParams.set("redirect_uri", this.callbackUrl);
    authorizationUrl.searchParams.set("response_type", "code");
    authorizationUrl.searchParams.set("scope", "snsapi_login");
    authorizationUrl.searchParams.set("state", state);
    authorizationUrl.searchParams.set("lang", "cn");

    return {
      provider: "wechat",
      mode: input.mode,
      authorizationUrl: `${authorizationUrl.toString()}#wechat_redirect`,
      callbackUrl: this.callbackUrl,
      state,
      expiresAt: expiresAt.toISOString(),
    };
  }

  async handleCallback(
    authService: AuthService,
    input: HandleWechatCallbackInput,
  ): Promise<WechatCallbackResult> {
    this.ensureConfigured();

    let state: SignedWechatState;
    try {
      if (!input.state) {
        throw new Error("WeChat callback is missing the signed state parameter.");
      }

      state = this.verifyState(input.state);
    } catch (error: any) {
      this.logger.warn("Rejected WeChat callback before code exchange", {
        reason: error?.message || "Invalid state.",
      });

      return this.buildFailureResult(
        undefined,
        "wechat_state_invalid",
        error?.message || "WeChat callback state validation failed.",
      );
    }

    if (input.error) {
      return this.buildFailureResult(
        state.redirectTo,
        "wechat_login_failed",
        input.errorDescription || input.error,
      );
    }

    if (!input.code) {
      return this.buildFailureResult(
        state.redirectTo,
        "wechat_code_missing",
        "WeChat callback did not include an authorization code.",
      );
    }

    try {
      const tokenData = await this.exchangeCode(input.code);
      const resolvedIdentity = await this.repository.resolveWechatIdentity(
        this.providerAppId,
        tokenData.openid,
        tokenData.unionid,
      );

      const profileData = await this.loadUserProfileWithFallback(
        tokenData.access_token,
        tokenData.openid,
        resolvedIdentity.resolved,
      );

      const providerUnionId = tokenData.unionid || profileData.unionid;
      const nickname = this.normalizeOptionalString(profileData.nickname)
        || resolvedIdentity.resolved?.nickname
        || undefined;
      const avatarUrl = this.normalizeOptionalString(profileData.headimgurl)
        || resolvedIdentity.resolved?.avatar_url
        || undefined;
      const lastLoginAt = new Date().toISOString();

      if (state.mode === "bind") {
        return await this.handleBindFlow({
          state,
          resolvedIdentity: resolvedIdentity.resolved,
          providerOpenId: tokenData.openid,
          providerUnionId,
          nickname,
          avatarUrl,
          rawProfile: {
            token: tokenData,
            profile: profileData,
          },
          lastLoginAt,
        });
      }

      return await this.handleLoginFlow({
        authService,
        state,
        resolvedIdentity: resolvedIdentity.resolved,
        providerOpenId: tokenData.openid,
        providerUnionId,
        nickname,
        avatarUrl,
        rawProfile: {
          token: tokenData,
          profile: profileData,
        },
        lastLoginAt,
      });
    } catch (error: any) {
      this.logger.error("WeChat callback failed", {
        message: error?.message || "Unknown WeChat callback error.",
      });

      return {
        redirectTo: this.appendQueryParams(
          state.redirectTo,
          {
            error: "wechat_login_failed",
            error_description: error?.message || "WeChat login failed unexpectedly.",
          },
        ),
      };
    }
  }

  private async handleLoginFlow(input: {
    authService: AuthService;
    state: SignedWechatState;
    resolvedIdentity?: ExternalIdentityRow;
    providerOpenId: string;
    providerUnionId?: string;
    nickname?: string;
    avatarUrl?: string;
    rawProfile: Record<string, unknown>;
    lastLoginAt: string;
  }): Promise<WechatCallbackResult> {
    const userIdentity = input.resolvedIdentity
      ? await this.resolveExistingUserIdentity(input.resolvedIdentity.user_id)
      : await this.repository.createOrGetWechatUser({
        providerAppId: this.providerAppId,
        providerOpenId: input.providerOpenId,
        providerUnionId: input.providerUnionId,
        nickname: input.nickname,
        avatarUrl: input.avatarUrl,
      });

    await this.repository.syncWechatProfile({
      userId: userIdentity.userId,
      email: userIdentity.email,
      providerAppId: this.providerAppId,
      providerOpenId: input.providerOpenId,
      providerUnionId: input.providerUnionId,
      nickname: input.nickname,
      avatarUrl: input.avatarUrl,
    });

    await this.repository.upsertWechatIdentity({
      userId: userIdentity.userId,
      providerAppId: this.providerAppId,
      providerOpenId: input.providerOpenId,
      providerUnionId: input.providerUnionId,
      nickname: input.nickname,
      avatarUrl: input.avatarUrl,
      rawProfile: input.rawProfile,
      lastLoginAt: input.lastLoginAt,
    });

    const session = input.authService.issueLoginSession(userIdentity.email);
    const redirectTo = new URL(input.state.redirectTo);
    redirectTo.hash = new URLSearchParams({
      access_token: session.accessToken,
      refresh_token: session.refreshToken,
      provider: "wechat",
    }).toString();

    return {
      redirectTo: redirectTo.toString(),
    };
  }

  private async handleBindFlow(input: {
    state: SignedWechatState;
    resolvedIdentity?: ExternalIdentityRow;
    providerOpenId: string;
    providerUnionId?: string;
    nickname?: string;
    avatarUrl?: string;
    rawProfile: Record<string, unknown>;
    lastLoginAt: string;
  }): Promise<WechatCallbackResult> {
    const targetUserId = input.state.userId;
    if (!targetUserId) {
      throw new Error("WeChat bind callback is missing the target user id.");
    }

    if (input.resolvedIdentity && input.resolvedIdentity.user_id !== targetUserId) {
      throw new Error("This WeChat account is already linked to a different KK Studio user.");
    }

    const existingProviderIdentity = await this.repository.findProviderIdentityForUser(
      targetUserId,
      "wechat",
    );

    if (
      existingProviderIdentity
      && existingProviderIdentity.provider_openid !== input.providerOpenId
      && existingProviderIdentity.provider_unionid !== (input.providerUnionId || null)
    ) {
      throw new Error("The current KK Studio account is already linked to another WeChat account.");
    }

    const targetUser = await this.resolveExistingUserIdentity(targetUserId);

    await this.repository.syncWechatProfile({
      userId: targetUser.userId,
      email: targetUser.email,
      providerAppId: this.providerAppId,
      providerOpenId: input.providerOpenId,
      providerUnionId: input.providerUnionId,
      nickname: input.nickname,
      avatarUrl: input.avatarUrl,
    });

    await this.repository.upsertWechatIdentity({
      userId: targetUser.userId,
      providerAppId: this.providerAppId,
      providerOpenId: input.providerOpenId,
      providerUnionId: input.providerUnionId,
      nickname: input.nickname,
      avatarUrl: input.avatarUrl,
      rawProfile: input.rawProfile,
      lastLoginAt: input.lastLoginAt,
    });

    return {
      redirectTo: this.appendQueryParams(input.state.redirectTo, {
        wechat_bind: "success",
      }),
    };
  }

  private async resolveExistingUserIdentity(userId: string): Promise<{ userId: string; email: string }> {
    const user = await this.repository.getUserById(userId);
    if (!user?.email) {
      throw new Error(`User ${userId} is missing an email anchor for session bootstrap.`);
    }

    return {
      userId: user.id,
      email: user.email,
    };
  }

  private async exchangeCode(code: string): Promise<Required<Pick<WechatCodeExchangeResponse, "access_token" | "openid">> & WechatCodeExchangeResponse> {
    const url = new URL("https://api.weixin.qq.com/sns/oauth2/access_token");
    url.searchParams.set("appid", this.providerAppId);
    url.searchParams.set("secret", this.providerSecret);
    url.searchParams.set("code", code);
    url.searchParams.set("grant_type", "authorization_code");

    const data = await this.fetchWechatJson<WechatCodeExchangeResponse>(url.toString());
    if (data.errcode || !data.access_token || !data.openid) {
      throw new Error(data.errmsg || "Failed to exchange WeChat authorization code.");
    }

    return data as Required<Pick<WechatCodeExchangeResponse, "access_token" | "openid">> & WechatCodeExchangeResponse;
  }

  private async loadUserProfileWithFallback(
    accessToken: string,
    openId: string,
    existingIdentity?: ExternalIdentityRow,
  ): Promise<WechatUserInfoResponse> {
    try {
      return await this.fetchUserProfile(accessToken, openId);
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

  private async fetchUserProfile(accessToken: string, openId: string): Promise<WechatUserInfoResponse> {
    const url = new URL("https://api.weixin.qq.com/sns/userinfo");
    url.searchParams.set("access_token", accessToken);
    url.searchParams.set("openid", openId);
    url.searchParams.set("lang", "zh_CN");

    const data = await this.fetchWechatJson<WechatUserInfoResponse>(url.toString());
    if (data.errcode || !data.openid) {
      throw new Error(data.errmsg || "Failed to fetch WeChat user profile.");
    }

    return data;
  }

  private async fetchWechatJson<T>(url: string): Promise<T> {
    const response = await this.fetchImpl(url, {
      method: "GET",
      headers: {
        accept: "application/json",
      },
    });

    if (!response.ok) {
      throw new Error(`WeChat API request failed with HTTP ${response.status}.`);
    }

    return await response.json() as T;
  }

  private signState(payload: SignedWechatState): string {
    const encodedPayload = this.base64UrlEncode(JSON.stringify(payload));
    const signature = this.createStateSignature(encodedPayload);
    return `${encodedPayload}.${signature}`;
  }

  private verifyState(state: string): SignedWechatState {
    const [encodedPayload, signature] = state.split(".");
    if (!encodedPayload || !signature) {
      throw new Error("Invalid WeChat state format.");
    }

    const expectedSignature = this.createStateSignature(encodedPayload);
    const actualBuffer = Buffer.from(signature);
    const expectedBuffer = Buffer.from(expectedSignature);
    if (
      actualBuffer.length !== expectedBuffer.length
      || !timingSafeEqual(actualBuffer, expectedBuffer)
    ) {
      throw new Error("WeChat state signature verification failed.");
    }

    const payload = JSON.parse(this.base64UrlDecode(encodedPayload)) as SignedWechatState;
    if (payload.v !== 1) {
      throw new Error("Unsupported WeChat state version.");
    }

    const expiresAt = new Date(payload.expiresAt);
    if (Number.isNaN(expiresAt.getTime()) || expiresAt.getTime() < Date.now()) {
      throw new Error("The WeChat login state has expired.");
    }

    payload.redirectTo = this.normalizeRedirectUrl(payload.redirectTo);
    return payload;
  }

  private createStateSignature(encodedPayload: string): string {
    return createHmac("sha256", this.stateSigningSecret)
      .update(encodedPayload)
      .digest("base64url");
  }

  private buildFailureResult(
    redirectTo: string | undefined,
    errorCode: string,
    errorDescription: string,
  ): WechatCallbackResult {
    const target = redirectTo || this.defaultRedirectUrl;
    if (target) {
      return {
        redirectTo: this.appendQueryParams(target, {
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

  private appendQueryParams(url: string, params: Record<string, string>): string {
    const nextUrl = new URL(url);
    Object.entries(params).forEach(([key, value]) => {
      nextUrl.searchParams.set(key, value);
    });
    return nextUrl.toString();
  }

  private normalizeRedirectUrl(value: string): string {
    const url = new URL(value);
    if (url.protocol !== "http:" && url.protocol !== "https:") {
      throw new Error("redirectTo must use http or https.");
    }

    if (
      this.allowedRedirectOrigins.length > 0
      && !this.allowedRedirectOrigins.includes(url.origin)
    ) {
      throw new Error("redirectTo origin is not allowed for WeChat authentication.");
    }

    return url.toString();
  }

  private normalizeAllowedRedirectOrigins(
    origins: string[] | undefined,
    callbackUrl: string,
  ): string[] {
    const candidates = (origins || [])
      .map((origin) => String(origin || "").trim())
      .filter(Boolean);

    if (candidates.length === 0) {
      candidates.push(new URL(callbackUrl).origin);
    }

    return Array.from(new Set(candidates.map((origin) => {
      const url = new URL(origin);
      if (url.protocol !== "http:" && url.protocol !== "https:") {
        throw new Error("Allowed WeChat redirect origins must use http or https.");
      }
      return url.origin;
    })));
  }

  private buildDefaultRedirectUrl(): string | undefined {
    const firstAllowedOrigin = this.allowedRedirectOrigins[0];
    if (!firstAllowedOrigin) {
      return undefined;
    }

    return new URL("/auth/callback", firstAllowedOrigin).toString();
  }

  private normalizeOptionalString(value: unknown): string | undefined {
    if (typeof value !== "string") {
      return undefined;
    }

    const normalized = value.trim();
    return normalized || undefined;
  }

  private base64UrlEncode(value: string): string {
    return Buffer.from(value, "utf8").toString("base64url");
  }

  private base64UrlDecode(value: string): string {
    return Buffer.from(value, "base64url").toString("utf8");
  }

  private ensureConfigured() {
    if (!this.providerAppId) {
      throw new Error("WECHAT_OPEN_APP_ID is not configured.");
    }

    if (!this.providerSecret) {
      throw new Error("WECHAT_OPEN_APP_SECRET is not configured.");
    }

    if (!this.callbackUrl) {
      throw new Error("WECHAT_OPEN_REDIRECT_URI is not configured.");
    }

    if (!this.stateSigningSecret) {
      throw new Error("WECHAT_STATE_SIGNING_SECRET is not configured.");
    }
  }
}
