import {
  createKkApiClient,
  type KkApiClient,
} from "../../../packages/contracts/src/client/kk-api-client.ts";
import { ADMIN_SESSION_TOKEN_HEADER } from "../../../packages/shared/src/index.ts";
import {
  getPreferredKkApiAccessToken,
  setStoredKkApiAccessToken,
} from "./authAccessToken";
import { getStoredAdminSessionToken } from "./adminSession";

function resolveBaseUrl(): string {
  const configuredBaseUrl = String(import.meta.env.VITE_KK_API_BASE_URL || "").trim();
  if (configuredBaseUrl) {
    return configuredBaseUrl;
  }

  if (typeof window !== "undefined" && window.location?.origin) {
    return window.location.origin;
  }

  return "http://127.0.0.1:3001";
}

export function setKkApiAccessToken(token?: string) {
  setStoredKkApiAccessToken(token);
}

export function createLegacyWebApiClient(): KkApiClient {
  return createKkApiClient({
    baseUrl: resolveBaseUrl(),
    getAccessToken: getPreferredKkApiAccessToken,
    getClientVersion: () => "kk-legacy-web",
    getDefaultHeaders: () => ({
      [ADMIN_SESSION_TOKEN_HEADER]: getStoredAdminSessionToken(),
    }),
  });
}

export const legacyWebApiClient = createLegacyWebApiClient();
