// tests/contract/card-ghost-skeleton-contract.test.ts
// 中文注释：大画布各专属卡片 Ghost 和 Skeleton 视图参数与防卡顿 CSS 规范契约测试

import assert from "node:assert/strict";
import { test } from "node:test";
import fs from "node:fs";
import path from "node:path";

test("Card Ghost & Skeleton - 专属卡片骨架视图契约与防卡顿校验", () => {
  const renderers = [
    "EcommerceTaskCardRenderer.tsx",
    "VideoGenerationGroupRenderer.tsx",
    "MusicTaskCardRenderer.tsx",
    "PptSlideCardRenderer.tsx",
    "PptDeckCardRenderer.tsx",
    "BrowserTaskCardRenderer.tsx",
    "AssetCardRenderer.tsx",
    "WorkflowCardRenderer.tsx",
    "AgentCardRenderer.tsx",
    "ExportCardRenderer.tsx",
    "ImageGenerationGroupRenderer.tsx"
  ];

  for (const filename of renderers) {
    const filePath = path.resolve(`apps/web/src/core/canvas/renderers/${filename}`);
    assert.ok(fs.existsSync(filePath), `渲染器文件 ${filename} 应存在`);

    const source = fs.readFileSync(filePath, "utf-8");

    // 1. 验证是否包含 skeleton 骨架状态的专用渲染逻辑
    assert.ok(
      source.includes("skeleton") || source.includes("detailLevel === 'skeleton'"),
      `渲染器 ${filename} 必须包含对 'skeleton' 骨架状态的专用渲染逻辑`
    );

    // 2. 验证是否包含 ghost 状态的专用渲染逻辑
    assert.ok(
      source.includes("ghost") || source.includes("detailLevel === 'ghost'"),
      `渲染器 ${filename} 必须包含对 'ghost' 状态的专用渲染逻辑`
    );

    // 3. 验证 ghost 视图中不得禁用事件响应（必须是 pointer-events-auto 而不是 pointer-events-none）
    if (source.includes("detailLevel === 'ghost'")) {
      const ghostBlock = source.split("detailLevel === 'ghost'")[1].split("}")[0];
      assert.ok(
        !ghostBlock.includes("pointer-events-none") || ghostBlock.includes("pointer-events-auto"),
        `渲染器 ${filename} 在 ghost 视图中必须启用 pointer-events-auto，防拦截拖拽`
      );
      assert.ok(
        !ghostBlock.includes("backdrop-blur") && !ghostBlock.includes("backdropFilter") && !ghostBlock.includes("blur"),
        `渲染器 ${filename} 在 ghost 视图中禁用重绘开销高的模糊滤镜`
      );
    }

    // 4. 验证 skeleton 视图中不得包含 transition-all
    if (source.includes("detailLevel === 'skeleton'")) {
      const skeletonBlock = source.split("detailLevel === 'skeleton'")[1].split("}")[0];
      assert.ok(
        !skeletonBlock.includes("transition-all"),
        `渲染器 ${filename} 在 skeleton 视图中必须禁用 transition-all 动画`
      );
      assert.ok(
        !skeletonBlock.includes("backdrop-blur") && !skeletonBlock.includes("backdropFilter") && !skeletonBlock.includes("blur"),
        `渲染器 ${filename} 在 skeleton 视图中禁用重绘开销高的模糊滤镜`
      );
    }
  }
});
