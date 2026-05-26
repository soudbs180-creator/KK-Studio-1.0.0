// packages/api-client/src/client.ts
// 职责：创建统一的 axios 实例，自动处理鉴权 token 和错误响应

import axios from 'axios';

// 声明全局变量以避免 import.meta 编译错误 (部分旧版 Webpack/CRA 的兼容处理)
const getBaseURL = (): string => {
  // 中文注释：在浏览器环境下，优先从环境变量读取 VITE_PUBLIC_API_BASE_URL，若无则使用默认的 /api 路径转发给 Netlify
  if (typeof window !== 'undefined') {
    return (import.meta.env?.VITE_PUBLIC_API_BASE_URL as string) ?? '/api';
  }
  // 中文注释：在移动端或Node环境，读取 EXPO_PUBLIC_API_BASE_URL
  return (process.env.EXPO_PUBLIC_API_BASE_URL) || '/api';
};

export const apiClient = axios.create({
  baseURL: getBaseURL(),
  timeout: 30000,
  headers: {
    // 请求头明确声明 UTF-8，防止中文乱码
    'Content-Type': 'application/json; charset=utf-8',
    'Accept': 'application/json; charset=utf-8',
  },
});

// 请求拦截器：每次请求自动附加 JWT token
apiClient.interceptors.request.use(
  (config) => {
    if (typeof window !== 'undefined') {
      // 桌面端从 sessionStorage 或 localStorage 获取 token
      const token = window.sessionStorage?.getItem('kk.api.access_token') || 
                    window.localStorage?.getItem('kk.api.access_token');
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
    } else {
      // 移动端由前端代码显式通过设置 API Client 全局配置或使用 SecureStore
      // 这里可以支持通过全局变量或局部覆盖来读取，稍后在移动端重构中补齐
    }

    // 附加客户端 Request ID 以追踪限流与辅助排查
    if (!config.headers['X-Client-Request-Id']) {
      config.headers['X-Client-Request-Id'] = `web-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// 响应拦截器：统一处理常见错误
apiClient.interceptors.response.use(
  (response) => {
    // 中文注释：滑动过期会话续期，拦截X-Refresh-Token响应头并覆盖本地Token存储
    const refreshToken = response.headers?.['x-refresh-token'] || response.headers?.['X-Refresh-Token'];
    if (refreshToken && typeof window !== 'undefined') {
      const storageKey = 'kk.api.access_token';
      window.sessionStorage?.setItem(storageKey, refreshToken);
      if (window.localStorage?.getItem(storageKey)) {
        window.localStorage.setItem(storageKey, refreshToken);
      }
      window.dispatchEvent(new CustomEvent('kk-api-token-refreshed', { detail: { token: refreshToken } }));
    }
    return response;
  },
  (error) => {
    if (error.response) {
      const { status, data } = error.response;
      if (status === 401) {
        console.error('[api-client] 授权过期或未登录，正在触发重定向...');
        if (typeof window !== 'undefined') {
          // 清除本地过期 token
          window.sessionStorage?.removeItem('kk.api.access_token');
          window.localStorage?.removeItem('kk.api.access_token');
          // 广播授权过期事件，通知前端 UI 跳转登录页
          window.dispatchEvent(new CustomEvent('kk-api-unauthorized'));
        }
      } else if (status === 429) {
        console.warn('[api-client] 速率限制 (429): 请稍后再试。');
      } else if (status === 500) {
        console.error('[api-client] 服务器内部错误 (500):', data || error.message);
      }
    }
    return Promise.reject(error);
  }
);
