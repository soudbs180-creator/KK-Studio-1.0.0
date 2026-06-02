import { readSource } from '../support/workspacePaths.js';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';

const ROOT_DIR = process.cwd();



test('cost estimation embeds an admin-only recharge review panel on the billing ledger', () => {
  const source = readSource('apps/web/src/pages/CostEstimation.tsx');

  assert.match(source, /import useAdminRole from '\.\.\/hooks\/useAdminRole';/);
  assert.match(source, /const \{[^}]*isAdmin,[^}]*adminSessionActive[^}]*\} = useAdminRole\(\);/);
  assert.match(source, /kkWebApiClient\.getAdminRechargeSubmission\(/);
  assert.match(source, /kkWebApiClient\.reviewRechargeSubmission\(/);
  assert.match(source, /isAdmin && adminSessionActive/);
});

test('cost estimation uses billing-ledger naming and drops the old dark console wording', () => {
  const source = readSource('apps/web/src/pages/CostEstimation.tsx');

  assert.match(source, /Billing Ledger/);
  assert.match(source, /SettingsHero/);
  assert.match(source, /SettingsSection/);
  assert.doesNotMatch(source, /settings-reference-page-header/);
  assert.doesNotMatch(source, /Consumption Center/);
  assert.doesNotMatch(source, /dark control-console structure/);
});
