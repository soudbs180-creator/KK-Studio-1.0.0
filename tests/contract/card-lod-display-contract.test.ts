// tests/contract/card-lod-display-contract.test.ts
// 中文注释：大画布各专属卡片 LoD (Level of Detail) 与骨架视图规范契约测试

import assert from "node:assert/strict";
import { test } from "node:test";
import fs from "node:fs";
import path from "node:path";

test("Card LoD Display - 各卡片骨架与分级渲染契约验证", () => {
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
    "ExportCardRenderer.tsx"
  ];

  for (const filename of renderers) {
    const filePath = path.resolve(`apps/web/src/core/canvas/renderers/${filename}`);
    assert.ok(fs.existsSync(filePath), `渲染器文件 ${filename} 应存在`);

    const source = fs.readFileSync(filePath, "utf-8");

    // 1. 验证是否显式处理了 'skeleton' 视图，以满足非视口卡片展现业务骨架的要求
    assert.ok(
      source.includes("skeleton") || source.includes("detailLevel === 'skeleton'"),
      `渲染器 ${filename} 必须包含对 'skeleton' 骨架状态的专用渲染逻辑`
    );

    // 2. 验证是否显式处理了 'ghost' 占位视图
    assert.ok(
      source.includes("ghost") || source.includes("detailLevel === 'ghost'"),
      `渲染器 ${filename} 必须包含对 'ghost' 状态的专用渲染逻辑`
    );

    // 3. 验证骨架中不应含有 transition-all 等耗费性能的属性
    if (source.includes("detailLevel === 'skeleton'")) {
      const skeletonBlock = source.split("detailLevel === 'skeleton'")[1].split("}")[0];
      assert.ok(
        !skeletonBlock.includes("transition-all"),
        `渲染器 ${filename} 在 skeleton 视图中禁用了 transition-all`
      );
    }
  }
});
