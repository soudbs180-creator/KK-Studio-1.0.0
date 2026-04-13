import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';

const ROOT_DIR = process.cwd();

function readSource(relativePath: string): string {
  return readFileSync(path.join(ROOT_DIR, relativePath), 'utf-8');
}

test('recharge modal uses recharge submission service instead of payment sidecar polling', () => {
  const source = readSource('src/components/modals/RechargeModal.tsx');

  assert.match(source, /from '\.\.\/\.\.\/services\/billing\/rechargeSubmissionService';/);
  assert.match(source, /await submitRechargeRequest\(/);
  assert.match(source, /await refreshBilling\(\{ includeTransactions: true \}\);/);
  assert.doesNotMatch(source, /paymentSidecarClient/);
  assert.doesNotMatch(source, /createPaymentOrder/);
  assert.doesNotMatch(source, /getPaymentOrderStatus/);
});
