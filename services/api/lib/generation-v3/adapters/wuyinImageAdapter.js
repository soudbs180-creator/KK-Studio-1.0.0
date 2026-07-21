// services/api/lib/generation-v3/adapters/wuyinImageAdapter.js
// 中文注释：Wuyin 同步图像 Provider 的 generation-v3 适配器。委托给既有 wuyinImageAdapter。

const { registry } = require('../providerAdapter');
const legacyAdapter = require('../../dispatcher/adapters/wuyinImageAdapter');

async function submit(input) {
  const result = await legacyAdapter.generateImage({
    requestId: input.requestId,
    modelId: input.modelId || 'image_nanoBanana2',
    prompt: input.prompt,
    aspectRatio: input.aspectRatio,
    size: input.size,
    referenceImages: input.referenceImages || [],
  });

  return {
    providerTaskId: '',
    status: result.status === 'success' ? 'success' : 'failed',
    urls: result.urls || [],
    errorMessage: result.status === 'success' ? undefined : (result.errorMessage || 'Wuyin image generation failed'),
  };
}

async function poll() {
  return { status: 'success', urls: [] };
}

async function cancel() {}

const adapter = {
  adapterId: 'wuyin-image',
  adapterVersion: '1.0.0',
  submit,
  poll,
  cancel,
};

registry.register(adapter);

module.exports = adapter;
