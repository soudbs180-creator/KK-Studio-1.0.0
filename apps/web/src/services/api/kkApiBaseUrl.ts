import { readRuntimeEnv, readRuntimeOrigin } from "../../utils/runtimeEnv.ts";

const DEFAULT_HOSTED_MODEL_PROXY_API_BASE_URL = "https://172-245-156-16.sslip.io";

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
      || /^100\.(6[4-9]|[7-9]\d|1[0-1]\d|12[0-7])\./.test(normalized) // 虚拟局域网段 (CGNAT / Tailscale)
      || /^169\.254\./.test(normalized) // 本地链路地址 (Link-local)
      || normalized === "0.0.0.0"
      || normalized === "::"
      || /^fe[89ab]/i.test(normalized) // IPv6 本地链路地址 (Link-local)
      || /^f[cd]/i.test(normalized) // IPv6 唯一本地地址 (Unique local)
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

    const isConfiguredLocal = isLoopbackHostname(configuredUrl.hostname) || isPrivateNetworkHostname(configuredUrl.hostname);
    const isRuntimeLocal = isLoopbackHostname(runtimeUrl.hostname) || isPrivateNetworkHostname(runtimeUrl.hostname);

    if (!isConfiguredLocal || !isRuntimeLocal) {
      return false;
    }

    // 如果配置的 API 地址是本地环回（手机端或局域网其他设备绝对无法直接访问 localhost/127.0.0.1），
    // 并且运行环境是通过局域网非环回地址（即私有 IP）访问的，我们必须将其对齐到 runtimeOrigin
    if (isLoopbackHostname(configuredUrl.hostname) && !isLoopbackHostname(runtimeUrl.hostname)) {
      return true;
    }

    // 两者都在本地运行，且配置满足基本的本地调试，我们直接返回 true 以便局域网共享和代理
    return true;
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

function isTemporaryVpsApiHostname(hostname: string): boolean {
  const normalized = normalizeHostname(hostname) || "";
  return /^(\d{1,3}\.){3}\d{1,3}$/.test(normalized)
    || normalized.endsWith(".sslip.io")
    || normalized.endsWith(".nip.io");
}

function shouldPreferRuntimeOriginForHostedTemporaryVpsApi(
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
      && configuredUrl.protocol === "https:"
      && isHostedRuntimeOrigin(runtimeOrigin)
      && isTemporaryVpsApiHostname(configuredUrl.hostname);
  } catch {
    return false;
  }
}

function isDirectHostedModelProxyBaseUrl(
  configuredBaseUrl: string,
  runtimeOrigin?: string,
): boolean {
  try {
    const configuredUrl = new URL(configuredBaseUrl);
    const runtimeUrl = runtimeOrigin ? new URL(runtimeOrigin) : undefined;

    if (configuredUrl.protocol !== "https:") {
      return false;
    }
    if (isLoopbackHostname(configuredUrl.hostname) || isPrivateNetworkHostname(configuredUrl.hostname)) {
      return false;
    }
    if (runtimeUrl && configuredUrl.origin === runtimeUrl.origin) {
      return false;
    }

    return true;
  } catch {
    return false;
  }
}

export function resolveKkApiBaseUrl(): string {
  const rawEnvValue = readRuntimeEnv("VITE_KK_API_BASE_URL") || "";
  const normalizedRaw = rawEnvValue.trim().toLowerCase();
  const runtimeOrigin = readRuntimeOrigin();

  // 简体中文注释：智能反代指令判定。当配置为 'proxy', 'self', 'relative', '/' 或者强制标志为 true 时，强制使用当前域名相对路径走 Vercel 反代。
  const isForceProxy = normalizedRaw === "proxy"
    || normalizedRaw === "self"
    || normalizedRaw === "relative"
    || normalizedRaw === "/"
    || (readRuntimeEnv("VITE_FORCE_REWRITE_PROXY") || "").trim().toLowerCase() === "true";

  if (isForceProxy && runtimeOrigin) {
    return runtimeOrigin;
  }

  const configuredBaseUrl = normalizeConfiguredApiBaseUrl(rawEnvValue);
  if (configuredBaseUrl) {
    if (shouldPreferRuntimeOriginForLocalApi(configuredBaseUrl, runtimeOrigin)) {
      return runtimeOrigin!;
    }
    if (shouldPreferRuntimeOriginForHostedHttpApi(configuredBaseUrl, runtimeOrigin)) {
      return runtimeOrigin!;
    }
    if (shouldPreferRuntimeOriginForHostedTemporaryVpsApi(configuredBaseUrl, runtimeOrigin)) {
      return runtimeOrigin!;
    }
    return configuredBaseUrl;
  }

  if (runtimeOrigin) {
    return runtimeOrigin;
  }

  return "http://127.0.0.1:3001";
}

export function resolveKkApiModelProxyBaseUrl(): string {
  const rawEnvValue = readRuntimeEnv("VITE_KK_API_BASE_URL") || "";
  const normalizedRaw = rawEnvValue.trim().toLowerCase();
  const runtimeOrigin = readRuntimeOrigin();

  const isForceProxy = normalizedRaw === "proxy"
    || normalizedRaw === "self"
    || normalizedRaw === "relative"
    || normalizedRaw === "/"
    || (readRuntimeEnv("VITE_FORCE_REWRITE_PROXY") || "").trim().toLowerCase() === "true";

  if (isForceProxy && runtimeOrigin) {
    return runtimeOrigin;
  }

  const configuredBaseUrl = normalizeConfiguredApiBaseUrl(rawEnvValue);
  if (configuredBaseUrl) {
    if (shouldPreferRuntimeOriginForLocalApi(configuredBaseUrl, runtimeOrigin)) {
      return runtimeOrigin!;
    }
    if (isDirectHostedModelProxyBaseUrl(configuredBaseUrl, runtimeOrigin)) {
      return configuredBaseUrl;
    }
    if (shouldPreferRuntimeOriginForHostedHttpApi(configuredBaseUrl, runtimeOrigin)) {
      return runtimeOrigin!;
    }
    if (isHostedRuntimeOrigin(runtimeOrigin)) {
      return DEFAULT_HOSTED_MODEL_PROXY_API_BASE_URL;
    }
    return configuredBaseUrl;
  }

  if (runtimeOrigin) {
    if (isHostedRuntimeOrigin(runtimeOrigin)) {
      return DEFAULT_HOSTED_MODEL_PROXY_API_BASE_URL;
    }
    return runtimeOrigin;
  }

  return "http://127.0.0.1:3001";
}

export function isHostedRuntime(): boolean {
  const hostname = resolveOriginHostname(readRuntimeOrigin()) || "";
  return !isLoopbackHostname(hostname) && !isPrivateNetworkHostname(hostname);
}
