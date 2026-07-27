import assert from 'node:assert/strict';
import test from 'node:test';

import {
  buildRechargeBillRequest,
  buildRechargeProofSubmissionRequest,
  buildRechargeSubmissionRequest,
  getRechargeSubmissionErrorMessage,
  getRechargeSubmissionStatusLabel,
  normalizeRechargeBillSnapshot,
  sanitizeProviderTransactionId,
  sanitizeTransferReferenceLast4,
} from './rechargeSubmissionService.ts';

test('sanitizeTransferReferenceLast4 keeps the latest four alphanumeric characters', () => {
  assert.equal(sanitizeTransferReferenceLast4(' ab-12 34 '), '1234');
  assert.equal(sanitizeTransferReferenceLast4('we-chat-zz9x'), 'ZZ9X');
  assert.equal(sanitizeTransferReferenceLast4('12'), '12');
});

test('sanitizeProviderTransactionId normalizes a complete provider transaction identifier', () => {
  assert.equal(sanitizeProviderTransactionId(' ali-8x9z-20260728 '), 'ALI-8X9Z-20260728');
  assert.equal(sanitizeProviderTransactionId('invalid_value'), 'INVALIDVALUE');
});

test('buildRechargeSubmissionRequest normalizes amount, note, and transaction identifier', () => {
  assert.deepEqual(
    buildRechargeSubmissionRequest({
      amount: 20,
      currencyCode: 'CNY',
      paymentChannel: 'alipay',
      providerTransactionId: ' ali-8x9z-20260728 ',
      note: '  user uploaded transfer proof  ',
    }),
    {
      amount: 20,
      currencyCode: 'CNY',
      paymentChannel: 'alipay',
      providerTransactionId: 'ALI-8X9Z-20260728',
      transferReferenceLast4: '0728',
      note: 'user uploaded transfer proof',
    },
  );
});

test('buildRechargeBillRequest normalizes amount and note without requiring a transfer tail', () => {
  assert.deepEqual(
    buildRechargeBillRequest({
      amount: 88,
      currencyCode: 'CNY',
      paymentChannel: 'wechat',
      manualProvider: 'wechat',
      note: '  reserve balance top-up  ',
    }),
    {
      amount: 88,
      currencyCode: 'CNY',
      paymentChannel: 'wechat',
      manualProvider: 'wechat',
      note: 'reserve balance top-up',
    },
  );
});

test('buildRechargeBillRequest supports manual recharge provider selection', () => {
  assert.deepEqual(
    buildRechargeBillRequest({
      amount: 20,
      currencyCode: 'CNY',
      paymentChannel: 'manual',
      manualProvider: 'alipay',
    }),
    {
      amount: 20,
      currencyCode: 'CNY',
      paymentChannel: 'manual',
      manualProvider: 'alipay',
      note: undefined,
    },
  );
});

test('buildRechargeProofSubmissionRequest preserves bill references and requires a complete transaction identifier', () => {
  assert.deepEqual(
    buildRechargeProofSubmissionRequest({
      submissionId: 'sub_123',
      billNumber: 'BILL-20260415-001',
      amount: 50,
      currencyCode: 'USD',
      paymentChannel: 'paypal',
      providerTransactionId: ' paypal-aa11-20260415 ',
      note: '  paid from business card  ',
    }),
    {
      submissionId: 'sub_123',
      billNumber: 'BILL-20260415-001',
      amount: 50,
      currencyCode: 'USD',
      paymentChannel: 'paypal',
      providerTransactionId: 'PAYPAL-AA11-20260415',
      transferReferenceLast4: '0415',
      note: 'paid from business card',
    },
  );

  assert.throws(
    () => buildRechargeProofSubmissionRequest({
      submissionId: 'sub_123',
      billNumber: 'BILL-20260415-001',
      amount: 50,
      currencyCode: 'USD',
      paymentChannel: 'paypal',
      providerTransactionId: 'A1',
    }),
    /8-64/,
  );
});

test('buildRechargeSubmissionRequest rejects invalid transaction identifiers and amounts', () => {
  assert.throws(
    () => buildRechargeSubmissionRequest({
      amount: 20,
      currencyCode: 'CNY',
      paymentChannel: 'wechat',
      providerTransactionId: '12',
    }),
    /8-64/,
  );

  assert.throws(
    () =>
      buildRechargeSubmissionRequest({
        amount: 0,
        currencyCode: 'USD',
        paymentChannel: 'paypal',
        providerTransactionId: 'PAYPAL-20260728',
      }),
    /\u5145\u503c\u91d1\u989d\u65e0\u6548/,
  );
});

test('getRechargeSubmissionStatusLabel exposes stable Chinese labels', () => {
  assert.equal(getRechargeSubmissionStatusLabel('draft'), '\u5f85\u521b\u5efa\u8d26\u5355');
  assert.equal(getRechargeSubmissionStatusLabel('bill_created'), '\u5f85\u8f6c\u8d26');
  assert.equal(getRechargeSubmissionStatusLabel('proof_submitted'), '\u5f85\u5ba1\u6838');
  assert.equal(getRechargeSubmissionStatusLabel('pending'), '\u7b49\u5f85\u5ba1\u6838');
  assert.equal(getRechargeSubmissionStatusLabel('paying'), '\u652f\u4ed8\u4e2d');
  assert.equal(getRechargeSubmissionStatusLabel('expired'), '\u652f\u4ed8\u5931\u8d25');
  assert.equal(getRechargeSubmissionStatusLabel('approved'), '\u5ba1\u6838\u901a\u8fc7');
  assert.equal(getRechargeSubmissionStatusLabel('rejected'), '\u5ba1\u6838\u9a73\u56de');
  assert.equal(getRechargeSubmissionStatusLabel('credited'), '\u5df2\u5165\u8d26');
  assert.equal(getRechargeSubmissionStatusLabel('completed' as any), '\u5df2\u5b8c\u6210');
  assert.equal(getRechargeSubmissionStatusLabel(undefined as any), '\u5df2\u5b8c\u6210');
});

