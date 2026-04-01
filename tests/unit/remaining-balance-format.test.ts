import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  formatRemainingCredits,
  getRemainingCreditsFractionDigits,
  normalizeRemainingCredits,
} from '../../src/services/billing/remainingBalance.ts';

test('remaining balance helpers normalize invalid values safely', () => {
  assert.equal(normalizeRemainingCredits(undefined), 0);
  assert.equal(normalizeRemainingCredits(null), 0);
  assert.equal(normalizeRemainingCredits(''), 0);
  assert.equal(normalizeRemainingCredits(-12), 0);
  assert.equal(normalizeRemainingCredits('18'), 18);
  assert.equal(normalizeRemainingCredits('3.5'), 3.5);
});

test('remaining balance helpers preserve integer and fractional display rules', () => {
  assert.equal(getRemainingCreditsFractionDigits(12), 0);
  assert.equal(getRemainingCreditsFractionDigits(12.5), 2);
  assert.equal(formatRemainingCredits(12, 'zh-CN'), '12');
  assert.equal(formatRemainingCredits(12.5, 'zh-CN'), '12.5');
  assert.equal(formatRemainingCredits(12.56, 'en-US'), '12.56');
});
