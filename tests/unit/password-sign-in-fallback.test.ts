import assert from 'node:assert/strict';
import { afterEach, beforeEach, describe, test } from 'node:test';

import {
  getStoredKkApiAccessToken,
  getStoredKkApiRefreshToken,
  setStoredKkApiAccessToken,
  setStoredKkApiRefreshToken,
} from '../../apps/web/src/services/api/authAccessToken.ts';
import { kkWebApiClient } from '../../apps/web/src/services/api/kkApiClient.ts';
import {
  signInWithPasswordWithFallback,
} from '../../apps/web/src/services/auth/passwordSignIn.ts';
import { getLatestRuntimeAuthState, persistRuntimeAuthState, createDefaultRuntimeAuthState } from '../../apps/web/src/services/auth/runtimeAuthState.ts';

describe('password sign-in fallback', () => {
  const originalFetch = globalThis.fetch;
  const originalLogin = kkWebApiClient.login.bind(kkWebApiClient);
  const originalRuntimeState = getLatestRuntimeAuthState();

  beforeEach(() => {
    globalThis.fetch = originalFetch;
    kkWebApiClient.login = originalLogin;
    setStoredKkApiAccessToken(undefined);
    setStoredKkApiRefreshToken(undefined);
    persistRuntimeAuthState(createDefaultRuntimeAuthState());
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    kkWebApiClient.login = originalLogin;
    setStoredKkApiAccessToken(undefined);
    setStoredKkApiRefreshToken(undefined);
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
        expiresIn: 3600,
        sessionExpiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        profile: {
          id: 'user-1',
          email: 'user@example.com',
          nickname: 'User One',
          avatarUrl: '',
          role: 'user',
          status: 'active',
          createdAt: new Date(0).toISOString(),
          updatedAt: new Date(0).toISOString(),
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
    assert.equal(getStoredKkApiRefreshToken(), 'refresh-token-1');
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
