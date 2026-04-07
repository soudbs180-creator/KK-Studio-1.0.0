import assert from 'node:assert/strict';
import { afterEach, beforeEach, describe, test } from 'node:test';

import authPasswordLoginHandler from '../../api/auth-password-login.ts';
import { supabase } from '../../src/lib/supabase.ts';
import {
  HOSTED_PASSWORD_PROXY_DISABLED_CODE,
  signInWithPasswordWithFallback,
} from '../../src/services/auth/passwordSignIn.ts';

describe('password sign-in fallback', () => {
  const auth = supabase.auth as typeof supabase.auth & {
    signInWithPassword: typeof supabase.auth.signInWithPassword;
    setSession: typeof supabase.auth.setSession;
  };
  const originalSignInWithPassword = auth.signInWithPassword.bind(auth);
  const originalSetSession = auth.setSession.bind(auth);
  const originalFetch = globalThis.fetch;
  const locationLike = globalThis as { location?: { origin?: string } };
  const originalLocation = locationLike.location;
  const windowLike = globalThis as typeof globalThis & { window?: { location?: { origin?: string } } };
  const originalWindow = windowLike.window;
  const originalBaseUrl = process.env.VITE_KK_API_BASE_URL;
  const originalLegacyFallback = process.env.VITE_ENABLE_LEGACY_WEB_API_FALLBACK;

  beforeEach(() => {
    auth.signInWithPassword = originalSignInWithPassword;
    auth.setSession = originalSetSession;
    globalThis.fetch = originalFetch;
    locationLike.location = originalLocation;
    windowLike.window = originalWindow;
    if (typeof originalBaseUrl === 'string') {
      process.env.VITE_KK_API_BASE_URL = originalBaseUrl;
    } else {
      delete process.env.VITE_KK_API_BASE_URL;
    }
    if (typeof originalLegacyFallback === 'string') {
      process.env.VITE_ENABLE_LEGACY_WEB_API_FALLBACK = originalLegacyFallback;
    } else {
      delete process.env.VITE_ENABLE_LEGACY_WEB_API_FALLBACK;
    }
  });

  afterEach(() => {
    auth.signInWithPassword = originalSignInWithPassword;
    auth.setSession = originalSetSession;
    globalThis.fetch = originalFetch;
    locationLike.location = originalLocation;
    windowLike.window = originalWindow;
    if (typeof originalBaseUrl === 'string') {
      process.env.VITE_KK_API_BASE_URL = originalBaseUrl;
    } else {
      delete process.env.VITE_KK_API_BASE_URL;
    }
    if (typeof originalLegacyFallback === 'string') {
      process.env.VITE_ENABLE_LEGACY_WEB_API_FALLBACK = originalLegacyFallback;
    } else {
      delete process.env.VITE_ENABLE_LEGACY_WEB_API_FALLBACK;
    }
  });

  test('keeps hosted password-proxy fallback disabled by default after a browser network failure', async () => {
    locationLike.location = { origin: 'https://kkai.plus' };
    windowLike.window = { location: { origin: 'https://kkai.plus' } };
    delete process.env.VITE_KK_API_BASE_URL;
    delete process.env.VITE_ENABLE_LEGACY_WEB_API_FALLBACK;

    auth.signInWithPassword = async () => {
      throw new TypeError('Load failed');
    };

    let sessionWasSet = false;
    auth.setSession = async ({ access_token, refresh_token }) => {
      sessionWasSet = true;
      assert.equal(access_token, 'access-token-1');
      assert.equal(refresh_token, 'refresh-token-1');
      return { data: { session: null, user: null }, error: null };
    };

    let proxyCallCount = 0;
    globalThis.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
      proxyCallCount += 1;
      assert.equal(String(input), '/api/auth-password-login');
      assert.equal(init?.method, 'POST');

      const payload = JSON.parse(String(init?.body || '{}')) as Record<string, string>;
      assert.deepEqual(payload, {
        email: 'user@example.com',
        password: 'secret-123',
        captchaToken: 'turnstile-token',
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

    const result = await signInWithPasswordWithFallback({
      email: 'user@example.com',
      password: 'secret-123',
      captchaToken: 'turnstile-token',
    });

    assert.equal(result.usedProxy, false);
    assert.equal(proxyCallCount, 0);
    assert.equal(sessionWasSet, false);
    assert.match(result.error?.message || '', new RegExp(HOSTED_PASSWORD_PROXY_DISABLED_CODE));
  });

  test('allows the hosted password proxy only when legacy runtime fallback is explicitly enabled', async () => {
    locationLike.location = { origin: 'https://kkai.plus' };
    windowLike.window = { location: { origin: 'https://kkai.plus' } };
    process.env.VITE_KK_API_BASE_URL = 'https://api.example.com';
    process.env.VITE_ENABLE_LEGACY_WEB_API_FALLBACK = 'true';

    auth.signInWithPassword = async () => {
      throw new TypeError('Load failed');
    };

    let sessionWasSet = false;
    auth.setSession = async ({ access_token, refresh_token }) => {
      sessionWasSet = true;
      assert.equal(access_token, 'access-token-1');
      assert.equal(refresh_token, 'refresh-token-1');
      return { data: { session: null, user: null }, error: null };
    };

    let proxyCallCount = 0;
    globalThis.fetch = async () => {
      proxyCallCount += 1;
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

    const result = await signInWithPasswordWithFallback({
      email: 'user@example.com',
      password: 'secret-123',
      captchaToken: 'turnstile-token',
    });

    assert.equal(result.error, null);
    assert.equal(result.usedProxy, true);
    assert.equal(proxyCallCount, 1);
    assert.equal(sessionWasSet, true);
  });

  test('keeps auth errors on the direct path without using the proxy', async () => {
    locationLike.location = { origin: 'https://kkai.plus' };
    windowLike.window = { location: { origin: 'https://kkai.plus' } };

    auth.signInWithPassword = async () => ({
      data: { user: null, session: null },
      error: new Error('Invalid login credentials'),
    });

    globalThis.fetch = async () => {
      assert.fail('proxy should not be called for non-network auth errors');
    };

    const result = await signInWithPasswordWithFallback({
      email: 'user@example.com',
      password: 'wrong-password',
    });

    assert.equal(result.usedProxy, false);
    assert.match(result.error?.message || '', /Invalid login credentials/);
  });

  test('uses the same-origin proxy on loopback origins during local development', async () => {
    locationLike.location = { origin: 'http://127.0.0.1:3000' };
    windowLike.window = { location: { origin: 'http://127.0.0.1:3000' } };
    delete process.env.VITE_KK_API_BASE_URL;
    delete process.env.VITE_ENABLE_LEGACY_WEB_API_FALLBACK;

    auth.signInWithPassword = async () => {
      throw new TypeError('Failed to fetch');
    };

    auth.setSession = async ({ access_token, refresh_token }) => {
      assert.equal(access_token, 'local-access-token');
      assert.equal(refresh_token, 'local-refresh-token');
      return { data: { session: null, user: null }, error: null };
    };

    globalThis.fetch = async () => {
      return new Response(JSON.stringify({
        access_token: 'local-access-token',
        refresh_token: 'local-refresh-token',
      }), {
        status: 200,
        headers: {
          'content-type': 'application/json',
        },
      });
    };

    const result = await signInWithPasswordWithFallback({
      email: 'user@example.com',
      password: 'secret-123',
    });

    assert.equal(result.usedProxy, true);
    assert.equal(result.error, null);
  });

  test('uses the same-origin proxy on private LAN origins during local development', async () => {
    locationLike.location = { origin: 'https://192.168.1.25:3000' };
    windowLike.window = { location: { origin: 'https://192.168.1.25:3000' } };
    delete process.env.VITE_KK_API_BASE_URL;
    delete process.env.VITE_ENABLE_LEGACY_WEB_API_FALLBACK;

    auth.signInWithPassword = async () => {
      throw new TypeError('Failed to fetch');
    };

    auth.setSession = async ({ access_token, refresh_token }) => {
      assert.equal(access_token, 'lan-access-token');
      assert.equal(refresh_token, 'lan-refresh-token');
      return { data: { session: null, user: null }, error: null };
    };

    globalThis.fetch = async () => {
      return new Response(JSON.stringify({
        access_token: 'lan-access-token',
        refresh_token: 'lan-refresh-token',
      }), {
        status: 200,
        headers: {
          'content-type': 'application/json',
        },
      });
    };

    const result = await signInWithPasswordWithFallback({
      email: 'user@example.com',
      password: 'secret-123',
    });

    assert.equal(result.usedProxy, true);
    assert.equal(result.error, null);
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
