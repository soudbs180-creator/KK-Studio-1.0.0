import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

import {
  buildBindCallbackUrl,
  collectLinkedAuthProviders,
  resolveBindCallbackProvider,
  resolveBindFailureMessage,
  resolveBindSuccessMessage,
} from '../../src/services/auth/identityLinking.ts';

describe('identity linking helpers', () => {
  test('builds a provider-specific bind callback url', () => {
    assert.equal(
      buildBindCallbackUrl('google', 'https://app.example.com'),
      'https://app.example.com/auth/callback?mode=google-bind',
    );
  });

  test('collects linked providers from user metadata and identities without duplicates', () => {
    const providers = collectLinkedAuthProviders(
      {
        app_metadata: {
          provider: 'email',
          providers: ['email', 'google'],
        },
        identities: [
          { provider: 'google' },
          { provider: 'wechat' },
        ],
      } as any,
      [
        { provider: 'wechat' },
        { provider: 'Google' },
      ],
    );

    assert.deepEqual(providers, ['email', 'google', 'wechat']);
  });

  test('resolves bind callback provider from mode and legacy success flags', () => {
    const googleParams = new URLSearchParams('mode=google-bind');
    const wechatParams = new URLSearchParams('wechat_bind=success');

    assert.equal(resolveBindCallbackProvider(googleParams), 'google');
    assert.equal(resolveBindCallbackProvider(wechatParams), 'wechat');
  });

  test('returns readable bind success and failure messages', () => {
    assert.equal(resolveBindSuccessMessage('google'), 'Google 绑定成功。');
    assert.equal(resolveBindFailureMessage('wechat'), '微信绑定失败，请稍后重试。');
  });
});
