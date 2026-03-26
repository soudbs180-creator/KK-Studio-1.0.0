import assert from 'node:assert/strict';
import { afterEach, describe, test } from 'node:test';

import {
  buildAuthRedirectUrl,
  normalizeAuthRedirectOrigin,
  resolveAuthRedirectOrigin,
} from '../../src/config/authRedirect.ts';

const originalLocationDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'location');

function restoreLocation() {
  if (originalLocationDescriptor) {
    Object.defineProperty(globalThis, 'location', originalLocationDescriptor);
    return;
  }

  Reflect.deleteProperty(globalThis, 'location');
}

afterEach(() => {
  restoreLocation();
});

describe('auth redirect helpers', () => {
  test('normalizes configured auth redirect origins down to the canonical origin', () => {
    assert.equal(
      normalizeAuthRedirectOrigin('https://app.example.com/auth/callback?mode=bind'),
      'https://app.example.com',
    );
  });

  test('falls back to the current runtime origin when no explicit override is configured', () => {
    Object.defineProperty(globalThis, 'location', {
      configurable: true,
      value: {
        origin: 'https://kkai.plus',
      },
    });

    assert.equal(resolveAuthRedirectOrigin(), 'https://kkai.plus');
    assert.equal(
      buildAuthRedirectUrl('/auth/callback?mode=google-bind'),
      'https://kkai.plus/auth/callback?mode=google-bind',
    );
  });

  test('throws a readable error when neither env nor runtime origin is available', () => {
    restoreLocation();

    assert.throws(
      () => resolveAuthRedirectOrigin(),
      /Set VITE_AUTH_REDIRECT_ORIGIN/,
    );
  });
});
