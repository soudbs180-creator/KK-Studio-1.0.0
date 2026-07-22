// services/api/lib/dispatcher/adapters/openAICompatibleImageAdapter.js
// 中文注释：OpenAI 兼容型图像生成通用适配器

const assetStore = require('../../generation/generationAssetStore');
const { toStandardError } = require('../providerErrors');

function resolveCredentials(input) {
  // Per-call Connection credentials must win so simultaneous owners cannot share process state.
  const baseUrl = String(input.baseUrl || process.env.OPENAI_COMPATIBLE_BASE_URL || '').trim();
  const apiKey = String(input.apiKey || process.env.OPENAI_COMPATIBLE_API_KEY || '').trim();
  if (!baseUrl || !apiKey) {
    const err = new Error('Base URL or API Key is missing for custom OpenAI-compatible provider.');
    err.statusCode = 400;
    throw err;
  }
  return { baseUrl, apiKey };
}

async function requestImage(input, credentials) {
  const response = await fetch(`${credentials.baseUrl.replace(/\/$/, '')}/images/generations`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${credentials.apiKey}`
    },
    body: JSON.stringify({
      model: input.modelId,
      prompt: input.prompt,
      n: 1,
      size: input.size || '1024x1024',
      response_format: 'url'
    })
  });
  if (!response.ok) {
    const errorText = await response.text();
    const err = new Error(`Upstream OpenAI-compatible service error: ${response.statusText}. Details: ${errorText}`);
    err.statusCode = response.status;
    throw err;
  }
  return response.json();
}

class OpenAICompatibleImageAdapter {
  constructor(providerId = 'custom') {
    this.providerId = providerId;
  }

  async generateImage(input) {
    const { modelId, requestId } = input;

    try {
      const credentials = resolveCredentials(input);
      const resBody = await requestImage(input, credentials);
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
