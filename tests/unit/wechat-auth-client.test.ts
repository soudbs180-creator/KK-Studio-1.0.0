import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, test } from "node:test";

import {
  parseWechatAuthorizationUrl,
  resolveWechatStartErrorMessage,
} from "../../src/services/auth/wechatAuthUtils.ts";

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
      /Supabase Edge Function/,
    );
  });

  test("maps missing edge function connectivity to a localized hint", () => {
    assert.match(
      resolveWechatStartErrorMessage(
        "EDGE_FUNCTION_UNAVAILABLE",
        "Failed to invoke the wechat-auth Edge Function.",
      ),
      /wechat-auth/i,
    );
  });

  test("prefers Supabase Edge Functions and only falls back to legacy API behind the local runtime guard", () => {
    const serviceSource = readSource("src/services/auth/wechatAuth.ts");
    const functionSource = readSource("supabase/functions/wechat-auth/index.ts");
    const packageSource = readSource("package.json");
    const workflowSource = readSource(".github/workflows/cloud-auto-deploy.yml");

    assert.match(serviceSource, /supabase\.functions\.invoke\("wechat-auth"/);
    assert.match(serviceSource, /shouldUseLegacyWebApiFallback\(\) && shouldFallbackToLegacyWechat\(resolvedEdgeError\)/);
    assert.match(functionSource, /Deno\.serve/);
    assert.match(functionSource, /WECHAT_OPEN_REDIRECT_URI/);
    assert.match(functionSource, /auth\.admin\.generateLink/);
    assert.match(functionSource, /appendQueryParams\(state\.redirectTo, \{\s*wechat_bind: 'success'/);
    assert.match(packageSource, /"supabase:functions:deploy:wechat-auth"\s*:\s*"npx supabase functions deploy wechat-auth --no-verify-jwt"/);
    assert.match(workflowSource, /Deploy wechat-auth Edge Function/);
    assert.match(workflowSource, /supabase functions deploy wechat-auth --no-verify-jwt/);
  });
});
