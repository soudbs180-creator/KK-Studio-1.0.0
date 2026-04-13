import { createHmac } from "node:crypto";

import type { GoogleAuthStartResponseDto } from "../../../../../../packages/contracts/src/index.ts";
import type { AuthService } from "./auth-service.ts";

export interface GoogleAuthServiceOptions {
  clientId: string;
  clientSecret: string;
  callbackUrl: string;
  stateSigningSecret: string;
  allowedRedirectOrigins: string[];
  fetchImpl?: typeof fetch;
}

type GoogleAuthMode = "login" | "bind";

interface GoogleStatePayload {
  mode: GoogleAuthMode;
  redirectTo: string;
  issuedAt: string;
}

interface GoogleTokenResponse {
  access_token?: string;
}

interface GoogleUserInfoResponse {
  email?: string;
}

function toBase64Url(value: string): string {
  return Buffer.from(value, "utf8")
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

function fromBase64Url(value: string): string {
  const normalized = String(value || "")
    .replace(/-/g, "+")
    .replace(/_/g, "/");
  const padding = normalized.length % 4 === 0 ? "" : "=".repeat(4 - (normalized.length % 4));
  return Buffer.from(`${normalized}${padding}`, "base64").toString("utf8");
}

function normalizeOrigin(origin: string): string {
  return String(origin || "").trim().replace(/\/+$/, "");
}

export class GoogleAuthService {
  private readonly options: GoogleAuthServiceOptions;
  private readonly fetchImpl: typeof fetch;

  constructor(options: GoogleAuthServiceOptions) {
    this.options = options;
    this.fetchImpl = options.fetchImpl || fetch;
  }

  start(input: {
    mode: GoogleAuthMode;
    redirectTo: string;
  }): GoogleAuthStartResponseDto {
    const redirectTo = this.validateRedirect(input.redirectTo);
    const state = this.encodeState({
      mode: input.mode,
      redirectTo,
      issuedAt: new Date().toISOString(),
    });
    const authorizationUrl = new URL("https://accounts.google.com/o/oauth2/v2/auth");
    authorizationUrl.searchParams.set("client_id", this.options.clientId);
    authorizationUrl.searchParams.set("redirect_uri", this.options.callbackUrl);
    authorizationUrl.searchParams.set("response_type", "code");
    authorizationUrl.searchParams.set("scope", "openid email profile");
    authorizationUrl.searchParams.set("access_type", "offline");
    authorizationUrl.searchParams.set("prompt", "select_account");
    authorizationUrl.searchParams.set("state", state);

    return {
      provider: "google",
      mode: input.mode,
      authorizationUrl: authorizationUrl.toString(),
      callbackUrl: this.options.callbackUrl,
      state,
      expiresAt: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
    };
  }

  async handleCallback(
    authService: AuthService,
    input: { code?: string; state?: string },
  ): Promise<{ redirectTo: string }> {
    const state = this.decodeState(input.state);
    if (!state) {
      return {
        redirectTo: `${this.defaultRedirectTo()}?error=google_state_invalid&error_description=Invalid+Google+state+format.`,
      };
    }

    if (state.mode === "bind") {
      return {
        redirectTo: `${state.redirectTo}?error=google_bind_unavailable&error_description=Google+bind+is+not+persisted+on+the+VPS+runtime+yet.`,
      };
    }

    if (!input.code) {
      return {
        redirectTo: `${state.redirectTo}?error=google_login_failed&error_description=Missing+Google+authorization+code.`,
      };
    }

    const accessToken = await this.exchangeCode(input.code);
    const profile = await this.fetchUserProfile(accessToken);
    const email = String(profile.email || "").trim().toLowerCase();
    if (!email) {
      return {
        redirectTo: `${state.redirectTo}?error=google_login_failed&error_description=Google+did+not+return+an+email+address.`,
      };
    }

    const session = authService.issueLoginSession(email);
    const redirectTo = new URL(state.redirectTo);
    redirectTo.hash = new URLSearchParams({
      access_token: session.accessToken,
      refresh_token: session.refreshToken,
      provider: "google",
    }).toString();

    return {
      redirectTo: redirectTo.toString(),
    };
  }

  private validateRedirect(redirectTo: string): string {
    const redirectUrl = new URL(String(redirectTo || "").trim());
    const origin = normalizeOrigin(redirectUrl.origin);
    const allowedOrigins = this.options.allowedRedirectOrigins.map(normalizeOrigin);
    if (!allowedOrigins.includes(origin)) {
      throw new Error("redirectTo origin is not allowed for Google auth.");
    }

    return redirectUrl.toString();
  }

  private encodeState(payload: GoogleStatePayload): string {
    const encodedPayload = toBase64Url(JSON.stringify(payload));
    const signature = createHmac("sha256", this.options.stateSigningSecret)
      .update(encodedPayload)
      .digest("base64url");
    return `${encodedPayload}.${signature}`;
  }

  private decodeState(state: string | undefined): GoogleStatePayload | null {
    const normalized = String(state || "").trim();
    const separatorIndex = normalized.lastIndexOf(".");
    if (separatorIndex <= 0) {
      return null;
    }

    const encodedPayload = normalized.slice(0, separatorIndex);
    const signature = normalized.slice(separatorIndex + 1);
    const expected = createHmac("sha256", this.options.stateSigningSecret)
      .update(encodedPayload)
      .digest("base64url");
    if (signature !== expected) {
      return null;
    }

    try {
      return JSON.parse(fromBase64Url(encodedPayload)) as GoogleStatePayload;
    } catch {
      return null;
    }
  }

  private async exchangeCode(code: string): Promise<string> {
    const body = new URLSearchParams({
      code,
      client_id: this.options.clientId,
      client_secret: this.options.clientSecret,
      redirect_uri: this.options.callbackUrl,
      grant_type: "authorization_code",
    });
    const response = await this.fetchImpl("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: body.toString(),
    });
    if (!response.ok) {
      throw new Error(`Google token exchange failed (${response.status})`);
    }

    const payload = await response.json() as GoogleTokenResponse;
    const accessToken = String(payload.access_token || "").trim();
    if (!accessToken) {
      throw new Error("Google token exchange did not return an access token.");
    }

    return accessToken;
  }

  private async fetchUserProfile(accessToken: string): Promise<GoogleUserInfoResponse> {
    const response = await this.fetchImpl("https://www.googleapis.com/oauth2/v2/userinfo", {
      method: "GET",
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });
    if (!response.ok) {
      throw new Error(`Google userinfo request failed (${response.status})`);
    }

    return await response.json() as GoogleUserInfoResponse;
  }

  private defaultRedirectTo(): string {
    const firstAllowedOrigin = this.options.allowedRedirectOrigins[0];
    return firstAllowedOrigin
      ? new URL("/auth/callback", firstAllowedOrigin).toString()
      : "http://127.0.0.1:3000/auth/callback";
  }
}
