// tests/contract/workspace-no-fake-renderer.test.ts
// 中文注释：WorkspacePage 架构解耦规范契约静态测试

import assert from "node:assert/strict";
import { test } from "node:test";
import fs from "node:fs";
import path from "node:path";

test("Workspace Decoupling - 页面组件无假渲染器/直接卡片引用验证", () => {
  const workspacePagePath = path.resolve("apps/web/src/pages/Workspace/WorkspacePage.tsx");
  assert.ok(fs.existsSync(workspacePagePath), "WorkspacePage.tsx 应存在");

  const source = fs.readFileSync(workspacePagePath, "utf-8");

  // 1. 验证没有直接 import 具体的卡片渲染组件
  const forbiddenImports = [
    "ImageGenerationGroupRenderer",
    "VideoGenerationGroupRenderer",
    "EcommerceTaskCardRenderer",
    "PptSlideCardRenderer",
    "PptDeckCardRenderer",
    "MusicTaskCardRenderer",
    "BrowserTaskCardRenderer",
    "AssetCardRenderer",
    "WorkflowCardRenderer",
    "AgentCardRenderer",
    "ExportCardRenderer"
  ];

  for (const comp of forbiddenImports) {
    // 检查是否存在对具体渲染器的直接引入，防止 Workspace 页面直接堆砌 UI
    assert.ok(
      !source.includes(`import ${comp} `) && !source.includes(`import { ${comp} }`),
      `WorkspacePage.tsx 绝对禁止直接引入 [${comp}]！必须通过 canvasCardRendererRegistry 进行动态解析。`
    );
  }

  // 2. 验证 WorkspacePage 中正确引入了外部注册表
  assert.ok(
    source.includes("canvasCardRendererRegistry"),
    "WorkspacePage.tsx 必须引入 canvasCardRendererRegistry 动态渲染卡片"
  );
});
