import {
  createKkApiClient,
  type KkApiClient,
} from "../../../../../packages/shared/src/index.ts";
import {
  ADMIN_SESSION_TOKEN_HEADER,
  TEMP_USER_ID_HEADER,
} from "../../../../../packages/shared/src/index.ts";
import { readRuntimeEnv, readRuntimeOrigin } from "../../utils/runtimeEnv.ts";
import {
  getPreferredKkApiAccessToken,
  refreshPreferredKkApiAccessToken,
  setStoredKkApiAccessToken,
} from "./authAccessToken.ts";
import { getStoredAdminSessionToken } from "./adminSession.ts";
import { getRuntimeOwnerId } from "../auth/runtimeSessionProfile.ts";
import {
  isHostedRuntime,
  isLoopbackHostname,
  isPrivateNetworkHostname,
  resolveKkApiBaseUrl,
  resolveKkApiModelProxyBaseUrl,
  resolveOriginHostname,
} from "./kkApiBaseUrl.ts";

const TEMP_USER_STORAGE_KEY = "temp_user_session_v1";

export type LegacyWebApiFallbackReason =
  | "local-loopback"
  | "local-private-network"
  | "explicit-opt-in"
  | "hosted-default"
  | "not-configured";

export interface LegacyWebApiFallbackState {
  enabled: boolean;
  reason: LegacyWebApiFallbackReason;
  configuredBaseUrl?: string;
  runtimeOrigin?: string;
}

function readStoredTempUserId(): string | undefined {
  if (typeof window === "undefined") {
    return undefined;
  }

  try {
    const raw = window.localStorage.getItem(TEMP_USER_STORAGE_KEY);
    if (!raw) {
      return undefined;
    }

    const session = JSON.parse(raw) as {
      expiresAt?: number;
      user?: { id?: unknown };
    };
    const expiresAt = Number(session?.expiresAt || 0);
    if (Number.isFinite(expiresAt) && expiresAt > 0 && expiresAt <= Date.now()) {
      window.localStorage.removeItem(TEMP_USER_STORAGE_KEY);
      return undefined;
    }

    const userId = String(session?.user?.id || "").trim();
    return userId || undefined;
  } catch {
    return undefined;
  }
}

function isExplicitLegacyWebApiFallbackEnabled(): boolean {
  const rawValue = readRuntimeEnv("VITE_ENABLE_LEGACY_WEB_API_FALLBACK") || "";
  const normalized = rawValue.trim().toLowerCase();
  return normalized === "1"
    || normalized === "true"
    || normalized === "yes"
    || normalized === "on";
}

export function getLegacyWebApiFallbackState(): LegacyWebApiFallbackState {
  const configuredBaseUrl = readRuntimeEnv("VITE_KK_API_BASE_URL") || "";
  const runtimeOrigin = readRuntimeOrigin();
  const runtimeHostname = resolveOriginHostname(runtimeOrigin);

  if (runtimeHostname && isLoopbackHostname(runtimeHostname)) {
    return {
      enabled: true,
      reason: "local-loopback",
      configuredBaseUrl: configuredBaseUrl || undefined,
      runtimeOrigin,
    };
  }

  if (runtimeHostname && isPrivateNetworkHostname(runtimeHostname)) {
    return {
      enabled: true,
      reason: "local-private-network",
      configuredBaseUrl: configuredBaseUrl || undefined,
      runtimeOrigin,
    };
  }

  if (Boolean(configuredBaseUrl) && isExplicitLegacyWebApiFallbackEnabled()) {
    return {
      enabled: true,
      reason: "explicit-opt-in",
      configuredBaseUrl,
      runtimeOrigin,
    };
  }

  return {
    enabled: false,
    reason: configuredBaseUrl ? "hosted-default" : "not-configured",
    configuredBaseUrl: configuredBaseUrl || undefined,
    runtimeOrigin,
  };
}

export function shouldUseLegacyWebApiFallback(): boolean {
  return getLegacyWebApiFallbackState().enabled;
}

export function setKkApiAccessToken(token?: string) {
  setStoredKkApiAccessToken(token);
}

function persistRefreshedKkApiAccessToken(token: string) {
  setStoredKkApiAccessToken(token);
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("kk-api-token-refreshed", { detail: { token } }));
  }
}

export function createKkWebApiClient(): KkApiClient {
  return createKkApiClient({
    baseUrl: resolveKkApiBaseUrl(),
    getAccessToken: getPreferredKkApiAccessToken,
    refreshAccessToken: refreshPreferredKkApiAccessToken,
    getAuthSubject: getRuntimeOwnerId,
    onRefreshToken: persistRefreshedKkApiAccessToken,
    getClientVersion: () => "kk-legacy-web",
    getDefaultHeaders: () => ({
      [ADMIN_SESSION_TOKEN_HEADER]: getStoredAdminSessionToken(),
      [TEMP_USER_ID_HEADER]: readStoredTempUserId(),
    }),
  });
}
export const kkWebApiClient = createKkWebApiClient();

export {
  isHostedRuntime,
  isLoopbackHostname,
  isPrivateNetworkHostname,
  resolveKkApiBaseUrl,
  resolveKkApiModelProxyBaseUrl,
  resolveOriginHostname,
};
