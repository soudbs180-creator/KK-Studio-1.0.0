// tests/contract/canvas-card-renderer-registry.test.ts
// 中文注释：大画布多类型卡片注册与独立渲染静态契约测试

import assert from "node:assert/strict";
import { test } from "node:test";
import fs from "node:fs";
import path from "node:path";

test("Canvas Card Registry - 独立渲染器注册与非空转发验证", () => {
  const filenames = [
    "VideoGenerationGroupRenderer.tsx",
    "EcommerceTaskCardRenderer.tsx",
    "PptSlideCardRenderer.tsx",
    "PptDeckCardRenderer.tsx",
    "MusicTaskCardRenderer.tsx",
    "BrowserTaskCardRenderer.tsx",
    "AssetCardRenderer.tsx",
    "WorkflowCardRenderer.tsx",
    "AgentCardRenderer.tsx",
    "ExportCardRenderer.tsx"
  ];

  for (const filename of filenames) {
    const filePath = path.resolve(`apps/web/src/core/canvas/renderers/${filename}`);
    assert.ok(fs.existsSync(filePath), `渲染器文件 ${filename} 应存在`);

    const source = fs.readFileSync(filePath, "utf-8");

    // 验证这些专属渲染器中不应导入或包含 ImageGenerationGroupRenderer 转发
    assert.ok(
      !source.includes("ImageGenerationGroupRenderer") || filename === "ImageGenerationGroupRenderer.tsx",
      `渲染器 ${filename} 包含了 ImageGenerationGroupRenderer 的假转发或直接依赖，这违反了多类型卡片独立渲染的契约！`
    );
  }
});