test('normalizeRechargeBillSnapshot supports future bill payloads and legacy submission payloads', () => {
  assert.deepEqual(
    normalizeRechargeBillSnapshot(
      {
        bill: {
          submissionId: 'sub_001',
          billNumber: 'BILL-001',
          amount: 88,
          currencyCode: 'CNY',
          paymentChannel: 'alipay',
          manualProvider: 'alipay',
          baseAmount: 88,
          serviceFee: 0.21,
          payableAmount: 88.21,
          baseCredits: 880,
          bonusCredits: 2,
          creditAmount: 882,
          estimatedCredits: 880,
          providerTransactionId: 'ALIPAY-8X9Z-20260427',
          transferReferenceLast4: '8X9Z',
          status: 'proof_submitted',
          expiresAt: '2026-04-27T08:05:00.000Z',
          paymentMarkedAt: '2026-04-27T08:01:00.000Z',
          qrDisplay: {
            title: 'Static QR',
            helperText: 'Upload payment proof after the transfer is complete.',
          },
        },
      },
      {
        amount: 88,
        currencyCode: 'CNY',
        paymentChannel: 'alipay',
        estimatedCredits: 880,
      },
    ),
    {
      submissionId: 'sub_001',
      billNumber: 'BILL-001',
      amount: 88,
      currencyCode: 'CNY',
      paymentChannel: 'alipay',
      manualProvider: 'alipay',
      baseAmount: 88,
      serviceFee: 0.21,
      payableAmount: 88.21,
      baseCredits: 880,
      bonusCredits: 2,
      creditAmount: 882,
      estimatedCredits: 880,
      providerTransactionId: 'ALIPAY-8X9Z-20260427',
      transferReferenceLast4: '8X9Z',
      note: undefined,
      status: 'proof_submitted',
      statusLabel: '\u5f85\u5ba1\u6838',
      expiresAt: '2026-04-27T08:05:00.000Z',
      paymentMarkedAt: '2026-04-27T08:01:00.000Z',
      qrDisplay: {
        title: 'Static QR',
        helperText: 'Upload payment proof after the transfer is complete.',
      },
      submittedAt: undefined,
    },
  );

  assert.deepEqual(
    normalizeRechargeBillSnapshot(
      {
        submission: {
          submissionId: 'legacy_sub_9',
          amount: 20,
          currencyCode: 'USD',
          paymentChannel: 'paypal',
          providerTransactionId: 'LEGACY-12345678',
          transferReferenceLast4: 'ABCD',
          status: 'pending',
          submittedAt: '2026-04-15T01:02:03.000Z',
        },
      },
      {
        amount: 20,
        currencyCode: 'USD',
        paymentChannel: 'paypal',
        estimatedCredits: 100,
      },
    ),
    {
      submissionId: 'legacy_sub_9',
      billNumber: 'legacy_sub_9',
      amount: 20,
      currencyCode: 'USD',
      paymentChannel: 'paypal',
      estimatedCredits: 100,
      providerTransactionId: 'LEGACY-12345678',
      transferReferenceLast4: 'ABCD',
      note: undefined,
      status: 'pending',
      statusLabel: '\u7b49\u5f85\u5ba1\u6838',
      qrDisplay: undefined,
      submittedAt: '2026-04-15T01:02:03.000Z',
    },
  );
});

test('getRechargeSubmissionErrorMessage surfaces missing runtime support clearly', () => {
  assert.equal(
    getRechargeSubmissionErrorMessage({ error: { code: 'HTTP_404' } }, 'fallback'),
    '\u5f53\u524d\u8fd0\u884c\u65f6\u5c1a\u672a\u90e8\u7f72\u5145\u503c\u63d0\u4ea4\u63a5\u53e3\uff0c\u8bf7\u8054\u7cfb\u7ba1\u7406\u5458\u3002',
  );
  assert.equal(
    getRechargeSubmissionErrorMessage({ error: { message: 'custom failure' } }, 'fallback'),
    'custom failure',
  );
  assert.equal(
    getRechargeSubmissionErrorMessage(
      {
        error: {
          code: 'SERVER_PERSISTENCE_REQUIRED',
          message:
            'Billing and credit persistence require the API server to use the VPS PostgreSQL backend.',
        },
      },
      'fallback',
    ),
    '\u5f53\u524d\u5145\u503c\u7533\u8bf7\u9700\u8981\u53ef\u6301\u4e45\u5316\u7684\u6b63\u5f0f\u540e\u7aef\uff0c\u8bf7\u8054\u7cfb\u7ba1\u7406\u5458\u68c0\u67e5\u8d26\u672c\u914d\u7f6e\u3002',
  );
  assert.equal(getRechargeSubmissionErrorMessage(undefined, 'fallback'), 'fallback');
});
