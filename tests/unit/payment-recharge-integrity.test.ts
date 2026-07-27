import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import test from 'node:test';

import { readSource } from '../support/workspacePaths.js';

const require = createRequire(import.meta.url);

test('manual recharge persists proof and settles credits through the authoritative repository', () => {
  const billingSource = readSource('services/api/routes/compat/billing.js');
  const adminSource = readSource('services/api/routes/compat/admin.js');
  const modalSource = readSource('apps/web/src/components/modals/RechargeModal.tsx');
  const viewSource = readSource('apps/web/src/components/settings/views/RechargeView.tsx');

  assert.match(billingSource, /rechargeSubmissions\.createRechargeSubmission/);
  assert.match(billingSource, /rechargeSubmissions\.submitRechargeProof/);
  assert.match(adminSource, /rechargeSubmissions\.reviewRechargeSubmission/);
  assert.match(modalSource, /submitRechargeProof\([\s\S]*transferReferenceLast4: normalizedReference/);
  assert.match(viewSource, /submitRechargeProof\([\s\S]*transferReferenceLast4: normalizedReference/);
  assert.doesNotMatch(modalSource, /markRechargeSubmissionPaid/);
  assert.doesNotMatch(viewSource, /markRechargeSubmissionPaid/);
});

test('manual recharge and exchange-rate state has a forward database migration', () => {
  const migrationSource = readSource(
    'infrastructure/database/migrations/027_payment_recharge_integrity.sql',
  );
  const deploySource = readSource('scripts/ops/vps/deploy-kk-vps.sh');
  const bootstrapSource = readSource('scripts/ops/vps/bootstrap-kk-vps.sh');
  const importSource = readSource('scripts/ops/postgres/import-runtime-into-vps.sh');

  assert.match(migrationSource, /CREATE TABLE IF NOT EXISTS public\.credit_exchange_rates/);
  assert.match(migrationSource, /CREATE TABLE IF NOT EXISTS public\.recharge_submissions/);
  assert.match(migrationSource, /chk_recharge_submission_credit_amount_positive/);
  assert.match(migrationSource, /chk_recharge_submission_status/);
  assert.match(migrationSource, /chk_recharge_submission_manual_channel/);
  assert.match(migrationSource, /ADD COLUMN IF NOT EXISTS currency/);
  assert.match(deploySource, /PAYMENT_RECHARGE_MIGRATION_PATH=.*027_payment_recharge_integrity\.sql/);
  assert.match(deploySource, /-f "\$\{NEW_RELEASE_DIR\}\/\$\{PAYMENT_RECHARGE_MIGRATION_PATH\}"/);
  assert.match(bootstrapSource, /PAYMENT_RECHARGE_MIGRATION=.*027_payment_recharge_integrity\.sql/);
  assert.match(bootstrapSource, /-f "\$\{PAYMENT_RECHARGE_MIGRATION\}"/);
  assert.match(importSource, /-f "\$\{PAYMENT_RECHARGE_MIGRATION\}"/);
});

test('Stripe checkout and settlement use server-owned currency, amount, and paid status', () => {
  const billingSource = readSource('services/api/routes/compat/billing.js');
  const webhookSource = readSource('services/api/routes/webhook.js');

  assert.match(billingSource, /currency: plan\.currency\.toLowerCase\(\)/);
  assert.doesNotMatch(billingSource, /req\.body\?\.currency/);
  assert.match(billingSource, /if \(isDbEnabled\(\) && !process\.env\.STRIPE_SECRET_KEY\)/);
  assert.match(billingSource, /stripe\.checkout\.sessions\.expire\(session\.id\)/);
  assert.match(webhookSource, /checkout\.session\.async_payment_succeeded/);
  assert.match(webhookSource, /isStripeSessionPaid/);
  assert.match(webhookSource, /assertStripeSessionMatchesOrder/);
  assert.match(webhookSource, /amount_cents, currency/);
});

test('manual recharge review applies credits once across repeated approvals', async () => {
  const repository = require('../../services/api/lib/billing/rechargeSubmissions.js');
  const creditService = require('../../services/api/lib/credits.js');
  const originalAddCredits = creditService.addCredits;
  let addCreditsCalls = 0;
  const row: Record<string, unknown> = {
    submission_id: 'rch_test',
    user_id: 'user_test',
    amount: '20.00',
    base_amount: '20.00',
    service_fee: '0.00',
    payable_amount: '20.00',
    base_credits: 100,
    bonus_credits: 0,
    credit_amount: 100,
    credits_per_unit: '5.000000',
    currency_code: 'CNY',
    payment_channel: 'manual',
    manual_provider: 'alipay',
    transfer_reference_last4: 'A123',
    note: '',
    status: 'paying',
    created_at: new Date('2026-07-27T00:00:00.000Z'),
    expires_at: new Date('2026-07-28T00:00:00.000Z'),
    payment_marked_at: new Date('2026-07-27T00:01:00.000Z'),
    submitted_at: new Date('2026-07-27T00:01:00.000Z'),
    reviewed_at: null,
    review_actor_user_id: null,
  };
  const client = {
    async query(sql: string, params: unknown[] = []) {
      if (sql.includes('SELECT * FROM public.recharge_submissions')) return { rows: [row] };
      if (sql.includes('UPDATE public.recharge_submissions')) {
        row.status = String(params[1]);
        row.reviewed_at = new Date('2026-07-27T00:02:00.000Z');
        row.review_actor_user_id = String(params[2]);
        return { rows: [row] };
      }
      if (sql.includes('SELECT credits FROM public.users')) return { rows: [{ credits: 100 }] };
      return { rows: [] };
    },
    release() {},
  };
  const pool = { async connect() { return client; } };

  creditService.addCredits = async () => {
    addCreditsCalls += 1;
    return 100;
  };

  try {
    const first = await repository.reviewRechargeSubmission(
      pool,
      'admin_test',
      'rch_test',
      { decision: 'credit' },
    );
    const second = await repository.reviewRechargeSubmission(
      pool,
      'admin_test',
      'rch_test',
      { decision: 'credit' },
    );

    assert.equal(first.credited, true);
    assert.equal(second.credited, false);
    assert.equal(addCreditsCalls, 1);
  } finally {
    creditService.addCredits = originalAddCredits;
  }
});

test('Stripe settlement validator rejects unpaid, wrong-amount, and wrong-currency sessions', () => {
  const {
    assertStripeSessionMatchesOrder,
    isStripeSessionPaid,
  } = require('../../services/api/lib/billing/stripeSettlement.js');

  const paidSession = { id: 'cs_test', payment_status: 'paid', amount_total: 990, currency: 'usd' };
  const order = { amount_cents: 990, currency: 'USD' };
  assert.equal(isStripeSessionPaid(paidSession), true);
  assert.equal(isStripeSessionPaid({ ...paidSession, payment_status: 'unpaid' }), false);
  assert.doesNotThrow(() => assertStripeSessionMatchesOrder(paidSession, order));
  assert.throws(
    () => assertStripeSessionMatchesOrder({ ...paidSession, amount_total: 991 }, order),
    /amount does not match/,
  );
  assert.throws(
    () => assertStripeSessionMatchesOrder({ ...paidSession, currency: 'cny' }, order),
    /currency does not match/,
  );
});
