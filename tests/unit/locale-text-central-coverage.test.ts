import assert from "node:assert/strict";
import { afterEach, describe, test } from "node:test";

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
  globalLike.document = originalDocument;
  globalLike.window = originalWindow;
  globalLike.localStorage = originalLocalStorage;
});

describe("localeText central coverage", () => {
  test("localizes recharge, storage, and backup notifications to English", () => {
    setMockLanguageEnvironment("en-US");

    assert.equal(localizeUserFacingText("原图将保存在浏览器中"), "Original images will be saved in the browser.");
    assert.equal(localizeUserFacingText("无法保存设置"), "Unable to save settings.");
    assert.equal(localizeUserFacingText("文档夹选择失败"), "Folder selection failed");
    assert.equal(localizeUserFacingText("无法获取文档夹访问权限"), "Unable to access the selected folder.");
    assert.equal(localizeUserFacingText("浏览器不支持"), "Browser unsupported");
    assert.equal(
      localizeUserFacingText("您的浏览器不支持文档系统访问API。请使用最新版Chrome、Edge或支持的浏览器。"),
      "Your browser does not support the File System Access API. Please use the latest Chrome, Edge, or another supported browser.",
    );
    assert.equal(localizeUserFacingText("微信支付维护中"), "WeChat Pay is under maintenance");
    assert.equal(localizeUserFacingText("国际支付维护中"), "International payments are under maintenance");
    assert.equal(localizeUserFacingText("订单已创建"), "Order created");
    assert.equal(
      localizeUserFacingText("请扫码或打开支付链接完成支付，到账后会自动刷新余额。"),
      "Scan the QR code or open the payment link to finish payment. Your balance will refresh automatically after settlement.",
    );
    assert.equal(
      localizeUserFacingText("当前暂未开放在线支付，请联系管理员处理。"),
      "Online payment is currently unavailable. Please contact an administrator.",
    );
    assert.equal(localizeUserFacingText("积分已同步到余额。"), "Credits have been synced to your balance.");
    assert.equal(localizeUserFacingText("导出成功"), "Export successful");
    assert.equal(
      localizeUserFacingText("已成功导出 3 张原图，失败 1 张"),
      "Successfully exported 3 original images; 1 failed.",
    );
    assert.equal(localizeUserFacingText("正在导出 3 张原图..."), "Exporting 3 original images...");
  });

  test("localizes chat and prompt notifications with common counters and actions", () => {
    setMockLanguageEnvironment("en-US");

    assert.equal(localizeUserFacingText("已添加参考附件"), "Reference attachments added");
    assert.equal(localizeUserFacingText("粘贴导入 2 个文档"), "Imported 2 documents from paste");
    assert.equal(localizeUserFacingText("拖拽导入 3 个文档"), "Imported 3 documents from drag and drop");
    assert.equal(localizeUserFacingText("参考图数量限制"), "Reference image limit");
    assert.equal(localizeUserFacingText("最多只能上传 5 张参考图"), "You can upload up to 5 reference images");
    assert.equal(localizeUserFacingText("参考图已调整"), "Reference images adjusted");
    assert.equal(
      localizeUserFacingText("最多只能上传 5 张参考图，已自动忽略 2 张"),
      "You can upload up to 5 reference images. 2 were ignored automatically.",
    );
    assert.equal(localizeUserFacingText("PPT页纲已应用"), "PPT outline applied");
    assert.equal(localizeUserFacingText("图片生成失败"), "Image generation failed");
    assert.equal(localizeUserFacingText("AI 生成失败"), "AI generation failed");
    assert.equal(localizeUserFacingText("未找到可编辑的上一条提问"), "No editable previous prompt found");
    assert.equal(localizeUserFacingText("已创建分支会话"), "Branch session created");
    assert.equal(localizeUserFacingText("没有可导入会话"), "No sessions available to import");
    assert.equal(localizeUserFacingText("覆盖导入 4 个会话"), "Replaced with 4 imported sessions");
    assert.equal(localizeUserFacingText("追加导入 4 个会话"), "Appended 4 imported sessions");
    assert.equal(localizeUserFacingText("智能合并后保留 4 个会话"), "Kept 4 sessions after smart merge");
  });

  test("localizes dynamic admin credit guardrails used by chat entry points", () => {
    setMockLanguageEnvironment("en-US");

    assert.equal(
      localizeUserFacingText("管理员配置的积分模型需要登录账号后使用积分才能进行对话。"),
      "Admin-configured credit models require a signed-in account before they can spend credits to chat.",
    );
    assert.equal(
      localizeUserFacingText("使用当前管理员模型进行对话需要 15 积分，当前余额: 3，请充值。"),
      "Using the current admin model to chat requires 15 credits. Current balance: 3. Please top up.",
    );
  });
});
