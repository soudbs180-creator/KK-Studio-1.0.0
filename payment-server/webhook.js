require('dotenv').config();
const express = require('express');
const { AlipaySdk } = require('alipay-sdk');
const {
    handleLegacySettlementFailure,
    handleLegacySuccessfulPaymentCallback,
} = require('./runtime_payment_bridge');

const router = express.Router();

function getSupabaseServiceRoleKey() {
    return String(
        process.env.SUPABASE_SERVICE_ROLE_KEY
        || process.env.SUPABASE_SECRET_KEY
        || ''
    ).trim();
}

function formatKey(key, type) {
    const raw = String(key || '').trim();
    if (!raw) return '';
    if (raw.includes('-----BEGIN')) return raw;
    const chunks = raw.match(/.{1,64}/g) || [];
    return `-----BEGIN ${type}-----\n${chunks.join('\n')}\n-----END ${type}-----`;
}

// Keep this Alipay configuration aligned with payment-server/index.js.
const alipaySdk = new AlipaySdk({
    appId: process.env.AP_APP_ID || process.env.ALIPAY_APP_ID,
    privateKey: formatKey(process.env.AP_APP_KEY || process.env.ALIPAY_PRIVATE_KEY, 'PRIVATE KEY'),
    keyType: 'PKCS8',
    alipayPublicKey: formatKey(process.env.AP_PUB_KEY || process.env.ALIPAY_PUBLIC_KEY, 'PUBLIC KEY'),
    encryptKey: process.env.AP_ENCRYPT_KEY || process.env.ALIPAY_ENCRYPT_KEY,
    gateway:
        String(process.env.AP_CURRENT_ENV || '').toLowerCase() === 'sandbox'
            ? 'https://openapi-sandbox.dl.alipaydev.com/gateway.do'
            : 'https://openapi.alipay.com/gateway.do'
});

// ============================================
// Core recharge helper
// ============================================
async function applyPaymentSettlement(userId, transactionId, amount, currency, payType, billNo, payload) {
    console.log(
        `[payment-webhook] Applying payment settlement for user ${userId}: ${currency} ${amount}, payType=${payType}, transactionId=${transactionId}, billNo=${billNo || 'n/a'}`
    );

    const bridgeOptions = {
        baseUrl: process.env.KK_API_BASE_URL || 'http://127.0.0.1:3001',
        internalToken: process.env.PAYMENT_SIDECAR_INTERNAL_TOKEN,
        supabaseUrl: process.env.SUPABASE_URL,
        serviceRoleKey: getSupabaseServiceRoleKey(),
        requestId: `payment-webhook-${payType}-${billNo || transactionId}`,
        onWarning(message, error) {
            console.warn('[payment-webhook]', message, error || '');
        },
    };

    try {
        const result = await handleLegacySuccessfulPaymentCallback({
            userId,
            callbackId: transactionId,
            transactionId,
            merchantOrderNo: billNo || transactionId,
            amount,
            currency,
            providerCode: payType,
            payType,
            tradeStatus: 'TRADE_SUCCESS',
            payload: payload || {},
        }, bridgeOptions);

        if (result.duplicated) {
            console.log('[payment-webhook] Duplicate payment callback ignored:', {
                merchantOrderNo: billNo || transactionId,
                callbackId: transactionId,
            });
            return true;
        }

        if (result.settlementSkipped) {
            console.log('[payment-webhook] Payment callback already settled, runtime status refreshed:', result.runtimeStatus);
            return true;
        }

        console.log('[payment-webhook] Payment settlement applied:', result.settlement?.result || result.runtimeStatus || {});
        return true;
    } catch (error) {
        await handleLegacySettlementFailure({
            merchantOrderNo: billNo || transactionId,
            callbackId: transactionId,
            errorMessage: error?.message || 'Payment settlement request failed.',
        }, bridgeOptions);
        console.error('[payment-webhook] Payment settlement request failed:', error);
        return false;
    }
}

