import assert from "node:assert/strict";
import { describe, test } from "node:test";
import {
  SUCHUANG_TEXT_MODELS,
  SUCHUANG_IMAGE_MODELS,
  SUCHUANG_VIDEO_MODELS,
  SUCHUANG_AUDIO_MODELS
} from "../../apps/web/src/config/suchuangModels.ts";

describe("suchuangModels 前端速创模型定义单元测试", () => {
  test("1. 校验速创模型广场各模型数量与期望快照完全吻合", () => {
    // 文本模型应为 0
    assert.equal(SUCHUANG_TEXT_MODELS.length, 0);

    // 图片模型应为 6
    assert.equal(SUCHUANG_IMAGE_MODELS.length, 6);

    // 视频模型应为 8
    assert.equal(SUCHUANG_VIDEO_MODELS.length, 8);

    // 音频模型应为 3
    assert.equal(SUCHUANG_AUDIO_MODELS.length, 3);
  });

  test("2. 校验模型端点路径与参考图限制符合规范", () => {
    // 检查 GPT-Image-2
    const gptImage = SUCHUANG_IMAGE_MODELS.find(m => m.modelId === "image_gpt");
    assert.ok(gptImage);
    assert.equal(gptImage.endpoint["text-to-image"].url, "/api/async/image_gpt");
    assert.equal(gptImage.maxInputs, 10);

    // 检查 google_omni
    const googleOmni = SUCHUANG_VIDEO_MODELS.find(m => m.modelId === "video_google_omni");
    assert.ok(googleOmni);
    assert.equal(googleOmni.maxInputs, 7);
    assert.equal(googleOmni.priceLabel, "0.1 元/秒");
  });
});
