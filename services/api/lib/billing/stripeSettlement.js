/**
 * @file stripeSettlement.js
 * @module services/api/lib/billing
 * @description Stripe Webhook 与服务端订单快照之间的可信结算校验。
 */

function createSettlementError(message) {
  const error = new Error(message);
  error.code = 'STRIPE_SETTLEMENT_MISMATCH';
  return error;
}

/**
 * 只有 Stripe 明确确认资金已支付时才允许积分到账。
 */
function isStripeSessionPaid(session) {
  return session?.payment_status === 'paid';
}

/**
 * 校验签名事件中的金额和币种与创建 Checkout 时保存的订单完全一致。
 */
function assertStripeSessionMatchesOrder(session, order) {
  const expectedAmount = Number(order.amount_cents);
  const actualAmount = Number(session?.amount_total);
  if (!Number.isSafeInteger(expectedAmount) || expectedAmount <= 0 || actualAmount !== expectedAmount) {
    throw createSettlementError(`Stripe amount does not match order ${session?.id || 'unknown'}.`);
  }

  const expectedCurrency = String(order.currency || '').trim().toLowerCase();
  const actualCurrency = String(session?.currency || '').trim().toLowerCase();
  if (!expectedCurrency || actualCurrency !== expectedCurrency) {
    throw createSettlementError(`Stripe currency does not match order ${session?.id || 'unknown'}.`);
  }
}

module.exports = {
  assertStripeSessionMatchesOrder,
  isStripeSessionPaid,
};
