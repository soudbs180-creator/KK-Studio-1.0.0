import { Request, Response, NextFunction } from 'express';

const LOOPBACK_HOSTNAMES = new Set(['localhost', '127.0.0.1', '[::1]']);

/** CORS 只接受可解析且 hostname 精确为 loopback 的 HTTP(S) Origin。 */
export function isAllowedLocalOrigin(origin: string): boolean {
  try {
    const parsedOrigin = new URL(origin);
    return (parsedOrigin.protocol === 'http:' || parsedOrigin.protocol === 'https:')
      && !parsedOrigin.username
      && !parsedOrigin.password
      && LOOPBACK_HOSTNAMES.has(parsedOrigin.hostname);
  } catch {
    return false;
  }
}

/** Host 校验必须精确解析 hostname，不能依赖可被前缀绕过的 startsWith。 */
export function isAllowedLoopbackHost(host: string): boolean {
  if (!host || /[\/@]/.test(host)) {
    return false;
  }

  try {
    return LOOPBACK_HOSTNAMES.has(new URL(`http://${host}`).hostname);
  } catch {
    return false;
  }
}

// 简体中文：拦截外部恶意站点的跨站 CORS 攻击与非法 Host 接入 (Origin Guard)
export const originGuard = (req: Request, res: Response, next: NextFunction) => {
  const origin = req.headers.origin || '';
  const host = req.headers.host || '';

  // 1. 验证 Origin 来源，仅允许 localhost 同源
  if (origin && !isAllowedLocalOrigin(origin)) {
    console.warn(`[OriginGuard] 拦截了非同源的跨域请求 Origin: ${origin}`);
    return res.status(403).send('Forbidden: Access allowed only from local KK Studio frontend.');
  }

  // 2. 验证 Host 头部，防御 DNS rebinding 攻击
  if (!isAllowedLoopbackHost(host)) {
    console.warn(`[OriginGuard] 拦截了异常 Host 头部: ${host}`);
    return res.status(403).send('Forbidden: Unauthorized Host header.');
  }

  next();
};
