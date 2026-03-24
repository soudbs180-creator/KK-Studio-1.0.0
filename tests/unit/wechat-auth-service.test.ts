import assert from "node:assert/strict";
import { describe, test } from "node:test";

import { WechatAuthService } from "../../apps/api/src/modules/auth/application/wechat-auth-service.ts";

function createService(overrides: Partial<ConstructorParameters<typeof WechatAuthService>[0]> = {}) {
  return new WechatAuthService({
    repository: {} as any,
    providerAppId: "wx-open-app-id",
    providerSecret: "wx-open-secret",
    callbackUrl: "https://api.example.com/api/v1/auth/wechat/callback",
    stateSigningSecret: "wechat-state-signing-secret",
    allowedRedirectOrigins: ["https://app.example.com"],
    ...overrides,
  });
}

describe("wechat auth service", () => {
  test("rejects redirect targets outside the allowlist", () => {
    const service = createService();

    assert.throws(() => {
      service.start({
        mode: "login",
        redirectTo: "https://evil.example.com/auth/callback",
      });
    }, /redirectTo origin is not allowed/i);
  });

  test("redirects invalid callback state to the trusted callback URL", async () => {
    const service = createService();

    const result = await service.handleCallback({
      code: "wechat-code",
      state: "broken-state",
    });

    assert.equal(
      result.redirectTo,
      "https://app.example.com/auth/callback?error=wechat_state_invalid&error_description=Invalid+WeChat+state+format.",
    );
  });
});
