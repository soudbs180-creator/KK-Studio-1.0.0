const path = require('path');

require('dotenv').config({ path: path.resolve(__dirname, '.env') });

const express = require('express');
const cors = require('cors');
const { AlipaySdk } = require('alipay-sdk');

const webhookRouter = require('./webhook');
const {
  buildRuntimePaymentStatusView,
  findLegacyPaymentOrder,
  persistLegacyPaymentOrder,
} = require('./runtime_payment_bridge');

const DEFAULT_ALLOWED_ORIGINS = [
  'https://kkai.plus',
  'https://www.kkai.plus',
  'http://localhost:3000',
  'http://127.0.0.1:3000',
  'http://localhost:8888',
  'http://127.0.0.1:8888',
  'http://localhost:3010',
  'http://127.0.0.1:3010',
  'http://localhost:3011',
  'http://127.0.0.1:3011',
  'http://localhost:3100',
  'http://127.0.0.1:3100',
  'http://localhost:3200',
  'http://127.0.0.1:3200',
];

function getAllowedOrigins() {
  const configuredOrigins = String(process.env.PAYMENT_ALLOWED_ORIGINS || '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);

  return configuredOrigins.length > 0 ? configuredOrigins : DEFAULT_ALLOWED_ORIGINS;
}

function formatKey(key, type) {
  const raw = String(key || '').trim();
  if (!raw) {
    return '';
  }

  if (raw.includes('-----BEGIN')) {
    return raw;
  }

  const chunks = raw.match(/.{1,64}/g) || [];
  return `-----BEGIN ${type}-----\n${chunks.join('\n')}\n-----END ${type}-----`;
}

function sanitizePaymentUrl(raw) {
  if (!raw) {
    return '';
  }

  let url = String(raw).trim();
  const markdownMatch = url.match(/\[[^\]]+\]\((https?:\/\/[^)\s]+)\)/i);
  if (markdownMatch) {
    url = markdownMatch[1];
  }

  return url.replace(/[)\],.;]+$/g, '');
}

function getSupabaseServiceRoleKey() {
  return String(
    process.env.SUPABASE_SERVICE_ROLE_KEY
      || process.env.SUPABASE_SECRET_KEY
      || '',
  ).trim();
}

const supabaseUrl = String(process.env.SUPABASE_URL || 'https://ovdjhdofjysanamgkfng.supabase.co').trim();
const mainApiBaseUrl = String(process.env.KK_API_BASE_URL || 'http://127.0.0.1:3001').trim();
const settlementInternalToken = String(process.env.PAYMENT_SIDECAR_INTERNAL_TOKEN || '').trim();
const supabaseServiceRoleKey = getSupabaseServiceRoleKey();

function buildRuntimeBridgeOptions(requestId) {
  return {
    supabaseUrl,
    serviceRoleKey: supabaseServiceRoleKey,
    requestId,
    onWarning(message, error) {
      console.warn('[payment-server]', message, error || '');
    },
  };
}

async function persistLegacyOrderSnapshot(input) {
  try {
    const result = await persistLegacyPaymentOrder({
      merchantOrderNo: input.outTradeNo,
      userId: input.userId,
      providerCode: input.providerCode || 'alipay',
      amount: input.amount,
      currency: input.currency || 'CNY',
      paymentUrl: input.paymentUrl,
      returnUrl: input.returnUrl,
      notifyUrl: input.notifyUrl,
      idempotencyKey: `legacy-${input.outTradeNo}`,
    }, buildRuntimeBridgeOptions(`payment-order-${input.outTradeNo}`));

    return result.persisted ? result.order : undefined;
  } catch (error) {
    console.warn('[payment-server] Failed to persist runtime payment order:', input.outTradeNo, error);
    return undefined;
  }
}

const app = express();
app.disable('x-powered-by');

