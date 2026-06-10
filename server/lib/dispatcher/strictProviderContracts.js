/**
 * @file strictProviderContracts.js
 * @module server/lib/dispatcher
 * @description 厂商执行契约。命中已知 provider/profile 后，只允许按契约声明的任务、endpoint、
 *              鉴权、请求体和响应结构执行；除 generic-openai-compatible 外，禁止用猜测式 fallback 污染已知厂商。
 */

const { getWuyinProduct, listWuyinProducts } = require('./wuyinProducts');

function openAIChatContract({
  adapterId = 'openai_chat_completions',
  baseUrl,
  endpoint = '/chat/completions',
  docs = [],
  responseShape = 'OpenAI-compatible chat completion',
  extraHeaders = [],
  note,
} = {}) {
  return {
    adapterId,
    method: 'POST',
    baseUrl,
    endpoint,
    auth: 'Authorization: Bearer <token>',
    contentType: 'application/json',
    requestShape: '{ model, messages, stream?, temperature?, max_tokens? }',
    responseShape,
    extraHeaders,
    docs,
    note,
  };
}

function wuyinTaskContract(category, adapterId = 'wuyin_documented_task') {
  const products = listWuyinProducts({ includeDisabled: false }).filter((item) => item.category === category);
  return {
    adapterId,
    method: 'POST',
    auth: 'Authorization header + ?key=<token> when documented',
    contentType: 'per model document',
    models: products.map((item) => item.id),
    docs: products.map((item) => item.docUrl),
    resultEndpoint: 'per model document',
  };
}

const TWELVE_AI_CONTRACT = {
  providerId: '12ai-documented-multi-protocol',
  displayName: '12AI',
  docs: ['https://doc.12ai.org/docs/api'],
  allowGenericFallback: false,
  supportedTasks: {
    chat: {
      adapterId: 'twelveai_multi_protocol',
      method: 'POST',
      baseUrl: 'https://cdn.12ai.org',
      directBaseUrl: 'https://api.12ai.org',
      auth: 'OpenAI/Claude: Authorization: Bearer <sk-token>; Gemini: ?key=<sk-token>',
      contentType: 'application/json',
      protocols: {
        openai_chat: {
          endpoint: '/v1/chat/completions',
          requestShape: '{ model, messages }',
          responseShape: 'OpenAI-compatible chat completion',
        },
        claude_messages: {
          endpoint: '/v1/messages',
          requiredHeaders: ['anthropic-version: 2023-06-01'],
          requestShape: '{ model, messages, system?, max_tokens?, temperature?, stream? }',
          responseShape: 'Claude Messages response',
        },
        gemini_generate_content: {
          endpoint: '/v1beta/models/{model}:generateContent?key=<token>',
          requestShape: '{ contents: [{ parts: [{ text }] }] }',
          responseShape: 'Gemini candidates/content/parts response',
        },
      },
      note: '12AI 是独立厂商多协议预设，不混用 OpenAI/Claude/Gemini 官方 profile；只复用统一内部请求抽象。',
    },
    image: {
      adapterId: 'twelveai_image',
      method: 'POST',
      auth: 'Authorization: Bearer <token>',
      contentType: 'application/json',
      protocols: {
        sync_image: {
          endpoint: '/v1beta/models/{model}:generateContent?key=<token>',
          requestShape: '{ contents, generationConfig }',
          responseShape: 'Gemini candidates/content/parts response',
        },
        async_image: {
          endpoint: '/v1/task/submit',
          requestShape: '{ model, input: { prompt, images?, aspect_ratio?, image_size?, n? }, callback_url? }',
          responseShape: '{ id, status, outputs, error }',
        },
      },
    },
    video: {
      adapterId: 'twelveai_video',
      method: 'POST',
      auth: 'Authorization: Bearer <token>',
      contentType: 'application/json',
      protocols: {
        async_video: {
          endpoint: '/v1/videos',
          requestShape: '{ model, prompt, size?/seconds? | duration?/aspect_ratio?/images? | resolution?/ratio? }',
          responseShape: '{ id, status, output?, video_url?, data? }',
        },
      },
    },
  },
  documentedButNotExecutableYet: {
    responses: ['/v1/responses', '/v1/responses/{response_id}', '/v1/responses/{response_id}/cancel'],
  },
};

