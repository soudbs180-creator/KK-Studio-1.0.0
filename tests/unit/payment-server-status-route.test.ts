import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { describe, test } from "node:test";

const require = createRequire(import.meta.url);
const Module = require("node:module");

type LegacyStatusRouteResult = {
  statusCode: number;
  contentType?: string;
  body: unknown;
};

type RouteHarnessOptions = {
  sidecarResult?: LegacyStatusRouteResult;
  sidecarError?: Error;
};

type RouteResponse = {
  statusCode: number;
  body: unknown;
  contentType?: string;
};

function createResponseRecorder(): {
  response: RouteResponse;
  res: {
    status: (statusCode: number) => unknown;
    json: (body: unknown) => unknown;
    type: (contentType: string) => unknown;
    send: (body: unknown) => unknown;
    redirect: (statusCode: number, location: string) => unknown;
  };
} {
  const response: RouteResponse = {
    statusCode: 200,
    body: undefined,
    contentType: undefined,
  };

  const res = {
    status(statusCode: number) {
      response.statusCode = statusCode;
      return res;
    },
    json(body: unknown) {
      response.body = body;
      response.contentType = "application/json; charset=utf-8";
      return res;
    },
    type(contentType: string) {
      response.contentType = contentType;
      return res;
    },
    send(body: unknown) {
      response.body = body;
      return res;
    },
    redirect(statusCode: number, location: string) {
      response.statusCode = statusCode;
      response.body = location;
      return res;
    },
  };

  return { response, res };
}

function loadStatusRouteHarness(options: RouteHarnessOptions = {}) {
  const originalModuleLoad = Module._load;
  const originalConsoleWarn = console.warn;
  const originalConsoleError = console.error;
  const originalConsoleLog = console.log;
  const originalEnv = {
    PORT: process.env.PORT,
    PAYMENT_SIDECAR_INTERNAL_TOKEN: process.env.PAYMENT_SIDECAR_INTERNAL_TOKEN,
    KK_API_BASE_URL: process.env.KK_API_BASE_URL,
  };

  process.env.PORT = "0";
  process.env.PAYMENT_SIDECAR_INTERNAL_TOKEN = "test-internal-token";
  process.env.KK_API_BASE_URL = "https://api.kk.local";

  const routeHandlers = new Map<string, (req: any, res: any) => Promise<unknown>>();
  const alipayExecCalls: Array<{ method: string; params: unknown }> = [];

  const app = {
    disable() {},
    use() {},
    get(path: string, handler: (req: any, res: any) => Promise<unknown>) {
      routeHandlers.set(path, handler);
      return app;
    },
    listen(_port: number, callback?: () => void) {
      callback?.();
      return {
        close() {},
      };
    },
  };

  const expressStub = () => app;
  expressStub.json = () => () => undefined;
  expressStub.urlencoded = () => () => undefined;

  class AlipaySdkStub {
    exec(method: string, params: unknown) {
      alipayExecCalls.push({ method, params });
      return Promise.resolve({
        tradeStatus: "TRADE_SUCCESS",
      });
    }
  }

  Module._load = function patchedModuleLoad(request: string, parent: unknown, isMain: boolean) {
    if (request === "dotenv") {
      return { config() {} };
    }

    if (request === "express") {
      return expressStub;
    }

    if (request === "cors") {
      return () => (_req: unknown, _res: unknown, next: () => void) => next?.();
    }

    if (request === "alipay-sdk") {
      return { AlipaySdk: AlipaySdkStub };
    }

    if (request === "./webhook") {
      return {};
    }

    if (request === "./sidecar_compat_bridge") {
      return {
        handleLegacyCreateQrCodeThroughSidecar: async () => ({
          statusCode: 200,
          body: { ok: true },
        }),
        handleLegacyRedirectThroughSidecar: async () => ({
          statusCode: 302,
          redirectTo: "https://pay.kk.local",
          body: "",
        }),
        handleLegacyGetStatusThroughSidecar: async () => {
          if (options.sidecarError) {
            throw options.sidecarError;
          }

          return options.sidecarResult ?? {
            statusCode: 200,
            body: {
              tradeStatus: "WAITING",
              source: "sidecar-test",
            },
          };
        },
      };
    }

    return originalModuleLoad.call(this, request, parent, isMain);
  };

  console.warn = () => undefined;
  console.error = () => undefined;
  console.log = () => undefined;

  const modulePath = require.resolve("../../payment-server/index.js");
  delete require.cache[modulePath];

  try {
    require(modulePath);
  } finally {
    Module._load = originalModuleLoad;
    console.warn = originalConsoleWarn;
    console.error = originalConsoleError;
    console.log = originalConsoleLog;

    for (const [key, value] of Object.entries(originalEnv)) {
      if (typeof value === "string") {
        process.env[key] = value;
      } else {
        delete process.env[key];
      }
    }

    delete require.cache[modulePath];
  }

  const statusHandler = routeHandlers.get("/api/pay/status");
  assert.ok(statusHandler, "expected /api/pay/status handler to be registered");

  return {
    statusHandler,
    alipayExecCalls,
  };
}

describe.skip("payment-server status route", () => {
  test("returns sidecar WAITING status without falling back to direct Alipay queries", async () => {
    const sidecarPayload = {
      tradeStatus: "WAITING",
      merchantOrderNo: "ORDER_WAITING",
      settlementApplied: false,
    };
    const { statusHandler, alipayExecCalls } = loadStatusRouteHarness({
      sidecarResult: {
        statusCode: 200,
        body: sidecarPayload,
      },
    });
    const { response, res } = createResponseRecorder();

    await statusHandler({
      query: {
        outTradeNo: "ORDER_WAITING",
      },
      headers: {},
    }, res);

    assert.equal(response.statusCode, 200);
    assert.deepEqual(response.body, sidecarPayload);
    assert.equal(alipayExecCalls.length, 0);
  });

  test("fails closed when the sidecar status bridge throws instead of querying Alipay directly", async () => {
    const { statusHandler, alipayExecCalls } = loadStatusRouteHarness({
      sidecarError: new Error("sidecar unavailable"),
    });
    const { response, res } = createResponseRecorder();
    const originalConsoleError = console.error;
    console.error = () => undefined;

    try {
      await statusHandler({
        query: {
          outTradeNo: "ORDER_SIDEcar_FAIL",
        },
        headers: {},
      }, res);
    } finally {
      console.error = originalConsoleError;
    }

    assert.equal(response.statusCode, 500);
    assert.deepEqual(response.body, {
      error: "sidecar unavailable",
    });
    assert.equal(alipayExecCalls.length, 0);
  });
});