const allowedOrigins = new Set(getAllowedOrigins().map((origin) => origin.toLowerCase()));
app.use(cors({
  origin(origin, callback) {
    if (!origin || allowedOrigins.has('*')) {
      callback(null, true);
      return;
    }

    callback(null, allowedOrigins.has(String(origin).toLowerCase()));
  },
  credentials: true,
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const alipaySdk = new AlipaySdk({
  appId: process.env.AP_APP_ID || process.env.ALIPAY_APP_ID,
  privateKey: formatKey(process.env.AP_APP_KEY || process.env.ALIPAY_PRIVATE_KEY, 'PRIVATE KEY'),
  keyType: 'PKCS8',
  alipayPublicKey: formatKey(process.env.AP_PUB_KEY || process.env.ALIPAY_PUBLIC_KEY, 'PUBLIC KEY'),
  gateway:
    String(process.env.AP_CURRENT_ENV || '').toLowerCase() === 'sandbox'
      ? 'https://openapi-sandbox.dl.alipaydev.com/gateway.do'
      : 'https://openapi.alipay.com/gateway.do',
  timeout: 5000,
  camelcase: true,
  signType: process.env.AP_ENCRYPTION_ALGO || 'RSA2',
  encryptKey: process.env.AP_ENCRYPT_KEY || process.env.ALIPAY_ENCRYPT_KEY,
});

if (!settlementInternalToken) {
  console.warn('[payment-server] PAYMENT_SIDECAR_INTERNAL_TOKEN is missing, so webhook settlement write-back will fail.');
}

if (!mainApiBaseUrl) {
  console.warn('[payment-server] KK_API_BASE_URL is missing, so webhook settlement write-back will fail.');
}

if (!supabaseUrl) {
  console.warn('[payment-server] SUPABASE_URL is missing, so exchange-rate lookup will fall back to defaults.');
}

if (!supabaseServiceRoleKey) {
  console.warn('[payment-server] SUPABASE_SERVICE_ROLE_KEY is missing, so payment order and callback persistence will be skipped.');
}

app.use('/api/pay/notify', webhookRouter);

const alipayPayMethodMode = String(process.env.ALIPAY_PAY_METHOD || 'page').toLowerCase();
const alipayTradeMethod = alipayPayMethodMode === 'wap' ? 'alipay.trade.wap.pay' : 'alipay.trade.page.pay';
const alipayProductCode = alipayPayMethodMode === 'wap' ? 'QUICK_WAP_WAY' : 'FAST_INSTANT_TRADE_PAY';
const appAuthToken = process.env.AP_APP_AUTH_TOKEN || process.env.ALIPAY_APP_AUTH_TOKEN;

async function createAlipayPageLink({ outTradeNo, amount, userId, returnUrl, notifyUrl }) {
  const bizParams = {
    bizContent: {
      outTradeNo,
      productCode: alipayProductCode,
      totalAmount: Number(amount).toFixed(2),
      subject: `KK Studio credit recharge ${amount}`,
      body: `KK Studio credit recharge ${amount}`,
      passbackParams: encodeURIComponent(String(userId)),
    },
    returnUrl,
    notifyUrl,
  };

  if (appAuthToken) {
    bizParams.appAuthToken = appAuthToken;
  }

  try {
    const link = await alipaySdk.pageExec(alipayTradeMethod, {
      method: 'GET',
      ...bizParams,
    });
    return sanitizePaymentUrl(link);
  } catch (error) {
    const message = String(error?.message || '');
    if (
      message.includes('formData')
      && (message.includes('pageExec') || message.includes('file'))
    ) {
      const link = await alipaySdk.pageExecute(alipayTradeMethod, 'GET', bizParams);
      return sanitizePaymentUrl(link);
    }

    throw error;
  }
}

app.get('/api/v1/user/nickname', async (req, res) => {
  const { email } = req.query;
  if (!email) {
    return res.json({ nickname: 'user' });
  }

  const nickname = String(email).split('@')[0] || 'user';
  return res.json({ nickname });
});

app.get('/api/pay/qrcode', async (req, res) => {
  try {
    const { method, userId, amount } = req.query;
    const currency = String(req.query.currency || 'CNY').trim().toUpperCase();

    if (!userId || !amount) {
      return res.status(400).json({ error: 'Missing required params: userId, amount' });
    }

    if (method !== 'alipay') {
      return res.status(400).json({ error: 'Only alipay is supported on this legacy route.' });
    }

    const outTradeNo = `ORDER_${Date.now()}_${Math.floor(Math.random() * 10000)}`;
    const returnUrl = process.env.PAYMENT_RETURN_URL || process.env.AP_RETURN_URL || 'https://kkai.plus/pay/success';
    const notifyUrl = process.env.PAYMENT_NOTIFY_URL || process.env.AP_NOTIFY_URL || 'https://kkai.plus/api/pay/notify/alipay';

    const payLink = await createAlipayPageLink({
      outTradeNo,
      amount,
      userId,
      returnUrl,
      notifyUrl,
    });

    if (!/^https?:\/\//i.test(payLink)) {
      return res.status(500).json({ error: 'Failed to generate a payment URL.' });
    }

    await persistLegacyOrderSnapshot({
      outTradeNo,
      userId,
      amount,
      currency,
      providerCode: 'alipay',
      paymentUrl: payLink,
      returnUrl,
      notifyUrl,
    });

    return res.json({ qrCode: payLink, outTradeNo, isWebLink: true });
  } catch (error) {
    console.error('[payment-server] create qrcode failed:', error);
    return res.status(500).json({ error: error?.message || String(error) });
  }
});

app.get('/api/pay', async (req, res) => {
  try {
    const { method, userId, amount } = req.query;
    const currency = String(req.query.currency || 'CNY').trim().toUpperCase();

    if (!userId || !amount) {
      return res.status(400).send('Missing required params: userId, amount');
    }

    if (method !== 'alipay') {
      return res.status(400).send('Only alipay is supported on this legacy route.');
    }

    const outTradeNo = `ORDER_${Date.now()}_${Math.floor(Math.random() * 10000)}`;
    const returnUrl = process.env.PAYMENT_RETURN_URL || process.env.AP_RETURN_URL || 'https://kkai.plus/pay/success';
    const notifyUrl = process.env.PAYMENT_NOTIFY_URL || process.env.AP_NOTIFY_URL || 'https://kkai.plus/api/pay/notify/alipay';

    const payLink = await createAlipayPageLink({
      outTradeNo,
      amount,
      userId,
      returnUrl,
      notifyUrl,
    });

    if (!/^https?:\/\//i.test(payLink)) {
      return res.status(500).send('Failed to generate a payment URL.');
    }

    await persistLegacyOrderSnapshot({
      outTradeNo,
      userId,
      amount,
      currency,
      providerCode: 'alipay',
      paymentUrl: payLink,
      returnUrl,
      notifyUrl,
    });

    return res.redirect(302, payLink);
  } catch (error) {
    console.error('[payment-server] create pay redirect failed:', error);
    return res.status(500).send(error?.message || String(error));
  }
});

app.get('/api/pay/status', async (req, res) => {
  try {
    const { outTradeNo } = req.query;
    if (!outTradeNo) {
      return res.status(400).json({ error: 'Missing outTradeNo.' });
    }

    let runtimeStatus;
    try {
      const runtimeOrder = await findLegacyPaymentOrder(
        String(outTradeNo),
        buildRuntimeBridgeOptions(`payment-status-${outTradeNo}`),
      );
      runtimeStatus = buildRuntimePaymentStatusView(runtimeOrder);

      if (
        runtimeStatus
        && (
          runtimeStatus.settlementApplied
          || runtimeStatus.paymentOrderStatus === 'failed'
          || runtimeStatus.paymentOrderStatus === 'cancelled'
          || runtimeStatus.paymentOrderStatus === 'refunded'
        )
      ) {
        return res.json({ tradeStatus: runtimeStatus.tradeStatus, details: runtimeStatus, source: 'runtime' });
      }
    } catch (runtimeError) {
      console.warn('[payment-server] Failed to read runtime payment status:', outTradeNo, runtimeError);
    }

    if (!alipaySdk) {
      if (runtimeStatus) {
        return res.json({ tradeStatus: runtimeStatus.tradeStatus, details: runtimeStatus, source: 'runtime' });
      }

      return res.status(500).json({ error: 'No payment status provider is configured.' });
    }

    const queryParams = {
      bizContent: { outTradeNo },
    };
    if (appAuthToken) {
      queryParams.appAuthToken = appAuthToken;
    }

    const result = await alipaySdk.exec('alipay.trade.query', queryParams);

    let tradeStatus = 'WAITING';
    if (result.tradeStatus === 'TRADE_SUCCESS' || result.tradeStatus === 'TRADE_FINISHED') {
      tradeStatus = 'TRADE_SUCCESS';
    } else if (result.tradeStatus === 'TRADE_CLOSED') {
      tradeStatus = 'TRADE_CLOSED';
    }

    return res.json({ tradeStatus, details: result });
  } catch (error) {
    console.error('[payment-server] query status failed:', error);
    return res.status(500).json({ error: error?.message || String(error) });
  }
});

const PORT = Number(process.env.PORT || 8080);
app.listen(PORT, () => {
  console.log(`[payment-server] running on :${PORT}`);
});
