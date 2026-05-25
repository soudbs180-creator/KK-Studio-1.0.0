import axios from 'axios';

export const apiClient = axios.create({
  baseURL: typeof window !== 'undefined' ? (window.location.origin || '') : 'https://kkai.plus',
  timeout: 30000,
});

apiClient.interceptors.request.use(
  (config) => {
    if (typeof window !== 'undefined') {
      const token = window.sessionStorage?.getItem('kk.api.access_token') || 
                    window.localStorage?.getItem('kk.api.access_token');
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
    }
    // OpenAI 规范：对 OpenAI 调用附加客户端 RequestId 以追踪限流
    if (!config.headers['X-Client-Request-Id']) {
      config.headers['X-Client-Request-Id'] = `web-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response) {
      const { status, data } = error.response;
      if (status === 401) {
        console.error('[api-client] Unauthorized, triggering reauth...');
        if (typeof window !== 'undefined') {
          // 广播授权过期事件，通知前端 UI 跳转登录页
          window.dispatchEvent(new CustomEvent('kk-api-unauthorized'));
        }
      } else if (status === 429) {
        console.warn('[api-client] Rate limited (429): 请稍后再试。');
      } else if (status === 500) {
        console.error('[api-client] Internal Server Error (500):', data || error.message);
      }
    }
    return Promise.reject(error);
  }
);
