import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { afterEach, describe, test } from "node:test";

const require = createRequire(import.meta.url);
const Module = require("node:module");

const trackedEnvKeys = [
  "PORT",
  "PAYMENT_SIDECAR_INTERNAL_TOKEN",
  "KK_API_BASE_URL",
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
  } = {
    statusCode: 200,
    body: undefined,
  };

  const res = {
    status(statusCode: number) {
      response.statusCode = statusCode;
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
  };

  return { response, res };
}

afterEach(() => {
  restoreTrackedEnv();
});

describe("payment webhook raw body handling", () => {
  test("payment-server json parser captures the raw body for webhook signature verification", () => {
    const originalModuleLoad = Module._load;
    let jsonOptions: { verify?: (req: Record<string, unknown>, res: unknown, buf: Buffer) => void } | undefined;

    const app = {
      disable() {},
      use() {},
      get() { return app; },
      listen(_port: number, callback?: () => void) {
        callback?.();
        return { close() {} };
      },
    };

    const expressStub = () => app;
    expressStub.json = (options?: typeof jsonOptions) => {
      jsonOptions = options;
      return () => undefined;
    };
    expressStub.static = () => () => undefined;
    expressStub.urlencoded = () => () => undefined;
    expressStub.Router = () => {
      return {
        post() { return this; },
        use() { return this; },
        get() { return this; },
        put() { return this; },
        patch() { return this; },
        delete() { return this; },
        all() { return this; },
      };
    };

    class AlipaySdkStub {}

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
          handleLegacyCreateQrCodeThroughSidecar: async () => ({ statusCode: 200, body: {} }),
          handleLegacyGetStatusThroughSidecar: async () => ({ statusCode: 200, body: {} }),
          handleLegacyRedirectThroughSidecar: async () => ({ statusCode: 302, redirectTo: "https://pay.example.com", body: "" }),
        };
      }

      return originalModuleLoad.call(this, request, parent, isMain);
    };

    const modulePath = require.resolve("../../server/index.js");
    delete require.cache[modulePath];

    try {
      require(modulePath);
    } finally {
      Module._load = originalModuleLoad;
      delete require.cache[modulePath];
    }

    assert.equal(typeof jsonOptions?.verify, "function");

    const req: Record<string, unknown> = {};
    jsonOptions?.verify?.(req, {}, Buffer.from('{"wechat":"raw-body"}', "utf8"));
    assert.equal(req.rawBody, '{"wechat":"raw-body"}');
  });

  test.skip("wechat webhook verification prefers the captured raw body over re-serialized json (微信支付已下线，仅作归档)", async () => {
    restoreTrackedEnv();
    process.env.WECHATPAY_API_V3_KEY = "wechat-v3-key";
    process.env.WECHATPAY_APPID = "wx-app-id";
    process.env.WECHATPAY_MCHID = "wx-mch-id";
    process.env.WECHATPAY_PUBLIC_CERT = "wechat-public-cert";
    process.env.WECHATPAY_PRIVATE_KEY = "wechat-private-key";

    const originalModuleLoad = Module._load;
    const verifyCalls: Array<Record<string, unknown>> = [];
    const routeHandlers = new Map<string, (req: any, res: any) => Promise<unknown>>();

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
        return {
          WxPay: class {
            verifySign(input: Record<string, unknown>) {
              verifyCalls.push(input);
              return true;
            }

            decipher_gcm() {
              return {
                trade_state: "NOTPAY",
              };
            }
          },
        };
      }

      return originalModuleLoad.call(this, request, parent, isMain);
    };

    const modulePath = require.resolve("../../server/routes/webhook.js");
    delete require.cache[modulePath];

    try {
      require(modulePath);

      const wechatHandler = routeHandlers.get("/wechat");
      assert.ok(wechatHandler, "expected /wechat webhook handler");

      const rawBody = '{"resource":{"ciphertext":"cipher","associated_data":"assoc","nonce":"nonce"},"meta":{"spacing":"kept"}}';
      const { response, res } = createResponseRecorder();

      await wechatHandler?.({
        rawBody,
        body: {
          meta: {
            spacing: "kept",
          },
          resource: {
            associated_data: "assoc",
            ciphertext: "cipher",
            nonce: "nonce",
          },
        },
        headers: {
          "wechatpay-signature": "test-signature",
          "wechatpay-timestamp": "1710000000",
          "wechatpay-nonce": "nonce-token",
          "wechatpay-serial": "serial-token",
        },
      }, res);

      assert.equal(response.statusCode, 200);
      assert.deepEqual(response.body, { code: "SUCCESS", message: "ignored" });
      assert.equal(verifyCalls.length, 1);
      assert.equal(verifyCalls[0]?.body, rawBody);
    } finally {
      Module._load = originalModuleLoad;
      delete require.cache[modulePath];
    }
  });
});
