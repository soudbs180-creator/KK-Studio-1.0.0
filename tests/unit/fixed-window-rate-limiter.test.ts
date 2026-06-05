import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { createFixedWindowRateLimiter } = require('../../server/lib/fixedWindowRateLimiter.js');

describe('fixedWindowRateLimiter', () => {
  it('blocks over-limit calls and allows the key again after the window resets', () => {
    const limiter = createFixedWindowRateLimiter({ windowMs: 1_000, max: 2 });

    assert.equal(limiter.check('user-1', 1_000).allowed, true);
    assert.equal(limiter.check('user-1', 1_100).allowed, true);

    const blocked = limiter.check('user-1', 1_200);
    assert.equal(blocked.allowed, false);
    assert.equal(blocked.retryAfter, 1);

    const reset = limiter.check('user-1', 2_100);
    assert.equal(reset.allowed, true);
    assert.equal(reset.count, 1);
  });

  it('prunes expired keys when the limiter grows beyond the configured cap', () => {
    const limiter = createFixedWindowRateLimiter({ windowMs: 100, max: 1, maxKeys: 2 });

    limiter.check('old-1', 1_000);
    limiter.check('old-2', 1_000);
    limiter.check('new-1', 1_200);

    assert.equal(limiter.size(), 1);
  });
});
