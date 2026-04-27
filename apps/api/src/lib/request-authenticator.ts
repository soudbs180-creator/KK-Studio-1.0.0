import {
  AUTHENTICATED_ADMIN_SESSION_EXPIRES_AT_HEADER,
  AUTHENTICATED_ADMIN_SESSION_HEADER,
  AUTHENTICATED_USER_EMAIL_HEADER,
  AUTHENTICATED_USER_ID_HEADER,
  AUTHENTICATED_USER_ROLE_HEADER,
} from "../../../../packages/shared/src/index.ts";
import { verifyKkSessionToken } from "../modules/auth/infrastructure/kk-session-token.ts";

export interface AuthenticatedRequestContext {
  userId: string;
  email?: string;
  role?: string;
}

type MaybePromise<T> = T | Promise<T>;

export interface RequestAuthenticator {
  authenticate(headers: Record<string, string>): Promise<AuthenticatedRequestContext | undefined>;
}

export interface RequestAuthenticatorOptions {
  resolveLegacyAccessToken?: (accessToken: string) => MaybePromise<AuthenticatedRequestContext | undefined>;
}

function readBearerToken(headers: Record<string, string>): string | undefined {
  const authorization = String(headers.authorization || "").trim();
  if (!authorization) {
    return undefined;
  }

  if (authorization.toLowerCase().startsWith("bearer ")) {
    return authorization.slice(7).trim() || undefined;
  }

  return authorization;
}

export function stripAuthenticatedHeaders(
  headers: Record<string, string>,
): Record<string, string> {
  const next = { ...headers };
  delete next[AUTHENTICATED_USER_ID_HEADER];
  delete next[AUTHENTICATED_USER_EMAIL_HEADER];
  delete next[AUTHENTICATED_USER_ROLE_HEADER];
  delete next[AUTHENTICATED_ADMIN_SESSION_HEADER];
  delete next[AUTHENTICATED_ADMIN_SESSION_EXPIRES_AT_HEADER];
  return next;
}

export function applyAuthenticatedHeaders(
  headers: Record<string, string>,
  context: AuthenticatedRequestContext,
): Record<string, string> {
  return {
    ...stripAuthenticatedHeaders(headers),
    [AUTHENTICATED_USER_ID_HEADER]: context.userId,
    ...(context.email ? { [AUTHENTICATED_USER_EMAIL_HEADER]: context.email } : {}),
    ...(context.role ? { [AUTHENTICATED_USER_ROLE_HEADER]: context.role } : {}),
  };
}

class HybridRequestAuthenticator implements RequestAuthenticator {
  private readonly resolveLegacyAccessToken?: RequestAuthenticatorOptions["resolveLegacyAccessToken"];

  constructor(options: RequestAuthenticatorOptions) {
    this.resolveLegacyAccessToken = options.resolveLegacyAccessToken;
  }

  async authenticate(
    headers: Record<string, string>,
  ): Promise<AuthenticatedRequestContext | undefined> {
    const bearerToken = readBearerToken(headers);
    if (!bearerToken) {
      return undefined;
    }

    const legacyProfile = this.resolveLegacyAccessToken
      ? await this.resolveLegacyAccessToken(bearerToken)
      : undefined;
    if (legacyProfile) {
      return legacyProfile;
    }

    const verifiedKkSession = verifyKkSessionToken(bearerToken, { tokenType: "access" });
    if (!verifiedKkSession) {
      return undefined;
    }

    // If a stateful resolver exists, an unrecognized signed token should fail
    // closed so role changes, suspensions, and revocations still take effect.
    if (this.resolveLegacyAccessToken) {
      return undefined;
    }

    return {
      userId: verifiedKkSession.userId,
      ...(verifiedKkSession.email ? { email: verifiedKkSession.email } : {}),
      ...(verifiedKkSession.role ? { role: verifiedKkSession.role } : {}),
    };
  }
}

export function createRequestAuthenticator(
  options: RequestAuthenticatorOptions,
): RequestAuthenticator {
  return new HybridRequestAuthenticator(options);
}
