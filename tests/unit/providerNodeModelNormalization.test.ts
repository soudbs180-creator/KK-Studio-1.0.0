import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { normalizeNodeModelForProvider } from "../../apps/web/src/utils/providerNodeModelNormalization.ts";

describe("providerNodeModelNormalization 前端节点模型规范化单元测试", () => {
  test("1. 能够对 Image 节点成功规范化并重设 model 和 provider 属性", () => {
    // 之前是云雾的 imagen 模型，切换到速创后，应当模糊匹配到最适宜的速创模型
    const result = normalizeNodeModelForProvider(
      "imagen-4.0-generate-001",
      "Google",
      "suchuang",
      "image",
      false
    );

    assert.equal(result.model, "image_gpt"); // 回退到第一个
    assert.equal(result.provider, "SuchuangProvider");
  });

  test("2. 能够对 Video 节点成功规范化并检索 aliases", () => {
    // 之前是 veo 视频模型，切换到速创后，应匹配到 veo3.1_fast
    const result = normalizeNodeModelForProvider(
      "veo-3.1",
      "Google",
      "suchuang",
      "video",
      false
    );

    assert.equal(result.model, "video_veo3.1_fast");
    assert.equal(result.provider, "SuchuangProvider");
  });

  test("3. 进行中的任务应当跳过规范化，防止破坏生成链路", () => {
    const result = normalizeNodeModelForProvider(
      "some-model",
      "some-provider",
      "suchuang",
      "image",
      true // isGenerating
    );

    assert.equal(result.model, "some-model");
    assert.equal(result.provider, "some-provider");
  });

  test("4. 文本/对话类模型因速创库内为 0 故应当全部置空", () => {
    const result = normalizeNodeModelForProvider(
      "gpt-4o",
      "OpenAI",
      "suchuang",
      "chat",
      false
    );

    assert.equal(result.model, "");
    assert.equal(result.provider, "");
  });
});
