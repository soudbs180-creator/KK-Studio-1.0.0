import { randomUUID } from "node:crypto";
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { URL } from "node:url";

import { buildPaymentManifest, paymentLogger } from "./app.ts";
import {
  applyAuthenticatedHeaders,
  createRequestAuthenticator,
  resolveSupabaseAuthKey,
  stripAuthenticatedHeaders,
  type AuthenticatedRequestContext,
  type RequestAuthenticator,
} from "../../api/src/lib/request-authenticator.ts";
import {
  HttpMainApiSettlementWriter,
  type PaymentCreditAmountResolver,
  type PaymentOrderRepository,
  type HttpMainApiSettlementWriterOptions,
  handleAlipayCallback,
  handleCheckoutComplete,
  handleCheckoutPage,
  handleCreatePaymentOrder,
  handleGetPaymentOrderStatus,
  handleLegacyCreateQrCode,
  handleLegacyGetStatus,
  handleLegacyRedirect,
  InMemoryPaymentOrderRepository,
  PaymentService,
  SupabasePaymentCreditAmountResolver,
  SupabasePaymentOrderRepository,
} from "./modules/payment/index.ts";
import { env } from "../../../packages/shared/src/index.ts";

class JsonBodyParseError extends Error {
  readonly code = "INVALID_JSON_BODY";
}

function writeBody(
  res: ServerResponse,
  statusCode: number,
  payload: unknown,
  contentType = "application/json; charset=utf-8",
) {
  const body = typeof payload === "string" ? payload : JSON.stringify(payload, null, 2);
  res.writeHead(statusCode, {
    "content-type": contentType,
    "content-length": Buffer.byteLength(body),
  });
  res.end(body);
}

function writeRedirect(res: ServerResponse, location: string) {
  res.writeHead(302, {
    location,
    "content-length": "0",
  });
  res.end();
}

function normalizeHeaders(req: IncomingMessage): Record<string, string> {
  const normalized: Record<string, string> = {};
  for (const [key, value] of Object.entries(req.headers)) {
    if (Array.isArray(value)) {
      normalized[key] = String(value[0] || "");
    } else if (typeof value !== "undefined") {
      normalized[key] = String(value);
    }
  }

  return normalized;
}

function buildRequestOrigin(req: IncomingMessage, headers: Record<string, string>): string {
  const forwardedProto = headers["x-forwarded-proto"];
  const protocol = forwardedProto || "http";
  const host = headers.host || `127.0.0.1:${req.socket.localPort || 0}`;
  return `${protocol}://${host}`;
}

async function readJsonBody(req: IncomingMessage): Promise<any> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }

  if (chunks.length === 0) {
    return {};
  }

  const raw = Buffer.concat(chunks).toString("utf8").trim();
  if (!raw) {
    return {};
  }

  try {
    return JSON.parse(raw);
  } catch (error: any) {
    throw new JsonBodyParseError(error?.message || "Invalid JSON body.");
  }
}

function buildErrorMeta(requestId: string, clientVersion?: string) {
  return {
    requestId,
    clientVersion,
    timestamp: new Date().toISOString(),
  };
}

export interface PaymentSidecarServerOptions {
  creditAmountResolver?: PaymentCreditAmountResolver;
  paymentOrderRepository?: PaymentOrderRepository;
  requestAuthenticator?: RequestAuthenticator;
  resolveAccessToken?: (accessToken: string) => AuthenticatedRequestContext | undefined;
  settlementWriterOptions?: Partial<HttpMainApiSettlementWriterOptions>;
}

type RuntimeMode = "memory" | "supabase" | "http" | "custom";

function resolveRepositoryBackend(
  repository: unknown,
  inMemoryCtor: abstract new (...args: any[]) => unknown,
  supabaseCtor: abstract new (...args: any[]) => unknown,
): RuntimeMode {
  if (repository instanceof inMemoryCtor) {
    return "memory";
  }

  if (repository instanceof supabaseCtor) {
    return "supabase";
  }

  return "custom";
}

function createPaymentOrderRepository(): PaymentOrderRepository {
  const supabaseUrl = env.get("SUPABASE_URL");
  const serviceRoleKey = env.get("SUPABASE_SERVICE_ROLE_KEY") || env.get("SUPABASE_SECRET_KEY");

  if (supabaseUrl && serviceRoleKey) {
    paymentLogger.info("Using Supabase payment order repository", {
      hasSupabaseUrl: true,
      hasServiceRoleKey: true,
    });
    return new SupabasePaymentOrderRepository({
      supabaseUrl,
      serviceRoleKey,
    });
  }

  paymentLogger.warn("Falling back to in-memory payment order repository", {
    hasSupabaseUrl: Boolean(supabaseUrl),
    hasServiceRoleKey: Boolean(serviceRoleKey),
  });
  return new InMemoryPaymentOrderRepository();
}

