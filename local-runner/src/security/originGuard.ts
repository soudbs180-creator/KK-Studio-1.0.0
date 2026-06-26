import { Request, Response, NextFunction } from 'express';

// 简体中文：拦截外部恶意站点的跨站 CORS 攻击与非法 Host 接入 (Origin Guard)
export const originGuard = (req: Request, res: Response, next: NextFunction) => {
  const origin = req.headers.origin || '';
  const host = req.headers.host || '';

  // 1. 验证 Origin 来源，仅允许 localhost 同源
  if (origin) {
    const isLocalhost = origin.startsWith('http://localhost:') || origin.startsWith('http://127.0.0.1:');
    if (!isLocalhost) {
      console.warn(`[OriginGuard] 拦截了非同源的跨域请求 Origin: ${origin}`);
      return res.status(403).send('Forbidden: Access allowed only from local KK Studio frontend.');
    }
  }

  // 2. 验证 Host 头部，防御 DNS rebinding 攻击
  const isLocalHostHeader = host.startsWith('localhost:') || host.startsWith('127.0.0.1:');
  if (!isLocalHostHeader) {
    console.warn(`[OriginGuard] 拦截了异常 Host 头部: ${host}`);
    return res.status(403).send('Forbidden: Unauthorized Host header.');
  }

  next();
};
