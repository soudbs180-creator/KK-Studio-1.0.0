import assert from "node:assert/strict";
import { afterEach, describe, test } from "node:test";

import {
  getBrowserPreferredLanguage,
  getDocumentLanguage,
  getInitialAppLanguage,
  localizeUserFacingText,
  pickByResolvedLanguage,
} from "../../apps/web/src/utils/localeText.ts";
import { resolveWechatStartErrorMessage } from "../../apps/web/src/services/auth/wechatAuthUtils.ts";

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
  navigator?: {
    language?: string;
    languages?: string[];
  };
};

const globalLike = globalThis as any;

const originalDocument = globalLike.document;
const originalWindow = globalLike.window;

function setMockLanguageEnvironment(options: {
  htmlLang?: string;
  documentLanguage?: string;
  storedLanguage?: string | null;
  browserLanguage?: string;
  browserLanguages?: string[];
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
    navigator: {
      language: options.browserLanguage,
      languages: options.browserLanguages,
    },
  };
}

afterEach(() => {
  globalLike.document = originalDocument;
  globalLike.window = originalWindow;
});

describe("locale text helpers", () => {
  test("detects English as the initial app language from the browser when no language is stored", () => {
    setMockLanguageEnvironment({
      htmlLang: "zh-CN",
      storedLanguage: null,
      browserLanguages: ["en-US", "zh-CN"],
    });

    assert.equal(getBrowserPreferredLanguage(), "en-US");
    assert.equal(getInitialAppLanguage(), "en-US");
  });

  test("keeps Chinese as the default initial language for Chinese and non-English browsers", () => {
    setMockLanguageEnvironment({
      htmlLang: "zh-CN",
      storedLanguage: null,
      browserLanguages: ["zh-Hans-CN", "en-US"],
    });

    assert.equal(getBrowserPreferredLanguage(), "zh-CN");
    assert.equal(getInitialAppLanguage(), "zh-CN");

    setMockLanguageEnvironment({
      htmlLang: "zh-CN",
      storedLanguage: null,
      browserLanguages: ["fr-FR", "en-US"],
    });

    assert.equal(getBrowserPreferredLanguage(), "zh-CN");
    assert.equal(getInitialAppLanguage(), "zh-CN");
  });

  test("keeps a stored user language preference ahead of browser detection", () => {
    setMockLanguageEnvironment({
      htmlLang: "zh-CN",
      storedLanguage: "zh-CN",
      browserLanguages: ["en-US"],
    });

    assert.equal(getInitialAppLanguage(), "zh-CN");
  });

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
    const authLocalization = await import("../../apps/web/src/components/auth/authLocalization.ts");

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
    assert.equal(
      authLocalization.mapTurnstileErrorMessage(
        "zh-CN",
        "Turnstile 脚本加载失败，请检查浏览器是否拦截了 challenges.cloudflare.com。",
      ),
      "Turnstile 脚本加载失败，请检查浏览器是否拦截了 challenges.cloudflare.com。",
    );
    assert.equal(
      authLocalization.mapAuthErrorMessage("zh-CN", new Error("Incorrect email or password."), "login"),
      "邮箱或密码错误。",
    );
  });

  test("maps hosted password login failures to actionable Chinese copy", async () => {
    const authLocalization = await import("../../apps/web/src/components/auth/authLocalization.ts");

    assert.equal(
      authLocalization.mapAuthErrorMessage("zh-CN", new Error("AUTH_REQUIRED: Invalid email or password."), "login"),
      "邮箱或密码错误。",
    );
    assert.equal(
      authLocalization.mapAuthErrorMessage("zh-CN", new Error("Invalid email or password."), "login"),
      "邮箱或密码错误。",
    );

    const unavailable = authLocalization.mapAuthErrorMessage(
      "zh-CN",
      new Error("HTTP_404: Request failed."),
      "login",
    );
    assert.match(unavailable, /登录/);
    assert.doesNotMatch(unavailable, /HTTP_404|Request failed/);

    const htmlPayload = authLocalization.mapAuthErrorMessage(
      "zh-CN",
      new Error("INVALID_RESPONSE_PAYLOAD: KK API returned an HTML page instead of the expected JSON payload."),
      "login",
    );
    assert.match(htmlPayload, /登录/);
    assert.doesNotMatch(htmlPayload, /INVALID_RESPONSE_PAYLOAD|HTML page/);
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
      "Your balance is too low. Please recharge credits first.",
    );
    assert.equal(
      localizeUserFacingText("已导出 3 页整屏长图"),
      "Exported 3 full-length slide images.",
    );
    assert.equal(
      localizeUserFacingText("已到账 25 积分"),
      "25 credits have been added to your balance",
    );
    assert.equal(
      localizeUserFacingText("最多支持 5 张参考图"),
      "You can upload up to 5 reference images",
    );
    assert.equal(
      localizeUserFacingText("使用当前配置需要 20 积分，当前余额: 8， 请充值。".replace("， ", "，")),
      "This configuration needs 20 credits. Current balance: 8. Please top up.",
    );
  });
});
