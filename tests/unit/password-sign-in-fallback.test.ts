import assert from 'node:assert/strict';
import { afterEach, beforeEach, describe, test } from 'node:test';

import authPasswordLoginHandler from '../../api/auth-password-login.ts';
import { getStoredKkApiAccessToken, setStoredKkApiAccessToken } from '../../src/services/api/authAccessToken.ts';
import { kkWebApiClient } from '../../src/services/api/kkApiClient.ts';
import {
  signInWithPasswordWithFallback,
} from '../../src/services/auth/passwordSignIn.ts';
import { getLatestRuntimeAuthState, persistRuntimeAuthState, createDefaultRuntimeAuthState } from '../../src/services/auth/runtimeAuthState.ts';

describe('password sign-in fallback', () => {
  const originalFetch = globalThis.fetch;
  const originalLogin = kkWebApiClient.login.bind(kkWebApiClient);
  const originalRuntimeState = getLatestRuntimeAuthState();

  beforeEach(() => {
    globalThis.fetch = originalFetch;
    kkWebApiClient.login = originalLogin;
    setStoredKkApiAccessToken(undefined);
    persistRuntimeAuthState(createDefaultRuntimeAuthState());
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    kkWebApiClient.login = originalLogin;
    setStoredKkApiAccessToken(undefined);
    persistRuntimeAuthState(originalRuntimeState);
  });

  test('returns KK API login failures directly and never reports proxy usage', async () => {
    kkWebApiClient.login = async () => ({
      success: false,
      error: {
        code: 'NETWORK_ERROR',
        message: 'Load failed',
      },
      meta: {
        requestId: 'req-login-fail',
        timestamp: new Date().toISOString(),
      },
    });

    const result = await signInWithPasswordWithFallback({
      email: 'user@example.com',
      password: 'secret-123',
      captchaToken: 'turnstile-token',
    });

    assert.equal(result.usedProxy, false);
    assert.match(result.error?.message || '', /NETWORK_ERROR: Load failed/);
    assert.equal(getStoredKkApiAccessToken(), undefined);
  });

  test('stores the KK API access token and updates runtime auth state after a successful login', async () => {
    kkWebApiClient.login = async () => ({
      success: true,
      data: {
        accessToken: 'access-token-1',
        refreshToken: 'refresh-token-1',
        profile: {
          id: 'user-1',
          email: 'user@example.com',
          nickname: 'User One',
          avatarUrl: '',
        },
      },
      meta: {
        requestId: 'req-login-ok',
        timestamp: new Date().toISOString(),
      },
    });

    const result = await signInWithPasswordWithFallback({
      email: 'user@example.com',
      password: 'secret-123',
      captchaToken: 'turnstile-token',
    });

    assert.equal(result.error, null);
    assert.equal(result.usedProxy, false);
    assert.equal(getStoredKkApiAccessToken(), 'access-token-1');
    assert.equal(getLatestRuntimeAuthState().user.id, 'user-1');
  });

  test('keeps invalid credential errors on the direct KK API path', async () => {
    kkWebApiClient.login = async () => ({
      success: false,
      error: {
        code: 'AUTH_INVALID_CREDENTIALS',
        message: 'Invalid login credentials',
      },
      meta: {
        requestId: 'req-login-invalid',
        timestamp: new Date().toISOString(),
      },
    });

    const result = await signInWithPasswordWithFallback({
      email: 'user@example.com',
      password: 'wrong-password',
    });

    assert.equal(result.usedProxy, false);
    assert.match(result.error?.message || '', /Invalid login credentials/);
  });
});

describe('auth password login edge handler', () => {
  const originalFetch = globalThis.fetch;
  const originalSupabaseUrl = process.env.SUPABASE_URL;
  const originalSupabaseAnonKey = process.env.SUPABASE_ANON_KEY;

  beforeEach(() => {
    globalThis.fetch = originalFetch;
    if (typeof originalSupabaseUrl === 'string') {
      process.env.SUPABASE_URL = originalSupabaseUrl;
    } else {
      delete process.env.SUPABASE_URL;
    }
    if (typeof originalSupabaseAnonKey === 'string') {
      process.env.SUPABASE_ANON_KEY = originalSupabaseAnonKey;
    } else {
      delete process.env.SUPABASE_ANON_KEY;
    }
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    if (typeof originalSupabaseUrl === 'string') {
      process.env.SUPABASE_URL = originalSupabaseUrl;
    } else {
      delete process.env.SUPABASE_URL;
    }
    if (typeof originalSupabaseAnonKey === 'string') {
      process.env.SUPABASE_ANON_KEY = originalSupabaseAnonKey;
    } else {
      delete process.env.SUPABASE_ANON_KEY;
    }
  });

  test('forwards the password sign-in payload to Supabase auth', async () => {
    process.env.SUPABASE_URL = 'https://project-ref.supabase.co';
    process.env.SUPABASE_ANON_KEY = 'anon-key-123';

    globalThis.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
      assert.equal(String(input), 'https://project-ref.supabase.co/auth/v1/token?grant_type=password');
      assert.equal(init?.method, 'POST');

      const headers = new Headers(init?.headers);
      assert.equal(headers.get('apikey'), 'anon-key-123');
      assert.equal(headers.get('authorization'), 'Bearer anon-key-123');

      const payload = JSON.parse(String(init?.body || '{}')) as Record<string, unknown>;
      assert.deepEqual(payload, {
        email: 'user@example.com',
        password: 'secret-123',
        gotrue_meta_security: {
          captcha_token: 'turnstile-token',
        },
      });

      return new Response(JSON.stringify({
        access_token: 'access-token-1',
        refresh_token: 'refresh-token-1',
      }), {
        status: 200,
        headers: {
          'content-type': 'application/json',
        },
      });
    };

    const response = await authPasswordLoginHandler(new Request('https://kkai.plus/api/auth-password-login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email: 'user@example.com',
        password: 'secret-123',
        captchaToken: 'turnstile-token',
      }),
    }));

    assert.equal(response.status, 200);
    const payload = await response.json() as Record<string, string>;
    assert.equal(payload.access_token, 'access-token-1');
    assert.equal(payload.refresh_token, 'refresh-token-1');
  });

  test('rejects browser requests from third-party origins', async () => {
    process.env.SUPABASE_URL = 'https://project-ref.supabase.co';
    process.env.SUPABASE_ANON_KEY = 'anon-key-123';

    globalThis.fetch = async () => {
      assert.fail('upstream fetch should not run for disallowed origins');
    };

    const response = await authPasswordLoginHandler(new Request('https://kkai.plus/api/auth-password-login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Origin: 'https://evil.example.com',
      },
      body: JSON.stringify({
        email: 'user@example.com',
        password: 'secret-123',
      }),
    }));

    assert.equal(response.status, 403);
  });
});
