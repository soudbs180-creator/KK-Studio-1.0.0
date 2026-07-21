// server/lib/generation-v3/adapters/googleImageAdapter.js
// 中文注释：Google Imagen Provider 的 generation-v3 适配器。将旧 generateImage 接口包装为 submit/poll/cancel。

const { registry } = require('../providerAdapter');
const legacyAdapter = require('../../dispatcher/adapters/googleImageAdapter');

function resolveApiKey(input) {
  return input.auth?.apiKey || process.env.GEMINI_API_KEY || '';
}

async function submit(input) {
  const apiKey = resolveApiKey(input);
  if (!apiKey) {
    const err = new Error('Gemini API key is missing.');
    err.code = 'SETUP_REQUIRED';
    err.statusCode = 403;
    throw err;
  }

  if (input.auth?.apiKey) {
    process.env.GEMINI_API_KEY = apiKey;
  }

  const result = await legacyAdapter.generateImage({
    requestId: input.requestId,
    modelId: input.modelId,
    prompt: input.prompt,
    aspectRatio: input.aspectRatio,
    referenceImages: input.referenceImages || [],
  });

  return {
    providerTaskId: '',
    status: result.status === 'success' ? 'success' : 'failed',
    urls: result.urls || [],
    errorMessage: result.status === 'success' ? undefined : (result.errorMessage || 'Gemini image generation failed'),
  };
}

async function poll() {
  return { status: 'success', urls: [] };
}

async function cancel() {}

const adapter = {
  adapterId: 'google-image',
  adapterVersion: '1.0.0',
  submit,
  poll,
  cancel,
};

registry.register(adapter);

module.exports = adapter;
