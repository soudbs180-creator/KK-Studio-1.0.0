import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import type { AddressInfo } from 'node:net';
import path from 'node:path';
import { test } from 'node:test';
import { fetch as nativeFetch } from 'undici';

const require = createRequire(import.meta.url);
const {
  readProviderConfig,
  resolveSafeRedirectTo,
} = require('../../services/api/lib/oauth/oauthConfig.js');
const {
  buildAuthorizationUrl,
  exchangeGoogleCode,
  exchangeWechatCode,
} = require('../../services/api/lib/oauth/oauthProviders.js');
const { signJWT } = require('../../services/api/lib/jwt.js');
const { createOAuthRouter } = require('../../services/api/routes/user/oauth.js');

function jsonResponse(payload: Record<string, unknown>, ok = true) {
  return {
    ok,
    json: async () => payload,
  };
}

test('OAuth config only accepts frontend redirects from the server allowlist', () => {
  const env = {
    GOOGLE_OAUTH_CLIENT_ID: 'google-client',
    GOOGLE_OAUTH_CLIENT_SECRET: 'server-secret',
    GOOGLE_OAUTH_REDIRECT_URI: 'https://api.example.com/api/v1/auth/google/callback',
    GOOGLE_ALLOWED_REDIRECT_ORIGINS: 'https://app.example.com',
    PUBLIC_APP_URL: 'https://app.example.com',
  };

  assert.deepEqual(readProviderConfig('google', env), {
    provider: 'google',
    clientId: 'google-client',
    clientSecret: 'server-secret',
    redirectUri: 'https://api.example.com/api/v1/auth/google/callback',
  });
  assert.equal(
    resolveSafeRedirectTo('https://app.example.com/auth/callback?mode=google-bind', 'google', env),
    'https://app.example.com/auth/callback?mode=google-bind',
  );
  assert.throws(
    () => resolveSafeRedirectTo('https://attacker.example/auth/callback', 'google', env),
    /允许列表/,
  );
});

