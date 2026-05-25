import assert from 'node:assert/strict';
import { afterEach, test } from 'node:test';

import {
  buildGoogleSignInRedirectUrl,
  startGoogleSignIn,
} from '../../apps/web/src/services/auth/googleAuth.ts';
import { startGoogleBind } from '../../apps/web/src/services/auth/identityLinking.ts';

const originalWindow = (globalThis as typeof globalThis & { window?: unknown }).window;
const originalRedirectOrigin = process.env.VITE_AUTH_REDIRECT_ORIGIN;
const originalLocation = (globalThis as typeof globalThis & { location?: unknown }).location;

afterEach(() => {
  (globalThis as typeof globalThis & { window?: unknown }).window = originalWindow;
  (globalThis as typeof globalThis & { location?: unknown }).location = originalLocation;
  if (typeof originalRedirectOrigin === 'string') {
    process.env.VITE_AUTH_REDIRECT_ORIGIN = originalRedirectOrigin;
  } else {
    delete process.env.VITE_AUTH_REDIRECT_ORIGIN;
  }
});

test('buildGoogleSignInRedirectUrl always points to /auth/callback', () => {
  assert.equal(
    buildGoogleSignInRedirectUrl('https://app.example.com'),
    'https://app.example.com/auth/callback',
  );
});

test('startGoogleSignIn launches KK API Google auth and redirects the browser to the returned authorization url', async () => {
  let capturedRedirectTo = '';
  let redirectedTo = '';
  (globalThis as typeof globalThis & { window?: any }).window = {
    location: {
      assign: (value: string) => {
        redirectedTo = value;
      },
    } as any,
  };

  await startGoogleSignIn({
    startGoogleLogin: async (redirectTo: string) => {
      capturedRedirectTo = redirectTo;
      return {
        success: true,
        data: {
          provider: 'google',
          mode: 'login',
          authorizationUrl: 'https://accounts.google.com/o/oauth2/v2/auth?client_id=test',
          callbackUrl: 'https://api.example.com/api/v1/auth/google/callback',
          state: 'state-123',
          expiresAt: '2099-01-01T00:00:00.000Z',
        },
        meta: {
          requestId: 'req-google-start',
          timestamp: '2026-04-13T00:00:00.000Z',
        },
      } as any;
    },
  } as any, 'https://app.example.com');

  assert.equal(capturedRedirectTo, 'https://app.example.com/auth/callback');
  assert.equal(redirectedTo, 'https://accounts.google.com/o/oauth2/v2/auth?client_id=test');
});

test('startGoogleSignIn surfaces KK API Google auth errors', async () => {
  await assert.rejects(
    () => startGoogleSignIn({
      startGoogleLogin: async () => ({
        success: false,
        error: {
          code: 'GOOGLE_AUTH_UNAVAILABLE',
          message: 'Google OAuth disabled',
        },
        meta: {
          requestId: 'req-google-start-error',
          timestamp: '2026-04-13T00:00:00.000Z',
        },
      }),
    } as any, 'https://app.example.com'),
    /Google OAuth disabled/,
  );
});

test('startGoogleBind surfaces the KK API bind-unavailable message instead of a local stub error', async () => {
  await assert.rejects(
    () => startGoogleBind({
      startGoogleBind: async () => ({
        success: false,
        error: {
          code: 'GOOGLE_BIND_UNAVAILABLE',
          message: 'Google bind is not persisted on the VPS runtime yet.',
        },
        meta: {
          requestId: 'req-google-bind-error',
          timestamp: '2026-04-13T00:00:00.000Z',
        },
      }),
    } as any, 'https://app.example.com'),
    /Google bind is not persisted on the VPS runtime yet\./,
  );
});
