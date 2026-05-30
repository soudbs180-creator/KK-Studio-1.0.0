// packages/api-client/src/client.ts
// 职责：创建统一的 axios 实例，并在浏览器端安全处理 JWT 注入与滑动续期。

import axios from 'axios';

const accessTokenStorageKey = 'kk.api.access_token';
const browserCookieMaxAgeSeconds = 180 * 24 * 60 * 60;

let inMemoryAccessToken: string | undefined;

const resolveDynamicBaseURL = (configured: string): string => {
  if (typeof window === 'undefined') {
    return configured;
  }

  try {
    const runtimeUrl = new URL(window.location.href);
    const configuredUrl = new URL(configured, window.location.origin);
    const runtimeHostname = runtimeUrl.hostname.toLowerCase();
    const configuredHostname = configuredUrl.hostname.toLowerCase();

    const isConfiguredLocal = configuredHostname === 'localhost' || configuredHostname === '127.0.0.1';
    const isRuntimeLocal = runtimeHostname === 'localhost' || runtimeHostname === '127.0.0.1';

    // 简体中文注释：若配置的 API 是本地环回（如 localhost/127.0.0.1），但当前处于非环回的局域网环境（手机调试），
    // 自动将其替换为电脑的局域网 IP，打通手机浏览器直接连接本地 API 的能力。
    if (isConfiguredLocal && !isRuntimeLocal) {
      configuredUrl.hostname = runtimeUrl.hostname;
      return configuredUrl.toString().replace(/\/$/, '');
    }
  } catch {
    // 简体中文注释：忽略非标准 URL，直接回退为原始配置值
  }

  return configured;
};

const getBaseURL = (): string => {
  if (typeof window !== 'undefined') {
    const configured = (import.meta.env?.VITE_PUBLIC_API_BASE_URL as string) ?? '/api';
    return resolveDynamicBaseURL(configured);
  }

  return (process.env.EXPO_PUBLIC_API_BASE_URL) || '/api';
};

function getBrowserStorage(kind: 'localStorage' | 'sessionStorage'): Storage | undefined {
  if (typeof window === 'undefined') {
    return undefined;
  }

  try {
    return window[kind];
  } catch {
    return undefined;
  }
}

function readStorageItem(storage: Storage | undefined, key: string): string | undefined {
  try {
    return storage?.getItem(key) || undefined;
  } catch {
    return undefined;
  }
}

function writeStorageItem(storage: Storage | undefined, key: string, value: string): void {
  try {
    storage?.setItem(key, value);
  } catch {
    // 简体中文注释：移动端隐私模式可能禁止写入 storage，继续依赖 cookie 与内存兜底。
  }
}

function removeStorageItem(storage: Storage | undefined, key: string): void {
  try {
    storage?.removeItem(key);
  } catch {
    // 简体中文注释：退出或失效清理失败不能反向打断请求错误处理。
  }
}

