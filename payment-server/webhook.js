// payment-server/webhook.js
// 职责：处理 Stripe Webhook 支付完成事件，实现安全防篡改的订单积分结算。
// 本文件只保留 Stripe webhook 核心逻辑，微信及支付宝等旧路由均在此下线。
// 遵守规范：所有代码使用中文注释，返回给前端的报错仅为脱敏英文。

require('dotenv').config();
const express = require('express');
const { Pool } = require('pg');

const router = express.Router();
let pgPool = null;

/**
 * 初始化并获取 PostgreSQL 数据库连接池
 */
function getPgPool() {
    if (!pgPool) {
        const connectionString = process.env.DATABASE_URL;
        if (!connectionString) {
            console.warn('[payment-webhook] DATABASE_URL 未配置。');
        }
        pgPool = new Pool({
            connectionString,
            ssl: connectionString && (connectionString.includes('sslmode=require') || process.env.NODE_ENV === 'production')
                ? { rejectUnauthorized: false }
                : false,
        });
    }
    return pgPool;
}

/**
 * 安全防篡改的 Stripe 订单结算：
 * 严格不信任来自 Webhook metadata 中传入的 credits 额度；
 * 根据 stripe_session_id 查询数据库中由 create-checkout 在服务端插入的可信 pending 订单；
 * 以数据库中记录的实际 credits 和 user_id 为准进行积分结算。
 */
async function handleStripePaymentSettlement(sessionId) {
    const pool = getPgPool();
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        
        // 1. 使用 stripe_session_id 查询数据库中早已记录的可信 pending 订单信息，并锁定行以防并发冲突
        const orderRes = await client.query(
            "SELECT user_id, credits, status FROM public.orders WHERE stripe_session_id = $1 FOR UPDATE",
            [sessionId]
        );
        
        if (orderRes.rowCount === 0) {
            await client.query('ROLLBACK');
            console.error(`[payment-webhook] 未找到 stripe_session_id = ${sessionId} 的对应订单记录`);
            return false;
        }
        
        const order = orderRes.rows[0];
        
        // 2. 幂等校验：若订单状态已经为 completed，则表明已被其他 webhook 事件或前端轮询处理过，直接提交并返回成功
        if (order.status !== 'pending') {
            await client.query('ROLLBACK');
            console.log(`[payment-webhook] Stripe session ${sessionId} 订单已是完成状态 (${order.status})，跳过重复结算。`);
            return true;
        }
        
        // 3. 将订单状态修改为已完成 (completed)
        await client.query(
            "UPDATE public.orders SET status = 'completed', updated_at = NOW() WHERE stripe_session_id = $1 AND status = 'pending'",
            [sessionId]
        );
        
        // 4. 按数据库内可信的积分值更新用户的积分余额 (credits)
        const parsedCredits = parseInt(order.credits, 10);
        const userRes = await client.query(
            "UPDATE public.users SET credits = COALESCE(credits, 0) + $1, updated_at = NOW() WHERE id = $2",
            [parsedCredits, order.user_id]
        );
        
        if (userRes.rowCount === 0) {
            throw new Error(`找不到用户 ID 为 ${order.user_id} 的结算账户`);
        }
        
        await client.query('COMMIT');
        console.log(`[payment-webhook] Stripe 支付结算成功。用户 ${order.user_id} 获得 ${parsedCredits} 积分。`);
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
 * 校验原始请求体数据
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
 * Stripe Webhook 入口路由：/stripe
 */
router.post('/stripe', async (req, res) => {
    console.log('[payment-webhook] 收到 Stripe Webhook 通知');
    
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
        // 使用 Stripe SDK 验证 webhook 签名的可信度，防止伪造请求
        event = stripe.webhooks.constructEvent(rawBody, sig, endpointSecret);
    } catch (err) {
        console.error('[payment-webhook] Stripe 签名验证失败:', err.message);
        return res.status(400).send(`Webhook Error: ${err.message}`);
    }

    // 仅处理支付完成事件 (checkout.session.completed)
    if (event.type === 'checkout.session.completed') {
        const session = event.data.object;
        const stripeSessionId = session.id;

        console.log('[payment-webhook] 正在处理 Stripe checkout.session.completed 事件:', { stripeSessionId });

        // 执行防篡改结算
        const rechargeSuccess = await handleStripePaymentSettlement(stripeSessionId);

        if (rechargeSuccess) {
            return res.json({ received: true });
        }
        return res.status(500).send('Database error during settlement');
    }

    // 对其他事件默认返回 200 OK
    return res.json({ received: true });
});

module.exports = router;
