// server/lib/dispatcher/adapters/openAICompatibleImageAdapter.js
// 中文注释：OpenAI 兼容型图像生成通用适配器

const assetStore = require('../../generation/generationAssetStore');
const { toStandardError } = require('../providerErrors');

class OpenAICompatibleImageAdapter {
  constructor(providerId = 'custom') {
    this.providerId = providerId;
  }

  async generateImage(input) {
    const { prompt, modelId, size = '1024x1024', requestId } = input;

    try {
      // 这里的 baseUrl 和 apiKey 在生产中通常从 keySlot 或者环境变量配置
      const baseUrl = process.env.OPENAI_COMPATIBLE_BASE_URL || '';
      const apiKey = process.env.OPENAI_COMPATIBLE_API_KEY || '';

      if (!baseUrl || !apiKey) {
        const err = new Error('Base URL or API Key is missing for custom OpenAI-compatible provider.');
        err.statusCode = 400;
        throw err;
      }

      const response = await fetch(`${baseUrl.replace(/\/$/, '')}/images/generations`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          model: modelId,
          prompt,
          n: 1,
          size,
          response_format: 'url'
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        const err = new Error(`Upstream OpenAI-compatible service error: ${response.statusText}. Details: ${errorText}`);
        err.statusCode = response.status;
        throw err;
      }

      const resBody = await response.json();
      const imageUrl = resBody?.data?.[0]?.url;
      if (!imageUrl) {
        throw new Error('Upstream OpenAI-compatible service failed to return image URL.');
      }

      // 文件落盘
      const staticUrl = await assetStore.saveFromUrl(imageUrl);

      return {
        requestId,
        providerId: this.providerId,
        surface: 'provider-images',
        modelId,
        status: 'success',
        urls: [staticUrl],
        raw: resBody
      };
    } catch (err) {
      throw toStandardError(err, this.providerId, 'provider-images');
    }
  }
}

module.exports = new OpenAICompatibleImageAdapter();
module.exports.OpenAICompatibleImageAdapter = OpenAICompatibleImageAdapter; // 导出类以便派生
