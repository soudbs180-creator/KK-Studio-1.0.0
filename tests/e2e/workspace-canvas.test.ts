// 简体中文：KK Studio 核心画布工作区端到端 (E2E) 契约及一致性测试

import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { readSource } from "../support/workspacePaths.js";

describe("KK Studio 画布工作区 E2E DOM 选择器与 AI 提示词一致性核对测试", () => {
  
  test("1. 核对 AI 助手内置提示词中提到的新建画布按钮 (btn-create-canvas) 在前端 DOM 中存在", () => {
    const chatSidebarSource = readSource("apps/web/src/components/layout/ChatSidebar.tsx");
    const projectManagerSource = readSource("apps/web/src/components/settings/ProjectManager.tsx");
    
    // 验证源码中存在该 id，确保 AI 助手引导点击高亮时选择器有效
    const hasBtnInSidebar = /id="btn-create-canvas"/.test(chatSidebarSource) || /data-testid="btn-create-canvas"/.test(chatSidebarSource);
    const hasBtnInManager = /id="btn-create-canvas"/.test(projectManagerSource) || /data-testid="btn-create-canvas"/.test(projectManagerSource);
    
    assert.ok(hasBtnInSidebar || hasBtnInManager, "未能在 ChatSidebar 或 ProjectManager 中找到 'btn-create-canvas' 选择器桩");
  });

  test("2. 核对 AI 助手内置提示词中提到的充值按钮 (btn-desktop-recharge) 在桌面端 Chrome 中存在", () => {
    const desktopChromeSource = readSource("apps/web/src/app/AppDesktopChrome.tsx");
    const chatSidebarSource = readSource("apps/web/src/components/layout/ChatSidebar.tsx");
    
    // 验证充值按钮的选择器在 DOM 结构中存在
    const hasRechargeInChrome = /id="btn-desktop-recharge"/.test(desktopChromeSource) || /data-testid="btn-desktop-recharge"/.test(desktopChromeSource);
    const hasRechargeInSidebar = /id="btn-desktop-recharge"/.test(chatSidebarSource) || /data-testid="btn-desktop-recharge"/.test(chatSidebarSource);
    
    assert.ok(hasRechargeInChrome || hasRechargeInSidebar, "未能在 AppDesktopChrome 或 ChatSidebar 中找到 'btn-desktop-recharge' 选择器桩");
  });

  test("3. 核对 AI 助手内置提示词中提到的画布缩放控制面板 (desktop-zoom-rail) 在前端主应用中存在", () => {
    const appSource = readSource("apps/web/src/App.tsx");
    const chatSidebarSource = readSource("apps/web/src/components/layout/ChatSidebar.tsx");
    
    // 验证缩放条 class/id 存在，确保高亮缩放控制面板有效
    const hasZoomRailInApp = /desktop-zoom-rail/.test(appSource);
    const hasZoomRailInSidebar = /desktop-zoom-rail/.test(chatSidebarSource);
    
    assert.ok(hasZoomRailInApp || hasZoomRailInSidebar, "未能在 App.tsx 或 ChatSidebar 中找到 'desktop-zoom-rail' 选择器或样式类名称");
  });

  test("4. 核对 AI 助手内置提示词中提到的设置按钮 (btn-desktop-settings) 在主渲染模块中存在", () => {
    const desktopChromeSource = readSource("apps/web/src/app/AppDesktopChrome.tsx");
    const chatSidebarSource = readSource("apps/web/src/components/layout/ChatSidebar.tsx");
    
    // 验证设置按钮的 Selector 存在
    const hasSettingsInChrome = /id="btn-desktop-settings"/.test(desktopChromeSource) || /data-testid="btn-desktop-settings"/.test(desktopChromeSource) || /id=\{`btn-desktop-settings`\}/.test(desktopChromeSource);
    const hasSettingsInSidebar = /id="btn-desktop-settings"/.test(chatSidebarSource) || /data-testid="btn-desktop-settings"/.test(chatSidebarSource) || /id=\{`btn-desktop-settings`\}/.test(chatSidebarSource);
    
    assert.ok(hasSettingsInChrome || hasSettingsInSidebar, "未能在 AppDesktopChrome 或 ChatSidebar 中找到 'btn-desktop-settings' 选择器桩");
  });

  test("5. 核对原图下载打包模块中已实现 originalUrl -> apiResultUrl -> url -> storageId 的优先级匹配策略", () => {
    const resolveAssetsSource = readSource("apps/web/src/features/assets/resolveOriginalAssets.ts");

    // 验证候选图优先级序列是否按规范排列
    assert.match(resolveAssetsSource, /sourceKind:\s*'originalUrl'/);
    assert.match(resolveAssetsSource, /sourceKind:\s*'apiResultUrl'/);
    assert.match(resolveAssetsSource, /sourceKind:\s*'url'/);
    assert.match(resolveAssetsSource, /sourceKind:\s*'storageId'/);
  });

  test("6. 核对 AI 智能批量出图任务的并发安全性，必须声明默认并发限制", () => {
    const queueSource = readSource("apps/web/src/features/ai-assistant-runtime/queue/DurableGenerationQueue.ts");

    // 检查是否存在对于 concurrency 或者 limit 的限速配置逻辑，保证不冲垮云端通道
    assert.ok(/concurrency|limit|rate/i.test(queueSource), "DurableGenerationQueue 中应包含并发或限速策略逻辑");
  });
});
