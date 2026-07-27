const crypto = require('crypto');
const { signJWT } = require('../jwt');

const ACCESS_TOKEN_COOKIE_NAME = 'kk.api.access_token';
const REFRESH_TOKEN_COOKIE_NAME = 'kk.api.refresh_token';
const SESSION_MAX_AGE_SECONDS = 7 * 24 * 60 * 60;

function isHttpsRequest(req) {
  const forwardedProto = String(req.headers['x-forwarded-proto'] || '').toLowerCase();
  return req.secure || forwardedProto.split(',').map((value) => value.trim()).includes('https');
}

function buildCookie(req, name, value, maxAgeSeconds, path = '/') {
  const security = isHttpsRequest(req) ? 'SameSite=None; Secure' : 'SameSite=Lax';
  return `${encodeURIComponent(name)}=${encodeURIComponent(value)}; `
    + `Max-Age=${maxAgeSeconds}; Path=${path}; HttpOnly; ${security}`;
}

function appendCookies(res, cookies) {
  const current = res.getHeader('Set-Cookie');
  const existing = Array.isArray(current) ? current : current ? [String(current)] : [];
  res.setHeader('Set-Cookie', [...existing, ...cookies]);
}

function readCookie(req, name) {
  const encodedName = encodeURIComponent(name);
  const pair = String(req.headers.cookie || '')
    .split(';')
    .map((value) => value.trim())
    .find((value) => value.startsWith(`${encodedName}=`) || value.startsWith(`${name}=`));
  if (!pair) return '';
  try {
    return decodeURIComponent(pair.slice(pair.indexOf('=') + 1));
  } catch {
    return '';
  }
}

function getStateCookieName(provider) {
  return `kk.oauth.state.${provider}`;
}

function setOAuthStateCookie(req, res, provider, state, maxAgeSeconds) {
  appendCookies(res, [
    buildCookie(req, getStateCookieName(provider), state, maxAgeSeconds, '/api/v1/auth'),
  ]);
}

function consumeOAuthStateCookie(req, res, provider, state) {
  const storedState = readCookie(req, getStateCookieName(provider));
  const storedHash = crypto.createHash('sha256').update(storedState).digest();
  const receivedHash = crypto.createHash('sha256').update(String(state || '')).digest();
  const matches = Boolean(storedState) && crypto.timingSafeEqual(storedHash, receivedHash);
  appendCookies(res, [
    buildCookie(req, getStateCookieName(provider), '', 0, '/api/v1/auth'),
  ]);
  return matches;
}

function setOAuthSessionCookies(req, res, userId) {
  const accessToken = signJWT({ userId });
  const refreshToken = signJWT({ userId });
  appendCookies(res, [
    buildCookie(req, ACCESS_TOKEN_COOKIE_NAME, accessToken, SESSION_MAX_AGE_SECONDS),
    buildCookie(req, REFRESH_TOKEN_COOKIE_NAME, refreshToken, SESSION_MAX_AGE_SECONDS),
  ]);
  res.setHeader('X-Refresh-Token', accessToken);
}

module.exports = {
  consumeOAuthStateCookie,
  setOAuthSessionCookies,
  setOAuthStateCookie,
};