test('provider authorization URLs use authorization-code flow without exposing client secrets', () => {
  const googleUrl = buildAuthorizationUrl('google', {
    clientId: 'google-client',
    clientSecret: 'server-secret',
    redirectUri: 'https://api.example.com/api/v1/auth/google/callback',
  }, 'state-google');
  const wechatUrl = buildAuthorizationUrl('wechat', {
    clientId: 'wx-app-id',
    clientSecret: 'server-secret',
    redirectUri: 'https://api.example.com/api/v1/auth/wechat/callback',
  }, 'state-wechat');

  assert.match(googleUrl, /^https:\/\/accounts\.google\.com\/o\/oauth2\/v2\/auth\?/);
  assert.match(googleUrl, /response_type=code/);
  assert.match(googleUrl, /scope=openid\+email\+profile/);
  assert.doesNotMatch(googleUrl, /server-secret/);
  assert.match(wechatUrl, /^https:\/\/open\.weixin\.qq\.com\/connect\/qrconnect\?/);
  assert.match(wechatUrl, /scope=snsapi_login/);
  assert.match(wechatUrl, /#wechat_redirect$/);
  assert.doesNotMatch(wechatUrl, /server-secret/);
});

test('Google code exchange returns a verified stable provider identity', async () => {
  const requests: Array<{ url: string; options?: Record<string, unknown> }> = [];
  const fetchImpl = async (url: URL | string, options?: Record<string, unknown>) => {
    requests.push({ url: String(url), options });
    return requests.length === 1
      ? jsonResponse({ access_token: 'google-access-token' })
      : jsonResponse({
        sub: 'google-subject-1',
        email: 'User@Example.com',
        email_verified: true,
        name: 'Google User',
        picture: 'https://images.example/avatar.png',
      });
  };

  const identity = await exchangeGoogleCode(fetchImpl, {
    clientId: 'google-client',
    clientSecret: 'server-secret',
    redirectUri: 'https://api.example.com/api/v1/auth/google/callback',
  }, 'authorization-code');

  assert.equal(identity.providerSubject, 'google-subject-1');
  assert.equal(identity.email, 'user@example.com');
  assert.equal(identity.emailVerified, true);
  assert.equal(requests[0]?.url, 'https://oauth2.googleapis.com/token');
  assert.equal(requests[1]?.url, 'https://openidconnect.googleapis.com/v1/userinfo');
  assert.equal(
    (requests[1]?.options?.headers as { authorization?: string }).authorization,
    'Bearer google-access-token',
  );
});

test('WeChat code exchange uses openid and unionid without persisting provider tokens', async () => {
  let requestCount = 0;
  const fetchImpl = async () => {
    requestCount += 1;
    return requestCount === 1
      ? jsonResponse({ access_token: 'wechat-access-token', openid: 'openid-1' })
      : jsonResponse({
        openid: 'openid-1',
        unionid: 'unionid-1',
        nickname: '微信用户',
        headimgurl: 'https://images.example/wechat.png',
      });
  };

  const identity = await exchangeWechatCode(fetchImpl, {
    clientId: 'wx-app-id',
    clientSecret: 'server-secret',
    redirectUri: 'https://api.example.com/api/v1/auth/wechat/callback',
  }, 'authorization-code');

  assert.equal(identity.providerSubject, 'openid-1');
  assert.equal(identity.unionId, 'unionid-1');
  assert.equal(identity.email, null);
  assert.equal('accessToken' in identity, false);
});

test('real Express OAuth route completes server-side Google callback and writes session cookies', async (t) => {
  const insertedQueries: Array<{ text: string; values: unknown[] }> = [];
  let oauthTransaction: Record<string, unknown> | null = null;
  let createdUserId = '';
  const pool = {
    query: async (text: string, values: unknown[]) => {
      insertedQueries.push({ text, values });
      if (text.includes('INSERT INTO public.oauth_transactions')) {
        oauthTransaction = {
          provider: values[1],
          mode: values[2],
          redirect_to: values[3],
          user_id: values[4],
          expires_at: values[5],
        };
      }
      if (text.includes('UPDATE public.oauth_transactions')) {
        return { rows: oauthTransaction ? [oauthTransaction] : [] };
      }
      if (text.includes('FROM public.users u')) {
        return {
          rows: [{
            id: createdUserId,
            email: 'user@example.com',
            display_name: 'Google User',
            avatar_url: '',
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            has_password: false,
            admin_level: 0,
            providers: ['google'],
          }],
        };
      }
      return { rows: [] };
    },
    connect: async () => ({
      query: async (text: string, values: unknown[] = []) => {
        if (text.includes('FROM public.auth_identities')) return { rows: [] };
        if (text.includes('LOWER(email)')) return { rows: [] };
        if (text.includes('INSERT INTO public.users')) {
          createdUserId = String(values[0] || '');
        }
        return { rows: [] };
      },
      release: () => {},
    }),
  };
  const env = {
    DATABASE_URL: 'postgres://test',
    GOOGLE_OAUTH_CLIENT_ID: 'google-client',
    GOOGLE_OAUTH_CLIENT_SECRET: 'server-secret',
    GOOGLE_OAUTH_REDIRECT_URI: 'https://api.example.com/api/v1/auth/google/callback',
    GOOGLE_ALLOWED_REDIRECT_ORIGINS: 'https://app.example.com',
    PUBLIC_APP_URL: 'https://app.example.com',
  };
  const express = require('express');
  const app = express();
  let providerRequestCount = 0;
  app.use('/api', createOAuthRouter({
    env: () => env,
    getPool: () => pool,
    fetchImpl: () => async () => {
      providerRequestCount += 1;
      return providerRequestCount === 1
        ? jsonResponse({ access_token: 'provider-access-token' })
        : jsonResponse({
          sub: 'google-subject-1',
          email: 'user@example.com',
          email_verified: true,
          name: 'Google User',
        });
    },
  }));
  const server = app.listen(0);
  t.after(() => server.close());
  await new Promise<void>((resolve) => server.once('listening', resolve));
  const address = server.address() as AddressInfo;

  const response = await nativeFetch(
    `http://127.0.0.1:${address.port}/api/v1/auth/google/start`
      + '?redirectTo=https%3A%2F%2Fapp.example.com%2Fauth%2Fcallback',
  );
  const payload = await response.json() as {
    success?: boolean;
    data?: { authorizationUrl?: string; state?: string };
  };

  assert.equal(response.status, 200);
  assert.equal(payload.success, true);
  const stateCookie = response.headers.get('set-cookie') || '';
  assert.match(stateCookie, /kk\.oauth\.state\.google=/);
  assert.match(stateCookie, /HttpOnly/);
  assert.match(payload.data?.authorizationUrl || '', /^https:\/\/accounts\.google\.com\//);
  assert.ok((payload.data?.state || '').length >= 40);
  assert.equal(insertedQueries.length, 1);
  assert.match(insertedQueries[0]?.text || '', /INSERT INTO public\.oauth_transactions/);
  assert.match(String(insertedQueries[0]?.values[0] || ''), /^[a-f0-9]{64}$/);

  const callbackResponse = await nativeFetch(
    `http://127.0.0.1:${address.port}/api/v1/auth/google/callback`
      + `?code=authorization-code&state=${encodeURIComponent(payload.data?.state || '')}`,
    {
      headers: { cookie: stateCookie.split(';')[0] || '' },
      redirect: 'manual',
    },
  );
  const callbackCookies = callbackResponse.headers.get('set-cookie') || '';
  const callbackLocation = callbackResponse.headers.get('location') || '';

  assert.equal(callbackResponse.status, 302);
  assert.match(callbackCookies, /kk\.api\.access_token=/);
  assert.match(callbackCookies, /kk\.api\.refresh_token=/);
  assert.match(callbackLocation, /^https:\/\/app\.example\.com\/auth\/callback\?/);
  assert.match(callbackLocation, /provider=google/);
  assert.match(callbackLocation, /auth=success/);
  assert.match(createdUserId, /^oauth-/);
  assert.equal(providerRequestCount, 2);
});

test('OAuth bind callback rejects a browser that no longer has the initiating KK account session', async (t) => {
  let oauthTransaction: Record<string, unknown> | null = null;
  let providerRequestCount = 0;
  const pool = {
    query: async (text: string, values: unknown[]) => {
      if (text.includes('INSERT INTO public.oauth_transactions')) {
        oauthTransaction = {
          provider: values[1],
          mode: values[2],
          redirect_to: values[3],
          user_id: values[4],
          expires_at: values[5],
        };
      }
      if (text.includes('UPDATE public.oauth_transactions')) {
        return { rows: oauthTransaction ? [oauthTransaction] : [] };
      }
      return { rows: [] };
    },
  };
  const env = {
    DATABASE_URL: 'postgres://test',
    GOOGLE_OAUTH_CLIENT_ID: 'google-client',
    GOOGLE_OAUTH_CLIENT_SECRET: 'server-secret',
    GOOGLE_OAUTH_REDIRECT_URI: 'https://api.example.com/api/v1/auth/google/callback',
    GOOGLE_ALLOWED_REDIRECT_ORIGINS: 'https://app.example.com',
    PUBLIC_APP_URL: 'https://app.example.com',
  };
  const express = require('express');
  const app = express();
  app.use('/api', createOAuthRouter({
    env: () => env,
    getPool: () => pool,
    fetchImpl: () => async () => {
      providerRequestCount += 1;
      return jsonResponse({ access_token: 'provider-access-token' });
    },
  }));
  const server = app.listen(0);
  t.after(() => server.close());
  await new Promise<void>((resolve) => server.once('listening', resolve));
  const address = server.address() as AddressInfo;
  const ownerToken = signJWT({ userId: 'owner-1' });

  const startResponse = await nativeFetch(
    `http://127.0.0.1:${address.port}/api/v1/auth/google/bind/start`
      + '?redirectTo=https%3A%2F%2Fapp.example.com%2Fauth%2Fcallback',
    { headers: { authorization: `Bearer ${ownerToken}` } },
  );
  const payload = await startResponse.json() as {
    data?: { state?: string };
  };
  const stateCookie = startResponse.headers.get('set-cookie') || '';

  const callbackResponse = await nativeFetch(
    `http://127.0.0.1:${address.port}/api/v1/auth/google/callback`
      + `?code=authorization-code&state=${encodeURIComponent(payload.data?.state || '')}`,
    {
      headers: { cookie: stateCookie.split(';')[0] || '' },
      redirect: 'manual',
    },
  );
  const callbackLocation = callbackResponse.headers.get('location') || '';

  assert.equal(callbackResponse.status, 302);
  assert.match(callbackLocation, /error=OAUTH_BIND_SESSION_MISMATCH/);
  assert.match(callbackLocation, /mode=google-bind/);
  assert.equal(providerRequestCount, 0);
});

test('OAuth migration allows social-only users and stores only hashed state', () => {
  const source = readFileSync(
    path.join(process.cwd(), 'infrastructure/database/migrations/026_oauth_identities.sql'),
    'utf8',
  );

  assert.match(source, /ALTER COLUMN email DROP NOT NULL/);
  assert.match(source, /ALTER COLUMN password_hash DROP NOT NULL/);
  assert.match(source, /CREATE TABLE IF NOT EXISTS public\.auth_identities/);
  assert.match(source, /CREATE TABLE IF NOT EXISTS public\.oauth_transactions/);
  assert.match(source, /state_hash CHAR\(64\) PRIMARY KEY/);
  assert.doesNotMatch(source, /access_token|refresh_token/i);
});

test('VPS bootstrap and deploy paths apply the OAuth identity migration', () => {
  const deploySource = readFileSync(
    path.join(process.cwd(), 'scripts/ops/vps/deploy-kk-vps.sh'),
    'utf8',
  );
  const bootstrapSource = readFileSync(
    path.join(process.cwd(), 'scripts/ops/vps/bootstrap-kk-vps.sh'),
    'utf8',
  );

  assert.match(deploySource, /026_oauth_identities\.sql/);
  assert.match(deploySource, /Applying mandatory OAuth identity migration/);
  assert.match(deploySource, /\('auth_identities'\), \('oauth_transactions'\)/);
  assert.match(bootstrapSource, /026_oauth_identities\.sql/);
  assert.match(bootstrapSource, /-f "\$\{OAUTH_IDENTITY_MIGRATION\}"/);
});
