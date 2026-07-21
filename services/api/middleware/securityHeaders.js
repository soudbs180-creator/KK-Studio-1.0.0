// services/api/middleware/securityHeaders.js
/**
 * @file securityHeaders.js
 * @description HTTP 安全响应头管控中间件，强化 VPS 安全边界防线。
 */

module.exports = function securityHeaders(req, res, next) {
  // 仅在非 Stripe Webhook 请求上挂载安全标头
  if (!req.path.startsWith('/webhook/stripe')) {
    // 强制浏览器不要嗅探 MIME 类型
    res.setHeader('X-Content-Type-Options', 'nosniff');
    // 彻底禁止页面被嵌入 Frame 以防御点击劫持
    res.setHeader('X-Frame-Options', 'DENY');
    // 控制跨域 Referer 信息泄露
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    // 开启旧版浏览器的 XSS 注入拦截
    res.setHeader('X-XSS-Protection', '1; mode=block');
  }
  next();
};
