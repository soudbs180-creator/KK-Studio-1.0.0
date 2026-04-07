import assert from "node:assert/strict";
import { afterEach, describe, test } from "node:test";

import { notificationService } from "../../src/services/system/notificationService.ts";
import { localizeUserFacingText } from "../../src/utils/localeText.ts";

type MockDocument = {
  documentElement: {
    lang?: string;
    dataset: {
      language?: string;
    };
  };
};

type MockLocalStorage = {
  getItem: (key: string) => string | null;
  setItem: (key: string, value: string) => void;
  removeItem: (key: string) => void;
};

type MockWindow = {
  localStorage: MockLocalStorage;
};

const globalLike = globalThis as typeof globalThis & {
  document?: MockDocument;
  window?: MockWindow;
  localStorage?: MockLocalStorage;
};

const originalDocument = globalLike.document;
const originalWindow = globalLike.window;
const originalLocalStorage = globalLike.localStorage;
const originalConsoleLog = console.log;
const originalConsoleWarn = console.warn;
const originalConsoleError = console.error;

function setMockLanguageEnvironment(language: "zh-CN" | "en-US") {
  const storage = new Map<string, string>([["kk_language", language]]);
  const localStorage: MockLocalStorage = {
    getItem: (key) => storage.get(key) ?? null,
    setItem: (key, value) => {
      storage.set(key, value);
    },
    removeItem: (key) => {
      storage.delete(key);
    },
  };

  globalLike.document = {
    documentElement: {
      lang: "zh-CN",
      dataset: {
        language,
      },
    },
  };

  globalLike.window = { localStorage };
  globalLike.localStorage = localStorage;
}

afterEach(() => {
  notificationService.dismissAll();
  globalLike.document = originalDocument;
  globalLike.window = originalWindow;
  globalLike.localStorage = originalLocalStorage;
  console.log = originalConsoleLog;
  console.warn = originalConsoleWarn;
  console.error = originalConsoleError;
});

describe("notification localization", () => {
  test("maps high-frequency App notification copy to English when en-US is active", () => {
    setMockLanguageEnvironment("en-US");

    assert.equal(localizeUserFacingText("生成失败"), "Generation failed");
    assert.equal(
      localizeUserFacingText("您的账户余额不足，请先充值积分。"),
      "Your balance is too low. Please recharge credits first.",
    );
    assert.equal(localizeUserFacingText("无可导出页面"), "No pages available to export");
    assert.equal(
      localizeUserFacingText("已导出 3 页整屏长图"),
      "Exported 3 full-length slide images.",
    );
  });

  test("notificationService emits English notifications for mapped Chinese text in en-US mode", () => {
    setMockLanguageEnvironment("en-US");
    console.log = () => undefined;
    console.warn = () => undefined;
    console.error = () => undefined;

    const id = notificationService.show(
      "error",
      "生成失败",
      "您的账户余额不足，请先充值积分。",
      {
        details: "已导出 2 页整屏长图",
        duration: 0,
      },
    );

    const [notification] = notificationService.getAll();
    assert.equal(notification.id, id);
    assert.equal(notification.title, "Generation failed");
    assert.equal(notification.message, "Your balance is too low. Please recharge credits first.");
    assert.equal(notification.details, "Exported 2 full-length slide images.");
  });
});