const STRICT_PROVIDER_CONTRACTS = {
  'openai-official': {
    providerId: 'openai-official',
    displayName: 'OpenAI Official',
    docs: ['https://developers.openai.com/api/reference/resources/chat'],
    allowGenericFallback: false,
    supportedTasks: {
      chat: openAIChatContract({ baseUrl: 'https://api.openai.com/v1', endpoint: '/chat/completions' }),
      models: { method: 'GET', baseUrl: 'https://api.openai.com/v1', endpoint: '/models', auth: 'Authorization: Bearer <token>' },
    },
  },
  'anthropic-official': {
    providerId: 'anthropic-official',
    displayName: 'Anthropic Claude Official',
    docs: ['https://platform.claude.com/docs/en/api/messages'],
    allowGenericFallback: false,
    supportedTasks: {
      chat: {
        adapterId: 'anthropic_messages',
        method: 'POST',
        baseUrl: 'https://api.anthropic.com/v1',
        endpoint: '/messages',
        auth: 'x-api-key: <token>',
        contentType: 'application/json',
        requiredHeaders: ['anthropic-version'],
        requestShape: '{ model, messages, system?, max_tokens, temperature?, stream? }',
        responseShape: '{ content: [{ type, text }], ... }',
      },
    },
  },
  'google-gemini-official': {
    providerId: 'google-gemini-official',
    displayName: 'Google Gemini Official',
    docs: ['https://ai.google.dev/api/generate-content'],
    allowGenericFallback: false,
    supportedTasks: {
      chat: {
        adapterId: 'google_gemini_generate_content',
        method: 'POST',
        baseUrl: 'https://generativelanguage.googleapis.com/v1beta',
        endpoint: '/models/<modelId>:generateContent?key=<token>',
        auth: 'key query parameter',
        contentType: 'application/json',
        requestShape: '{ contents, systemInstruction?, generationConfig? }',
        responseShape: '{ candidates: [{ content: { parts: [{ text }] } }] }',
      },
    },
  },
  'deepseek-official': {
    providerId: 'deepseek-official',
    displayName: 'DeepSeek Official',
    docs: ['https://api-docs.deepseek.com/'],
    allowGenericFallback: false,
    supportedTasks: {
      chat: openAIChatContract({
        adapterId: 'deepseek_chat_completions',
        baseUrl: 'https://api.deepseek.com',
        endpoint: '/chat/completions',
        note: 'DeepSeek 官方文档的 OpenAI SDK base_url 是 https://api.deepseek.com，不是 /v1。',
      }),
      anthropic_chat: {
        adapterId: 'anthropic_messages',
        method: 'POST',
        baseUrl: 'https://api.deepseek.com/anthropic',
        endpoint: '/v1/messages',
        auth: 'x-api-key: <token>',
        contentType: 'application/json',
      },
    },
  },
  'dashscope-openai-compatible': {
    providerId: 'dashscope-openai-compatible',
    displayName: 'Alibaba DashScope OpenAI-Compatible',
    docs: ['https://help.aliyun.com/zh/model-studio/compatibility-of-openai-with-dashscope'],
    allowGenericFallback: false,
    supportedTasks: { chat: openAIChatContract({ baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1', endpoint: '/chat/completions' }) },
  },
  'volcengine-ark-openai-compatible': {
    providerId: 'volcengine-ark-openai-compatible',
    displayName: 'Volcengine Ark OpenAI-Compatible',
    docs: ['https://www.volcengine.com/docs/82379/1099475'],
    allowGenericFallback: false,
    supportedTasks: { chat: openAIChatContract({ baseUrl: 'https://ark.cn-beijing.volces.com/api/v3', endpoint: '/chat/completions' }) },
  },
  'siliconflow-openai-compatible': {
    providerId: 'siliconflow-openai-compatible',
    displayName: 'SiliconFlow OpenAI-Compatible',
    docs: ['https://docs.siliconflow.cn/en/api-reference/chat-completions/chat-completions'],
    allowGenericFallback: false,
    supportedTasks: { chat: openAIChatContract({ baseUrl: 'https://api.siliconflow.cn/v1', endpoint: '/chat/completions' }) },
  },
  'openrouter-openai-compatible': {
    providerId: 'openrouter-openai-compatible',
    displayName: 'OpenRouter',
    docs: ['https://openrouter.ai/docs/api/api-reference/chat/send-chat-completion-request'],
    allowGenericFallback: false,
    supportedTasks: {
      chat: openAIChatContract({ baseUrl: 'https://openrouter.ai/api/v1', endpoint: '/chat/completions', responseShape: 'OpenAI-compatible chat completion with optional openrouter_metadata' }),
    },
  },
  'moonshot-openai-compatible': {
    providerId: 'moonshot-openai-compatible',
    displayName: 'Moonshot OpenAI-Compatible',
    docs: ['https://platform.moonshot.cn/docs/api-reference'],
    allowGenericFallback: false,
    supportedTasks: { chat: openAIChatContract({ baseUrl: 'https://api.moonshot.cn/v1', endpoint: '/chat/completions' }) },
  },
  'zhipu-openai-compatible': {
    providerId: 'zhipu-openai-compatible',
    displayName: 'Zhipu OpenAI-Compatible',
    docs: ['https://open.bigmodel.cn/dev/api/normal-model/glm-4'],
    allowGenericFallback: false,
    supportedTasks: { chat: openAIChatContract({ baseUrl: 'https://open.bigmodel.cn/api/paas/v4', endpoint: '/chat/completions' }) },
  },
  'mistral-openai-compatible': {
    providerId: 'mistral-openai-compatible',
    displayName: 'Mistral Official',
    docs: ['https://docs.mistral.ai/api/'],
    allowGenericFallback: false,
    supportedTasks: { chat: openAIChatContract({ baseUrl: 'https://api.mistral.ai/v1', endpoint: '/chat/completions' }) },
  },
  'cohere-openai-compatible': {
    providerId: 'cohere-openai-compatible',
    displayName: 'Cohere OpenAI-Compatible',
    docs: ['https://docs.cohere.com/v2/docs/compatibility-api'],
    allowGenericFallback: false,
    supportedTasks: { chat: openAIChatContract({ baseUrl: 'https://api.cohere.ai/compatibility/v1', endpoint: '/chat/completions' }) },
  },
  'gpt-best-openai-compatible': {
    providerId: 'gpt-best-openai-compatible',
    displayName: 'GPT-Best',
    docs: ['https://gpt-best.apifox.cn/llms.txt'],
    allowGenericFallback: false,
    supportedTasks: {
      chat: openAIChatContract({ baseUrl: 'https://api.gpt-best.com/v1', endpoint: '/chat/completions', docs: ['https://gpt-best.apifox.cn/llms.txt'] }),
      models: { method: 'GET', endpoint: '/models', auth: 'Authorization: Bearer <token>' },
    },
  },
  'apimart-openai-compatible': {
    providerId: 'apimart-openai-compatible',
    displayName: 'APIMart',
    docs: ['https://docs.apimart.ai/cn'],
    allowGenericFallback: false,
    supportedTasks: {
      chat: openAIChatContract({ adapterId: 'apimart_chat_completions', baseUrl: 'https://api.apimart.ai/v1', endpoint: '/chat/completions', responseShape: '{ code, data: OpenAI-compatible chat completion }' }),
    },
  },
  '12ai-documented-multi-protocol': TWELVE_AI_CONTRACT,
  '12ai-docs-pending': TWELVE_AI_CONTRACT,
  'wuyin-suchuang-form': {
    providerId: 'wuyin-suchuang-form',
    displayName: 'Wuyin / 速创',
    docs: ['https://api.wuyinkeji.com/type/all', ...listWuyinProducts({ includeDisabled: true }).map((item) => item.docUrl)],
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
      image: wuyinTaskContract('image'),
      video: wuyinTaskContract('video'),
      audio: wuyinTaskContract('audio'),
      utility: wuyinTaskContract('utility'),
    },
  },
};

function getStrictProviderContract(profileId) {
  return STRICT_PROVIDER_CONTRACTS[String(profileId || '').trim()] || null;
}

function hasStrictProviderContract(profileId) {
  return Boolean(getStrictProviderContract(profileId));
}

function resolveContractTaskType(profileId, taskType, modelId) {
  if (profileId === 'wuyin-suchuang-form') {
    const product = getWuyinProduct(modelId);
    if (product?.category) return product.category;
  }
  if (taskType === 'image_generation' || taskType === 'image_edit') return 'image';
  if (taskType === 'video_generation') return 'video';
  if (taskType === 'audio_generation' || taskType === 'tts') return 'audio';
  return taskType || 'chat';
}

function assertStrictTaskSupported(profileId, taskType, options = {}) {
  const contract = getStrictProviderContract(profileId);
  if (!contract) return null;

  const resolvedTaskType = resolveContractTaskType(profileId, String(taskType || '').trim(), options.modelId);
  const task = contract.supportedTasks[resolvedTaskType];
  if (!task) {
    const error = new Error(`${contract.displayName} 预设未声明 ${resolvedTaskType} 任务，AI Router 已阻止 generic/旧逻辑回落。请先按官方文档补充 contract。`);
    error.code = 'STRICT_PROVIDER_TASK_NOT_SUPPORTED';
    error.statusCode = 400;
    error.route = { profileId, taskType: resolvedTaskType, originalTaskType: taskType, docs: contract.docs };
    throw error;
  }

  const modelId = String(options.modelId || '').trim();
  if (Array.isArray(task.models) && modelId && !task.models.includes(modelId)) {
    const error = new Error(`${contract.displayName} 预设未声明模型 ${modelId} 可用于 ${resolvedTaskType}，AI Router 已阻止猜测式请求。`);
    error.code = 'STRICT_PROVIDER_MODEL_NOT_SUPPORTED';
    error.statusCode = 400;
    error.route = { profileId, taskType: resolvedTaskType, modelId, allowedModels: task.models, docs: contract.docs };
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
  resolveContractTaskType,
  resolveWuyinTaskTypeByModel,
};
