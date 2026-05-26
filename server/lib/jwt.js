// server/lib/jwt.js
// 职责：统一提供 JWT 令牌的签发（signJWT）与验证（verifyJWT）功能。
// 遵守规范：时序安全比较防范时序攻击，所有注释均采用中文详细解释为什么和处理逻辑。

const crypto = require('crypto');

// 统一使用的 JWT 有效期为 7 天（单位：秒）
const JWT_EXPIRES_IN = 7 * 24 * 60 * 60;

/**
 * 校验启动时是否配置了 JWT_SECRET 密钥。
 * 若无，则抛出 Error 强行中断服务启动（测试运行环境下除外，测试用 mock-secret）。
 */
function getJwtSecret() {
  const isTestRun = process.env.NODE_ENV === 'test' || process.argv.some(arg => arg.includes('test'));
  const secret = process.env.JWT_SECRET;
  if (!secret && !isTestRun) {
    throw new Error('[严重] JWT_SECRET 环境变量未配置，拒绝处理 Token 验证');
  }
  return secret || 'mock-secret-for-testing-only';
}

/**
 * Base64url 编码（JWT 规范格式，去除填充且安全字符）
 */
function base64url(obj) {
  return Buffer.from(JSON.stringify(obj))
    .toString('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
}

/**
 * Base64url 解码成 utf8 字符串
 */
function base64UrlDecode(str) {
  let base64 = str.replace(/-/g, '+').replace(/_/g, '/');
  while (base64.length % 4) {
    base64 += '=';
  }
  return Buffer.from(base64, 'base64').toString('utf8');
}

/**
 * 签发新的 JWT 令牌
 * @param {object} payload - 附带的载荷数据（必须包含 userId）
 * @returns {string} 签发后的 JWT 字符串
 */
function signJWT(payload) {
  const secret = getJwtSecret();
  const header = base64url({ alg: 'HS256', typ: 'JWT' });
  const body = base64url({
    ...payload,
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + JWT_EXPIRES_IN,
  });

  const signature = crypto
    .createHmac('sha256', secret)
    .update(`${header}.${body}`)
    .digest('base64url');

  return `${header}.${body}.${signature}`;
}

/**
 * 验证 Authorization 头部中的 JWT 令牌并提取 userId
 * 使用 crypto.timingSafeEqual 严格进行签名安全比较，杜绝由于时序攻击破解签名的风险。
 * @param {string | undefined} authHeader - 客户端请求传入的 Authorization 头部
 * @returns {string | null} 验证成功返回 userId，失败或过期返回 null
 */
function verifyJWT(authHeader) {
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }
  const token = authHeader.substring(7).trim();
  const parts = token.split('.');
  if (parts.length !== 3) {
    return null;
  }

  const [header, payload, signature] = parts;
  const secret = getJwtSecret();

  // 根据头部和载荷重新生成预期的 HMAC-SHA256 签名，用于核对
  const expectedSignature = crypto
    .createHmac('sha256', secret)
    .update(`${header}.${payload}`)
    .digest('base64url');

  // 执行时序安全校验，防止根据响应时间猜测签名相似度
  try {
    const signatureBuffer = Buffer.from(signature);
    const expectedBuffer = Buffer.from(expectedSignature);
    if (signatureBuffer.length !== expectedBuffer.length || !crypto.timingSafeEqual(signatureBuffer, expectedBuffer)) {
      return null;
    }
  } catch {
    return null;
  }

  // 解码载荷，校验是否过期（exp）
  try {
    const decodedPayload = JSON.parse(base64UrlDecode(payload));
    const now = Math.floor(Date.now() / 1000);
    if (decodedPayload.exp && now > decodedPayload.exp) {
      return null;
    }
    return decodedPayload.userId || null;
  } catch {
    return null;
  }
}

module.exports = {
  signJWT,
  verifyJWT,
};
