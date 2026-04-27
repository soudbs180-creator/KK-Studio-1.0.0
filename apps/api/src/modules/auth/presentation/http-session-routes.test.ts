import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

import { AuthService, BrowserSessionService, InMemoryAuthIdentityStore } from '../index.ts';
import { DEFAULT_SESSION_COOKIE_NAME, type BrowserSessionRecord } from '../domain/browser-session.ts';
import {
  handleGetSession,
  handleLogoutSession,
  handleRefreshSession,
} from './http-session-routes.ts';
import {
  handleVersionedLogin,
  handleVersionedRegister,
} from './http-auth-routes.ts';

class InMemoryBrowserSessionRepository {
  private readonly rows = new Map<string, BrowserSessionRecord>();

  async insert(record: BrowserSessionRecord): Promise<void> {
    this.rows.set(record.id, { ...record });
  }

  async findActiveByRefreshTokenHash(
    refreshTokenHash: string,
    nowIso: string,
  ): Promise<BrowserSessionRecord | undefined> {
    return Array.from(this.rows.values()).find((record) =>
      record.refreshTokenHash === refreshTokenHash
      && !record.revokedAt
      && record.expiresAt > nowIso,
    );
  }

  async revokeSession(id: string, revokedAt: string): Promise<void> {
    const current = this.rows.get(id);
    if (!current) {
      return;
    }

    this.rows.set(id, {
      ...current,
      revokedAt,
    });
  }

  async replaceRotatedSession(
    currentId: string,
    nextRecord: BrowserSessionRecord,
    revokedAt: string,
  ): Promise<void> {
    await this.revokeSession(currentId, revokedAt);
    await this.insert(nextRecord);
  }
}

function extractCookieValue(setCookieHeader: string | undefined): string {
  const rawCookie = String(setCookieHeader || '').split(';')[0] || '';
  const separatorIndex = rawCookie.indexOf('=');
  return separatorIndex >= 0 ? rawCookie.slice(separatorIndex + 1) : '';
}

function createAuthService(): AuthService {
  return new AuthService({
    verifyTurnstileToken: async () => ({ success: true }),
    identityStore: new InMemoryAuthIdentityStore(),
    browserSessionService: new BrowserSessionService({
      repository: new InMemoryBrowserSessionRepository(),
      sessionSigningSecret: 'route-session-secret',
    }),
  });
}

describe('http session routes', () => {
  test('login sets a refresh-session cookie', async () => {
    const service = createAuthService();

    const registerResult = await handleVersionedRegister(service, {
      email: 'route-user@example.com',
      password: 'password-123',
      turnstileToken: 'turnstile-ok',
    }, {
      'x-request-id': 'req-login-register',
      'x-client-version': 'auth-module-test',
    }, '127.0.0.1');
    assert.equal(registerResult.statusCode, 201);

    const result = await handleVersionedLogin(service, {
      email: 'route-user@example.com',
      password: 'password-123',
    }, {
      'x-request-id': 'req-login-cookie',
      'x-client-version': 'auth-module-test',
    }, '127.0.0.1', 'node-test');

    assert.equal(result.statusCode, 200);
    assert.ok(Array.isArray(result.headers?.['set-cookie']));
    assert.match(String(result.headers?.['set-cookie']?.[0] || ''), /HttpOnly/);
  });

  test('session restore, refresh, and logout all work through the browser cookie', async () => {
    const service = createAuthService();

    await handleVersionedRegister(service, {
      email: 'restore-user@example.com',
      password: 'password-123',
      turnstileToken: 'turnstile-ok',
    }, {
      'x-request-id': 'req-session-register',
      'x-client-version': 'auth-module-test',
    }, '127.0.0.1');

    const loginResult = await handleVersionedLogin(service, {
      email: 'restore-user@example.com',
      password: 'password-123',
    }, {
      'x-request-id': 'req-session-login',
      'x-client-version': 'auth-module-test',
    }, '127.0.0.1', 'node-test');

    const cookieValue = extractCookieValue(String(loginResult.headers?.['set-cookie']?.[0] || ''));
    assert.ok(cookieValue);

    const sessionResult = await handleGetSession(service, {
      'x-request-id': 'req-session-restore',
      'x-client-version': 'auth-module-test',
    }, {
      [DEFAULT_SESSION_COOKIE_NAME]: cookieValue,
    }, '127.0.0.1', 'node-test');

    assert.equal(sessionResult.statusCode, 200);
    assert.equal(sessionResult.body.success, true);
    assert.equal(sessionResult.body.data.profile.email, 'restore-user@example.com');

    const refreshResult = await handleRefreshSession(service, {
      'x-request-id': 'req-session-refresh',
      'x-client-version': 'auth-module-test',
    }, {
      [DEFAULT_SESSION_COOKIE_NAME]: cookieValue,
    }, '127.0.0.1', 'node-test');

    assert.equal(refreshResult.statusCode, 200);
    assert.equal(refreshResult.body.success, true);
    assert.ok(Array.isArray(refreshResult.headers?.['set-cookie']));

    const logoutResult = await handleLogoutSession(service, {
      'x-request-id': 'req-logout-cookie',
      'x-client-version': 'auth-module-test',
    }, {
      [DEFAULT_SESSION_COOKIE_NAME]: extractCookieValue(String(refreshResult.headers?.['set-cookie']?.[0] || '')),
    });

    assert.equal(logoutResult.statusCode, 200);
    assert.match(String(logoutResult.headers?.['set-cookie']?.[0] || ''), /Max-Age=0/);
  });

  test('session restore clears an invalid browser-session cookie', async () => {
    const service = createAuthService();

    const result = await handleGetSession(service, {
      'x-request-id': 'req-invalid-session-restore',
      'x-client-version': 'auth-module-test',
    }, {
      [DEFAULT_SESSION_COOKIE_NAME]: 'invalid-refresh-token',
    }, '127.0.0.1', 'node-test');

    assert.equal(result.statusCode, 401);
    assert.equal(result.body.success, false);
    assert.match(String(result.headers?.['set-cookie']?.[0] || ''), /Max-Age=0/);
  });

  test('session refresh clears an invalid browser-session cookie', async () => {
    const service = createAuthService();

    const result = await handleRefreshSession(service, {
      'x-request-id': 'req-invalid-session-refresh',
      'x-client-version': 'auth-module-test',
    }, {
      [DEFAULT_SESSION_COOKIE_NAME]: 'invalid-refresh-token',
    }, '127.0.0.1', 'node-test');

    assert.equal(result.statusCode, 401);
    assert.equal(result.body.success, false);
    assert.match(String(result.headers?.['set-cookie']?.[0] || ''), /Max-Age=0/);
  });
});
