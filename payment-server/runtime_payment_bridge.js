const { randomUUID } = require('node:crypto');

const {
  calculateCreditsFromAmount,
  loadCreditExchangeRateMap,
  writeLegacyPaymentSettlement,
} = require('./settlement_bridge');

function normalizeBaseUrl(baseUrl) {
  const trimmed = String(baseUrl || '').trim();
  return trimmed.endsWith('/') ? trimmed : `${trimmed}/`;
}

function parseOptionalJson(text) {
  const raw = String(text || '').trim();
  if (!raw) {
    return undefined;
  }

  try {
    return JSON.parse(raw);
  } catch {
    return undefined;
  }
}

async function parseJsonResponse(response) {
  return parseOptionalJson(await response.text());
}

function buildSupabaseHeaders(serviceRoleKey, prefer) {
  const headers = {
    apikey: serviceRoleKey,
    Authorization: `Bearer ${serviceRoleKey}`,
    'Content-Type': 'application/json',
  };

  if (prefer) {
    headers.Prefer = prefer;
  }

  return headers;
}

function resolveBridgeOptions(options = {}) {
  return {
    supabaseUrl: String(options.supabaseUrl || '').trim(),
    serviceRoleKey: String(options.serviceRoleKey || '').trim(),
    fetchImpl: options.fetchImpl || globalThis.fetch,
  };
}

function canUseRuntimePaymentStore(options = {}) {
  const resolved = resolveBridgeOptions(options);
  return Boolean(
    resolved.supabaseUrl
      && resolved.serviceRoleKey
      && typeof resolved.fetchImpl === 'function',
  );
}

function normalizeCurrencyCode(currency) {
  const upper = String(currency || '').trim().toUpperCase();
  return upper === 'USD' ? 'USD' : 'CNY';
}

