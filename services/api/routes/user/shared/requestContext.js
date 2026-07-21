const { signJWT, verifyJWT } = require('../../../lib/jwt');

const ACCESS_TOKEN_COOKIE_NAME = 'kk.api.access_token';
const REFRESH_TOKEN_COOKIE_NAME = 'kk.api.refresh_token';
const TEMP_USER_ID_HEADER = 'x-kk-temp-user-id';

function readCookieValue(req, name) {
  const rawCookie = String(req.headers.cookie || '');
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

/** Centralizes owner resolution so auth and profile routes accept identical credentials. */
function verifyRequestJwt(req, tokenOverride = '') {
  const directUserId = verifyJWT(req.headers.authorization);
  if (directUserId) return directUserId;

  const explicitToken = String(tokenOverride || '').trim();
  const explicitUserId = explicitToken ? verifyJWT(`Bearer ${explicitToken}`) : null;
  if (explicitUserId) return explicitUserId;

  const cookieToken = readCookieValue(req, ACCESS_TOKEN_COOKIE_NAME)
    || readCookieValue(req, REFRESH_TOKEN_COOKIE_NAME);
  return cookieToken ? verifyJWT(`Bearer ${cookieToken}`) : null;
}

/** Keeps authenticated and local-only profile storage scoped to one resolved owner. */
function resolveProfileUserId(req) {
  const verifiedUserId = verifyRequestJwt(req);
  if (verifiedUserId) {
    return { userId: verifiedUserId, refreshToken: signJWT({ userId: verifiedUserId }) };
  }

  const tempUserId = String(req.headers[TEMP_USER_ID_HEADER] || '').trim();
  const allowsTempUser = process.env.KKAI_LOCAL_ONLY === 'true';
  if (allowsTempUser && /^temp-[a-zA-Z0-9_.-]{4,128}$/.test(tempUserId)) {
    return { userId: tempUserId, refreshToken: null };
  }
  return null;
}

/** Gives every user-route response the same trace metadata contract. */
function buildMeta(req) {
  return {
    requestId: req.headers['x-request-id'] || `req-${Date.now()}`,
    timestamp: new Date().toISOString(),
  };
}

/** Preserves the public success envelope across split route modules. */
function okEnvelope(data, req) {
  return { success: true, data, meta: buildMeta(req) };
}

/** Preserves the public authentication error envelope across split route modules. */
function authErrorEnvelope(req, code, message) {
  return { success: false, error: { code, message }, meta: buildMeta(req) };
}

module.exports = {
  authErrorEnvelope,
  buildMeta,
  okEnvelope,
  resolveProfileUserId,
  verifyRequestJwt,
};
