require('dotenv').config();
const express = require('express');
const { AlipaySdk } = require('alipay-sdk');
const {
    handleLegacyPaymentCallbackThroughSidecar,
} = require('./sidecar_compat_bridge');

const router = express.Router();

function getWebhookSettlementToken() {
    return String(
        process.env.PAYMENT_WEBHOOK_SETTLEMENT_TOKEN
        || process.env.PAYMENT_SIDECAR_SETTLEMENT_TOKEN
        || process.env.PAYMENT_SIDECAR_INTERNAL_TOKEN
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

function resolveWebhookRawBody(req) {
    if (typeof req.rawBody === 'string' && req.rawBody.length > 0) {
        return req.rawBody;
    }

    if (typeof req.body === 'string') {
        return req.body;
    }

    return JSON.stringify(req.body);
}

function getMissingWeChatPayConfigKeys() {
    return [
        'WECHATPAY_API_V3_KEY',
        'WECHATPAY_APPID',
        'WECHATPAY_MCHID',
        'WECHATPAY_PUBLIC_CERT',
        'WECHATPAY_PRIVATE_KEY',
    ].filter((key) => !String(process.env[key] || '').trim());
}

function formatMissingConfigMessage(keys) {
    if (keys.length <= 1) {
        return `${keys[0] || 'WeChat Pay config'} missing`;
    }

    return `${keys.slice(0, -1).join(', ')} and ${keys[keys.length - 1]} missing`;
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
        internalToken: getWebhookSettlementToken(),
        settlementToken: getWebhookSettlementToken(),
        requestId: `payment-webhook-${payType}-${billNo || transactionId}`,
        onWarning(message, error) {
            console.warn('[payment-webhook]', message, error || '');
        },
    };

    try {
        const result = await handleLegacyPaymentCallbackThroughSidecar({
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

        if (!result.success) {
            console.error('[payment-webhook] Payment callback was rejected by compatibility bridge:', {
                merchantOrderNo: billNo || transactionId,
                callbackId: transactionId,
                source: result.source || 'sidecar',
                error: result.error || null,
            });
            return false;
        }

        console.log('[payment-webhook] Payment settlement applied:', {
            source: result.source || 'sidecar',
            settlement: result.settlement?.result || undefined,
            runtimeStatus: result.runtimeStatus || undefined,
            paymentOrderStatus: result.paymentOrderStatus || undefined,
        });
        return true;
    } catch (error) {
        console.error('[payment-webhook] Payment settlement request failed:', error);
        return false;
    }
}

// ============================================
// 1. Alipay webhook
// ============================================
router.post('/alipay', async (req, res) => {
    const postData = req.body;

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

        console.log('[payment-webhook] Received Alipay notify:', {
            outTradeNo,
            tradeStatus,
            totalAmount,
            alipayTradeNo
        });

        if (tradeStatus === 'TRADE_SUCCESS' || tradeStatus === 'TRADE_FINISHED') {
            if (!userId) {
                console.error('[payment-webhook] Missing userId in Alipay webhook:', outTradeNo);
                return res.status(400).send('failure');
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

    const missingWeChatConfigKeys = getMissingWeChatPayConfigKeys();
    if (missingWeChatConfigKeys.length > 0) {
        const message = formatMissingConfigMessage(missingWeChatConfigKeys);
        console.error(`[payment-webhook] WeChat Pay configuration is incomplete: ${message}.`);
        return res.status(500).json({ code: 'FAIL', message });
    }

    try {
        const { WxPay } = require('wechatpay-node-v3');
        const wxpay = new WxPay({
            appid: process.env.WECHATPAY_APPID,
            mchid: process.env.WECHATPAY_MCHID,
            publicKey: Buffer.from(process.env.WECHATPAY_PUBLIC_CERT, 'utf-8'),
            privateKey: Buffer.from(process.env.WECHATPAY_PRIVATE_KEY, 'utf-8'),
        });

        const signature = req.headers['wechatpay-signature'];
        const timestamp = req.headers['wechatpay-timestamp'];
        const nonce = req.headers['wechatpay-nonce'];

        const bodyStr = resolveWebhookRawBody(req);

        const isValid = wxpay.verifySign({
            body: bodyStr,
            signature,
            timestamp,
            nonce,
            serial: req.headers['wechatpay-serial']
        });

        if (!isValid) {
            console.error('[payment-webhook] WeChat signature verification failed.');
            return res.status(401).json({ code: 'FAIL', message: 'signature verification failed' });
        }

        const resource = req.body.resource;
        if (!resource || !resource.ciphertext || !resource.associated_data || !resource.nonce) {
            console.error('[payment-webhook] Invalid WeChat callback payload: missing resource envelope.');
            return res.status(400).json({ code: 'FAIL', message: 'invalid resource payload' });
        }

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

            if (!userId) {
                console.error('[payment-webhook] Missing attach userId in WeChat webhook:', outTradeNo);
                return res.status(400).json({ code: 'FAIL', message: 'missing attach userId' });
            }

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
                return res.status(200).json({ code: 'SUCCESS', message: 'success' });
            }

            return res.status(500).json({ code: 'FAIL', message: 'database settlement failed' });
        }

        return res.status(200).json({ code: 'SUCCESS', message: 'ignored' });
    } catch (error) {
        console.error('[payment-webhook] Failed to process WeChat webhook:', error);
        res.status(500).json({ code: 'FAIL', message: 'internal error' });
    }
});

module.exports = router;
