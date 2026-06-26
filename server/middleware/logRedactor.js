// server/middleware/logRedactor.js
/**
 * @file logRedactor.js
 * @description 日志脱敏过滤中间件，保护生产密钥与用户数据隐私，阻断敏感数据打印至控制台或日志文件。
 */

function redactObject(obj) {
  if (!obj || typeof obj !== 'object') {
    return obj;
  }

  if (Array.isArray(obj)) {
    return obj.map(redactObject);
  }

  const redacted = {};
  const SENSITIVE_KEYS = new Set([
    'password', 'apikey', 'api_key', 'key', 'secret',
    'authorization', 'token', 'access_token', 'refresh_token',
    'encrypted_secret', 'encrypted_refresh_token'
  ]);

  for (const [key, value] of Object.entries(obj)) {
    const lowerKey = key.toLowerCase();
    if (SENSITIVE_KEYS.has(lowerKey)) {
      redacted[key] = '[REDACTED]';
    } else if (typeof value === 'object' && value !== null) {
      redacted[key] = redactObject(value);
    } else {
      redacted[key] = value;
    }
  }

  return redacted;
}

module.exports = function logRedactor(req, res, next) {
  // 脱敏请求体以供日志记录器使用
  if (req.body && typeof req.body === 'object') {
    req.redactedBody = redactObject(req.body);
  }
  
  // 脱敏 HTTP 头部字段（如 Authorization 密文和 Cookies）
  if (req.headers && typeof req.headers === 'object') {
    req.redactedHeaders = redactObject(req.headers);
  }

  next();
};
