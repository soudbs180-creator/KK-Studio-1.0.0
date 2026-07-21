// server/lib/generation-v3/adapters/wuyinDocumentedAdapter.js
// 中文注释：Wuyin 文档化异步任务（视频/音频/部分图片）的 generation-v3 适配器。
//          使用 wuyinModelExecutor 提交并轮询，任务上下文保存在内存 Map 中。

const { registry } = require('../providerAdapter');
const { getWuyinProduct } = require('../../dispatcher/wuyinProducts');
const {
  submitWuyinTask,
  checkWuyinTaskStatus,
} = require('../../dispatcher/adapters/wuyin/wuyinModelExecutor');

// 保存 providerTaskId -> product 的映射，供 poll/cancel 使用
const TASK_CONTEXT = new Map();

function resolveApiKey(input) {
  return input.auth?.apiKey || process.env.SUCHUANG_API_KEY || '';
}

function normalizeInput(input) {
  return {
    prompt: input.prompt,
    modelId: input.modelId,
    aspectRatio: input.aspectRatio,
    size: input.size,
    duration: input.duration,
    referenceImages: input.referenceImages || [],
    urls: input.referenceImages || [],
    ...(input.payload || {}),
  };
}

async function submit(input) {
  const apiKey = resolveApiKey(input);
  if (!apiKey) {
    const err = new Error('Wuyin API key is missing.');
    err.code = 'SETUP_REQUIRED';
    err.statusCode = 403;
    throw err;
  }

  const modelId = input.modelId || 'video_google_omni';
  const product = getWuyinProduct(modelId);
  if (!product) {
    const err = new Error(`Wuyin model ${modelId} is not documented.`);
    err.code = 'MODEL_UNAVAILABLE';
    err.statusCode = 400;
    throw err;
  }

  const result = await submitWuyinTask({
    catalogItem: product,
    apiKey,
    input: normalizeInput(input),
    baseUrl: input.auth?.baseUrl,
  });

  if (result.providerTaskId) {
    TASK_CONTEXT.set(result.providerTaskId, { product, apiKey, baseUrl: input.auth?.baseUrl });
  }

  return {
    providerTaskId: result.providerTaskId || '',
    status: result.status === 'success' ? 'success' : (result.status === 'pending' ? 'pending' : 'failed'),
    urls: result.urls || [],
    errorMessage: result.status === 'failed' ? (result.errorMessage || 'Wuyin task submission failed') : undefined,
  };
}

async function poll(providerTaskId) {
  const ctx = TASK_CONTEXT.get(providerTaskId);
  if (!ctx) {
    const err = new Error('Wuyin task context not found.');
    err.code = 'PROVIDER_TASK_NOT_FOUND';
    err.statusCode = 404;
    throw err;
  }

  const result = await checkWuyinTaskStatus({
    catalogItem: ctx.product,
    apiKey: ctx.apiKey,
    providerTaskId,
    baseUrl: ctx.baseUrl,
  });

  // Wuyin executor 使用 'processing' 表示进行中的状态，统一为 'pending'
  const status = result.status === 'processing' ? 'pending' : result.status;

  return {
    status,
    urls: result.urls || [],
    errorMessage: status === 'failed' ? (result.message || 'Wuyin task failed') : undefined,
    raw: result.raw,
  };
}

async function cancel(providerTaskId) {
  // Wuyin 文档暂无统一取消接口；仅清理本地上下文
  TASK_CONTEXT.delete(providerTaskId);
}

const adapter = {
  adapterId: 'wuyin-documented',
  adapterVersion: '1.0.0',
  submit,
  poll,
  cancel,
};

registry.register(adapter);

module.exports = adapter;
