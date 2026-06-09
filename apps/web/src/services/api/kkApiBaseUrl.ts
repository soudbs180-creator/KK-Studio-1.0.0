import { readRuntimeEnv, readRuntimeOrigin } from "../../utils/runtimeEnv.ts";

const DEFAULT_HOSTED_MODEL_PROXY_API_BASE_URL = "https://172-245-156-16.sslip.io";

// 内存中缓存的延迟最低 API URL
let memoryOptimalApiBaseUrl: string | null = null;

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

// 简体中文注释：判断是否为 create.xyz 或 createanything.com 等沙箱/托管预览环境的域名
function isSandboxOrigin(origin?: string): boolean {
  const hostname = resolveOriginHostname(origin) || "";
  return hostname.endsWith("create.xyz")
    || hostname.endsWith("createanything.com")
    || hostname === "create.xyz"
    || hostname === "createanything.com"
    || hostname.endsWith("anything.com")
    || hostname === "anything.com";
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

// ----------------------------------------------------
// 🚀 新增：智能延迟竞争测速（Smart Routing）与状态指纹机制
// ----------------------------------------------------

function generateNetworkFingerprint(): string {
  if (typeof window === "undefined" || !window.navigator) {
    return "server-env";
  }
  const onLine = window.navigator.onLine ? "online" : "offline";
  const connection = (window.navigator as any).connection;
  const connectionType = connection ? `${connection.type || ""}_${connection.effectiveType || ""}` : "unknown-conn";
  return `${onLine}_${connectionType}`;
}

export async function startOptimalApiBaseUrlRace(): Promise<string | null> {
  if (typeof window === "undefined") return null;

  const rawEnvValue = readRuntimeEnv("VITE_KK_API_BASE_URL") || "";
  const normalizedRaw = rawEnvValue.trim().toLowerCase();
  const runtimeOrigin = readRuntimeOrigin();

  const isForceProxy = normalizedRaw === "proxy"
    || normalizedRaw === "self"
    || normalizedRaw === "relative"
    || normalizedRaw === "/"
    || (readRuntimeEnv("VITE_FORCE_REWRITE_PROXY") || "").trim().toLowerCase() === "true";

  if (isForceProxy && runtimeOrigin) {
    memoryOptimalApiBaseUrl = runtimeOrigin;
    return runtimeOrigin;
  }

  const configuredBaseUrl = normalizeConfiguredApiBaseUrl(rawEnvValue);
  
  if (!configuredBaseUrl || !runtimeOrigin || configuredBaseUrl === runtimeOrigin) {
    memoryOptimalApiBaseUrl = runtimeOrigin || configuredBaseUrl || null;
    return memoryOptimalApiBaseUrl;
  }

  const OPTIMAL_URL_KEY = "kk_optimal_api_base_url_v1";
  const NETWORK_FINGERPRINT_KEY = "kk_optimal_api_network_fingerprint";
  const LAST_RACED_KEY = "kk_optimal_api_last_raced_at";
  const CACHE_TTL_MS = 6 * 60 * 60 * 1000; // 缓存有效保持时间：6 小时

  const cachedUrl = window.localStorage.getItem(OPTIMAL_URL_KEY);
  const cachedFingerprint = window.localStorage.getItem(NETWORK_FINGERPRINT_KEY);
  const cachedLastRacedStr = window.localStorage.getItem(LAST_RACED_KEY);
  
  const currentFingerprint = generateNetworkFingerprint();
  const now = Date.now();
  const cacheAge = now - Number(cachedLastRacedStr || 0);

  // 如果网络指纹未变且未超时，直接使用并保持缓存路线
  if (cachedUrl && cachedFingerprint === currentFingerprint && cacheAge < CACHE_TTL_MS) {
    memoryOptimalApiBaseUrl = cachedUrl;
    return cachedUrl;
  }

  const testPing = async (baseUrl: string): Promise<{ url: string; latency: number }> => {
    const probeUrl = new URL("healthz", baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`);
    probeUrl.searchParams.set("smart_probe", String(Date.now()));
    
    const startTime = performance.now();
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 2000); // 2 秒超时降级
      
      const response = await fetch(probeUrl.toString(), {
        method: "GET",
        headers: { accept: "application/json" },
        signal: controller.signal,
        cache: "no-store",
        credentials: "omit"
      });
      clearTimeout(timeoutId);
      
      // 简体中文注释：强校验健康检查响应，必须为 200 OK 且响应体为包含 ok: true 或 success: true 的 JSON 格式
      if (response.ok) {
        const contentType = response.headers.get("content-type") || "";
        if (contentType.includes("application/json")) {
          const json = await response.json().catch(() => null);
          if (json && (json.ok === true || json.success === true)) {
            return { url: baseUrl, latency: performance.now() - startTime };
          }
        }
      }
      return { url: baseUrl, latency: 9999 };
    } catch {
      return { url: baseUrl, latency: 9999 };
    }
  };

  try {
    const results = await Promise.all([
      testPing(runtimeOrigin),
      testPing(configuredBaseUrl)
    ]);

    const optimal = results.reduce((prev, curr) => (curr.latency < prev.latency ? curr : prev));
    
    // 简体中文注释：若均探测失败，且运行环境属于沙箱预览环境，则优先回退到配置好的本地 API 地址以防止访问沙箱网关报错
    const optimalUrl = optimal.latency < 9999
      ? optimal.url
      : (isSandboxOrigin(runtimeOrigin) ? (configuredBaseUrl || runtimeOrigin) : runtimeOrigin);

    window.localStorage.setItem(OPTIMAL_URL_KEY, optimalUrl);
    window.localStorage.setItem(NETWORK_FINGERPRINT_KEY, currentFingerprint);
    window.localStorage.setItem(LAST_RACED_KEY, String(now));
    
    memoryOptimalApiBaseUrl = optimalUrl;
    console.log(`[Smart Routing] 智能网络延迟测试完毕。中转延迟: ${results[0].latency.toFixed(1)}ms | 直连延迟: ${results[1].latency.toFixed(1)}ms。最低延迟选择: ${optimalUrl}`);
    return optimalUrl;
  } catch (e) {
    const fallbackUrl = isSandboxOrigin(runtimeOrigin) ? (configuredBaseUrl || runtimeOrigin) : runtimeOrigin;
    memoryOptimalApiBaseUrl = fallbackUrl;
    return fallbackUrl;
  }
}

// ----------------------------------------------------
// 🚀 位置变化网络监听（online 触发重新测速匹配）
// ----------------------------------------------------
if (typeof window !== "undefined") {
  const handleNetworkChange = () => {
    console.log("[Smart Routing] 检测到网络状态或物理位置发生变化，准备擦除缓存重新匹配最低延迟...");
    try {
      window.localStorage.removeItem("kk_optimal_api_network_fingerprint");
      startOptimalApiBaseUrlRace();
    } catch {}
  };

  window.addEventListener("online", handleNetworkChange);
  if ((window.navigator as any).connection) {
    (window.navigator as any).connection.addEventListener("change", handleNetworkChange);
  }
}

export function resolveKkApiBaseUrl(): string {
  // 如果内存中已缓存了测速后的最优结果，零延迟瞬间返回
  if (memoryOptimalApiBaseUrl) {
    return memoryOptimalApiBaseUrl;
  }

  // 尝试从持久化缓存中读取，保证页面刷新时的低延迟体验
  if (typeof window !== "undefined") {
    try {
      const cachedUrl = window.localStorage.getItem("kk_optimal_api_base_url_v1");
      if (cachedUrl) {
        memoryOptimalApiBaseUrl = cachedUrl;
        return cachedUrl;
      }
    } catch {}
  }

  // 如果处于开机启动阶段（尚未完成测速竞争），启动后台默默异步测速，并先快速回退到安全的中转路线，绝不卡死首屏渲染
  if (typeof window !== "undefined") {
    setTimeout(() => {
      startOptimalApiBaseUrlRace();
    }, 50);
  }

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
  if (memoryOptimalApiBaseUrl) {
    return memoryOptimalApiBaseUrl;
  }

  if (typeof window !== "undefined") {
    try {
      const cachedUrl = window.localStorage.getItem("kk_optimal_api_base_url_v1");
      if (cachedUrl) {
        memoryOptimalApiBaseUrl = cachedUrl;
        return cachedUrl;
      }
    } catch {}
  }

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
