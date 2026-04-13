import assert from 'node:assert/strict';
import test from 'node:test';

import {
  buildRechargeSubmissionRequest,
  getRechargeSubmissionErrorMessage,
  getRechargeSubmissionStatusLabel,
  sanitizeTransferReferenceLast4,
} from './rechargeSubmissionService.ts';

test('sanitizeTransferReferenceLast4 keeps the latest four alphanumeric characters', () => {
  assert.equal(sanitizeTransferReferenceLast4(' ab-12 34 '), '1234');
  assert.equal(sanitizeTransferReferenceLast4('we-chat-zz9x'), 'ZZ9X');
  assert.equal(sanitizeTransferReferenceLast4('12'), '12');
});

test('buildRechargeSubmissionRequest normalizes amount, note, and reference tail', () => {
  assert.deepEqual(
    buildRechargeSubmissionRequest({
      amount: 20,
      currencyCode: 'CNY',
      paymentChannel: 'alipay',
      transferReferenceLast4: ' 8x-9z ',
      note: '  user uploaded transfer proof  ',
    }),
    {
      amount: 20,
      currencyCode: 'CNY',
      paymentChannel: 'alipay',
      transferReferenceLast4: '8X9Z',
      note: 'user uploaded transfer proof',
    },
  );
});

test('buildRechargeSubmissionRequest rejects invalid transfer tails and amounts', () => {
  assert.throws(
    () => buildRechargeSubmissionRequest({
      amount: 20,
      currencyCode: 'CNY',
      paymentChannel: 'wechat',
      transferReferenceLast4: '12',
    }),
    /请填写转账流水后四位/,
  );

  assert.throws(
    () => buildRechargeSubmissionRequest({
      amount: 0,
      currencyCode: 'USD',
      paymentChannel: 'paypal',
      transferReferenceLast4: 'ABCD',
    }),
    /充值金额无效/,
  );
});

test('getRechargeSubmissionStatusLabel exposes stable Chinese labels', () => {
  assert.equal(getRechargeSubmissionStatusLabel('pending'), '等待审核');
  assert.equal(getRechargeSubmissionStatusLabel('approved'), '审核通过');
  assert.equal(getRechargeSubmissionStatusLabel('rejected'), '审核驳回');
  assert.equal(getRechargeSubmissionStatusLabel('credited'), '已入账');
  assert.equal(getRechargeSubmissionStatusLabel('completed' as any), '已完成');
  assert.equal(getRechargeSubmissionStatusLabel(undefined as any), '已完成');
});

test('getRechargeSubmissionErrorMessage surfaces missing runtime support clearly', () => {
  assert.equal(
    getRechargeSubmissionErrorMessage({ error: { code: 'HTTP_404' } }, 'fallback'),
    '当前运行时尚未部署充值提交接口，请联系管理员。',
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
          message: 'Billing and credit persistence require the API server to use the canonical Supabase backend.',
        },
      },
      'fallback',
    ),
    '当前充值申请需要可持久化的正式后端，请联系管理员检查账本配置。',
  );
  assert.equal(getRechargeSubmissionErrorMessage(undefined, 'fallback'), 'fallback');
});
