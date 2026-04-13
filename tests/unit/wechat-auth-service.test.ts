import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, test } from "node:test";

import { WechatAuthService } from "../../apps/api/src/modules/auth/application/wechat-auth-service.ts";

const originalConsoleWarn = console.warn;
const originalConsoleError = console.error;

async function withMutedWechatLogs<T>(callback: () => Promise<T>): Promise<T> {
  const originalWarn = console.warn;
  const originalError = console.error;
  console.warn = () => undefined;
  console.error = () => undefined;
  try {
    return await callback();
  } finally {
    console.warn = originalWarn;
    console.error = originalError;
  }
}

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

function createWechatFetchStub() {
  return async (url: string) => {
    if (url.includes("/sns/oauth2/access_token")) {
      return {
        ok: true,
        json: async () => ({
          access_token: "wechat-access-token",
          openid: "wechat-open-id",
          unionid: "wechat-union-id",
        }),
      } as Response;
    }

    if (url.includes("/sns/userinfo")) {
      return {
        ok: true,
        json: async () => ({
          openid: "wechat-open-id",
          unionid: "wechat-union-id",
          nickname: "KK Wechat User",
          headimgurl: "https://cdn.example.com/avatar.png",
        }),
      } as Response;
    }

    throw new Error(`Unexpected WeChat request: ${url}`);
  };
}

beforeEach(() => {
  console.warn = () => undefined;
  console.error = () => undefined;
});

afterEach(() => {
  console.warn = originalConsoleWarn;
  console.error = originalConsoleError;
});

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
    await withMutedWechatLogs(async () => {
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

  test("keeps the same user id when binding a WeChat account", async () => {
    const targetUserId = "11111111-1111-1111-1111-111111111111";
    const syncCalls: Array<Record<string, unknown>> = [];
    const identityCalls: Array<Record<string, unknown>> = [];

    const service = createService({
      fetchImpl: createWechatFetchStub(),
      repository: {
        resolveWechatIdentity: async () => ({ resolved: undefined }),
        findProviderIdentityForUser: async () => undefined,
        getUserById: async (userId: string) => ({
          id: userId,
          email: "owner@example.com",
          user_metadata: {},
        }),
        syncWechatProfile: async (input: Record<string, unknown>) => {
          syncCalls.push(input);
        },
        upsertWechatIdentity: async (input: Record<string, unknown>) => {
          identityCalls.push(input);
        },
      } as any,
    });

    const start = service.start({
      mode: "bind",
      redirectTo: "https://app.example.com/auth/callback",
      userId: targetUserId,
    });

    const result = await service.handleCallback({
      code: "wechat-auth-code",
      state: start.state,
    });

    assert.equal(
      result.redirectTo,
      "https://app.example.com/auth/callback?wechat_bind=success",
    );
    assert.equal(syncCalls.length, 1);
    assert.equal(identityCalls.length, 1);
    assert.equal(syncCalls[0]?.userId, targetUserId);
    assert.equal(identityCalls[0]?.userId, targetUserId);
  });

  test("rejects binding a WeChat account that already belongs to another user", async () => {
    await withMutedWechatLogs(async () => {
      const service = createService({
        fetchImpl: createWechatFetchStub(),
        repository: {
          resolveWechatIdentity: async () => ({
            resolved: {
              id: "external-identity-id",
              user_id: "22222222-2222-2222-2222-222222222222",
              provider: "wechat",
              provider_appid: "wx-open-app-id",
              provider_unionid: "wechat-union-id",
              provider_openid: "wechat-open-id",
              nickname: "Bound User",
              avatar_url: "https://cdn.example.com/bound-user.png",
              raw_profile: {},
              last_login_at: null,
              created_at: "2026-03-24T00:00:00.000Z",
              updated_at: "2026-03-24T00:00:00.000Z",
            },
          }),
        } as any,
      });

      const start = service.start({
        mode: "bind",
        redirectTo: "https://app.example.com/auth/callback",
        userId: "11111111-1111-1111-1111-111111111111",
      });

      const result = await service.handleCallback({
        code: "wechat-auth-code",
        state: start.state,
      });

      assert.ok(result.redirectTo);
      const redirectUrl = new URL(result.redirectTo!);
      assert.equal(redirectUrl.searchParams.get("error"), "wechat_login_failed");
      assert.equal(
        redirectUrl.searchParams.get("error_description"),
        "This WeChat account is already linked to a different KK Studio user.",
      );
    });
  });
});
