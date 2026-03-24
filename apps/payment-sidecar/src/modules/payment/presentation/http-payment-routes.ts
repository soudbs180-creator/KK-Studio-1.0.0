import { randomUUID } from "node:crypto";

import {
  buildRequestMeta,
  type AlipayCallbackRequestDto,
  type ApiErrorDetail,
  type CreatePaymentOrderRequestDto,
  type PaymentOrderStatusViewDto,
} from "../../../../../../packages/contracts/src/index.ts";
import { resolveAuthenticatedUserId } from "../../../../../../packages/shared/src/index.ts";
import { isValidAmount } from "../domain/payment-order.ts";
import type { PaymentService } from "../application/payment-service.ts";

export interface HttpRouteResult {
  statusCode: number;
  body?: unknown;
  contentType?: string;
  redirectTo?: string;
}

function getAuthenticatedUserId(headers: Record<string, string>): string | undefined {
  return resolveAuthenticatedUserId(headers);
}

function buildAbsoluteUrl(origin: string, path: string): string {
  return new URL(path, origin).toString();
}

function buildCheckoutUrl(origin: string, merchantOrderNo: string): string {
  return buildAbsoluteUrl(origin, `/payment/v1/orders/${encodeURIComponent(merchantOrderNo)}/checkout`);
}

function resolveConfiguredInternalTokens(): string[] {
  return Array.from(new Set(
    [
      process.env.PAYMENT_SIDECAR_CALLBACK_TOKEN,
      process.env.PAYMENT_SIDECAR_INTERNAL_TOKEN,
    ]
      .map((value) => String(value || "").trim())
      .filter((value) => value.length > 0),
  ));
}

function isInternalRequestAuthorized(headers: Record<string, string>): boolean {
  const configuredTokens = resolveConfiguredInternalTokens();
  if (configuredTokens.length === 0) {
    return false;
  }

  const headerToken = String(headers["x-internal-token"] || "").trim();
  const authorization = String(headers.authorization || "").trim();
  const bearerToken = authorization.toLowerCase().startsWith("bearer ")
    ? authorization.slice(7).trim()
    : "";

  return configuredTokens.includes(headerToken) || configuredTokens.includes(bearerToken);
}

function canAccessPaymentOrder(
  orderUserId: string,
  headers: Record<string, string>,
): boolean {
  const authenticatedUserId = getAuthenticatedUserId(headers);
  if (authenticatedUserId && authenticatedUserId === orderUserId) {
    return true;
  }

  return isInternalRequestAuthorized(headers);
}

function buildPaymentOrderNotFoundResult(
  requestId: string,
  clientVersion: string | undefined,
): HttpRouteResult {
  return buildErrorResult(
    requestId,
    clientVersion,
    404,
    "PAYMENT_ORDER_NOT_FOUND",
    "The requested payment order could not be found.",
    [{ field: "merchantOrderNo", reason: "No payment order matches the provided merchantOrderNo." }],
  );
}

function isAbsoluteUrl(value: string): boolean {
  try {
    const candidate = new URL(value);
    return candidate.protocol === "http:" || candidate.protocol === "https:";
  } catch {
    return false;
  }
}

function buildErrorResult(
  requestId: string,
  clientVersion: string | undefined,
  statusCode: number,
  code: string,
  message: string,
  details?: ApiErrorDetail[],
): HttpRouteResult {
  return {
    statusCode,
    body: {
      success: false,
      error: {
        code,
        message,
        details,
      },
      meta: buildRequestMeta(requestId, clientVersion),
    },
  };
}

function buildLegacyNotifyUrl(origin: string): string {
  return buildAbsoluteUrl(origin, "/payment/v1/callbacks/alipay");
}

function buildLegacyReturnUrl(origin: string): string {
  return String(process.env.PAYMENT_RETURN_URL || buildAbsoluteUrl(origin, "/pay/success"));
}

function isManualCheckoutEnabled(): boolean {
  return String(process.env.PAYMENT_SIDECAR_ALLOW_MANUAL_CHECKOUT || "").trim().toLowerCase() === "true";
}

