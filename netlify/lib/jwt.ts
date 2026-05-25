// netlify/lib/jwt.ts
// 职责：使用 Node.js 原生 crypto 模块手写轻量级 HMAC-SHA256 JWT 签发与验证工具。
// 避免外部模块引入开销，并遵守所有 AGENTS 中文注释及开发规范。

import crypto from "crypto";

// 读取后端的 JWT 签名密钥
const JWT_SECRET = process.env.JWT_SECRET || "nano-banana-kk-super-secret-fallback-token-key-9988";

/**
 * Base64url 编码实现
 */
function base64UrlEncode(str: string): string {
  return Buffer.from(str).toString("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
}

/**
 * Base64url 解码实现
 */
function base64UrlDecode(str: string): string {
  let base64 = str.replace(/-/g, "+").replace(/_/g, "/");
  while (base64.length % 4) {
    base64 += "=";
  }
  return Buffer.from(base64, "base64").toString("utf8");
}

/**
 * 签发 JWT
 * @param payload 存储在 JWT 中的负载
 * @param expiresInSeconds 过期时间 (秒)，默认 24 小时 (86400 秒)
 */
export function signJWT(payload: any, expiresInSeconds: number = 86400): string {
  const header = { alg: "HS256", typ: "JWT" };
  const exp = Math.floor(Date.now() / 1000) + expiresInSeconds;
  const fullPayload = { ...payload, exp };

  const encodedHeader = base64UrlEncode(JSON.stringify(header));
  const encodedPayload = base64UrlEncode(JSON.stringify(fullPayload));

  const signature = crypto
    .createHmac("sha256", JWT_SECRET)
    .update(`${encodedHeader}.${encodedPayload}`)
    .digest("base64url");

  return `${encodedHeader}.${encodedPayload}.${signature}`;
}

/**
 * 校验并解析 Authorization 头部中的 JWT
 * @param authHeader 原始 Header（Bearer token）
 * @returns 成功返回 userId，失败或过期返回 null
 */
export function verifyJWT(authHeader: string | undefined): string | null {
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return null;
  }
  const token = authHeader.substring(7).trim();
  const parts = token.split(".");
  if (parts.length !== 3) {
    return null;
  }

  const [header, payload, signature] = parts;
  const expectedSignature = crypto
    .createHmac("sha256", JWT_SECRET)
    .update(`${header}.${payload}`)
    .digest("base64url");

  // 防止时序攻击，使用 timingSafeEqual 进行比对
  try {
    const signatureBuffer = Buffer.from(signature);
    const expectedBuffer = Buffer.from(expectedSignature);
    if (signatureBuffer.length !== expectedBuffer.length || !crypto.timingSafeEqual(signatureBuffer, expectedBuffer)) {
      return null;
    }
  } catch {
    return null;
  }

  try {
    const decodedPayload = JSON.parse(base64UrlDecode(payload));
    const now = Math.floor(Date.now() / 1000);
    // 判断过期时间
    if (decodedPayload.exp && now > decodedPayload.exp) {
      return null;
    }
    return decodedPayload.userId || null;
  } catch {
    return null;
  }
}
