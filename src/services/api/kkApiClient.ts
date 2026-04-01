import {
  createKkApiClient,
  type KkApiClient,
} from "../../../packages/contracts/src/index.ts";
import { ADMIN_SESSION_TOKEN_HEADER } from "../../../packages/shared/src/index.ts";
import { readRuntimeEnv, readRuntimeOrigin } from "../../utils/runtimeEnv.ts";
import {
  getPreferredKkApiAccessToken,
  refreshPreferredKkApiAccessToken,
  setStoredKkApiAccessToken,
} from "./authAccessToken.ts";
import { getStoredAdminSessionToken } from "./adminSession.ts";

export function isLoopbackHostname(hostname: string): boolean {
  const normalized = String(hostname || "").trim().toLowerCase().replace(/^\[|\]$/g, "");
  return normalized === "localhost"
    || normalized === "::1"
    || normalized.startsWith("127.");
}

function resolveOriginHostname(origin?: string): string | undefined {
  const normalizedOrigin = String(origin || "").trim();
  if (!normalizedOrigin) {
    return undefined;
  }

  try {
    return new URL(normalizedOrigin).hostname;
  } catch {
    return undefined;
  }
}

function shouldPreferRuntimeOriginForLocalApi(
  configuredBaseUrl: string,
  runtimeOrigin?: string,
): boolean {
  if (!runtimeOrigin) {
    return false;
  }

  try {
    const configuredUrl = new URL(configuredBaseUrl);
    const runtimeUrl = new URL(runtimeOrigin);
    const configuredPort = configuredUrl.port || (configuredUrl.protocol === "https:" ? "443" : "80");
    const runtimePort = runtimeUrl.port || (runtimeUrl.protocol === "https:" ? "443" : "80");

    return isLoopbackHostname(configuredUrl.hostname)
      && configuredPort === "3001"
      && isLoopbackHostname(runtimeUrl.hostname)
      && runtimePort === "3000";
  } catch {
    return false;
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

export function resolveKkApiBaseUrl(): string {
  const configuredBaseUrl = readRuntimeEnv("VITE_KK_API_BASE_URL") || "";
  const runtimeOrigin = readRuntimeOrigin();
  if (configuredBaseUrl) {
    if (shouldPreferRuntimeOriginForLocalApi(configuredBaseUrl, runtimeOrigin)) {
      return runtimeOrigin!;
    }
    return configuredBaseUrl;
  }

  if (runtimeOrigin) {
    return runtimeOrigin;
  }

  return "http://127.0.0.1:3001";
}

export function shouldUseLegacyWebApiFallback(): boolean {
  const configuredBaseUrl = readRuntimeEnv("VITE_KK_API_BASE_URL") || "";
  const runtimeOrigin = readRuntimeOrigin();
  const runtimeHostname = resolveOriginHostname(runtimeOrigin);
  if (runtimeHostname && isLoopbackHostname(runtimeHostname)) {
    return true;
  }

  return Boolean(configuredBaseUrl) && isExplicitLegacyWebApiFallbackEnabled();
}

export function setKkApiAccessToken(token?: string) {
  setStoredKkApiAccessToken(token);
}

export function createLegacyWebApiClient(): KkApiClient {
  return createKkApiClient({
    baseUrl: resolveKkApiBaseUrl(),
    getAccessToken: getPreferredKkApiAccessToken,
    refreshAccessToken: refreshPreferredKkApiAccessToken,
    getClientVersion: () => "kk-legacy-web",
    getDefaultHeaders: () => ({
      [ADMIN_SESSION_TOKEN_HEADER]: getStoredAdminSessionToken(),
    }),
  });
}

export const legacyWebApiClient = createLegacyWebApiClient();