export function validateCreatePaymentOrderRequest(body: unknown): ApiErrorDetail[] {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return [{ field: "body", reason: "Request body must be an object." }];
  }

  const candidate = body as Partial<CreatePaymentOrderRequestDto>;
  const details: ApiErrorDetail[] = [];

  if (!candidate.providerCode || typeof candidate.providerCode !== "string") {
    details.push({ field: "providerCode", reason: "providerCode is required." });
  }
  if (!candidate.amount || typeof candidate.amount !== "string" || !isValidAmount(candidate.amount)) {
    details.push({ field: "amount", reason: "amount must be a positive decimal string." });
  }
  if (!candidate.currency || typeof candidate.currency !== "string") {
    details.push({ field: "currency", reason: "currency is required." });
  }
  if (!candidate.returnUrl || typeof candidate.returnUrl !== "string" || !isAbsoluteUrl(candidate.returnUrl)) {
    details.push({ field: "returnUrl", reason: "returnUrl must be an absolute http(s) URL." });
  }
  if (!candidate.notifyUrl || typeof candidate.notifyUrl !== "string" || !isAbsoluteUrl(candidate.notifyUrl)) {
    details.push({ field: "notifyUrl", reason: "notifyUrl must be an absolute http(s) URL." });
  }
  if (!candidate.idempotencyKey || typeof candidate.idempotencyKey !== "string") {
    details.push({ field: "idempotencyKey", reason: "idempotencyKey is required." });
  }

  return details;
}

export function validateAlipayCallbackRequest(body: unknown): ApiErrorDetail[] {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return [{ field: "body", reason: "Request body must be an object." }];
  }

  const candidate = body as Partial<AlipayCallbackRequestDto>;
  const details: ApiErrorDetail[] = [];

  if (!candidate.callbackId || typeof candidate.callbackId !== "string") {
    details.push({ field: "callbackId", reason: "callbackId is required." });
  }
  if (!candidate.merchantOrderNo || typeof candidate.merchantOrderNo !== "string") {
    details.push({ field: "merchantOrderNo", reason: "merchantOrderNo is required." });
  }
  if (!candidate.tradeStatus || typeof candidate.tradeStatus !== "string") {
    details.push({ field: "tradeStatus", reason: "tradeStatus is required." });
  }
  if (!candidate.payload || typeof candidate.payload !== "object" || Array.isArray(candidate.payload)) {
    details.push({ field: "payload", reason: "payload must be an object." });
  }

  return details;
}

export async function handleCreatePaymentOrder(
  service: PaymentService,
  body: CreatePaymentOrderRequestDto,
  headers: Record<string, string>,
  origin: string,
): Promise<HttpRouteResult> {
  const requestId = headers["x-request-id"] || randomUUID();
  const clientVersion = headers["x-client-version"];
  const validationErrors = validateCreatePaymentOrderRequest(body);
  if (validationErrors.length > 0) {
    return buildErrorResult(
      requestId,
      clientVersion,
      400,
      "INVALID_REQUEST",
      "Payment order request validation failed.",
      validationErrors,
    );
  }

  if (!service.isProviderSupported(body.providerCode)) {
    return buildErrorResult(
      requestId,
      clientVersion,
      400,
      "PAYMENT_PROVIDER_UNSUPPORTED",
      "The requested payment provider is not supported in the sidecar.",
      [{ field: "providerCode", reason: "Supported providers are alipay, wechat, and paypal." }],
    );
  }

  const userId = getAuthenticatedUserId(headers);
  if (!userId) {
    return buildErrorResult(
      requestId,
      clientVersion,
      401,
      "AUTH_REQUIRED",
      "An authenticated user context is required to create a payment order.",
    );
  }

  const result = await service.createOrder(body, {
    requestId,
    clientVersion,
    userId,
    paymentUrlFactory: (merchantOrderNo) => buildCheckoutUrl(origin, merchantOrderNo),
  });

  return {
    statusCode: result.success ? 201 : 400,
    body: result,
  };
}

