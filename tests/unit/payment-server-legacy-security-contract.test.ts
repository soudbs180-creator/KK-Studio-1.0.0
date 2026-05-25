import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { afterEach, describe, test } from "node:test";

const require = createRequire(import.meta.url);
const Module = require("node:module");

const trackedEnvKeys = [
  "PORT",
  "PAYMENT_RETURN_URL",
  "AP_RETURN_URL",
  "PAYMENT_NOTIFY_URL",
  "AP_NOTIFY_URL",
  "WECHATPAY_API_V3_KEY",
  "WECHATPAY_APPID",
  "WECHATPAY_MCHID",
  "WECHATPAY_PUBLIC_CERT",
  "WECHATPAY_PRIVATE_KEY",
] as const;

const originalEnv = new Map(trackedEnvKeys.map((key) => [key, process.env[key]]));

function restoreTrackedEnv() {
  for (const key of trackedEnvKeys) {
    const originalValue = originalEnv.get(key);
    if (typeof originalValue === "string") {
      process.env[key] = originalValue;
    } else {
      delete process.env[key];
    }
  }
}

function createResponseRecorder() {
  const response: {
    statusCode: number;
    body: unknown;
    redirectedTo?: string;
  } = {
    statusCode: 200,
    body: undefined,
  };

  const res = {
    status(statusCode: number) {
      response.statusCode = statusCode;
      return res;
    },
    type() {
      return res;
    },
    send(body: unknown) {
      response.body = body;
      return res;
    },
    json(body: unknown) {
      response.body = body;
      return res;
    },
    redirect(statusCode: number, redirectTo: string) {
      response.statusCode = statusCode;
      response.redirectedTo = redirectTo;
      return res;
    },
  };

  return { response, res };
}

afterEach(() => {
  restoreTrackedEnv();
});

describe.skip("legacy payment-server security boundaries", () => {
  test("wechat webhook fails closed before loading the SDK when certificate config is incomplete", async () => {
    restoreTrackedEnv();
    process.env.WECHATPAY_API_V3_KEY = "wechat-v3-key";
    process.env.WECHATPAY_APPID = "wx-app-id";
    process.env.WECHATPAY_MCHID = "wx-mch-id";
    delete process.env.WECHATPAY_PUBLIC_CERT;
    delete process.env.WECHATPAY_PRIVATE_KEY;

    const originalModuleLoad = Module._load;
    const routeHandlers = new Map<string, (req: any, res: any) => Promise<unknown>>();
    let wechatSdkLoaded = false;

    const expressStub = {
      Router() {
        return {
          post(path: string, handler: (req: any, res: any) => Promise<unknown>) {
            routeHandlers.set(path, handler);
            return this;
          },
        };
      },
    };

    Module._load = function patchedModuleLoad(request: string, parent: unknown, isMain: boolean) {
      if (request === "dotenv") {
        return { config() {} };
      }

      if (request === "express") {
        return expressStub;
      }

      if (request === "alipay-sdk") {
        return { AlipaySdk: class {} };
      }

      if (request === "./sidecar_compat_bridge") {
        return {
          handleLegacyPaymentCallbackThroughSidecar: async () => ({ success: true }),
        };
      }

      if (request === "wechatpay-node-v3") {
        wechatSdkLoaded = true;
        return {
          WxPay: class {
            verifySign() {
              return true;
            }

            decipher_gcm() {
              return { trade_state: "NOTPAY" };
            }
          },
        };
      }

      return originalModuleLoad.call(this, request, parent, isMain);
    };

    const modulePath = require.resolve("../../payment-server/webhook.js");
    delete require.cache[modulePath];

    try {
      require(modulePath);

      const wechatHandler = routeHandlers.get("/wechat");
      assert.ok(wechatHandler, "expected /wechat webhook handler");

      const { response, res } = createResponseRecorder();
      await wechatHandler?.({
        body: {
          resource: {
            associated_data: "assoc",
            ciphertext: "cipher",
            nonce: "nonce",
          },
        },
        headers: {},
      }, res);

      assert.equal(response.statusCode, 500);
      assert.deepEqual(response.body, {
        code: "FAIL",
        message: "WECHATPAY_PUBLIC_CERT and WECHATPAY_PRIVATE_KEY missing",
      });
      assert.equal(wechatSdkLoaded, false);
    } finally {
      Module._load = originalModuleLoad;
      delete require.cache[modulePath];
    }
  });

  test("legacy payment URL defaults are derived from the current request origin", async () => {
    restoreTrackedEnv();
    delete process.env.PAYMENT_RETURN_URL;
    delete process.env.AP_RETURN_URL;
    delete process.env.PAYMENT_NOTIFY_URL;
    delete process.env.AP_NOTIFY_URL;

    const originalModuleLoad = Module._load;
    const routeHandlers = new Map<string, (req: any, res: any) => Promise<unknown>>();
    let capturedQuery: URLSearchParams | undefined;
    let capturedOrigin = "";

    const app = {
      disable() {},
      use() {
        return app;
      },
      get(path: string, handler?: (req: any, res: any) => Promise<unknown>) {
        if (typeof handler === "function") {
          routeHandlers.set(path, handler);
        }
        return app;
      },
      listen(_port: number, callback?: () => void) {
        callback?.();
        return { close() {} };
      },
    };

    const expressStub = () => app;
    expressStub.json = () => () => undefined;
    expressStub.urlencoded = () => () => undefined;

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
        return { AlipaySdk: class {} };
      }

      if (request === "./webhook") {
        return {};
      }

      if (request === "./sidecar_compat_bridge") {
        return {
          handleLegacyCreateQrCodeThroughSidecar: async (
            query: URLSearchParams,
            _headers: Record<string, unknown>,
            origin: string,
          ) => {
            capturedQuery = query;
            capturedOrigin = origin;
            return { statusCode: 200, body: { ok: true } };
          },
          handleLegacyGetStatusThroughSidecar: async () => ({ statusCode: 200, body: { ok: true } }),
          handleLegacyRedirectThroughSidecar: async () => ({ statusCode: 302, redirectTo: "https://pay.example.com", body: "" }),
        };
      }

      return originalModuleLoad.call(this, request, parent, isMain);
    };

    const modulePath = require.resolve("../../payment-server/index.js");
    delete require.cache[modulePath];

    try {
      require(modulePath);

      const qrcodeHandler = routeHandlers.get("/api/pay/qrcode");
      assert.ok(qrcodeHandler, "expected /api/pay/qrcode handler");

      const { response, res } = createResponseRecorder();
      await qrcodeHandler?.({
        query: {
          amount: "20",
          method: "alipay",
          userId: "legacy-user-1",
        },
        headers: {},
        protocol: "http",
        get(name: string) {
          return name.toLowerCase() === "host" ? "127.0.0.1:8080" : "";
        },
      }, res);

      assert.equal(response.statusCode, 200);
      assert.equal(capturedOrigin, "http://127.0.0.1:8080");
      assert.equal(capturedQuery?.get("returnUrl"), "http://127.0.0.1:8080/pay/success");
      assert.equal(capturedQuery?.get("notifyUrl"), "http://127.0.0.1:8080/api/pay/notify/alipay");
    } finally {
      Module._load = originalModuleLoad;
      delete require.cache[modulePath];
    }
  });
});
