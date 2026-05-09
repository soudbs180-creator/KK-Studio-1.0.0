import { readRuntimeEnv, readRuntimeOrigin } from "../../utils/runtimeEnv.ts";

function normalizeHostname(value: unknown): string | undefined {
  const normalized = typeof value === "string"
    ? value.trim().toLowerCase().replace(/^\[|\]$/g, "")
    : "";
  return normalized || undefined;
}

export function isLoopbackHostname(hostname: string): boolean {
  const normalized = normalizeHostname(hostname);
  return normalized === "localhost"
    || normalized === "::1"
    || Boolean(normalized && normalized.startsWith("127."));
}

export function isPrivateNetworkHostname(hostname: string): boolean {
  const normalized = normalizeHostname(hostname);
  return Boolean(
    normalized
    && (
      /^10\./.test(normalized)
      || /^192\.168\./.test(normalized)
      || /^172\.(1[6-9]|2\d|3[0-1])\./.test(normalized)
    ),
  );
}

export function resolveOriginHostname(origin?: string): string | undefined {
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

function isHostedRuntimeOrigin(runtimeOrigin?: string): boolean {
  const runtimeHostname = resolveOriginHostname(runtimeOrigin);
  return Boolean(
    runtimeHostname
    && !isLoopbackHostname(runtimeHostname)
    && !isPrivateNetworkHostname(runtimeHostname)
  );
}

function normalizeConfiguredApiBaseUrl(configuredBaseUrl: string): string {
  try {
    const url = new URL(configuredBaseUrl);
    const normalizedPathname = url.pathname.replace(/\/+$/, "");
    if (
      normalizedPathname === "/api"
      || normalizedPathname === "/api/v1"
    ) {
      url.pathname = "/";
      url.search = "";
      url.hash = "";
      return url.origin;
    }
  } catch {
    return configuredBaseUrl;
  }

  return configuredBaseUrl;
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

    return (isLoopbackHostname(configuredUrl.hostname) || isPrivateNetworkHostname(configuredUrl.hostname))
      && configuredPort === "3001"
      && (isLoopbackHostname(runtimeUrl.hostname) || isPrivateNetworkHostname(runtimeUrl.hostname))
      && runtimePort === "3000";
  } catch {
    return false;
  }
}

function shouldPreferRuntimeOriginForHostedHttpApi(
  configuredBaseUrl: string,
  runtimeOrigin?: string,
): boolean {
  if (!runtimeOrigin) {
    return false;
  }

  try {
    const configuredUrl = new URL(configuredBaseUrl);
    const runtimeUrl = new URL(runtimeOrigin);

    return runtimeUrl.protocol === "https:"
      && configuredUrl.protocol === "http:"
      && !isLoopbackHostname(configuredUrl.hostname)
      && !isPrivateNetworkHostname(configuredUrl.hostname)
      && !isLoopbackHostname(runtimeUrl.hostname)
      && !isPrivateNetworkHostname(runtimeUrl.hostname);
  } catch {
    return false;
  }
}

export function resolveKkApiBaseUrl(): string {
  const configuredBaseUrl = normalizeConfiguredApiBaseUrl(readRuntimeEnv("VITE_KK_API_BASE_URL") || "");
  const runtimeOrigin = readRuntimeOrigin();
  if (configuredBaseUrl) {
    if (shouldPreferRuntimeOriginForLocalApi(configuredBaseUrl, runtimeOrigin)) {
      return runtimeOrigin!;
    }
    if (shouldPreferRuntimeOriginForHostedHttpApi(configuredBaseUrl, runtimeOrigin)) {
      return runtimeOrigin!;
    }
    return configuredBaseUrl;
  }

  if (runtimeOrigin) {
    return runtimeOrigin;
  }

  return "http://127.0.0.1:3001";
}

export function isHostedRuntime(): boolean {
  const hostname = resolveOriginHostname(readRuntimeOrigin()) || "";
  return !isLoopbackHostname(hostname) && !isPrivateNetworkHostname(hostname);
}
