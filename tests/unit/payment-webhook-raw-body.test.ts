import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { afterEach, describe, test } from "node:test";

const require = createRequire(import.meta.url);
const Module = require("node:module");

const trackedEnvKeys = [
  "PORT",
  "KK_API_BASE_URL",
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

afterEach(() => {
  restoreTrackedEnv();
});

describe("payment webhook raw body handling", () => {
  test("server json parser captures the raw body for Stripe webhook signature verification", () => {
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

      if (request === "stripe") {
        return () => ({
          webhooks: {
            constructEvent() {
              return {};
            },
          },
        });
      }

      return originalModuleLoad.call(this, request, parent, isMain);
    };

    const modulePath = require.resolve("../../services/api/index.js");
    delete require.cache[modulePath];

    try {
      require(modulePath);
    } finally {
      Module._load = originalModuleLoad;
      delete require.cache[modulePath];
    }

    assert.equal(typeof jsonOptions?.verify, "function");

    const req: Record<string, unknown> = {};
    jsonOptions?.verify?.(req, {}, Buffer.from('{"stripe":"raw-body"}', "utf8"));
    assert.equal(req.rawBody, '{"stripe":"raw-body"}');
  });
});