function normalizeProviderCode(providerCode) {
  return String(providerCode || 'alipay').trim().toLowerCase() || 'alipay';
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

function buildLegacyTradeStatus(orderStatus, settlementApplied) {
  const normalized = String(orderStatus || '').trim().toLowerCase();

  if (!settlementApplied) {
    if (normalized === 'failed' || normalized === 'cancelled') {
      return 'TRADE_CLOSED';
    }

    return 'WAITING';
  }

  if (normalized === 'paid' || normalized === 'refunded') {
    return 'TRADE_SUCCESS';
  }

  if (normalized === 'failed' || normalized === 'cancelled') {
    return 'TRADE_CLOSED';
  }

  return 'WAITING';
}

function buildSelectUrl(tableName, filters, options = {}) {
  const resolved = resolveBridgeOptions(options);
  const url = new URL(`rest/v1/${tableName}`, normalizeBaseUrl(resolved.supabaseUrl));
  url.searchParams.set('select', '*');

  for (const [field, value] of Object.entries(filters || {})) {
    url.searchParams.set(field, `eq.${String(value)}`);
  }

  return url;
}

async function readSingleRow(tableName, filters, options = {}) {
  if (!canUseRuntimePaymentStore(options)) {
    return undefined;
  }

  const resolved = resolveBridgeOptions(options);
  const response = await resolved.fetchImpl(buildSelectUrl(tableName, filters, options), {
    method: 'GET',
    headers: buildSupabaseHeaders(resolved.serviceRoleKey),
  });

  const payload = await parseJsonResponse(response);
  if (!response.ok) {
    const message = Array.isArray(payload)
      ? `Supabase ${tableName} read failed with status ${response.status}.`
      : payload?.message || `Supabase ${tableName} read failed with status ${response.status}.`;
    throw new Error(message);
  }

  if (Array.isArray(payload)) {
    return payload[0];
  }

  return payload;
}

async function upsertRow(tableName, row, onConflict, options = {}) {
  const resolved = resolveBridgeOptions(options);
  const url = new URL(`rest/v1/${tableName}`, normalizeBaseUrl(resolved.supabaseUrl));
  url.searchParams.set('on_conflict', onConflict);
  url.searchParams.set('select', '*');

  const response = await resolved.fetchImpl(url, {
    method: 'POST',
    headers: buildSupabaseHeaders(resolved.serviceRoleKey, 'resolution=merge-duplicates,return=representation'),
    body: JSON.stringify(row),
  });

  const payload = await parseJsonResponse(response);
  if (!response.ok) {
    const message = Array.isArray(payload)
      ? `Supabase ${tableName} upsert failed with status ${response.status}.`
      : payload?.message || `Supabase ${tableName} upsert failed with status ${response.status}.`;
    throw new Error(message);
  }

  if (Array.isArray(payload)) {
    return payload[0] || row;
  }

  return payload || row;
}

async function patchRow(tableName, filters, patch, options = {}) {
  const resolved = resolveBridgeOptions(options);
  const response = await resolved.fetchImpl(buildSelectUrl(tableName, filters, options), {
    method: 'PATCH',
    headers: buildSupabaseHeaders(resolved.serviceRoleKey, 'return=representation'),
    body: JSON.stringify(patch),
  });

  const payload = await parseJsonResponse(response);
  if (!response.ok) {
    const message = Array.isArray(payload)
      ? `Supabase ${tableName} update failed with status ${response.status}.`
      : payload?.message || `Supabase ${tableName} update failed with status ${response.status}.`;
    throw new Error(message);
  }

  if (Array.isArray(payload)) {
    return payload[0];
  }

  return payload;
}

async function resolveLegacyCreditAmount(input, options = {}) {
  if (Number.isFinite(input.creditAmount) && Number(input.creditAmount) > 0) {
    return Math.max(1, Math.round(Number(input.creditAmount)));
  }

  const rateMap = options.rateMap || await loadCreditExchangeRateMap(options);
  return Math.max(
    1,
    calculateCreditsFromAmount(input.amount, input.currency, rateMap),
  );
}

async function buildLegacyPaymentOrderRow(input, options = {}) {
  const now = String(input.createdAt || new Date().toISOString());
  const existing = input.existingOrder;
  const merchantOrderNo = String(input.merchantOrderNo || '').trim();
  const userId = String(input.userId || '').trim();
  const providerCode = normalizeProviderCode(input.providerCode);
  const currency = normalizeCurrencyCode(input.currency);
  const creditAmount = await resolveLegacyCreditAmount(input, options);

  return {
    id: existing?.id || randomUUID(),
    user_id: userId,
    provider_code: providerCode,
    merchant_order_no: merchantOrderNo,
    status: String(existing?.status || input.status || 'created'),
    amount: formatMoney(input.amount),
    currency,
    credit_amount: creditAmount,
    idempotency_key: String(input.idempotencyKey || `legacy-${merchantOrderNo}`).trim(),
    payment_url: String(input.paymentUrl || existing?.payment_url || '').trim(),
    return_url: String(input.returnUrl || existing?.return_url || '').trim(),
    notify_url: String(input.notifyUrl || existing?.notify_url || '').trim(),
    last_callback_id: existing?.last_callback_id || null,
    settlement_applied_at: existing?.settlement_applied_at || null,
    settlement_ledger_id: existing?.settlement_ledger_id || null,
    created_at: existing?.created_at || now,
    updated_at: now,
    paid_at: existing?.paid_at || null,
  };
}

async function findLegacyPaymentOrder(merchantOrderNo, options = {}) {
  return readSingleRow('payment_orders', {
    merchant_order_no: merchantOrderNo,
  }, options);
}

async function findLegacyPaymentCallback(callbackId, options = {}) {
  return readSingleRow('payment_callbacks', {
    callback_id: callbackId,
  }, options);
}

async function persistLegacyPaymentOrder(input, options = {}) {
  if (!canUseRuntimePaymentStore(options)) {
    return {
      persisted: false,
      skipped: true,
      reason: 'Runtime payment store is unavailable.',
    };
  }

  const existingOrder = await findLegacyPaymentOrder(input.merchantOrderNo, options);
  if (existingOrder) {
    return {
      persisted: true,
      created: false,
      order: existingOrder,
    };
  }

  const row = await buildLegacyPaymentOrderRow(input, options);
  const order = await upsertRow('payment_orders', row, 'merchant_order_no', options);
  return {
    persisted: true,
    created: true,
    order,
  };
}

async function updateLegacyPaymentOrder(merchantOrderNo, patch, options = {}) {
  if (!canUseRuntimePaymentStore(options)) {
    return undefined;
  }

  return patchRow('payment_orders', {
    merchant_order_no: merchantOrderNo,
  }, patch, options);
}

async function persistLegacyPaymentCallback(input, options = {}) {
  if (!canUseRuntimePaymentStore(options)) {
    return {
      persisted: false,
      skipped: true,
      reason: 'Runtime payment store is unavailable.',
    };
  }

  const existing = await findLegacyPaymentCallback(input.callbackId, options);
  if (existing) {
    return {
      persisted: true,
      created: false,
      callback: existing,
    };
  }

  const receivedAt = String(input.receivedAt || new Date().toISOString());
  const callback = await upsertRow('payment_callbacks', {
    id: randomUUID(),
    payment_order_id: String(input.paymentOrderId || '').trim(),
    provider_code: normalizeProviderCode(input.providerCode),
    callback_id: String(input.callbackId || '').trim(),
    verified: input.verified !== false,
    trade_status: String(input.tradeStatus || 'TRADE_SUCCESS').trim(),
    payload: input.payload || {},
    settlement_status: String(input.settlementStatus || 'pending').trim(),
    settlement_error: input.settlementError || null,
    received_at: receivedAt,
    processed_at: input.processedAt || null,
  }, 'callback_id', options);

  return {
    persisted: true,
    created: true,
    callback,
  };
}

async function updateLegacyPaymentCallback(callbackId, patch, options = {}) {
  if (!canUseRuntimePaymentStore(options)) {
    return undefined;
  }

  return patchRow('payment_callbacks', {
    callback_id: callbackId,
  }, patch, options);
}

function buildRuntimePaymentStatusView(order) {
  if (!order) {
    return undefined;
  }

  const settlementApplied = Boolean(order.settlement_applied_at);
  return {
    paymentOrderId: String(order.id || ''),
    merchantOrderNo: String(order.merchant_order_no || ''),
    paymentOrderStatus: String(order.status || 'created'),
    tradeStatus: buildLegacyTradeStatus(order.status, settlementApplied),
    creditAmount: Math.max(0, Math.round(toFiniteNumber(order.credit_amount, 0))),
    amount: formatMoney(order.amount),
    currency: normalizeCurrencyCode(order.currency),
    settlementApplied,
    settlementLedgerId: order.settlement_ledger_id || undefined,
  };
}

function reportRuntimeWarning(options, message, error) {
  if (typeof options.onWarning === 'function') {
    options.onWarning(message, error);
  }
}

async function handleLegacySuccessfulPaymentCallback(input, options = {}) {
  const now = new Date().toISOString();
  const merchantOrderNo = String(input.merchantOrderNo || '').trim();
  const callbackId = String(input.callbackId || input.transactionId || '').trim();
  const providerCode = normalizeProviderCode(input.providerCode || input.payType);
  const currency = normalizeCurrencyCode(input.currency);
  const runtimeEnabled = canUseRuntimePaymentStore(options);
  let order = undefined;

  if (runtimeEnabled) {
    try {
      order = await findLegacyPaymentOrder(merchantOrderNo, options);

      if (!order && input.userId) {
        const created = await persistLegacyPaymentOrder({
          merchantOrderNo,
          userId: input.userId,
          providerCode,
          amount: input.amount,
          currency,
          paymentUrl: input.paymentUrl || '',
          returnUrl: input.returnUrl || process.env.PAYMENT_RETURN_URL || process.env.AP_RETURN_URL || 'https://kkai.plus/pay/success',
          notifyUrl: input.notifyUrl || process.env.PAYMENT_NOTIFY_URL || process.env.AP_NOTIFY_URL || 'https://kkai.plus/api/pay/notify/alipay',
          idempotencyKey: input.idempotencyKey || `legacy-${merchantOrderNo}`,
          creditAmount: input.creditAmount,
          createdAt: now,
        }, options);
        order = created.order;
      }

      if (order) {
        const existingCallback = await findLegacyPaymentCallback(callbackId, options);
        if (existingCallback && existingCallback.payment_order_id === order.id) {
          return {
            success: true,
            duplicated: true,
            order,
            callback: existingCallback,
            runtimeStatus: buildRuntimePaymentStatusView(order),
          };
        }

        if (order.settlement_applied_at) {
          await persistLegacyPaymentCallback({
            paymentOrderId: order.id,
            providerCode,
            callbackId,
            verified: input.verified !== false,
            tradeStatus: String(input.tradeStatus || 'TRADE_SUCCESS').trim(),
            payload: input.payload || {},
            settlementStatus: 'ignored',
            receivedAt: now,
            processedAt: now,
          }, options);

          await updateLegacyPaymentOrder(merchantOrderNo, {
            status: 'paid',
            updated_at: now,
            last_callback_id: callbackId,
          }, options);

          const settledOrder = await findLegacyPaymentOrder(merchantOrderNo, options);
          return {
            success: true,
            settlementSkipped: true,
            duplicated: false,
            order: settledOrder || order,
            runtimeStatus: buildRuntimePaymentStatusView(settledOrder || order),
          };
        }

        await persistLegacyPaymentCallback({
          paymentOrderId: order.id,
          providerCode,
          callbackId,
          verified: input.verified !== false,
          tradeStatus: String(input.tradeStatus || 'TRADE_SUCCESS').trim(),
          payload: input.payload || {},
          settlementStatus: 'pending',
          receivedAt: now,
        }, options);
      }
    } catch (error) {
      reportRuntimeWarning(
        options,
        `Failed to persist runtime payment callback audit for ${merchantOrderNo}.`,
        error,
      );
      order = undefined;
    }
  }

  const settlement = await writeLegacyPaymentSettlement({
    paymentOrderId: order?.id || input.paymentOrderId,
    userId: input.userId,
    transactionId: callbackId,
    amount: input.amount,
    currency,
    payType: providerCode,
    billNo: merchantOrderNo,
    creditAmount: order?.credit_amount || input.creditAmount,
  }, options);

  if (runtimeEnabled && order) {
    try {
      await updateLegacyPaymentOrder(merchantOrderNo, {
        status: 'paid',
        updated_at: now,
        last_callback_id: callbackId,
        settlement_applied_at: now,
        settlement_ledger_id: settlement.result.ledgerId,
        paid_at: now,
      }, options);

      await updateLegacyPaymentCallback(callbackId, {
        settlement_status: 'applied',
        settlement_error: null,
        processed_at: now,
      }, options);

      order = await findLegacyPaymentOrder(merchantOrderNo, options);
    } catch (error) {
      reportRuntimeWarning(
        options,
        `Payment settlement succeeded but runtime payment audit update failed for ${merchantOrderNo}.`,
        error,
      );
    }
  }

  return {
    success: true,
    duplicated: false,
    settlement,
    order,
    runtimeStatus: buildRuntimePaymentStatusView(order),
  };
}

async function handleLegacySettlementFailure(input, options = {}) {
  if (!canUseRuntimePaymentStore(options)) {
    return;
  }

  const now = new Date().toISOString();
  const merchantOrderNo = String(input.merchantOrderNo || '').trim();
  const callbackId = String(input.callbackId || input.transactionId || '').trim();

  try {
    await updateLegacyPaymentOrder(merchantOrderNo, {
      status: 'paid',
      updated_at: now,
      paid_at: now,
    }, options);

    await updateLegacyPaymentCallback(callbackId, {
      settlement_status: 'failed',
      settlement_error: String(input.errorMessage || 'Legacy payment settlement failed.'),
      processed_at: now,
    }, options);
  } catch (error) {
    reportRuntimeWarning(
      options,
      `Failed to mark runtime payment settlement failure for ${merchantOrderNo}.`,
      error,
    );
  }
}

module.exports = {
  buildRuntimePaymentStatusView,
  canUseRuntimePaymentStore,
  findLegacyPaymentCallback,
  findLegacyPaymentOrder,
  handleLegacySettlementFailure,
  handleLegacySuccessfulPaymentCallback,
  persistLegacyPaymentCallback,
  persistLegacyPaymentOrder,
};
