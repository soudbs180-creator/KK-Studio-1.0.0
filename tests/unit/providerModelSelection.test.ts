import assert from "node:assert/strict";
import { describe, test } from "node:test";
import {
  normalizeModelName,
  findBestMatchingModel
} from "../../apps/web/src/utils/providerModelSelection.ts";

describe("providerModelSelection 前端模型检索逻辑单元测试", () => {
  test("1. normalizeModelName 能够清洗名称与标点符号", () => {
    assert.equal(normalizeModelName("image_nanoBanana2"), "imagenanobanana2");
    assert.equal(normalizeModelName("Wan-2.6_Image"), "wan26image");
    assert.equal(normalizeModelName("Google Omni Video "), "googleomnivideo");
  });

  test("2. findBestMatchingModel 能够精确/别名定位速创模型", () => {
    // 匹配 Wan2.6 图片模型
    const matchImage = findBestMatchingModel("suchuang", "image", "Wan2.6");
    assert.ok(matchImage);
    const imageModelId = 'modelId' in matchImage ? matchImage.modelId : matchImage.id;
    assert.equal(imageModelId, "image_wan2.6");

    // 匹配 veo3.1_fast 别名
    const matchVideoAlias = findBestMatchingModel("suchuang", "video", "veo-3.1");
    assert.ok(matchVideoAlias);
    const videoModelId = 'modelId' in matchVideoAlias ? matchVideoAlias.modelId : matchVideoAlias.id;
    assert.equal(videoModelId, "video_veo3.1_fast");
  });

  test("3. findBestMatchingModel 匹配失败时回退到默认第一个可用模型", () => {
    const matchFallback = findBestMatchingModel("suchuang", "image", "non-existent-image-model");
    assert.ok(matchFallback);
    const fallbackModelId = 'modelId' in matchFallback ? matchFallback.modelId : matchFallback.id;
    assert.equal(fallbackModelId, "image_gpt"); // 第一个可用模型
  });
});
