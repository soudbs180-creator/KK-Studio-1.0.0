import assert from "node:assert/strict";
import { afterEach, describe, test } from "node:test";

import {
  getDocumentLanguage,
  localizeUserFacingText,
  pickByResolvedLanguage,
} from "../../src/utils/localeText.ts";
import { resolveWechatStartErrorMessage } from "../../src/services/auth/wechatAuthUtils.ts";

type MockDocument = {
  documentElement: {
    lang?: string;
    dataset: {
      language?: string;
    };
  };
};

type MockWindow = {
  localStorage: {
    getItem: (key: string) => string | null;
  };
};

const globalLike = globalThis as typeof globalThis & {
  document?: MockDocument;
  window?: MockWindow;
};

const originalDocument = globalLike.document;
const originalWindow = globalLike.window;

function setMockLanguageEnvironment(options: {
  htmlLang?: string;
  documentLanguage?: string;
  storedLanguage?: string | null;
}) {
  globalLike.document = {
    documentElement: {
      lang: options.htmlLang,
      dataset: {
        language: options.documentLanguage,
      },
    },
  };

  globalLike.window = {
    localStorage: {
      getItem: (key: string) => {
        if (key !== "kk_language") {
          return null;
        }
        return options.storedLanguage ?? null;
      },
    },
  };
}

afterEach(() => {
  globalLike.document = originalDocument;
  globalLike.window = originalWindow;
});

describe("locale text helpers", () => {
  test("prefers the stored app language over the static html lang before providers mount", () => {
    setMockLanguageEnvironment({
      htmlLang: "zh-CN",
      storedLanguage: "en-US",
    });

    assert.equal(getDocumentLanguage(), "en-US");
  });

  test("still allows the document dataset language to override the stored language", () => {
    setMockLanguageEnvironment({
      htmlLang: "zh-CN",
      documentLanguage: "en-US",
      storedLanguage: "zh-CN",
    });

    assert.equal(getDocumentLanguage(), "en-US");
    assert.equal(pickByResolvedLanguage(getDocumentLanguage(), "中文", "English"), "English");
  });

  test("falls back to the plain html lang when no app language has been stored yet", () => {
    setMockLanguageEnvironment({
      htmlLang: "en-US",
      storedLanguage: null,
    });

    assert.equal(getDocumentLanguage(), "en-US");
  });
});

describe("auth-facing localization helpers", () => {
  test("returns the WeChat startup hint in English when English mode is active", () => {
    const message = (resolveWechatStartErrorMessage as unknown as (
      code: string | undefined,
      detail: string | undefined,
      language: "zh-CN" | "en-US",
    ) => string)(
      "EDGE_FUNCTION_UNAVAILABLE",
      "Failed to invoke the wechat-auth Edge Function.",
      "en-US",
    );

    assert.match(message, /WeChat/i);
    assert.doesNotMatch(message, /微信/);
  });

  test("maps login and Turnstile messages through the shared auth localization module", async () => {
    const authLocalization = await import("../../src/components/auth/authLocalization.ts");

    assert.equal(
      authLocalization.mapAuthErrorMessage("en-US", new Error("Invalid login credentials"), "login"),
      "Incorrect email or password.",
    );
    assert.match(
      authLocalization.getTurnstileMissingSiteKeyMessage("en-US"),
      /Turnstile/i,
    );
    assert.equal(
      authLocalization.mapTurnstileErrorMessage("en-US", "400070"),
      "The current Turnstile site key has been disabled. Check the widget status in Cloudflare.",
    );
  });

  test("localizeUserFacingText translates common notification strings to English when English mode is active", () => {
    setMockLanguageEnvironment({
      htmlLang: "zh-CN",
      storedLanguage: "en-US",
    });

    assert.equal(localizeUserFacingText("请先登录"), "Sign in required");
    assert.equal(localizeUserFacingText("生成失败"), "Generation failed");
    assert.equal(
      localizeUserFacingText("您的账户余额不足，请先充值积分。"),
      "Your balance is too low. Please top up your credits first.",
    );
    assert.equal(
      localizeUserFacingText("已导出 3 页整屏长图"),
      "Exported 3 full-page images",
    );
    assert.equal(
      localizeUserFacingText("已到账 25 积分"),
      "25 credits have been added to your balance",
    );
    assert.equal(
      localizeUserFacingText("最多支持 5 张参考图"),
      "Up to 5 reference images are supported",
    );
    assert.equal(
      localizeUserFacingText("使用当前配置需要 20 积分，当前余额: 8， 请充值。".replace("， ", "，")),
      "This configuration needs 20 credits. Current balance: 8. Please top up.",
    );
  });
});