export async function handleAlipayCallback(
  service: PaymentService,
  body: AlipayCallbackRequestDto,
  headers: Record<string, string>,
): Promise<HttpRouteResult> {
  const requestId = headers["x-request-id"] || randomUUID();
  const clientVersion = headers["x-client-version"];

  if (!isInternalRequestAuthorized(headers)) {
    return buildErrorResult(
      requestId,
      clientVersion,
      401,
      "INTERNAL_AUTH_REQUIRED",
      "Valid callback credentials are required.",
    );
  }

  const validationErrors = validateAlipayCallbackRequest(body);
  if (validationErrors.length > 0) {
    return buildErrorResult(
      requestId,
      clientVersion,
      422,
      "INVALID_REQUEST",
      "Payment callback validation failed.",
      validationErrors,
    );
  }

  const result = await service.handleAlipayCallback(body, {
    requestId,
    clientVersion,
  });

  return {
    statusCode: result.success ? 200 : result.error.code === "PAYMENT_ORDER_NOT_FOUND" ? 404 : 502,
    body: result,
  };
}

export async function handleLegacyCreateQrCode(
  service: PaymentService,
  query: URLSearchParams,
  headers: Record<string, string>,
  origin: string,
): Promise<HttpRouteResult> {
  const requestId = headers["x-request-id"] || randomUUID();
  const clientVersion = headers["x-client-version"];
  const method = String(query.get("method") || "").trim().toLowerCase();
  const queryUserId = String(query.get("userId") || "").trim();
  const authenticatedUserId = getAuthenticatedUserId(headers);
  const internalRequest = isInternalRequestAuthorized(headers);
  const userId = authenticatedUserId || (internalRequest ? queryUserId : "");
  const amount = Number(query.get("amount") || "");
  const currency = String(query.get("currency") || "CNY").trim().toUpperCase();

  if (!authenticatedUserId && !internalRequest) {
    return buildErrorResult(
      requestId,
      clientVersion,
      401,
      "AUTH_REQUIRED",
      "An authenticated user context is required to create a legacy payment order.",
    );
  }

  const details: ApiErrorDetail[] = [];
  if (!userId) {
    details.push({ field: "userId", reason: "userId is required." });
  }
  if (!Number.isFinite(amount) || amount <= 0) {
    details.push({ field: "amount", reason: "amount must be a positive number." });
  }

  if (details.length > 0) {
    return buildErrorResult(
      requestId,
      clientVersion,
      400,
      "INVALID_REQUEST",
      "Legacy payment route requires userId and a positive amount.",
      details,
    );
  }

  if (method !== "alipay") {
    return buildErrorResult(
      requestId,
      clientVersion,
      400,
      "PAYMENT_PROVIDER_UNSUPPORTED",
      "The legacy payment route currently supports alipay only.",
      [{ field: "method", reason: "Only method=alipay is supported." }],
    );
  }

  const body: CreatePaymentOrderRequestDto = {
    providerCode: "alipay",
    amount: amount.toFixed(2),
    currency,
    returnUrl: String(query.get("returnUrl") || buildLegacyReturnUrl(origin)),
    notifyUrl: String(query.get("notifyUrl") || buildLegacyNotifyUrl(origin)),
    idempotencyKey: `legacy-${userId}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    userId,
  };

  const result = await service.createOrder(body, {
    requestId,
    clientVersion,
    userId,
    paymentUrlFactory: (merchantOrderNo) => buildCheckoutUrl(origin, merchantOrderNo),
  });

  if (!result.success) {
    return {
      statusCode: 400,
      body: result,
    };
  }

  return {
    statusCode: 200,
    body: {
      qrCode: result.data.paymentUrl,
      outTradeNo: result.data.merchantOrderNo,
      isWebLink: true,
    },
  };
}

export async function handleLegacyGetStatus(
  service: PaymentService,
  query: URLSearchParams,
  headers: Record<string, string>,
): Promise<HttpRouteResult> {
  const requestId = headers["x-request-id"] || randomUUID();
  const clientVersion = headers["x-client-version"];
  const authenticatedUserId = getAuthenticatedUserId(headers);
  const internalRequest = isInternalRequestAuthorized(headers);

  if (!authenticatedUserId && !internalRequest) {
    return buildErrorResult(
      requestId,
      clientVersion,
      401,
      "AUTH_REQUIRED",
      "An authenticated user context is required to check payment status.",
    );
  }

  const merchantOrderNo = String(query.get("outTradeNo") || query.get("merchantOrderNo") || "").trim();
  if (!merchantOrderNo) {
    return {
      statusCode: 400,
      body: {
        error: "Missing outTradeNo.",
      },
    };
  }

  const order = await service.getOrder(merchantOrderNo);
  if (!order || !canAccessPaymentOrder(order.userId, headers)) {
    return {
      statusCode: 404,
      body: {
        error: "Payment order not found.",
      },
    };
  }

  const status = await service.getOrderStatus(merchantOrderNo);
  if (!status) {
    return {
      statusCode: 404,
      body: {
        error: "Payment order not found.",
      },
    };
  }

  return {
    statusCode: 200,
    body: {
      tradeStatus: status.tradeStatus,
      details: status,
    },
  };
}

export async function handleGetPaymentOrderStatus(
  service: PaymentService,
  merchantOrderNo: string,
  headers: Record<string, string>,
): Promise<HttpRouteResult> {
  const requestId = headers["x-request-id"] || randomUUID();
  const clientVersion = headers["x-client-version"];
  const authenticatedUserId = getAuthenticatedUserId(headers);
  const internalRequest = isInternalRequestAuthorized(headers);

  if (!authenticatedUserId && !internalRequest) {
    return buildErrorResult(
      requestId,
      clientVersion,
      401,
      "AUTH_REQUIRED",
      "An authenticated user context is required to read payment status.",
    );
  }

  const order = await service.getOrder(merchantOrderNo);
  if (!order || !canAccessPaymentOrder(order.userId, headers)) {
    return buildPaymentOrderNotFoundResult(requestId, clientVersion);
  }

  const status = await service.getOrderStatus(merchantOrderNo);
  if (!status) {
    return buildPaymentOrderNotFoundResult(requestId, clientVersion);
  }

  return {
    statusCode: 200,
    body: {
      success: true as const,
      data: status satisfies PaymentOrderStatusViewDto,
      meta: buildRequestMeta(requestId, clientVersion),
    },
  };
}

export async function handleLegacyRedirect(
  service: PaymentService,
  query: URLSearchParams,
  headers: Record<string, string>,
  origin: string,
): Promise<HttpRouteResult> {
  const created = await handleLegacyCreateQrCode(service, query, headers, origin);
  if (created.statusCode !== 200 || !created.body || typeof created.body !== "object") {
    return created;
  }

  const payload = created.body as { qrCode: string };
  return {
    statusCode: 302,
    redirectTo: payload.qrCode,
  };
}

export async function handleCheckoutPage(
  service: PaymentService,
  merchantOrderNo: string,
): Promise<HttpRouteResult> {
  const order = await service.getOrder(merchantOrderNo);
  if (!order) {
    return {
      statusCode: 404,
      contentType: "text/html; charset=utf-8",
      body: `<html><body><h1>Payment Order Not Found</h1><p>No order matches ${merchantOrderNo}.</p></body></html>`,
    };
  }

  const manualCheckoutEnabled = isManualCheckoutEnabled();
  const html = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>KK Studio Payment Checkout</title>
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <style>
      body { font-family: ui-sans-serif, system-ui, sans-serif; background: #f8fafc; color: #0f172a; margin: 0; }
      .shell { max-width: 640px; margin: 40px auto; background: #ffffff; border-radius: 18px; padding: 32px; box-shadow: 0 20px 48px rgba(15, 23, 42, 0.12); }
      .eyebrow { font-size: 12px; text-transform: uppercase; letter-spacing: 0.18em; color: #64748b; }
      h1 { margin: 12px 0 8px; font-size: 32px; }
      .summary { margin: 24px 0; padding: 20px; border-radius: 14px; background: #f8fafc; border: 1px solid #e2e8f0; }
      .summary div { margin-bottom: 8px; }
      form { display: flex; gap: 12px; flex-wrap: wrap; margin-top: 24px; }
      button, a { border: 0; border-radius: 12px; padding: 12px 18px; font-size: 15px; font-weight: 600; cursor: pointer; text-decoration: none; }
      button { background: #2563eb; color: white; }
      a { background: #e2e8f0; color: #0f172a; }
      .note { margin-top: 18px; font-size: 14px; color: #475569; }
    </style>
  </head>
  <body>
    <div class="shell">
      <div class="eyebrow">KK Studio Payment Sidecar</div>
      <h1>Checkout</h1>
      <p>This lightweight checkout page is provided for migration and local verification while the new payment sidecar replaces the legacy gateway.</p>
      <div class="summary">
        <div><strong>Order:</strong> ${order.merchantOrderNo}</div>
        <div><strong>Provider:</strong> ${order.providerCode}</div>
        <div><strong>Amount:</strong> ${order.currency} ${order.amount}</div>
        <div><strong>Credits:</strong> ${order.creditAmount}</div>
        <div><strong>Status:</strong> ${order.status}</div>
      </div>
      <form method="post" action="/payment/v1/orders/${encodeURIComponent(order.merchantOrderNo)}/complete">
        ${manualCheckoutEnabled ? "<button type=\"submit\">Mark payment as received</button>" : ""}
        <a href="${order.returnUrl}">Return without payment</a>
      </form>
      <p class="note">${manualCheckoutEnabled
        ? "When the payment is marked as received, the sidecar will call the main API settlement endpoint and then redirect back to the configured return URL."
        : "Manual checkout is disabled by default. Use the provider callback endpoint or enable PAYMENT_SIDECAR_ALLOW_MANUAL_CHECKOUT=true for local verification."}</p>
    </div>
  </body>
</html>`;

  return {
    statusCode: 200,
    contentType: "text/html; charset=utf-8",
    body: html,
  };
}

export async function handleCheckoutComplete(
  service: PaymentService,
  merchantOrderNo: string,
  headers: Record<string, string>,
): Promise<HttpRouteResult> {
  if (!isManualCheckoutEnabled()) {
    return {
      statusCode: 403,
      contentType: "text/html; charset=utf-8",
      body: "<html><body><h1>Manual Checkout Disabled</h1><p>Enable PAYMENT_SIDECAR_ALLOW_MANUAL_CHECKOUT=true for local verification.</p></body></html>",
    };
  }

  const order = await service.getOrder(merchantOrderNo);
  if (!order) {
    return {
      statusCode: 404,
      contentType: "text/html; charset=utf-8",
      body: `<html><body><h1>Payment Order Not Found</h1><p>No order matches ${merchantOrderNo}.</p></body></html>`,
    };
  }

  const requestId = headers["x-request-id"] || randomUUID();
  const clientVersion = headers["x-client-version"];
  const result = await service.handleAlipayCallback({
    callbackId: `manual-${randomUUID()}`,
    merchantOrderNo,
    tradeStatus: "TRADE_SUCCESS",
    payload: {
      source: "manual_checkout",
    },
  }, {
    requestId,
    clientVersion,
  });

  if (!result.success) {
    return {
      statusCode: 502,
      contentType: "text/html; charset=utf-8",
      body: `<html><body><h1>Settlement Failed</h1><p>${result.error.message}</p></body></html>`,
    };
  }

  const separator = order.returnUrl.includes("?") ? "&" : "?";
  return {
    statusCode: 302,
    redirectTo: `${order.returnUrl}${separator}merchantOrderNo=${encodeURIComponent(order.merchantOrderNo)}&paymentStatus=paid`,
  };
}
