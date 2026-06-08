/**
 * @file strictProviderContracts.js
 * @module server/lib/dispatcher
 * @description 第三方强预设执行契约。命中这些 provider/profile 后，只允许按契约声明的任务、endpoint、
 *              鉴权、请求体和响应结构执行；禁止回落 generic-openai-compatible 或旧 adapter。
 */

const { getWuyinProduct, listWuyinProducts } = require('./wuyinProducts');

const STRICT_PROVIDER_CONTRACTS = {
  'gpt-best-openai-compatible': {
    providerId: 'gpt-best-openai-compatible',
    displayName: 'GPT-Best',
    docs: ['https://gpt-best.apifox.cn/llms.txt'],
    allowGenericFallback: false,
    supportedTasks: {
      chat: {
        adapterId: 'openai_chat_completions',
        method: 'POST',
        baseUrl: 'https://api.gpt-best.com/v1',
        endpoint: '/chat/completions',
        auth: 'Authorization: Bearer <token>',
        contentType: 'application/json',
        responseShape: 'OpenAI-compatible chat completion',
      },
      models: {
        method: 'GET',
        endpoint: '/models',
        auth: 'Authorization: Bearer <token>',
      },
    },
  },
  'apimart-openai-compatible': {
    providerId: 'apimart-openai-compatible',
    displayName: 'APIMart',
    docs: ['https://docs.apimart.ai/cn'],
    allowGenericFallback: false,
    supportedTasks: {
      chat: {
        adapterId: 'apimart_chat_completions',
        method: 'POST',
        baseUrl: 'https://api.apimart.ai/v1',
        endpoint: '/chat/completions',
        auth: 'Authorization: Bearer <token>',
        contentType: 'application/json',
        responseShape: '{ code, data: OpenAI-compatible chat completion }',
      },
    },
  },
  'wuyin-suchuang-form': {
    providerId: 'wuyin-suchuang-form',
    displayName: 'Wuyin / 速创',
    docs: [
      'https://api.wuyinkeji.com/type/all',
      'https://api.wuyinkeji.com/doc/65',
      'https://api.wuyinkeji.com/doc/55',
      'https://api.wuyinkeji.com/doc/53',
      'https://api.wuyinkeji.com/doc/72',
      'https://api.wuyinkeji.com/doc/47',
    ],
    allowGenericFallback: false,
    supportedTasks: {
      chat: {
        adapterId: 'custom_form_urlencoded',
        method: 'POST',
        endpoint: '/api/chat/index',
        auth: 'Authorization: <token>',
        contentType: 'application/x-www-form-urlencoded;charset=utf-8',
        fields: ['content', 'model', 'stream', 'image_url'],
        note: '仅限聊天旧接口。image/video/audio 不允许走该 adapter。',
      },
      image: {
        adapterId: 'wuyin_async_task',
        method: 'POST',
        endpointPattern: '/api/async/<modelId>',
        auth: 'Authorization header + ?key=<token>',
        contentType: 'application/json',
        models: listWuyinProducts().filter((item) => item.category === 'image').map((item) => item.id),
        resultEndpoint: '/api/async/detail?id=<taskId>',
      },
      video: {
        adapterId: 'wuyin_async_task',
        method: 'POST',
        endpointPattern: '/api/async/<modelId>',
        auth: 'Authorization header + ?key=<token>',
        contentType: 'application/json',
        models: listWuyinProducts().filter((item) => item.category === 'video').map((item) => item.id),
        resultEndpoint: '/api/async/detail?id=<taskId>',
      },
    },
  },
  '12ai-docs-pending': {
    providerId: '12ai-docs-pending',
    displayName: '12AI',
    docs: ['https://doc.12ai.org/docs/api'],
    allowGenericFallback: false,
    requiresDocsVerification: true,
    supportedTasks: {},
  },
};

function getStrictProviderContract(profileId) {
  return STRICT_PROVIDER_CONTRACTS[String(profileId || '').trim()] || null;
}

function hasStrictProviderContract(profileId) {
  return Boolean(getStrictProviderContract(profileId));
}

function assertStrictTaskSupported(profileId, taskType, options = {}) {
  const contract = getStrictProviderContract(profileId);
  if (!contract) return null;

  const task = contract.supportedTasks[String(taskType || '').trim()];
  if (!task) {
    const error = new Error(`${contract.displayName} 强预设未声明 ${taskType} 任务，AI Router 已阻止 generic/旧逻辑回落。请先按官方文档补充 contract。`);
    error.code = 'STRICT_PROVIDER_TASK_NOT_SUPPORTED';
    error.statusCode = 400;
    error.route = {
      profileId,
      taskType,
      docs: contract.docs,
    };
    throw error;
  }

  const modelId = String(options.modelId || '').trim();
  if (Array.isArray(task.models) && modelId && !task.models.includes(modelId)) {
    const error = new Error(`${contract.displayName} 强预设未声明模型 ${modelId} 可用于 ${taskType}，AI Router 已阻止猜测式请求。`);
    error.code = 'STRICT_PROVIDER_MODEL_NOT_SUPPORTED';
    error.statusCode = 400;
    error.route = {
      profileId,
      taskType,
      modelId,
      allowedModels: task.models,
      docs: contract.docs,
    };
    throw error;
  }

  return task;
}

function resolveWuyinTaskTypeByModel(modelId) {
  const product = getWuyinProduct(modelId);
  return product?.category || null;
}

module.exports = {
  STRICT_PROVIDER_CONTRACTS,
  assertStrictTaskSupported,
  getStrictProviderContract,
  hasStrictProviderContract,
  resolveWuyinTaskTypeByModel,
};
