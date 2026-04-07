import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import {
  AUTHENTICATED_ADMIN_SESSION_EXPIRES_AT_HEADER,
  AUTHENTICATED_ADMIN_SESSION_HEADER,
  AUTHENTICATED_USER_EMAIL_HEADER,
  AUTHENTICATED_USER_ID_HEADER,
  AUTHENTICATED_USER_ROLE_HEADER,
} from "../../../../packages/shared/src/index.ts";
import { resolveServerSupabaseConfig } from "./server-supabase-config.ts";

export interface AuthenticatedRequestContext {
  userId: string;
  email?: string;
  role?: string;
}

export interface RequestAuthenticator {
  authenticate(headers: Record<string, string>): Promise<AuthenticatedRequestContext | undefined>;
}

export interface RequestAuthenticatorOptions {
  resolveLegacyAccessToken?: (accessToken: string) => AuthenticatedRequestContext | undefined;
  resolveSupabaseAccessToken?: (
    accessToken: string,
  ) => Promise<AuthenticatedRequestContext | undefined>;
  supabaseUrl?: string;
  supabaseAuthKey?: string;
}

interface CachedAuthenticationResult {
  context?: AuthenticatedRequestContext;
  expiresAt: number;
}

const supabaseAuthLookupTimeoutMs = 4_000;
const successfulAuthenticationCacheTtlMs = 60_000;
const failedAuthenticationCacheTtlMs = 5_000;

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

function decodeJwtPayload(accessToken: string): Record<string, unknown> | undefined {
  const [, payloadSegment] = accessToken.split(".");
  if (!payloadSegment) {
    return undefined;
  }

  try {
    const normalizedPayload = payloadSegment.replace(/-/g, "+").replace(/_/g, "/");
    const padding = normalizedPayload.length % 4 === 0
      ? ""
      : "=".repeat(4 - (normalizedPayload.length % 4));
    return JSON.parse(Buffer.from(`${normalizedPayload}${padding}`, "base64").toString("utf8"));
  } catch {
    return undefined;
  }
}

function resolveSuccessfulAuthenticationCacheTtl(accessToken: string): number {
  const payload = decodeJwtPayload(accessToken);
  const expiresAtSeconds = Number(payload?.exp);
  if (!Number.isFinite(expiresAtSeconds) || expiresAtSeconds <= 0) {
    return successfulAuthenticationCacheTtlMs;
  }

  const msUntilExpiry = Math.max(0, (expiresAtSeconds * 1000) - Date.now() - 1_000);
  return Math.min(successfulAuthenticationCacheTtlMs, msUntilExpiry);
}

class HybridRequestAuthenticator implements RequestAuthenticator {
  private readonly resolveLegacyAccessToken?: RequestAuthenticatorOptions["resolveLegacyAccessToken"];
  private readonly resolveSupabaseAccessToken?: RequestAuthenticatorOptions["resolveSupabaseAccessToken"];
  private readonly supabaseClient?: SupabaseClient;
  private readonly cachedAuthentications = new Map<string, CachedAuthenticationResult>();
  private readonly pendingAuthentications = new Map<
    string,
    Promise<AuthenticatedRequestContext | undefined>
  >();

  constructor(options: RequestAuthenticatorOptions) {
    this.resolveLegacyAccessToken = options.resolveLegacyAccessToken;
    this.resolveSupabaseAccessToken = options.resolveSupabaseAccessToken;

    if (!this.resolveSupabaseAccessToken && options.supabaseUrl && options.supabaseAuthKey) {
      this.supabaseClient = createClient(options.supabaseUrl, options.supabaseAuthKey, {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
        global: {
          fetch: (input: RequestInfo | URL, init?: RequestInit) => fetch(input, {
            ...init,
            signal: init?.signal ?? AbortSignal.timeout(supabaseAuthLookupTimeoutMs),
          }),
        },
      });

      this.resolveSupabaseAccessToken = async (
        accessToken: string,
      ): Promise<AuthenticatedRequestContext | undefined> => {
        const { data, error } = await this.supabaseClient!.auth.getUser(accessToken);
        if (error || !data.user) {
          return undefined;
        }

        return {
          userId: data.user.id,
          email: data.user.email || undefined,
        };
      };
    }
  }

  private readCachedAuthentication(accessToken: string): CachedAuthenticationResult | undefined {
    const cachedResult = this.cachedAuthentications.get(accessToken);
    if (!cachedResult) {
      return undefined;
    }

    if (cachedResult.expiresAt <= Date.now()) {
      this.cachedAuthentications.delete(accessToken);
      return undefined;
    }

    return cachedResult;
  }

  private cacheAuthentication(
    accessToken: string,
    context: AuthenticatedRequestContext | undefined,
    ttlMs: number,
  ): void {
    if (!Number.isFinite(ttlMs) || ttlMs <= 0) {
      this.cachedAuthentications.delete(accessToken);
      return;
    }

    this.cachedAuthentications.set(accessToken, {
      context,
      expiresAt: Date.now() + ttlMs,
    });
  }

  async authenticate(
    headers: Record<string, string>,
  ): Promise<AuthenticatedRequestContext | undefined> {
    const bearerToken = readBearerToken(headers);
    if (!bearerToken) {
      return undefined;
    }

    const legacyProfile = this.resolveLegacyAccessToken?.(bearerToken);
    if (legacyProfile) {
      return legacyProfile;
    }

    const cachedResult = this.readCachedAuthentication(bearerToken);
    if (cachedResult) {
      return cachedResult.context;
    }

    if (!this.resolveSupabaseAccessToken) {
      return undefined;
    }
    const resolveSupabaseAccessToken = this.resolveSupabaseAccessToken;

    const pendingAuthentication = this.pendingAuthentications.get(bearerToken);
    if (pendingAuthentication) {
      return pendingAuthentication;
    }

    const authenticationPromise = (async (): Promise<AuthenticatedRequestContext | undefined> => {
      try {
        const context = await resolveSupabaseAccessToken(bearerToken);
        if (!context) {
          this.cacheAuthentication(bearerToken, undefined, failedAuthenticationCacheTtlMs);
          return undefined;
        }

        this.cacheAuthentication(
          bearerToken,
          context,
          resolveSuccessfulAuthenticationCacheTtl(bearerToken),
        );
        return context;
      } catch {
        return this.readCachedAuthentication(bearerToken)?.context;
      }
    })().finally(() => {
      this.pendingAuthentications.delete(bearerToken);
    });

    this.pendingAuthentications.set(bearerToken, authenticationPromise);
    return await authenticationPromise;
  }
}

export function createRequestAuthenticator(
  options: RequestAuthenticatorOptions,
): RequestAuthenticator {
  return new HybridRequestAuthenticator(options);
}

export function resolveSupabaseAuthKey(): string | undefined {
  return resolveServerSupabaseConfig().authKey;
}
