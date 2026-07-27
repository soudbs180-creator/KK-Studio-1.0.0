// services/api/routes/webhook.js
// 职责：安全且防篡改地处理来自 Stripe Webhook 支付完成的结算事件。
// 本服务仅负责对 Stripe webhook (端点为 /stripe) 进行处理，将已废弃的微信和支付宝支付代码全部去除。
// 遵守规范：代码和变更使用中文注释，返回给前端的报错英文脱敏。

const express = require('express');
const { getPool } = require('../lib/db');
const credits = require('../lib/credits');
const {
  assertStripeSessionMatchesOrder,
  isStripeSessionPaid,
} = require('../lib/billing/stripeSettlement');

const router = express.Router();

/**
 * 校验原始请求体数据，优先使用 express-json 捕获到的原始缓冲区字符串
 */
function resolveWebhookRawBody(req) {
  if (typeof req.rawBody === 'string' && req.rawBody.length > 0) {
    return req.rawBody;
  }
  if (typeof req.body === 'string') {
    return req.body;
  }
  return JSON.stringify(req.body);
}

/**
 * Stripe 订单扣费的防篡改结算事务处理：
 * 1. 严格不信任来自 Webhook metadata 中传入的 credits 积分项，防范篡改伪造；
 * 2. 结合 stripe_session_id 查询数据库 orders 中事先插入的可信订单；
 * 3. 校验并确保幂等。如果订单仍处于 'pending'，将其更新为 'completed' 并安全增加用户积分。
 */
async function handleStripePaymentSettlement(session) {
  const sessionId = session.id;
  const pool = getPool();
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // 查询数据库中记录的可信 pending 订单信息，并使用行锁防止并发状态覆盖
    const orderRes = await client.query(
      "SELECT user_id, credits, amount_cents, currency, status FROM public.orders WHERE stripe_session_id = $1 FOR UPDATE",
      [sessionId]
    );

    if (orderRes.rowCount === 0) {
      await client.query('ROLLBACK');
      console.error(`[payment-webhook] 未找到 stripe_session_id = ${sessionId} 的对应订单记录`);
      return false;
    }

    const order = orderRes.rows[0];
    assertStripeSessionMatchesOrder(session, order);

    // 幂等处理：若订单状态已经为 completed，说明已被其他事件或轮询并发处理过，跳过交易
    if (order.status !== 'pending') {
      await client.query('ROLLBACK');
      console.info(`[payment-webhook] Stripe session ${sessionId} 订单已是完成状态 (${order.status})，跳过重复结算。`);
      return true;
    }

    const parsedCredits = Number(order.credits);
    if (!Number.isSafeInteger(parsedCredits) || parsedCredits <= 0) {
      throw new Error(`[payment-webhook] 订单积分数量非法: stripe_session_id = ${sessionId}`);
    }

    // 更新订单状态为已完成
    await client.query(
      "UPDATE public.orders SET status = 'completed', updated_at = NOW() WHERE stripe_session_id = $1 AND status = 'pending'",
      [sessionId]
    );

    // 基于 credits.js 的 addCredits 安全加分，内部涵盖了流水变动记录
    const balanceAfter = await credits.addCredits(client, order.user_id, parsedCredits, 'stripe_webhook', sessionId);

    await client.query('COMMIT');
    console.info(`[payment-webhook] Stripe 支付结算成功。用户 ${order.user_id} 获得 ${parsedCredits} 积分，当前最新余额: ${balanceAfter}`);
    return true;
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('[payment-webhook] Stripe 支付结算事务执行失败:', error);
    return false;
  } finally {
    client.release();
  }
}

/**
 * Stripe Webhook 入口路由：POST /webhook/stripe
 */
router.post('/stripe', async (req, res) => {
  console.info('[payment-webhook] 收到 Stripe Webhook 通知');

  const sig = req.headers['stripe-signature'];
  const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
  const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!stripeSecretKey) {
    console.error('[payment-webhook] Stripe secret key 未配置');
    return res.status(500).send('Stripe secret key missing on server');
  }

  if (!endpointSecret) {
    console.error('[payment-webhook] Stripe webhook secret 未配置');
    return res.status(500).send('Stripe webhook secret missing on server');
  }

  const stripe = require('stripe')(stripeSecretKey);
  let event;

  try {
    const rawBody = resolveWebhookRawBody(req);
    // 使用 Stripe 官方工具库校验请求签名，防止恶意攻击
    event = stripe.webhooks.constructEvent(rawBody, sig, endpointSecret);
  } catch (err) {
    console.error('[payment-webhook] Stripe 签名验证失败:', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  const settlementEvents = new Set([
    'checkout.session.completed',
    'checkout.session.async_payment_succeeded',
  ]);
  if (settlementEvents.has(event.type)) {
    const session = event.data.object;
    const stripeSessionId = session.id;

    if (!isStripeSessionPaid(session)) {
      console.info('[payment-webhook] Stripe Checkout 尚未确认付款，等待后续成功事件:', {
        stripeSessionId,
        paymentStatus: session.payment_status,
      });
      return res.json({ received: true, settled: false });
    }

    console.info('[payment-webhook] 正在处理 Stripe 支付成功事件:', {
      eventType: event.type,
      stripeSessionId,
    });

    // 执行防篡改结算
    const settlementSuccess = await handleStripePaymentSettlement(session);

    if (settlementSuccess) {
      return res.json({ received: true });
    }
    return res.status(500).send('Database error during settlement');
  }

  // 其它不涉及结算的事件默认直接响应 200 OK，防止 Stripe 队列积压
  return res.json({ received: true });
});

module.exports = router;
