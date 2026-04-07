const path = require('path');
const { pathToFileURL } = require('url');

const AUTHENTICATED_USER_ID_HEADER = 'x-authenticated-user-id';
const AUTHENTICATED_USER_EMAIL_HEADER = 'x-authenticated-user-email';
const AUTHENTICATED_USER_ROLE_HEADER = 'x-authenticated-user-role';

let paymentModulePromise;
let paymentServicePromise;
let requestAuthenticatorPromise;

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

function normalizeHeaderMap(headers = {}) {
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

  return normalized;
}

function stripTrustedHeaders(headers) {
  const sanitized = { ...headers };
  delete sanitized['x-internal-token'];
  delete sanitized[AUTHENTICATED_USER_ID_HEADER];
  delete sanitized[AUTHENTICATED_USER_EMAIL_HEADER];
  delete sanitized[AUTHENTICATED_USER_ROLE_HEADER];
  return sanitized;
}

async function getRequestAuthenticator() {
  if (!requestAuthenticatorPromise) {
    const moduleUrl = pathToFileURL(
      path.resolve(__dirname, '../apps/api/src/lib/request-authenticator.ts'),
    ).href;
    requestAuthenticatorPromise = import(moduleUrl).then((mod) => {
      const supabaseUrl = String(
        process.env.SUPABASE_URL
        || process.env.VITE_SUPABASE_URL
        || ''
      ).trim();
      const supabaseAuthKey = String(
        getSupabaseServiceRoleKey()
        || process.env.SUPABASE_ANON_KEY
        || process.env.VITE_SUPABASE_ANON_KEY
        || ''
      ).trim();

      if (!supabaseUrl || !supabaseAuthKey) {
        return undefined;
      }

      return mod.createRequestAuthenticator({
        supabaseUrl,
        supabaseAuthKey,
      });
    });
  }

  return requestAuthenticatorPromise;
}

function buildAuthRequiredResult(message = 'Authentication is required for legacy payment routes.') {
  return {
    statusCode: 401,
    body: {
      success: false,
      error: {
        code: 'AUTH_REQUIRED',
        message,
      },
    },
  };
}

function buildForbiddenResult(message) {
  return {
    statusCode: 403,
    body: {
      success: false,
      error: {
        code: 'AUTH_FORBIDDEN',
        message,
      },
    },
  };
}

async function buildLegacyCompatibilityHeaders(headers = {}, options = {}) {
  const normalized = stripTrustedHeaders(normalizeHeaderMap(headers));
  const authenticator = await getRequestAuthenticator();
  if (!authenticator) {
    return {
      errorResult: buildAuthRequiredResult('Legacy payment routes are unavailable because server-side auth verification is not configured.'),
    };
  }

  const authenticatedUser = await authenticator.authenticate(normalized);
  if (!authenticatedUser?.userId) {
    return {
      errorResult: buildAuthRequiredResult(),
    };
  }

  const expectedUserId = String(options.queryUserId || '').trim();
  if (expectedUserId && expectedUserId !== authenticatedUser.userId) {
    return {
      errorResult: buildForbiddenResult('The requested userId does not match the authenticated user.'),
    };
  }

  return {
    headers: {
      ...normalized,
      [AUTHENTICATED_USER_ID_HEADER]: authenticatedUser.userId,
      ...(authenticatedUser.email ? { [AUTHENTICATED_USER_EMAIL_HEADER]: authenticatedUser.email } : {}),
      ...(authenticatedUser.role ? { [AUTHENTICATED_USER_ROLE_HEADER]: authenticatedUser.role } : {}),
    },
  };
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
  const compatibility = await buildLegacyCompatibilityHeaders(headers, {
    queryUserId: query.get('userId') || '',
  });
  if (compatibility.errorResult) {
    return compatibility.errorResult;
  }

  return paymentModule.handleLegacyCreateQrCode(
    service,
    query,
    compatibility.headers,
    origin,
    options,
  );
}

async function handleLegacyRedirectThroughSidecar(query, headers, origin, options = {}) {
  const paymentModule = await loadPaymentModule();
  const service = await getCompatibilityPaymentService();
  const compatibility = await buildLegacyCompatibilityHeaders(headers, {
    queryUserId: query.get('userId') || '',
  });
  if (compatibility.errorResult) {
    return compatibility.errorResult;
  }

  return paymentModule.handleLegacyRedirect(
    service,
    query,
    compatibility.headers,
    origin,
    options,
  );
}

async function handleLegacyGetStatusThroughSidecar(query, headers) {
  const paymentModule = await loadPaymentModule();
  const service = await getCompatibilityPaymentService();
  const compatibility = await buildLegacyCompatibilityHeaders(headers, {
    queryUserId: query.get('userId') || '',
  });
  if (compatibility.errorResult) {
    return compatibility.errorResult;
  }

  return paymentModule.handleLegacyGetStatus(
    service,
    query,
    compatibility.headers,
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

  if (result.error?.code === 'PAYMENT_ORDER_NOT_FOUND') {
    return {
      success: false,
      source: 'sidecar',
      error: {
        ...result.error,
        message: 'The payment order could not be found in the canonical sidecar store. Legacy runtime fallback is disabled for missing orders.',
      },
    };
  }

  if (!result.success) {
    return {
      success: false,
      source: 'sidecar',
      error: result.error,
    };
  }
}

module.exports = {
  handleLegacyCreateQrCodeThroughSidecar,
  handleLegacyPaymentCallbackThroughSidecar,
  handleLegacyGetStatusThroughSidecar,
  handleLegacyRedirectThroughSidecar,
};
