// services/api/lib/generation-v3/adapters/openaiCompatibleImageAdapter.js
// 中文注释：OpenAI 兼容图像 Provider 的 generation-v3 适配器。将旧 generateImage 接口包装为 submit/poll/cancel。

const { registry } = require('../providerAdapter');
const legacyAdapter = require('../../dispatcher/adapters/openAICompatibleImageAdapter');

function resolveApiKey(input) {
  return input.auth?.apiKey || process.env.OPENAI_COMPATIBLE_API_KEY || '';
}

async function submit(input) {
  const apiKey = resolveApiKey(input);
  if (!apiKey) {
    const err = new Error('OpenAI-compatible provider API key is missing.');
    err.code = 'SETUP_REQUIRED';
    err.statusCode = 403;
    throw err;
  }

  // 旧适配器从环境变量读取 key；这里优先通过 env 注入，后续支持 keySlot
  if (input.auth?.apiKey) {
    process.env.OPENAI_COMPATIBLE_API_KEY = apiKey;
  }

  const result = await legacyAdapter.generateImage({
    requestId: input.requestId,
    modelId: input.modelId,
    prompt: input.prompt,
    size: input.size || '1024x1024',
    referenceImages: input.referenceImages || [],
  });

  return {
    providerTaskId: '',
    status: result.status === 'success' ? 'success' : 'failed',
    urls: result.urls || [],
    errorMessage: result.status === 'success' ? undefined : (result.errorMessage || 'OpenAI-compatible image generation failed'),
  };
}

async function poll() {
  // 同步适配器无需轮询
  return { status: 'success', urls: [] };
}

async function cancel() {
  // 同步任务无可取消的远端任务
}

const adapter = {
  adapterId: 'openai-compatible-image',
  adapterVersion: '1.0.0',
  submit,
  poll,
  cancel,
};

registry.register(adapter);

module.exports = adapter;