// ============================================
// 1. Alipay webhook
// ============================================
router.post('/alipay', async (req, res) => {
    const postData = req.body;

    console.log('[payment-webhook] Received Alipay notify:', postData);

    try {
        const isValid = alipaySdk.checkNotifySign(postData);

        if (!isValid) {
            console.error('[payment-webhook] Invalid Alipay signature.');
            return res.status(400).send('failure');
        }

        const tradeStatus = postData.trade_status;
        const outTradeNo = postData.out_trade_no;
        const totalAmount = postData.total_amount;
        const alipayTradeNo = postData.trade_no;
        const userId = decodeURIComponent(postData.passback_params || '');

        if (tradeStatus === 'TRADE_SUCCESS' || tradeStatus === 'TRADE_FINISHED') {
            if (!userId) {
                console.error('[payment-webhook] Missing userId in Alipay webhook:', outTradeNo);
                return res.send('success');
            }

            const rechargeSuccess = await applyPaymentSettlement(
                userId,
                alipayTradeNo,
                Number(totalAmount),
                'CNY',
                'alipay',
                outTradeNo,
                postData
            );

            if (rechargeSuccess) {
                return res.send('success');
            }

            return res.status(500).send('database error');
        }

        return res.send('success');
    } catch (error) {
        console.error('[payment-webhook] Failed to process Alipay webhook:', error);
        res.status(500).send('failure');
    }
});

// ============================================
// 2. WeChat Pay webhook
// ============================================
router.post('/wechat', async (req, res) => {
    console.log('[payment-webhook] Received WeChat Pay notify');

    // Skip verification in development if WeChat V3 key is not configured.
    if (!process.env.WECHATPAY_API_V3_KEY) {
        return res.status(200).json({ code: 'SUCCESS', message: '开发模式忽略验签' });
    }

    try {
        const { WxPay } = require('wechatpay-node-v3');
        const wxpay = new WxPay({
            appid: process.env.WECHATPAY_APPID,
            mchid: process.env.WECHATPAY_MCHID,
            publicKey: Buffer.from(process.env.WECHATPAY_PUBLIC_CERT || 'public-key', 'utf-8'),
            privateKey: Buffer.from(process.env.WECHATPAY_PRIVATE_KEY || 'private-key', 'utf-8'),
        });

        const signature = req.headers['wechatpay-signature'];
        const timestamp = req.headers['wechatpay-timestamp'];
        const nonce = req.headers['wechatpay-nonce'];

        // Express usually gives us parsed JSON, so convert it back to a string before verifySign.
        const bodyStr = typeof req.body === 'string' ? req.body : JSON.stringify(req.body);

        const isValid = wxpay.verifySign({
            body: bodyStr,
            signature,
            timestamp,
            nonce,
            serial: req.headers['wechatpay-serial']
        });

        if (!isValid) {
            console.error('[payment-webhook] WeChat signature verification failed.');
            return res.status(401).json({ code: 'FAIL', message: '验签失败' });
        }

        const resource = req.body.resource;
        const decryptData = wxpay.decipher_gcm(
            resource.ciphertext,
            resource.associated_data,
            resource.nonce,
            process.env.WECHATPAY_API_V3_KEY
        );

        if (decryptData.trade_state === 'SUCCESS') {
            const outTradeNo = decryptData.out_trade_no;
            const amount = decryptData.amount.total / 100;
            const userId = decodeURIComponent(decryptData.attach || '');
            const transactionId = decryptData.transaction_id;

            if (userId) {
                const rechargeSuccess = await applyPaymentSettlement(
                    userId,
                    transactionId,
                    amount,
                    'CNY',
                    'wechat',
                    outTradeNo,
                    decryptData
                );
                if (rechargeSuccess) {
                    return res.status(200).json({ code: 'SUCCESS', message: '成功' });
                }

                return res.status(500).json({ code: 'FAIL', message: '数据库加币失败' });
            }

            console.error('[payment-webhook] Missing attach userId in WeChat webhook:', outTradeNo);
        }

        res.status(200).json({ code: 'SUCCESS', message: '成功' });
    } catch (error) {
        console.error('[payment-webhook] Failed to process WeChat webhook:', error);
        res.status(500).json({ code: 'FAIL', message: '内部错误' });
    }
});

module.exports = router;
