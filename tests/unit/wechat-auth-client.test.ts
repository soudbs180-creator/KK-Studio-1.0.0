import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, test } from "node:test";

import {
  parseWechatAuthorizationUrl,
  resolveWechatStartErrorMessage,
} from "../../apps/web/src/services/auth/wechatAuthUtils.ts";

const ROOT_DIR = process.cwd();

function readSource(relativePath: string): string {
  return readFileSync(path.join(ROOT_DIR, relativePath), "utf-8");
}

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
        "WeChat auth function secrets are missing.",
      ),
      /KK API/,
    );
  });

  test("maps missing edge function connectivity to a localized hint", () => {
    assert.match(
      resolveWechatStartErrorMessage(
        "EDGE_FUNCTION_UNAVAILABLE",
        "Failed to invoke the wechat-auth Edge Function.",
      ),
      /KK API/,
    );
  });

  test("routes WeChat auth through the KK API client instead of direct Supabase Edge calls", () => {
    const serviceSource = readSource("src/services/auth/wechatAuth.ts");

    assert.match(serviceSource, /await kkWebApiClient\.startWechatLogin\(redirectTo\)/);
    assert.match(serviceSource, /await kkWebApiClient\.startWechatBind\(redirectTo\)/);
    assert.doesNotMatch(serviceSource, /supabase\.functions\.invoke\("wechat-auth"/);
    assert.doesNotMatch(serviceSource, /shouldUseLegacyWebApiFallback/);
  });
});
