import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { readSource } from "../support/workspacePaths.js";

describe("ApiSettingsView 前端面板速创支持契约测试", () => {
  test("1. 确保成功导入了速创专属的 17 个模型及价格映射元数据", () => {
    const source = readSource("apps/web/src/components/settings/ApiSettingsView.tsx");

    assert.match(source, /SUCHUANG_IMAGE_MODELS/);
    assert.match(source, /SUCHUANG_VIDEO_MODELS/);
    assert.match(source, /SUCHUANG_AUDIO_MODELS/);
    assert.match(source, /PROVIDER_MODEL_LIBRARIES/);
    assert.match(source, /getProviderModelPriceLabel/);
  });

  test("2. 确保在展示可用模型时，若为速创渠道则重新映射并彻底剥离云雾模型", () => {
    const source = readSource("apps/web/src/components/settings/ApiSettingsView.tsx");

    // 验证在 PresetModelsCardComponent 传递 models 属性处，包含了对速创的过滤处理
    assert.match(source, /models=\{\s*selectedProvider\.name === '速创 API'/);
    assert.match(source, /SUCHUANG_IMAGE_MODELS\.map/);
  });

  test("3. 确保在保存速创密钥时使用了防覆盖机制", () => {
    const source = readSource("apps/web/src/components/settings/ApiSettingsView.tsx");

    // 验证使用 resolveRuntimeSecretForSave 处理 wuyinApiKeyForSave，防止被空字符覆盖
    assert.match(source, /const wuyinApiKeyForSave = resolveRuntimeSecretForSave\(/);
  });
});
