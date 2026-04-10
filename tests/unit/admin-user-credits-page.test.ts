import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  buildAdminRechargeRequest,
  getLatestCreditBalance,
} from '../../apps/admin/src/features/user-credits/userCreditLookupModel.ts';

test('getLatestCreditBalance returns the canonical account balance from the lookup payload', () => {
  assert.equal(
    getLatestCreditBalance({
      identity: 'admin@example.com',
      subjectId: 'user-1',
      balance: 42,
      frozenBalance: 0,
      transactions: [],
    }),
    42,
  );
});

test('buildAdminRechargeRequest returns the existing admin recharge payload shape', () => {
  assert.deepEqual(
    buildAdminRechargeRequest({
      identity: 'admin@example.com',
      creditAmount: 15,
      description: 'Manual adjustment',
    }),
    {
      identity: 'admin@example.com',
      creditAmount: 15,
      description: 'Manual adjustment',
    },
  );
});
