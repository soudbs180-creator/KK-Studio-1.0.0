import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import fs from 'node:fs';
import { pathToFileURL } from 'node:url';
import test from 'node:test';

import { readSource, workspacePath } from '../support/workspacePaths.js';

const require = createRequire(import.meta.url);

test('fresh VPS provisioning applies the strict billing prerequisites before OAuth and payment migrations', () => {
  const bootstrapSource = readSource('scripts/ops/vps/bootstrap-kk-vps.sh');
  const deploySource = readSource('scripts/ops/vps/deploy-kk-vps.sh');
  const importSource = readSource('scripts/ops/postgres/import-runtime-into-vps.sh');
  const adminConstraintSource = readSource(
    'infrastructure/database/migrations/009_admin_level_check_constraint.sql',
  );

  for (const source of [bootstrapSource, deploySource, importSource]) {
    assert.match(source, /003_strict_agents_schema\.sql/);
    assert.match(source, /006_admin_credits_contract\.sql/);
    assert.ok(
      source.indexOf('003_strict_agents_schema.sql') < source.indexOf('026_oauth_identities.sql'),
      'strict billing schema must be declared before the OAuth migration',
    );
  }
  assert.match(adminConstraintSource, /IF NOT EXISTS[\s\S]*chk_admin_level_range/);
});

test('manual recharge requires an immutable unique provider transaction identifier', () => {
  const migrationPath = workspacePath(
    'infrastructure/database/migrations/028_payment_recharge_hardening.sql',
  );
  assert.equal(fs.existsSync(migrationPath), true, 'payment hardening migration must exist');

  const migrationSource = fs.readFileSync(migrationPath, 'utf8');
  const repositorySource = readSource('services/api/lib/billing/rechargeSubmissions.js');
  const billingDtoSource = readSource('packages/shared/src/contracts/dto/billing.ts');
  const modalSource = readSource('apps/web/src/components/modals/RechargeModal.tsx');
  const viewSource = readSource('apps/web/src/components/settings/views/RechargeView.tsx');

  assert.match(migrationSource, /provider_transaction_id/);
  assert.match(migrationSource, /CREATE UNIQUE INDEX[\s\S]*provider_transaction_id/);
  assert.match(migrationSource, /CREATE TRIGGER recharge_submissions_immutable_proof_trigger/);
  assert.match(migrationSource, /OLD\.provider_transaction_id IS NOT NULL/);
  assert.match(repositorySource, /provider_transaction_id/);
  assert.match(repositorySource, /status IN \('created', 'pending'\)/);
  assert.doesNotMatch(repositorySource, /status IN \('created', 'pending', 'paying'\)/);
  assert.match(billingDtoSource, /providerTransactionId/);
  assert.match(modalSource, /providerTransactionId/);
  assert.match(viewSource, /providerTransactionId/);
});

test('deployment imports legacy JSON recharge state before selecting the new release', () => {
  const deploySource = readSource('scripts/ops/vps/deploy-kk-vps.sh');
  const importerPath = workspacePath(
    'scripts/ops/postgres/import-legacy-payment-state.mjs',
  );

  assert.equal(fs.existsSync(importerPath), true, 'legacy payment importer must exist');
  assert.match(deploySource, /import-legacy-payment-state\.mjs/);
  const importCallIndex = deploySource.lastIndexOf('\nimport_legacy_payment_state\n');
  const switchCallIndex = deploySource.lastIndexOf('\natomic_switch_symlinks\n');
  assert.ok(
    importCallIndex >= 0 && switchCallIndex > importCallIndex,
    'legacy payment state must be imported before the release symlink changes',
  );
});

test('repository rejects replayed provider transaction identifiers and only derives the display tail', async () => {
  const repository = require('../../services/api/lib/billing/rechargeSubmissions.js');
  const conflict = Object.assign(new Error('duplicate'), {
    code: '23505',
    constraint: 'recharge_submissions_provider_transaction_unique_idx',
  });
  const pool = { async query() { throw conflict; } };

  await assert.rejects(
    repository.submitRechargeProof(
      pool,
      'user_test',
      'rch_test',
      { providerTransactionId: 'ALIPAY-ORDER-20260728' },
    ),
    (error: { code?: string; statusCode?: number }) => (
      error.code === 'RECHARGE_TRANSACTION_ALREADY_USED'
      && error.statusCode === 409
    ),
  );
});

test('legacy payment projection downgrades old approvals until balances are reconciled', async () => {
  const importerUrl = pathToFileURL(workspacePath(
    'scripts/ops/postgres/import-legacy-payment-state.mjs',
  )).href;
  const { projectLegacyPaymentState } = await import(importerUrl);
  const projected = projectLegacyPaymentState({
    exchangeRates: [{ currencyCode: 'CNY', creditsPerUnit: 5, isActive: true }],
    profiles: {
      user_test: {
        rechargeSubmissions: {
          rch_legacy: {
            amount: 20,
            creditAmount: 100,
            creditsPerUnit: 5,
            currencyCode: 'CNY',
            manualProvider: 'alipay',
            transferReferenceLast4: 'A123',
            status: 'credited',
          },
        },
      },
    },
  });

  assert.equal(projected.exchangeRates.length, 1);
  assert.equal(projected.submissions[0]?.status, 'paying');
  assert.match(projected.submissions[0]?.providerTransactionId || '', /^LEGACY-[0-9A-F]{40}$/);
  assert.match(projected.submissions[0]?.note || '', /balance reconciliation/);
});

test('legacy Stripe orders reconcile signed event currency without weakening new orders', () => {
  const migrationPath = workspacePath(
    'infrastructure/database/migrations/028_payment_recharge_hardening.sql',
  );
  assert.equal(fs.existsSync(migrationPath), true, 'payment hardening migration must exist');

  const migrationSource = fs.readFileSync(migrationPath, 'utf8');
  const billingSource = readSource('services/api/routes/compat/billing.js');
  const webhookSource = readSource('services/api/routes/webhook.js');
  const settlementSource = readSource('services/api/lib/billing/stripeSettlement.js');

  assert.match(migrationSource, /currency_verified/);
  assert.match(billingSource, /currency_verified/);
  assert.match(webhookSource, /currency_verified/);
  assert.match(webhookSource, /readStripeSessionCurrency\(session\)/);
  assert.match(settlementSource, /session\?\.currency/);
});
