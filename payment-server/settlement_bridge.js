const DEFAULT_CREDIT_EXCHANGE_RATES = Object.freeze({
  CNY: Object.freeze({
    currencyCode: 'CNY',
    creditsPerUnit: 5,
    minAmount: 5,
    maxAmount: 500,
    isActive: true,
  }),
  USD: Object.freeze({
    currencyCode: 'USD',
    creditsPerUnit: 30,
    minAmount: 1,
    maxAmount: 100,
    isActive: true,
  }),
});

function normalizeBaseUrl(baseUrl) {
  const trimmed = String(baseUrl || '').trim();
  return trimmed.endsWith('/') ? trimmed : `${trimmed}/`;
}

function normalizeCurrencyCode(currency) {
  const upper = String(currency || '').trim().toUpperCase();
  return upper === 'USD' ? 'USD' : 'CNY';
}

function toFiniteNumber(value, fallback = 0) {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }

  return fallback;
}

function roundAmount(value) {
  return Math.max(0, Math.round((toFiniteNumber(value, 0) + Number.EPSILON) * 100) / 100);
}

function formatMoney(value) {
  return roundAmount(value).toFixed(2);
}

function normalizeRateRow(row) {
  if (!row || typeof row !== 'object') {
    return null;
  }

  const currencyCode = normalizeCurrencyCode(row.currency_code || row.currencyCode);
  return {
    currencyCode,
    creditsPerUnit: Math.max(
      1,
      toFiniteNumber(
        row.credits_per_unit ?? row.creditsPerUnit,
        DEFAULT_CREDIT_EXCHANGE_RATES[currencyCode].creditsPerUnit,
      ),
    ),
    minAmount: row.min_amount == null ? null : toFiniteNumber(row.min_amount, null),
    maxAmount: row.max_amount == null ? null : toFiniteNumber(row.max_amount, null),
    isActive: row.is_active !== false,
  };
}

function mergeWithDefaultRates(rows) {
  const merged = {
    CNY: { ...DEFAULT_CREDIT_EXCHANGE_RATES.CNY },
    USD: { ...DEFAULT_CREDIT_EXCHANGE_RATES.USD },
  };

  for (const row of rows || []) {
    const normalized = normalizeRateRow(row);
    if (!normalized) {
      continue;
    }

    merged[normalized.currencyCode] = {
      ...merged[normalized.currencyCode],
      ...normalized,
    };
  }

  return merged;
}

async function parseJsonResponse(response) {
  const text = await response.text();
  if (!text.trim()) {
    return undefined;
  }

  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
}

async function loadCreditExchangeRateMap(options = {}) {
  const supabaseUrl = String(options.supabaseUrl || '').trim();
  const serviceRoleKey = String(options.serviceRoleKey || '').trim();
  const fetchImpl = options.fetchImpl || globalThis.fetch;

  if (!supabaseUrl || !serviceRoleKey || typeof fetchImpl !== 'function') {
    return mergeWithDefaultRates([]);
  }

  try {
    const response = await fetchImpl(
      `${supabaseUrl}/rest/v1/credit_exchange_rates?select=currency_code,credits_per_unit,min_amount,max_amount,is_active&currency_code=in.(CNY,USD)`,
      {
        method: 'GET',
        headers: {
          apikey: serviceRoleKey,
          Authorization: `Bearer ${serviceRoleKey}`,
          'Content-Type': 'application/json',
        },
      },
    );

    if (!response.ok) {
      return mergeWithDefaultRates([]);
    }

    const payload = await parseJsonResponse(response);
    if (!Array.isArray(payload)) {
      return mergeWithDefaultRates([]);
    }

    return mergeWithDefaultRates(payload);
  } catch {
    return mergeWithDefaultRates([]);
  }
}

function calculateCreditsFromAmount(amount, currency, rateMap) {
  const currencyCode = normalizeCurrencyCode(currency);
  const rate = rateMap[currencyCode] || DEFAULT_CREDIT_EXCHANGE_RATES[currencyCode];
  return Math.max(0, Math.round(roundAmount(amount) * Math.max(1, toFiniteNumber(rate.creditsPerUnit, 1))));
}

function buildLegacyPaymentSettlementRequest(input, rateMap) {
  const providerCode = String(input.payType || input.providerCode || 'alipay').trim().toLowerCase() || 'alipay';
  const merchantOrderNo = String(input.billNo || input.merchantOrderNo || input.transactionId || '').trim();
  const callbackId = String(input.transactionId || input.callbackId || merchantOrderNo).trim();
  const paymentOrderId = String(input.paymentOrderId || '').trim() || `legacy-${providerCode}-${merchantOrderNo || callbackId}`;
  const currencyCode = normalizeCurrencyCode(input.currency);
  const amount = roundAmount(input.amount);
  const creditAmount = Number.isFinite(input.creditAmount) && Number(input.creditAmount) > 0
    ? Math.max(1, Math.round(Number(input.creditAmount)))
    : calculateCreditsFromAmount(amount, currencyCode, rateMap);

  return {
    paymentOrderId,
    merchantOrderNo: merchantOrderNo || callbackId,
    userId: String(input.userId || '').trim(),
    providerCode,
    amount: {
      amount: formatMoney(amount),
      currency: currencyCode,
    },
    creditAmount,
    callbackId,
  };
}

async function writeLegacyPaymentSettlement(input, options = {}) {
  const baseUrl = String(options.baseUrl || '').trim();
  const internalToken = String(options.internalToken || '').trim();
  const fetchImpl = options.fetchImpl || globalThis.fetch;

  if (!baseUrl) {
    throw new Error('Missing KK_API_BASE_URL for payment settlement write-back.');
  }

  if (!internalToken) {
    throw new Error('Missing PAYMENT_SIDECAR_INTERNAL_TOKEN for payment settlement write-back.');
  }

  if (typeof fetchImpl !== 'function') {
    throw new Error('No fetch implementation is available for payment settlement write-back.');
  }

  const rateMap = options.rateMap || await loadCreditExchangeRateMap(options);
  const payload = buildLegacyPaymentSettlementRequest(input, rateMap);
  const response = await fetchImpl(new URL('internal/v1/payment-settlements', normalizeBaseUrl(baseUrl)), {
    method: 'POST',
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'x-request-id': String(options.requestId || `legacy-payment-${payload.callbackId}`),
      'x-client-version': String(options.clientVersion || 'payment-server-legacy'),
      'x-internal-token': internalToken,
    },
    body: JSON.stringify(payload),
  });

  const envelope = await parseJsonResponse(response);
  if (!response.ok || !envelope || envelope.success !== true) {
    const message = envelope && envelope.success === false
      ? envelope.error?.message
      : `Settlement write failed with status ${response.status}.`;
    throw new Error(message || 'Payment settlement write-back failed.');
  }

  return {
    payload,
    result: envelope.data,
  };
}

module.exports = {
  DEFAULT_CREDIT_EXCHANGE_RATES,
  buildLegacyPaymentSettlementRequest,
  calculateCreditsFromAmount,
  loadCreditExchangeRateMap,
  mergeWithDefaultRates,
  writeLegacyPaymentSettlement,
};
