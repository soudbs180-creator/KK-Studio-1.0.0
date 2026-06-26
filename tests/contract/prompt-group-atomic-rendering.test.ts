// tests/contract/prompt-group-atomic-rendering.test.ts
// 中文注释：卡组原子渲染与组级视口裁剪静态契约测试

import assert from "node:assert/strict";
import { test } from "node:test";
import fs from "node:fs";
import path from "node:path";

test("Prompt Group Atomic Rendering - 组级原子渲染契约验证", () => {
  const imageRendererPath = path.resolve("apps/web/src/core/canvas/renderers/ImageGenerationGroupRenderer.tsx");
  const workspacePagePath = path.resolve("apps/web/src/pages/Workspace/WorkspacePage.tsx");

  assert.ok(fs.existsSync(imageRendererPath), "ImageGenerationGroupRenderer.tsx 应存在");
  assert.ok(fs.existsSync(workspacePagePath), "WorkspacePage.tsx 应存在");

  const imageRendererSrc = fs.readFileSync(imageRendererPath, "utf-8");
  const workspacePageSrc = fs.readFileSync(workspacePagePath, "utf-8");

  // 1. 验证子卡片的 isVisible 属性是否被锁定为 true，防止二次视口内裁剪
  assert.match(
    imageRendererSrc,
    /isVisible=\{true\}/,
    "在卡组渲染器内，子卡片 isVisible 属性必须直传 true 以保证卡组内的原子单位完整渲染"
  );

  // 2. 验证 WorkspacePage.tsx 挂载门禁已接入 isRectIntersecting 且基于 groupView.bounds 判断
  assert.match(
    workspacePageSrc,
    /isRectIntersecting\(groupView\.bounds/,
    "WorkspacePage 的挂载门禁必须使用 groupView.bounds 搭配 isRectIntersecting 做卡组级的整体视口判断"
  );
});
