// server/routes/compat/compatHelper.js
// 职责：提供大兼容路由（auth、billing、workspace、admin）共享的身份校验、Cookie 解析和信封包装等辅助逻辑。

const crypto = require('crypto');
const fs = require('fs/promises');
const path = require('path');
const { getPool } = require('../../lib/db');
const { signJWT, verifyJWT } = require('../../lib/jwt');
const credits = require('../../lib/credits');

const TEMP_USER_ID_HEADER = 'x-kk-temp-user-id';
const ADMIN_SESSION_TOKEN_HEADER = 'x-kk-admin-session-token';
const ACCESS_TOKEN_COOKIE_NAME = 'kk.api.access_token';
const REFRESH_TOKEN_COOKIE_NAME = 'kk.api.refresh_token';
const LOCAL_STORE_PATH = path.resolve(__dirname, '../../.kk-local/contract-compat.json');
const DEFAULT_CREDIT_BALANCE = 999999;

function isDbEnabled() {
  return Boolean(process.env.DATABASE_URL) && process.env.KKAI_LOCAL_ONLY !== 'true';
}

// 简体中文注释：获取当前 ISO 时间字符串
function nowIso() {
  return new Date().toISOString();
}

function requestId(req) {
  return String(req.headers['x-request-id'] || req.headers['x-client-request-id'] || '').trim() || `req-${Date.now()}`;
}

function meta(req) {
  return {
    requestId: requestId(req),
    timestamp: nowIso(),
  };
}

function okEnvelope(data, req) {
  return {
    success: true,
    data,
    meta: meta(req),
  };
}

function sendError(res, req, status, code, message, details) {
  return res.status(status).json({
    success: false,
    error: {
      code,
      message,
      ...(details ? { details } : {}),
    },
    meta: meta(req),
  });
}

function readCookieValue(req, name) {
  const rawCookie = String(req.headers.cookie || '');
  if (!rawCookie) return '';
  const encodedName = encodeURIComponent(name);
  const pair = rawCookie
    .split(';')
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${encodedName}=`) || part.startsWith(`${name}=`));
  if (!pair) return '';
  const rawValue = pair.slice(pair.indexOf('=') + 1);
  try {
    return decodeURIComponent(rawValue);
  } catch {
    return rawValue;
  }
}

function resolveRequestUserId(req, options = {}) {
  const directUserId = verifyJWT(req.headers.authorization);
  if (directUserId) return directUserId;

  const cookieToken = readCookieValue(req, ACCESS_TOKEN_COOKIE_NAME) || readCookieValue(req, REFRESH_TOKEN_COOKIE_NAME);
  if (cookieToken) {
    const cookieUserId = verifyJWT(`Bearer ${cookieToken}`);
    if (cookieUserId) return cookieUserId;
  }

  const explicitRefreshToken = String(req.body?.refreshToken || '').trim();
  if (explicitRefreshToken) {
    const refreshUserId = verifyJWT(`Bearer ${explicitRefreshToken}`);
    if (refreshUserId) return refreshUserId;
  }

  const allowTemp = options.allowTemp !== false;
  const allowLocalTempUser = process.env.KKAI_LOCAL_ONLY === 'true' || process.env.NODE_ENV !== 'production';
  const tempUserId = String(req.headers[TEMP_USER_ID_HEADER] || '').trim();
  if (allowTemp && allowLocalTempUser && /^temp-[a-zA-Z0-9_.-]{4,128}$/.test(tempUserId)) {
    return tempUserId;
  }

  return null;
}

module.exports = {
  TEMP_USER_ID_HEADER,
  ADMIN_SESSION_TOKEN_HEADER,
  ACCESS_TOKEN_COOKIE_NAME,
  REFRESH_TOKEN_COOKIE_NAME,
  LOCAL_STORE_PATH,
  DEFAULT_CREDIT_BALANCE,
  isDbEnabled,
  nowIso,
  requestId,
  meta,
  okEnvelope,
  sendError,
  readCookieValue,
  resolveRequestUserId,
};