function createPaymentCreditAmountResolver(): PaymentCreditAmountResolver {
  return new SupabasePaymentCreditAmountResolver({
    supabaseUrl: env.get("SUPABASE_URL"),
    serviceRoleKey: env.get("SUPABASE_SERVICE_ROLE_KEY") || env.get("SUPABASE_SECRET_KEY"),
  });
}

export function createPaymentSidecarServer(
  port = Number(process.env.PAYMENT_SIDECAR_PORT || process.env.PORT || 8080),
  options: PaymentSidecarServerOptions = {},
) {
  const supabaseUrl = env.get("SUPABASE_URL");
  const serviceRoleKey = env.get("SUPABASE_SERVICE_ROLE_KEY") || env.get("SUPABASE_SECRET_KEY");
  const configuredKkApiBaseUrl =
    options.settlementWriterOptions?.baseUrl
    || process.env.KK_API_BASE_URL
    || "http://127.0.0.1:3001";
  const configuredInternalToken =
    options.settlementWriterOptions?.internalToken
    || process.env.PAYMENT_SIDECAR_INTERNAL_TOKEN
    || "";
  const repository = options.paymentOrderRepository || createPaymentOrderRepository();
  const creditAmountResolver = options.creditAmountResolver || createPaymentCreditAmountResolver();
  const settlementWriter = new HttpMainApiSettlementWriter({
    baseUrl: configuredKkApiBaseUrl,
    internalToken: configuredInternalToken,
    fetchImpl: options.settlementWriterOptions?.fetchImpl,
  });
  const service = new PaymentService(repository, settlementWriter, creditAmountResolver);
  const requestAuthenticator = options.requestAuthenticator || createRequestAuthenticator({
    resolveLegacyAccessToken: options.resolveAccessToken,
    supabaseUrl,
    supabaseAuthKey: resolveSupabaseAuthKey(),
  });
  const repositoryModes = {
    paymentOrders: resolveRepositoryBackend(
      repository,
      InMemoryPaymentOrderRepository,
      SupabasePaymentOrderRepository,
    ),
    creditAmountResolver:
      options.creditAmountResolver
        ? "custom"
        : (supabaseUrl && serviceRoleKey ? "supabase" : "memory"),
    settlementWriter:
      options.settlementWriterOptions?.fetchImpl
        ? "custom"
        : configuredInternalToken
          ? "http"
          : "memory",
  } as const;
  const hasPersistentPaymentRepository = repositoryModes.paymentOrders === "supabase";
  const hasSupabaseCreditAmountResolver = Boolean(!options.creditAmountResolver && supabaseUrl && serviceRoleKey);
  const hasSettlementWriteback = Boolean(configuredKkApiBaseUrl && configuredInternalToken);

  const server = createServer((req, res) => {
    void (async () => {
      const headers = stripAuthenticatedHeaders(normalizeHeaders(req));
      const requestId = headers["x-request-id"] || randomUUID();
      const clientVersion = headers["x-client-version"];
      const url = new URL(req.url || "/", "http://localhost");
      const pathname = url.pathname;

      try {
        const authenticatedUser = await requestAuthenticator.authenticate(headers);
        const requestHeaders = authenticatedUser
          ? applyAuthenticatedHeaders(headers, authenticatedUser)
          : headers;
        const origin = buildRequestOrigin(req, requestHeaders);

        if (pathname === "/healthz") {
          writeBody(res, 200, {
            success: true,
            data: {
              service: "kk-studio-payment-sidecar",
              status: "ok",
              config: {
                hasSupabaseUrl: Boolean(supabaseUrl),
                hasServiceRoleKey: Boolean(serviceRoleKey),
                hasKkApiBaseUrl: Boolean(configuredKkApiBaseUrl),
                hasInternalToken: Boolean(configuredInternalToken),
                kkApiBaseUrl: configuredKkApiBaseUrl,
              },
              repositories: repositoryModes,
              persistence: {
                paymentOrders: hasPersistentPaymentRepository,
                paymentCallbacks: hasPersistentPaymentRepository,
                settlementWriteback: hasSettlementWriteback,
                creditExchangeRates: hasSupabaseCreditAmountResolver,
              },
            },
            meta: buildErrorMeta(requestId, clientVersion),
          });
          return;
        }

        if (pathname === "/payment/manifest") {
          writeBody(res, 200, buildPaymentManifest(requestId, clientVersion));
          return;
        }

        if (req.method === "POST" && pathname === "/payment/v1/orders") {
          const body = await readJsonBody(req);
          const result = await handleCreatePaymentOrder(service, body, requestHeaders, origin);
          if (result.redirectTo) {
            writeRedirect(res, result.redirectTo);
            return;
          }

          writeBody(res, result.statusCode, result.body ?? "", result.contentType);
          return;
        }

        if (
          req.method === "POST"
          && (
            pathname === "/payment/v1/callbacks/alipay"
            || pathname === "/api/pay/notify/alipay"
          )
        ) {
          const body = await readJsonBody(req);
          const result = await handleAlipayCallback(service, body, requestHeaders);
          if (result.redirectTo) {
            writeRedirect(res, result.redirectTo);
            return;
          }

          writeBody(res, result.statusCode, result.body ?? "", result.contentType);
          return;
        }

        const checkoutMatch = pathname.match(/^\/payment\/v1\/orders\/([^/]+)\/checkout$/);
        if (req.method === "GET" && checkoutMatch) {
          const result = await handleCheckoutPage(service, decodeURIComponent(checkoutMatch[1]));
          writeBody(res, result.statusCode, result.body ?? "", result.contentType);
          return;
        }

        const paymentOrderStatusMatch = pathname.match(/^\/payment\/v1\/orders\/([^/]+)\/status$/);
        if (req.method === "GET" && paymentOrderStatusMatch) {
          const result = await handleGetPaymentOrderStatus(service, decodeURIComponent(paymentOrderStatusMatch[1]), requestHeaders);
          if (result.redirectTo) {
            writeRedirect(res, result.redirectTo);
            return;
          }

          writeBody(res, result.statusCode, result.body ?? "", result.contentType);
          return;
        }

        const checkoutCompleteMatch = pathname.match(/^\/payment\/v1\/orders\/([^/]+)\/complete$/);
        if (req.method === "POST" && checkoutCompleteMatch) {
          const result = await handleCheckoutComplete(service, decodeURIComponent(checkoutCompleteMatch[1]), requestHeaders);
          if (result.redirectTo) {
            writeRedirect(res, result.redirectTo);
            return;
          }

          writeBody(res, result.statusCode, result.body ?? "", result.contentType);
          return;
        }

        if (req.method === "GET" && pathname === "/api/pay/qrcode") {
          const result = await handleLegacyCreateQrCode(service, url.searchParams, requestHeaders, origin);
          if (result.redirectTo) {
            writeRedirect(res, result.redirectTo);
            return;
          }

          writeBody(res, result.statusCode, result.body ?? "", result.contentType);
          return;
        }

        if (req.method === "GET" && pathname === "/api/pay/status") {
          const result = await handleLegacyGetStatus(service, url.searchParams, requestHeaders);
          writeBody(res, result.statusCode, result.body ?? "", result.contentType);
          return;
        }

        if (req.method === "GET" && pathname === "/api/pay") {
          const result = await handleLegacyRedirect(service, url.searchParams, requestHeaders, origin);
          if (result.redirectTo) {
            writeRedirect(res, result.redirectTo);
            return;
          }

          writeBody(res, result.statusCode, result.body ?? "", result.contentType);
          return;
        }

        writeBody(res, 404, {
          success: false,
          error: {
            code: "ROUTE_NOT_FOUND",
            message: "The requested route is not registered in the payment sidecar.",
            details: [{ method: req.method, url: req.url }],
          },
          meta: buildErrorMeta(requestId, clientVersion),
        });
      } catch (error: any) {
        if (error instanceof JsonBodyParseError) {
          writeBody(res, 400, {
            success: false,
            error: {
              code: error.code,
              message: error.message,
            },
            meta: buildErrorMeta(requestId, clientVersion),
          });
          return;
        }

        writeBody(res, 500, {
          success: false,
          error: {
            code: "PAYMENT_SIDECAR_ERROR",
            message: error?.message || "Unexpected payment sidecar error.",
          },
          meta: buildErrorMeta(requestId, clientVersion),
        });
      }
    })();
  });

  server.listen(port, () => {
    paymentLogger.info("Payment sidecar server started", { port });
  });

  return server;
}

if (process.env.RUN_PAYMENT_SIDECAR === "true") {
  createPaymentSidecarServer();
}
