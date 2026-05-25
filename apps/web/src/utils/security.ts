/**
 * 路由守卫：在生产环境和测试环境下禁止前端直连第三方 API
 */
export function shouldBlockDirectCall(): void {
  const isProd = process.env.NODE_ENV === 'production' || 
                 (typeof window !== 'undefined' && (window as any).__ENV__?.NODE_ENV === 'production');
  const isTest = process.env.NODE_ENV === 'test' || 
                 (typeof window !== 'undefined' && (window as any).__ENV__?.NODE_ENV === 'test');

  if (isProd || isTest) {
    throw new Error('[SECURITY] 禁止前端直连外部 API，请通过 secureModelProxy 转发');
  }
}

/**
 * 路由守卫：在生产环境和测试环境下禁止前端直接发起对外部域名的网络请求
 */
export function assertNoDirectCall(url: string): void {
  const isProd = process.env.NODE_ENV === 'production' || 
                 (typeof window !== 'undefined' && (window as any).__ENV__?.NODE_ENV === 'production');
  const isTest = process.env.NODE_ENV === 'test' || 
                 (typeof window !== 'undefined' && (window as any).__ENV__?.NODE_ENV === 'test');

  if (isProd || isTest) {
    if (url.startsWith('/') || url.startsWith('./') || url.startsWith('../')) {
      return;
    }

    try {
      const parsed = new URL(url);
      const host = parsed.hostname.toLowerCase();
      if (host === 'localhost' || host === '127.0.0.1' || host === 'kkai.plus') {
        return;
      }
      throw new Error(`[SECURITY] 禁止前端直连外部 API (${url})，请通过 secureModelProxy 转发`);
    } catch (e: any) {
      if (e.message.includes('[SECURITY]')) {
        throw e;
      }
      throw new Error(`[SECURITY] 禁止前端直连外部 API (${url})，请通过 secureModelProxy 转发`);
    }
  }
}
