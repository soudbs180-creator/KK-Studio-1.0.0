import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import type { AddressInfo } from 'node:net';
import path from 'node:path';
import { test } from 'node:test';
import { fetch as nativeFetch } from 'undici';

const ROOT_DIR = process.cwd();
const require = createRequire(import.meta.url);

function readServerAuthRoute(): string {
  return readFileSync(path.join(ROOT_DIR, 'server/routes/user/auth.js'), 'utf8');
}

function readServerProfileRoute(): string {
  return readFileSync(path.join(ROOT_DIR, 'server/routes/user/profile.js'), 'utf8');
}

test('server exposes the typed profile and session routes used by mobile browser auth recovery', () => {
  const authSource = readServerAuthRoute();
  const profileSource = readServerProfileRoute();

  assert.match(profileSource, /router\.get\('\/v1\/profile'/);
  assert.match(authSource, /router\.get\('\/v1\/auth\/session'/);
  assert.match(authSource, /router\.post\('\/v1\/auth\/refresh'/);
  assert.match(authSource, /router\.post\('\/v1\/auth\/logout'/);
  assert.match(authSource, /return sendAuthSession\(req, res, profile\)/);
  assert.match(authSource, /kk\.api\.access_token/);
});

test('profile recovery accepts authorization headers, refresh tokens, and browser cookie tokens', () => {
  const source = readServerAuthRoute();

  assert.match(source, /function verifyRequestJwt\(req, tokenOverride = ''\)/);
  assert.match(source, /verifyJWT\(req\.headers\.authorization\)/);
  assert.match(source, /verifyJWT\(`Bearer \$\{explicitToken\}`\)/);
  assert.match(source, /readCookieValue\(req, ACCESS_TOKEN_COOKIE_NAME\)/);
  assert.match(source, /readCookieValue\(req, REFRESH_TOKEN_COOKIE_NAME\)/);
  assert.match(source, /res\.setHeader\('X-Refresh-Token', signJWT\(\{ userId \}\)\)/);
});

test('password login writes cookie fallback and keeps timing-safe password verification active', () => {
  const source = readServerAuthRoute();

  assert.match(source, /function setAuthSessionCookies\(req, res, session\)/);
  assert.match(source, /buildAuthCookie\(req, ACCESS_TOKEN_COOKIE_NAME, session\.accessToken/);
  assert.match(source, /buildAuthCookie\(req, REFRESH_TOKEN_COOKIE_NAME, session\.refreshToken/);
  assert.match(source, /setAuthSessionCookies\(req, res, session\);[\s\S]*return res\.json\(\{[\s\S]*data: session/);
  assert.match(source, /if \(!timingSafeEqualHex\(user\.password_hash, computedHash\)\) \{[\s\S]*AUTH_INVALID_CREDENTIALS/);
});

test('password login cookie fallback restores mobile browser sessions through the real Express routes', async (t) => {
  const previousEnv = {
    DATABASE_URL: process.env.DATABASE_URL,
    JWT_SECRET: process.env.JWT_SECRET,
    KKAI_LOCAL_ONLY: process.env.KKAI_LOCAL_ONLY,
    NODE_ENV: process.env.NODE_ENV,
    PASSWORD_SALT: process.env.PASSWORD_SALT,
  };
  process.env.NODE_ENV = 'test';
  process.env.JWT_SECRET = 'mobile-session-test-secret';
  process.env.PASSWORD_SALT = 'mobile-session-test-salt';
  process.env.KKAI_LOCAL_ONLY = 'true';
  delete process.env.DATABASE_URL;

  t.after(() => {
    for (const [key, value] of Object.entries(previousEnv)) {
      if (typeof value === 'undefined') {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    }
  });

  // 简体中文注释：清理服务器模块及其依赖的缓存，防止被之前测试的 module._load 劫持及缓存污染
  for (const key of Object.keys(require.cache)) {
    if (key.includes('/server/') || key.includes('\\server\\') || key.includes('express')) {
      delete require.cache[key];
    }
  }

  const { createApp } = require('../../server/index.js') as typeof import('../../server/index.js');
  const server = createApp().listen(0);
  t.after(() => server.close());
  await new Promise<void>((resolve) => server.once('listening', resolve));
  const address = server.address() as AddressInfo;
  const baseUrl = `http://127.0.0.1:${address.port}`;

  const loginResponse = await nativeFetch(`${baseUrl}/api/v1/auth/login`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      origin: 'https://kkai.plus',
    },
    body: JSON.stringify({
      email: 'mobile@example.com',
      password: 'correct-horse-battery-staple',
    }),
  });

  assert.equal(loginResponse.status, 200);
  const setCookie = loginResponse.headers.get('set-cookie') || '';
  assert.match(setCookie, /kk\.api\.access_token=/);
  assert.match(setCookie, /kk\.api\.refresh_token=/);

  const accessCookie = setCookie.match(/kk\.api\.access_token=[^;,]+/)?.[0];
  const refreshCookie = setCookie.match(/kk\.api\.refresh_token=[^;,]+/)?.[0];
  assert.ok(accessCookie);
  assert.ok(refreshCookie);
  const cookieHeader = `${accessCookie}; ${refreshCookie}`;

  const sessionResponse = await nativeFetch(`${baseUrl}/api/v1/auth/session`, {
    headers: { cookie: cookieHeader },
  });
  assert.equal(sessionResponse.status, 200);
  const sessionPayload = await sessionResponse.json() as { success?: boolean; data?: { profile?: { email?: string } } };
  assert.equal(sessionPayload.success, true);
  assert.equal(sessionPayload.data?.profile?.email, 'local-user@example.com');

  const profileResponse = await nativeFetch(`${baseUrl}/api/v1/profile`, {
    headers: { cookie: cookieHeader },
  });
  assert.equal(profileResponse.status, 200);
  const profilePayload = await profileResponse.json() as { success?: boolean; data?: { id?: string } };
  assert.equal(profilePayload.success, true);
  assert.equal(profilePayload.data?.id, 'mock-user-id');
});