function readCookieItem(key: string): string | undefined {
  if (typeof document === 'undefined' || typeof document.cookie !== 'string') {
    return undefined;
  }

  const encodedKey = encodeURIComponent(key);
  const pair = document.cookie
    .split(';')
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${encodedKey}=`));

  if (!pair) {
    return undefined;
  }

  try {
    return decodeURIComponent(pair.slice(encodedKey.length + 1)) || undefined;
  } catch {
    return undefined;
  }
}

function writeCookieItem(key: string, value: string): void {
  if (typeof document === 'undefined') {
    return;
  }

  try {
    const isHttps = typeof window !== 'undefined' && window.location?.protocol === 'https:';
    const cookieSuffix = isHttps
      ? '; Secure; SameSite=None'
      : '; SameSite=Lax';
    document.cookie = `${encodeURIComponent(key)}=${encodeURIComponent(value)}; Max-Age=${browserCookieMaxAgeSeconds}; Path=/${cookieSuffix}`;
  } catch {
    // 简体中文注释：部分 WebView 会禁用 cookie 写入，当前页面仍可使用内存 token。
  }
}

function removeCookieItem(key: string): void {
  if (typeof document === 'undefined') {
    return;
  }

  try {
    const secureSuffix = typeof window !== 'undefined' && window.location?.protocol === 'https:'
      ? '; Secure'
      : '';
    document.cookie = `${encodeURIComponent(key)}=; Max-Age=0; Path=/; SameSite=Lax${secureSuffix}`;
  } catch {
    // 简体中文注释：清理 cookie 是尽力行为，避免在异常浏览器里造成二次错误。
  }
}

export function persistBrowserAccessToken(token: string): string {
  inMemoryAccessToken = token;
  writeStorageItem(getBrowserStorage('sessionStorage'), accessTokenStorageKey, token);
  writeStorageItem(getBrowserStorage('localStorage'), accessTokenStorageKey, token);
  writeCookieItem(accessTokenStorageKey, token);
  return token;
}

function readBrowserAccessToken(): string | undefined {
  const token = readStorageItem(getBrowserStorage('sessionStorage'), accessTokenStorageKey)
    || readStorageItem(getBrowserStorage('localStorage'), accessTokenStorageKey)
    || readCookieItem(accessTokenStorageKey)
    || inMemoryAccessToken;

  return token ? persistBrowserAccessToken(token) : undefined;
}

export function clearBrowserAccessToken(): void {
  inMemoryAccessToken = undefined;
  removeStorageItem(getBrowserStorage('sessionStorage'), accessTokenStorageKey);
  removeStorageItem(getBrowserStorage('localStorage'), accessTokenStorageKey);
  removeCookieItem(accessTokenStorageKey);
}

function createClientRequestId(): string {
  const runtimeCrypto = globalThis.crypto;
  if (runtimeCrypto && typeof runtimeCrypto.randomUUID === 'function') {
    return runtimeCrypto.randomUUID();
  }
  return `web-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
}

export const apiClient = axios.create({
  baseURL: getBaseURL(),
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json; charset=utf-8',
    Accept: 'application/json; charset=utf-8',
  },
});

apiClient.interceptors.request.use(
  (config) => {
    const token = readBrowserAccessToken();
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }

    if (!config.headers['X-Client-Request-Id']) {
      config.headers['X-Client-Request-Id'] = createClientRequestId();
    }

    return config;
  },
  (error) => Promise.reject(error),
);

apiClient.interceptors.response.use(
  (response) => {
    // 简体中文注释：若登录或刷新直接在返回体中携带了 token 或 accessToken，自动更新并缓存凭据到内存，免除外部手动关联的额外开销
    if (response.data && typeof response.data === 'object') {
      const token = response.data.token || response.data.accessToken;
      if (token && typeof token === 'string') {
        persistBrowserAccessToken(token);
      }
    }

    const refreshToken = response.headers?.['x-refresh-token'] || response.headers?.['X-Refresh-Token'];
    if (refreshToken && typeof refreshToken === 'string') {
      persistBrowserAccessToken(refreshToken);
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('kk-api-token-refreshed', { detail: { token: refreshToken } }));
      }
    }
    return response;
  },
  (error) => {
    if (error.response) {
      const { status, data } = error.response;
      if (status === 401) {
        // 简体中文注释：仅当请求真正携带了授权凭据时，401 才判断为过期并清除。匿名请求 401 不执行擦除，防止误踢用户。
        const hasAuthHeader = Boolean(error.config?.headers?.Authorization || error.config?.headers?.authorization);
        if (hasAuthHeader) {
          console.error('[api-client] 授权过期或未登录，正在触发重定向...');
          clearBrowserAccessToken();
          if (typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent('kk-api-unauthorized'));
          }
        } else {
          console.warn('[api-client] 匿名请求返回 401，忽略凭据擦除。');
        }
      } else if (status === 429) {
        console.warn('[api-client] 速率限制 (429): 请稍后再试。');
      } else if (status === 500) {
        console.error('[api-client] 服务器内部错误 (500):', data || error.message);
      }
    }
    return Promise.reject(error);
  },
);
