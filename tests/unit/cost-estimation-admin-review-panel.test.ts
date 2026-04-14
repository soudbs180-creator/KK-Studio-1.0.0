import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';

const ROOT_DIR = process.cwd();

function readSource(relativePath: string): string {
  return readFileSync(path.join(ROOT_DIR, relativePath), 'utf-8');
}

test('cost estimation embeds an admin-only recharge review panel on the billing ledger', () => {
  const source = readSource('src/pages/CostEstimation.tsx');

  assert.match(source, /import useAdminRole from '\.\.\/hooks\/useAdminRole';/);
  assert.match(source, /const \{[^}]*isAdmin,[^}]*adminSessionActive[^}]*\} = useAdminRole\(\);/);
  assert.match(source, /kkWebApiClient\.getAdminRechargeSubmission\(/);
  assert.match(source, /kkWebApiClient\.reviewRechargeSubmission\(/);
  assert.match(source, /账单编号/);
  assert.match(source, /核销充值/);
  assert.match(source, /驳回账单/);
  assert.match(source, /isAdmin && adminSessionActive/);
});
