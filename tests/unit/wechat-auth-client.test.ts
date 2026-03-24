import assert from "node:assert/strict";
import { describe, test } from "node:test";

import {
  parseWechatAuthorizationUrl,
  resolveWechatStartErrorMessage,
} from "../../src/services/auth/wechatAuthUtils.ts";

describe("wechat auth client helpers", () => {
  test("extracts widget params from the official WeChat qrconnect url", () => {
    const parsed = parseWechatAuthorizationUrl(
      "https://open.weixin.qq.com/connect/qrconnect?appid=wx1234567890&redirect_uri=https%3A%2F%2Fapp.example.com%2Fauth%2Fcallback&response_type=code&scope=snsapi_login&state=state-123&lang=en#wechat_redirect",
    );

    assert.deepEqual(parsed, {
      appId: "wx1234567890",
      redirectUri: "https://app.example.com/auth/callback",
      scope: "snsapi_login",
      state: "state-123",
      language: "en",
    });
  });

  test("rejects non-WeChat authorization urls", () => {
    assert.equal(
      parseWechatAuthorizationUrl("https://example.com/connect/qrconnect?appid=wx123"),
      null,
    );
  });

  test("maps unavailable service errors to a localized setup hint", () => {
    assert.match(
      resolveWechatStartErrorMessage(
        "WECHAT_AUTH_UNAVAILABLE",
        "WeChat login is not configured on the API server.",
      ),
      /微信扫码登录尚未在 API 服务端完成配置/u,
    );
  });

  test("maps invalid html payloads to a localized proxy hint", () => {
    assert.match(
      resolveWechatStartErrorMessage(
        "INVALID_RESPONSE_PAYLOAD",
        "KK API returned an HTML page instead of the expected JSON payload.",
      ),
      /返回了网页而不是 JSON/u,
    );
  });
});
