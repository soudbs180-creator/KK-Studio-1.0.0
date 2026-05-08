import assert from "node:assert/strict";
import { afterEach, test } from "node:test";

import { proxyToVps } from "../../api/_vpsProxy.ts";

const originalFetch = globalThis.fetch;
const originalVpsApiBaseUrl = process.env.KK_VPS_API_BASE_URL;

afterEach(() => {
  globalThis.fetch = originalFetch;
  if (typeof originalVpsApiBaseUrl === "string") {
    process.env.KK_VPS_API_BASE_URL = originalVpsApiBaseUrl;
  } else {
    delete process.env.KK_VPS_API_BASE_URL;
  }
});

test("Vercel VPS proxy preserves API requests while stripping the public Host header", async () => {
  let observedUrl = "";
  let observedInit: RequestInit | undefined;

  process.env.KK_VPS_API_BASE_URL = "http://172.245.156.16";
  globalThis.fetch = async (input, init) => {
    observedUrl = String(input);
    observedInit = init;
    return new Response(JSON.stringify({ success: false, error: { code: "AUTH_REQUIRED" } }), {
      status: 401,
      headers: { "content-type": "application/json" },
    });
  };

  const response = await proxyToVps(
    new Request("https://kkai.plus/api/v1/model-proxy/user?trace=1", {
      method: "POST",
      headers: {
        authorization: "Bearer access-token",
        "content-type": "application/json",
        host: "kkai.plus",
        "x-forwarded-host": "kkai.plus",
      },
      body: JSON.stringify({ routeId: "google-route" }),
    }),
    "/api/v1/model-proxy/user",
  );

  assert.equal(observedUrl, "http://172.245.156.16/api/v1/model-proxy/user?trace=1");
  assert.equal(observedInit?.method, "POST");
  assert.equal(response.status, 401);

  const headers = observedInit?.headers as Headers;
  assert.equal(headers.get("authorization"), "Bearer access-token");
  assert.equal(headers.get("content-type"), "application/json");
  assert.equal(headers.get("host"), null);
  assert.equal(headers.get("x-forwarded-host"), "172.245.156.16");
  assert.equal(headers.get("x-forwarded-proto"), "http");
  assert.equal(new TextDecoder().decode(observedInit?.body as ArrayBuffer), '{"routeId":"google-route"}');
});
