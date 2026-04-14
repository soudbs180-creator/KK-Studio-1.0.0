import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';

const ROOT_DIR = process.cwd();

function readSource(relativePath: string): string {
  return readFileSync(path.join(ROOT_DIR, relativePath), 'utf-8');
}

test('recharge modal keeps a bill-first manual-proof flow without payment sidecar polling', () => {
  const source = readSource('src/components/modals/RechargeModal.tsx');

  assert.match(source, /from '\.\.\/\.\.\/services\/billing\/rechargeSubmissionService';/);
  assert.match(source, /await createRechargeBill\(/);
  assert.match(source, /await submitRechargeProof\(/);
  assert.match(source, /await refreshBilling\(\{ includeTransactions: true \}\);/);
  assert.match(source, /Create bill/);
  assert.match(source, /Submit payment proof/);
  assert.match(source, /submissionId/);
  assert.match(source, /billNumber/);
  assert.match(source, /estimatedCredits/);
  assert.match(source, /qrDisplay/);
  assert.match(source, /transferReferenceLast4/);
  assert.match(source, /statusLabel/);
  assert.doesNotMatch(source, /paymentSidecarClient/);
  assert.doesNotMatch(source, /createPaymentOrder/);
  assert.doesNotMatch(source, /getPaymentOrderStatus/);
  assert.doesNotMatch(source, /QRCodeCanvas/);
  assert.doesNotMatch(source, /setTimeout\(/);
});
