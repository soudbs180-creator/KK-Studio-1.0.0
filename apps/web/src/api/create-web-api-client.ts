import {
  createKkApiClient,
  type ApiClientConfig,
  type ApiClientRequestOptions,
  type KkApiClient,
} from "../../../../packages/contracts/src/client/kk-api-client.ts";

export interface WebApiClientConfig {
  accessToken?: string;
  apiBaseUrl?: string;
  clientVersion?: string;
  headers?: Record<string, string | undefined>;
}

function resolveDefaultBaseUrl(): string {
  const runtime = globalThis as typeof globalThis & {
    location?: {
      origin?: string;
    };
  };

  if (runtime.location?.origin) {
    return runtime.location.origin;
  }

  return "http://127.0.0.1:3001";
}

export function createWebApiClient(config: WebApiClientConfig = {}): KkApiClient {
  const apiConfig: ApiClientConfig = {
    baseUrl: config.apiBaseUrl || resolveDefaultBaseUrl(),
    getAccessToken: () => config.accessToken,
    getClientVersion: () => config.clientVersion || "kk-web-migration-preview",
    getDefaultHeaders: () => config.headers || {},
  };

  return createKkApiClient(apiConfig);
}

export type { ApiClientRequestOptions };
