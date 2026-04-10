import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  createEditableExchangeRateRows,
  toUpsertCreditExchangeRateInput,
} from '../../apps/admin/src/features/exchange-rates/exchangeRatesModel.ts';

test('createEditableExchangeRateRows sorts CNY before USD and keeps disabled rows visible', () => {
  const rows = createEditableExchangeRateRows([
    { currencyCode: 'USD', creditsPerUnit: 30, minAmount: 1, maxAmount: 100, isActive: true },
    { currencyCode: 'CNY', creditsPerUnit: 5, minAmount: 5, maxAmount: 500, isActive: false },
  ]);

  assert.equal(rows[0].currencyCode, 'CNY');
  assert.equal(rows[1].currencyCode, 'USD');
  assert.equal(rows[0].isActive, false);
});

test('toUpsertCreditExchangeRateInput returns the canonical request payload', () => {
  assert.deepEqual(
    toUpsertCreditExchangeRateInput({
      currencyCode: 'CNY',
      creditsPerUnit: 8,
      minAmount: 10,
      maxAmount: 300,
      isActive: true,
    }),
    {
      currencyCode: 'CNY',
      creditsPerUnit: 8,
      minAmount: 10,
      maxAmount: 300,
      isActive: true,
    },
  );
});
