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
  supabaseUrl?: string;
  supabaseAuthKey?: string;
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
  private readonly supabaseClient?: SupabaseClient;

  constructor(options: RequestAuthenticatorOptions) {
    this.resolveLegacyAccessToken = options.resolveLegacyAccessToken;

    if (options.supabaseUrl && options.supabaseAuthKey) {
      this.supabaseClient = createClient(options.supabaseUrl, options.supabaseAuthKey, {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      });
    }
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

    if (!this.supabaseClient) {
      return undefined;
    }

    const { data, error } = await this.supabaseClient.auth.getUser(bearerToken);
    if (error || !data.user) {
      return undefined;
    }

    return {
      userId: data.user.id,
      email: data.user.email || undefined,
    };
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
