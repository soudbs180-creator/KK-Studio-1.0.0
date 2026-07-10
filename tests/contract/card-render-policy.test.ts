// tests/contract/card-render-policy.test.ts
// 中文注释：大画布卡片渲染策略与原子组判定规则契约测试

import assert from "node:assert/strict";
import { test } from "node:test";
import fs from "node:fs";
import path from "node:path";

test("Card Render Policy - 渲染策略与原子卡组默认判定规则验证", () => {
  const registryPath = path.resolve("apps/web/src/core/canvas/renderers/CanvasCardRendererRegistry.ts");
  assert.ok(fs.existsSync(registryPath), "CanvasCardRendererRegistry.ts 应当存在");

  const source = fs.readFileSync(registryPath, "utf-8");

  // 1. 验证默认 createPolicy 规则
  assert.ok(
    source.includes("hasMainCard: false") || source.includes("hasMainCard:false"),
    "createPolicy 必须默认设定 hasMainCard 为 false"
  );
  assert.ok(
    source.includes("hasResultCards: false") || source.includes("hasResultCards:false"),
    "createPolicy 必须默认设定 hasResultCards 为 false"
  );
  assert.ok(
    source.includes("atomicGroup: false") || source.includes("atomicGroup:false"),
    "createPolicy 必须默认设定 atomicGroup 为 false"
  );

  // 2. 验证所有 Prompt-backed 卡型均使用完整主副卡原子组渲染器
  assert.ok(
    source.includes("this.register('image-generation-group', createPolicy('image-generation-group', 'prompt-result-group', { hasMainCard: true, hasResultCards: true, atomicGroup: true }), ImageGenerationGroupRenderer);")
    || (source.includes("image-generation-group") && source.includes("hasMainCard: true") && source.includes("atomicGroup: true")),
    "只有图片生成卡组应当被配置为 hasMainCard: true 且 atomicGroup: true"
  );

  assert.ok(
    source.includes("this.register('video-generation-group', createPolicy('video-generation-group', 'prompt-result-group', { hasMainCard: true, hasResultCards: true, atomicGroup: true }), VideoGenerationGroupRenderer);")
    || (source.includes("video-generation-group") && source.includes("hasMainCard: true") && source.includes("atomicGroup: true")),
    "只有视频生成卡组应当被配置为 hasMainCard: true 且 atomicGroup: true"
  );

  for (const kind of ['ecommerce-task-card', 'ppt-slide-card', 'ppt-deck-card', 'music-task-card']) {
    assert.match(
      source,
      new RegExp(`this\\.register\\('${kind}',[\\s\\S]{0,220}ImageGenerationGroupRenderer\\)`),
      `${kind} 必须复用带世界坐标、选择、拖拽和主副卡联动的功能渲染器`
    );
  }

  assert.doesNotMatch(source, /import EcommerceTaskCardRenderer/);
  assert.doesNotMatch(source, /import PptSlideCardRenderer/);
  assert.doesNotMatch(source, /import PptDeckCardRenderer/);
  assert.doesNotMatch(source, /import MusicTaskCardRenderer/);
});
