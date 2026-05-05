const path = require('path');

require('dotenv').config({ path: path.resolve(__dirname, '.env') });

const express = require('express');
const cors = require('cors');
const { AlipaySdk } = require('alipay-sdk');

const webhookRouter = require('./webhook');
const {
  handleLegacyCreateQrCodeThroughSidecar,
  handleLegacyGetStatusThroughSidecar,
  handleLegacyRedirectThroughSidecar,
} = require('./sidecar_compat_bridge');

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

function getWebhookSettlementToken() {
  return String(
    process.env.PAYMENT_WEBHOOK_SETTLEMENT_TOKEN
      || process.env.PAYMENT_SIDECAR_SETTLEMENT_TOKEN
      || process.env.PAYMENT_SIDECAR_INTERNAL_TOKEN
      || '',
  ).trim();
}

function isHostedRuntime() {
  return Boolean(
    process.env.VERCEL
      || process.env.VERCEL_ENV
      || (process.env.CONTEXT && process.env.CONTEXT !== 'dev'),
  );
}

function allowHostedLegacyPaymentRoutes() {
  if (!isHostedRuntime()) {
    return true;
  }

  return String(process.env.ALLOW_HOSTED_LEGACY_PAYMENT_ROUTES || '').trim().toLowerCase() === 'true';
}

const settlementInternalToken = getWebhookSettlementToken();

function buildLegacyOrigin(req) {
  const protocol = String(req.headers['x-forwarded-proto'] || req.protocol || 'http')
    .split(',')[0]
    .trim();
  const host = String(req.headers['x-forwarded-host'] || req.get('host') || '')
    .split(',')[0]
    .trim();

  return host ? `${protocol}://${host}` : 'http://127.0.0.1:8080';
}

function toUrlSearchParams(query = {}) {
  const params = new URLSearchParams();

  for (const [key, value] of Object.entries(query)) {
    if (Array.isArray(value)) {
      for (const item of value) {
        if (typeof item !== 'undefined' && item !== null) {
          params.append(key, String(item));
        }
      }
      continue;
    }

    if (typeof value !== 'undefined' && value !== null) {
      params.set(key, String(value));
    }
  }

  return params;
}

function buildLegacyCallbackUrl(origin, pathName) {
  const normalizedOrigin = String(origin || 'http://127.0.0.1:8080').replace(/\/+$/g, '');
  return `${normalizedOrigin}${pathName}`;
}

function applyLegacyPaymentDefaults(params, origin) {
  params.set(
    'returnUrl',
    process.env.PAYMENT_RETURN_URL
      || process.env.AP_RETURN_URL
      || buildLegacyCallbackUrl(origin, '/pay/success'),
  );

  params.set(
    'notifyUrl',
    process.env.PAYMENT_NOTIFY_URL
      || process.env.AP_NOTIFY_URL
      || buildLegacyCallbackUrl(origin, '/api/pay/notify/alipay'),
  );

  if (!params.get('currency')) {
    params.set('currency', 'CNY');
  }

  return params;
}

function sendRouteResult(res, result) {
  if (result.redirectTo) {
    res.redirect(result.statusCode || 302, result.redirectTo);
    return;
  }

  const contentType = result.contentType || 'application/json; charset=utf-8';
  res.status(result.statusCode || 200);

  if (typeof result.body === 'string') {
    res.type(contentType).send(result.body);
    return;
  }

  res.type(contentType).send(result.body);
}

function captureRawJsonBody(req, _res, buf) {
  if (!buf || !buf.length) {
    return;
  }

  req.rawBody = buf.toString('utf8');
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

app.use(express.json({ verify: captureRawJsonBody }));
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
  console.warn('[payment-server] Settlement token is missing, so webhook settlement write-back will fail.');
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
    if (!allowHostedLegacyPaymentRoutes()) {
      return res.status(404).json({ error: 'Legacy payment routes are disabled on hosted runtimes.' });
    }

    const origin = buildLegacyOrigin(req);
    const query = applyLegacyPaymentDefaults(toUrlSearchParams(req.query), origin);
    const result = await handleLegacyCreateQrCodeThroughSidecar(query, req.headers, origin, {
      paymentUrlFactory: async (input) => createAlipayPageLink({
        outTradeNo: input.merchantOrderNo,
        amount: input.amount,
        userId: input.userId,
        returnUrl: input.returnUrl,
        notifyUrl: input.notifyUrl,
      }),
    });

    sendRouteResult(res, result);
    return;
  } catch (error) {
    console.error('[payment-server] create qrcode failed:', error);
    return res.status(500).json({ error: error?.message || String(error) });
  }
});

app.get('/api/pay', async (req, res) => {
  try {
    if (!allowHostedLegacyPaymentRoutes()) {
      return res.status(404).json({ error: 'Legacy payment routes are disabled on hosted runtimes.' });
    }

    const origin = buildLegacyOrigin(req);
    const query = applyLegacyPaymentDefaults(toUrlSearchParams(req.query), origin);
    const result = await handleLegacyRedirectThroughSidecar(query, req.headers, origin, {
      paymentUrlFactory: async (input) => createAlipayPageLink({
        outTradeNo: input.merchantOrderNo,
        amount: input.amount,
        userId: input.userId,
        returnUrl: input.returnUrl,
        notifyUrl: input.notifyUrl,
      }),
    });

    sendRouteResult(res, result);
    return;
  } catch (error) {
    console.error('[payment-server] create pay redirect failed:', error);
    return res.status(500).send(error?.message || String(error));
  }
});

app.get('/api/pay/status', async (req, res) => {
  try {
    if (!allowHostedLegacyPaymentRoutes()) {
      return res.status(404).json({ error: 'Legacy payment routes are disabled on hosted runtimes.' });
    }

    const query = toUrlSearchParams(req.query);
    const { outTradeNo } = req.query;
    if (!outTradeNo) {
      return res.status(400).json({ error: 'Missing outTradeNo.' });
    }

    const sidecarResult = await handleLegacyGetStatusThroughSidecar(query, req.headers);
    sendRouteResult(res, sidecarResult);
    return;
  } catch (error) {
    console.error('[payment-server] query status failed:', error);
    return res.status(500).json({ error: error?.message || String(error) });
  }
});

const PORT = Number(process.env.PORT || 8080);
app.listen(PORT, () => {
  console.log(`[payment-server] running on :${PORT}`);
});
