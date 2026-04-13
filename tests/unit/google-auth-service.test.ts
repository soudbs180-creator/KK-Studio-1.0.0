import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  buildGoogleSignInRedirectUrl,
  startGoogleSignIn,
} from '../../src/services/auth/googleAuth.ts';

test('buildGoogleSignInRedirectUrl always points to /auth/callback', () => {
  assert.equal(
    buildGoogleSignInRedirectUrl('https://app.example.com'),
    'https://app.example.com/auth/callback',
  );
});

test('startGoogleSignIn launches Supabase OAuth with the Google provider and callback redirect', async () => {
  let capturedPayload: unknown;

  await startGoogleSignIn({
    auth: {
      signInWithOAuth: async (payload: unknown) => {
        capturedPayload = payload;
        return {
          data: {
            provider: 'google',
            url: 'https://accounts.google.com/o/oauth2/v2/auth',
          },
          error: null,
        };
      },
    },
  } as any, 'https://app.example.com');

  assert.deepEqual(capturedPayload, {
    provider: 'google',
    options: {
      redirectTo: 'https://app.example.com/auth/callback',
      queryParams: {
        access_type: 'offline',
        prompt: 'select_account',
      },
    },
  });
});

test('startGoogleSignIn surfaces Supabase OAuth errors', async () => {
  await assert.rejects(
    () => startGoogleSignIn({
      auth: {
        signInWithOAuth: async () => ({
          data: {
            provider: 'google',
            url: null,
          },
          error: new Error('Google OAuth disabled'),
        }),
      },
    } as any, 'https://app.example.com'),
    /Google OAuth disabled/,
  );
});
