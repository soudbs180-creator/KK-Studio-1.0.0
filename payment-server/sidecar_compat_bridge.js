const path = require('path');
const { pathToFileURL } = require('url');

const AUTHENTICATED_USER_ID_HEADER = 'x-authenticated-user-id';

let paymentModulePromise;
let paymentServicePromise;
let runtimePaymentBridge;

function getSupabaseServiceRoleKey() {
  return String(
    process.env.SUPABASE_SERVICE_ROLE_KEY
      || process.env.SUPABASE_SECRET_KEY
      || '',
  ).trim();
}

function getPaymentWebhookSettlementToken() {
  return String(
    process.env.PAYMENT_WEBHOOK_SETTLEMENT_TOKEN
      || process.env.PAYMENT_SIDECAR_INTERNAL_TOKEN
      || '',
  ).trim();
}

function loadPaymentModule() {
  if (!paymentModulePromise) {
    const moduleUrl = pathToFileURL(
      path.resolve(__dirname, '../apps/payment-sidecar/src/modules/payment/index.ts'),
    ).href;
    paymentModulePromise = import(moduleUrl);
  }

  return paymentModulePromise;
}

function loadRuntimePaymentBridge() {
  if (!runtimePaymentBridge) {
    runtimePaymentBridge = require('./runtime_payment_bridge');
  }

  return runtimePaymentBridge;
}

function buildLegacyCompatibilityHeaders(headers = {}, queryUserId = '') {
  const normalized = {};

  for (const [key, value] of Object.entries(headers || {})) {
    if (Array.isArray(value)) {
      normalized[String(key).toLowerCase()] = String(value[0] || '');
      continue;
    }

    if (typeof value !== 'undefined') {
      normalized[String(key).toLowerCase()] = String(value);
    }
  }

  const internalToken = String(process.env.PAYMENT_SIDECAR_INTERNAL_TOKEN || '').trim();
  if (internalToken && !normalized['x-internal-token']) {
    normalized['x-internal-token'] = internalToken;
  }

  if (queryUserId && !normalized[AUTHENTICATED_USER_ID_HEADER]) {
    normalized[AUTHENTICATED_USER_ID_HEADER] = String(queryUserId).trim();
  }

  return normalized;
}

async function createCompatibilityPaymentService() {
  const paymentModule = await loadPaymentModule();
  const supabaseUrl = String(process.env.SUPABASE_URL || '').trim();
  const serviceRoleKey = getSupabaseServiceRoleKey();
  const repository = supabaseUrl && serviceRoleKey
    ? new paymentModule.SupabasePaymentOrderRepository({
      supabaseUrl,
      serviceRoleKey,
    })
    : new paymentModule.InMemoryPaymentOrderRepository();
  const creditAmountResolver = new paymentModule.SupabasePaymentCreditAmountResolver({
    supabaseUrl,
    serviceRoleKey,
  });
  const settlementWriter = new paymentModule.HttpMainApiSettlementWriter({
    baseUrl: String(process.env.KK_API_BASE_URL || 'http://127.0.0.1:3001').trim(),
    internalToken: getPaymentWebhookSettlementToken(),
    settlementToken: getPaymentWebhookSettlementToken(),
    caller: 'payment-webhook',
  });

  return new paymentModule.PaymentService(repository, settlementWriter, creditAmountResolver);
}

async function getCompatibilityPaymentService() {
  if (!paymentServicePromise) {
    paymentServicePromise = createCompatibilityPaymentService();
  }

  return paymentServicePromise;
}

async function handleLegacyCreateQrCodeThroughSidecar(query, headers, origin, options = {}) {
  const paymentModule = await loadPaymentModule();
  const service = await getCompatibilityPaymentService();
  const compatibilityHeaders = buildLegacyCompatibilityHeaders(
    headers,
    query.get('userId') || '',
  );

  return paymentModule.handleLegacyCreateQrCode(
    service,
    query,
    compatibilityHeaders,
    origin,
    options,
  );
}

async function handleLegacyRedirectThroughSidecar(query, headers, origin, options = {}) {
  const paymentModule = await loadPaymentModule();
  const service = await getCompatibilityPaymentService();
  const compatibilityHeaders = buildLegacyCompatibilityHeaders(
    headers,
    query.get('userId') || '',
  );

  return paymentModule.handleLegacyRedirect(
    service,
    query,
    compatibilityHeaders,
    origin,
    options,
  );
}

async function handleLegacyGetStatusThroughSidecar(query, headers) {
  const paymentModule = await loadPaymentModule();
  const service = await getCompatibilityPaymentService();
  const compatibilityHeaders = buildLegacyCompatibilityHeaders(
    headers,
    query.get('userId') || '',
  );

  return paymentModule.handleLegacyGetStatus(
    service,
    query,
    compatibilityHeaders,
  );
}

async function handleLegacyPaymentCallbackThroughSidecar(input, options = {}) {
  const service = await getCompatibilityPaymentService();
  const requestId = String(
    options.requestId
      || `payment-webhook-${String(input.providerCode || input.payType || 'alipay').trim()}-${String(input.merchantOrderNo || input.callbackId || input.transactionId || 'unknown').trim()}`,
  ).trim();
  const clientVersion = String(options.clientVersion || '').trim() || undefined;
  const result = await service.handleAlipayCallback({
    callbackId: String(input.callbackId || input.transactionId || '').trim(),
    merchantOrderNo: String(input.merchantOrderNo || input.billNo || '').trim(),
    tradeStatus: String(input.tradeStatus || 'TRADE_SUCCESS').trim(),
    payload: input.payload || {},
  }, {
    requestId,
    clientVersion,
  });

  if (result.success) {
    return {
      success: true,
      source: 'sidecar',
      accepted: result.data.accepted,
      paymentOrderStatus: result.data.paymentOrderStatus,
      runtimeStatus: await service.getOrderStatus(String(input.merchantOrderNo || input.billNo || '').trim()),
    };
  }

  if (result.error?.code !== 'PAYMENT_ORDER_NOT_FOUND' || options.disableRuntimeFallback) {
    return {
      success: false,
      source: 'sidecar',
      error: result.error,
    };
  }

  const { handleLegacySuccessfulPaymentCallback } = loadRuntimePaymentBridge();
  const fallbackResult = await handleLegacySuccessfulPaymentCallback(input, options);
  return {
    ...fallbackResult,
    source: 'runtime-fallback',
  };
}

module.exports = {
  handleLegacyCreateQrCodeThroughSidecar,
  handleLegacyPaymentCallbackThroughSidecar,
  handleLegacyGetStatusThroughSidecar,
  handleLegacyRedirectThroughSidecar,
};
