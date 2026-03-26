import {
  createKkApiClient,
  type KkApiClient,
} from "../../../packages/contracts/src/client/kk-api-client.ts";
import { ADMIN_SESSION_TOKEN_HEADER } from "../../../packages/shared/src/index.ts";
import { readRuntimeEnv, readRuntimeOrigin } from "../../utils/runtimeEnv.ts";
import {
  getPreferredKkApiAccessToken,
  setStoredKkApiAccessToken,
} from "./authAccessToken.ts";
import { getStoredAdminSessionToken } from "./adminSession.ts";

export function resolveKkApiBaseUrl(): string {
  const configuredBaseUrl = readRuntimeEnv("VITE_KK_API_BASE_URL") || "";
  if (configuredBaseUrl) {
    return configuredBaseUrl;
  }

  const runtimeOrigin = readRuntimeOrigin();
  if (runtimeOrigin) {
    return runtimeOrigin;
  }

  return "http://127.0.0.1:3001";
}

export function setKkApiAccessToken(token?: string) {
  setStoredKkApiAccessToken(token);
}

export function createLegacyWebApiClient(): KkApiClient {
  return createKkApiClient({
    baseUrl: resolveKkApiBaseUrl(),
    getAccessToken: getPreferredKkApiAccessToken,
    getClientVersion: () => "kk-legacy-web",
    getDefaultHeaders: () => ({
      [ADMIN_SESSION_TOKEN_HEADER]: getStoredAdminSessionToken(),
    }),
  });
}

export const legacyWebApiClient = createLegacyWebApiClient();
