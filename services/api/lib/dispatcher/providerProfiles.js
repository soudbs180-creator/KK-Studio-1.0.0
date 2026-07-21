/**
 * @file providerProfiles.js
 * @module services/api/lib/dispatcher
 * @description AI Router 供应商画像库。画像只负责识别厂商；具体 endpoint、鉴权、请求体、响应结构由
 *              strictProviderContracts 与 adapter 执行。已知厂商禁止走 generic 猜测路径。
 */

function safeHostname(value) {
  try {
    return new URL(String(value || '').trim()).hostname.toLowerCase();
  } catch {
    return '';
  }
}

function includesAny(value, needles) {
  const normalized = String(value || '').toLowerCase();
  return needles.some((needle) => normalized.includes(String(needle).toLowerCase()));
}

const PROVIDER_PROFILES = [
  {
    id: 'openai-official',
    label: 'OpenAI Official',
    providerKind: 'official',
    protocolFamily: 'openai-compatible',
    adapterId: 'openai_chat_completions',
    domains: ['api.openai.com'],
    defaultBaseUrl: 'https://api.openai.com/v1',
    modelDiscovery: 'openai-models',
  },
  {
    id: 'azure-openai',
    label: 'Azure OpenAI',
    providerKind: 'official',
    protocolFamily: 'azure-openai',
    adapterId: 'azure_openai_chat_completions',
    domains: ['openai.azure.com'],
    modelDiscovery: 'manual-or-openai-compatible',
    requiresDocsVerification: true,
  },
  {
    id: 'anthropic-official',
    label: 'Anthropic Claude Official',
    providerKind: 'official',
    protocolFamily: 'claude-native',
    adapterId: 'anthropic_messages',
    domains: ['api.anthropic.com'],
    defaultBaseUrl: 'https://api.anthropic.com/v1',
    modelDiscovery: 'manual',
    fallbackModels: ['claude-3-5-sonnet-latest', 'claude-3-5-haiku-latest'],
  },
  {
    id: 'google-gemini-official',
    label: 'Google Gemini Official',
    providerKind: 'official',
    protocolFamily: 'gemini-native',
    adapterId: 'google_gemini_generate_content',
    domains: ['generativelanguage.googleapis.com'],
    defaultBaseUrl: 'https://generativelanguage.googleapis.com/v1beta',
    modelDiscovery: 'gemini-models',
    fallbackModels: ['gemini-2.5-flash', 'gemini-2.5-pro'],
  },
  {
    id: 'deepseek-official',
    label: 'DeepSeek Official',
    providerKind: 'official',
    protocolFamily: 'deepseek-openai-compatible',
    adapterId: 'deepseek_chat_completions',
    domains: ['api.deepseek.com'],
    defaultBaseUrl: 'https://api.deepseek.com',
    authKeyEnv: 'DEEPSEEK_API_KEY',
    modelDiscovery: 'manual-or-openai-compatible',
    fallbackModels: ['deepseek-chat', 'deepseek-reasoner'],
  },
  {
    id: 'dashscope-openai-compatible',
    label: 'Alibaba DashScope OpenAI-Compatible',
    providerKind: 'official',
    protocolFamily: 'dashscope-openai-compatible',
    adapterId: 'openai_chat_completions',
    domains: ['dashscope.aliyuncs.com'],
    pathHints: ['/compatible-mode'],
    defaultBaseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
    authKeyEnv: 'DASHSCOPE_API_KEY',
    modelDiscovery: 'openai-models',
    fallbackModels: ['qwen-plus', 'qwen-turbo', 'qwen-max'],
  },
  {
    id: 'volcengine-ark-openai-compatible',
    label: 'Volcengine Ark OpenAI-Compatible',
    providerKind: 'official',
    protocolFamily: 'volcengine-ark-openai-compatible',
    adapterId: 'openai_chat_completions',
    domains: ['ark.cn-beijing.volces.com'],
    defaultBaseUrl: 'https://ark.cn-beijing.volces.com/api/v3',
    authKeyEnv: 'VOLCENGINE_API_KEY',
    modelDiscovery: 'manual-or-openai-compatible',
  },
  {
    id: 'tencent',
    label: 'Tencent Cloud',
    providerKind: 'official',
    protocolFamily: 'openai-compatible',
    adapterId: 'openai_chat_completions',
    domains: ['tencent.com', 'tencentcloudapi', 'api.hunyuan.cloud.tencent.com'],
    defaultBaseUrl: 'https://api.hunyuan.cloud.tencent.com/v1',
    authKeyEnv: 'HUNYUAN_API_KEY',
    modelDiscovery: 'manual-or-openai-compatible',
  },
  {
    id: 'gpt-best-openai-compatible',
    label: 'GPT-Best OpenAI-Compatible',
    providerKind: 'relay',
    protocolFamily: 'gpt-best-openai-compatible',
    adapterId: 'openai_chat_completions',
    domains: ['gpt-best.com', 'api.gpt-best.com', 'gpt-best.apifox.cn'],
    providerHints: ['gpt-best', 'gptbest', 'GPT-Best'],
    defaultBaseUrl: 'https://api.gpt-best.com/v1',
    modelDiscovery: 'openai-models',
    strictDocs: {
      source: 'https://gpt-best.apifox.cn/llms.txt',
      notes: 'GPT-Best 文档索引声明聊天模型兼容 OpenAI 格式，并另有 Claude/Gemini/视频/绘图等独立文档；未建 contract 的任务禁止猜测执行。',
    },
  },
  {
    id: 'apimart-openai-compatible',
    label: 'APIMart OpenAI-Compatible',
    providerKind: 'relay',
    protocolFamily: 'apimart-openai-compatible',
    adapterId: 'apimart_chat_completions',
    domains: ['api.apimart.ai', 'docs.apimart.ai', 'apimart.ai'],
    providerHints: ['apimart', 'API Mart', 'APIMart'],
    defaultBaseUrl: 'https://api.apimart.ai/v1',
    modelDiscovery: 'manual-or-openai-compatible',
    fallbackModels: ['gpt-5', 'gpt-5-mini', 'gpt-5-nano', 'claude-sonnet-4-5-20250929', 'claude-haiku-4-5-20251001', 'gemini-2.5-flash', 'gemini-2.5-pro', 'deepseek-v3.1-250821'],
    strictDocs: {
      source: 'https://docs.apimart.ai/cn',
      responseEnvelope: 'APIMart examples wrap OpenAI chat response under { code, data }.',
    },
  },
  {
    id: '12ai-documented-multi-protocol',
    aliases: ['12ai-docs-pending'],
    label: '12AI Documented Multi-Protocol',
    providerKind: 'relay',
    protocolFamily: '12ai-documented-multi-protocol',
    adapterId: 'twelveai_multi_protocol',
    domains: ['12ai.org', 'cdn.12ai.org', 'api.12ai.org', 'doc.12ai.org'],
    providerHints: ['12ai', '12AI', '12 AI'],
    defaultBaseUrl: 'https://cdn.12ai.org',
    modelDiscovery: 'manual',
    fallbackModels: ['gpt-5.1', 'gemini-3-pro-preview'],
    generationCapabilities: {
      imageGeneration: true,
      textToVideo: true,
      imageToVideo: true,
      firstLastFrameVideo: false,
      videoExtension: false,
      audioGeneration: false,
      audioSynchronizedVideo: false,
      supportedDurationsSeconds: [],
      supportedResolutions: [],
      maxConcurrentImage: 8,
      maxConcurrentVideo: 2,
      maxConcurrentAudio: 0,
    },
    strictDocs: {
      source: 'https://doc.12ai.org/docs/api',
      defaultBaseUrl: 'https://cdn.12ai.org',
      directBaseUrl: 'https://api.12ai.org',
      notes: '12AI 独立多协议预设：OpenAI Chat 使用 /v1/chat/completions，Claude Messages 使用 /v1/messages，Gemini Generate Content 使用 /v1beta/models/{model}:generateContent?key=。不要混用其它厂商 profile。',
    },
  },
  {
    id: 'siliconflow-openai-compatible',
    label: 'SiliconFlow OpenAI-Compatible',
    providerKind: 'relay',
    protocolFamily: 'siliconflow-openai-compatible',
    adapterId: 'openai_chat_completions',
    domains: ['api.siliconflow.cn'],
    defaultBaseUrl: 'https://api.siliconflow.cn/v1',
    modelDiscovery: 'openai-models',
    strictDocs: {
      source: 'https://docs.siliconflow.cn/cn/userguide/introduction',
      notes: 'SiliconFlow 为 OpenAI 兼容中转站：chat 走 /v1/chat/completions，模型列表走 /v1/models。不要与官方 OpenAI profile 混用。',
    },
  },
  {
    id: 'openrouter-openai-compatible',
    label: 'OpenRouter',
    providerKind: 'relay',
    protocolFamily: 'openrouter-openai',
    adapterId: 'openai_chat_completions',
    domains: ['openrouter.ai'],
    defaultBaseUrl: 'https://openrouter.ai/api/v1',
    modelDiscovery: 'openai-models',
    strictDocs: {
      source: 'https://openrouter.ai/docs/quickstart',
      notes: 'OpenRouter 为 OpenAI 兼容聚合中转：chat 走 /api/v1/chat/completions，模型列表走 /api/v1/models。支持额外 HTTP-Referer / X-Title 头。不要与官方 OpenAI profile 混用。',
    },
  },
  {
    id: 'moonshot-openai-compatible',
    label: 'Moonshot OpenAI-Compatible',
    providerKind: 'official',
    protocolFamily: 'moonshot-openai-compatible',
    adapterId: 'openai_chat_completions',
    domains: ['api.moonshot.cn'],
    defaultBaseUrl: 'https://api.moonshot.cn/v1',
    modelDiscovery: 'openai-models',
  },
  {
    id: 'zhipu-openai-compatible',
    label: 'Zhipu OpenAI-Compatible',
    providerKind: 'official',
    protocolFamily: 'zhipu-openai-compatible',
    adapterId: 'openai_chat_completions',
    domains: ['open.bigmodel.cn'],
    defaultBaseUrl: 'https://open.bigmodel.cn/api/paas/v4',
    modelDiscovery: 'manual-or-openai-compatible',
  },
  {
    id: 'mistral-openai-compatible',
    label: 'Mistral Official',
    providerKind: 'official',
    protocolFamily: 'mistral-openai-compatible',
    adapterId: 'openai_chat_completions',
    domains: ['api.mistral.ai'],
    defaultBaseUrl: 'https://api.mistral.ai/v1',
    modelDiscovery: 'openai-models',
  },
  {
    id: 'cohere-openai-compatible',
    label: 'Cohere OpenAI-Compatible',
    providerKind: 'official',
    protocolFamily: 'cohere-openai-compatible',
    adapterId: 'openai_chat_completions',
    domains: ['api.cohere.ai'],
    defaultBaseUrl: 'https://api.cohere.ai/compatibility/v1',
    modelDiscovery: 'manual-or-openai-compatible',
  },
  {
    id: 'ollama-openai-compatible',
    label: 'Ollama Local OpenAI-Compatible',
    providerKind: 'relay',
    protocolFamily: 'ollama-openai-compatible',
    adapterId: 'openai_chat_completions',
    domains: ['localhost', '127.0.0.1'],
    pathHints: [':11434'],
    defaultBaseUrl: 'http://localhost:11434/v1',
    modelDiscovery: 'openai-models',
  },
  {
    id: 'one-api-new-api-compatible',
    label: 'One API / New API Compatible',
    providerKind: 'relay',
    protocolFamily: 'openai-compatible',
    adapterId: 'openai_chat_completions',
    providerHints: ['oneapi', 'one-api', 'newapi', 'new-api'],
    modelDiscovery: 'openai-models',
  },
  {
    id: 'wuyin-suchuang-form',
    label: 'Wuyin/Suchuang Documented API',
    providerKind: 'relay',
    protocolFamily: 'wuyin-documented-multi-task',
    adapterId: 'custom_form_urlencoded',
    domains: ['wuyinkeji.com', 'api.wuyinkeji.com'],
    providerHints: ['wuyin', 'suchuang', '速创', '悟因'],
    pathHints: ['/api/chat/index', '/api/async/', '/type/all'],
    defaultBaseUrl: 'https://api.wuyinkeji.com/api/chat/index',
    modelDiscovery: 'wuyin-catalog',
    catalogUrl: 'https://api.wuyinkeji.com/type/all',
    fallbackModels: ['chat_index', 'image_nanoBanana2', 'image_nanoBanana_pro', 'image_gpt', 'video_google_omni'],
    generationCapabilities: {
      imageGeneration: true,
      textToVideo: true,
      imageToVideo: true,
      firstLastFrameVideo: true,
      videoExtension: true,
      audioGeneration: true,
      audioSynchronizedVideo: true,
      supportedDurationsSeconds: [],
      supportedResolutions: [],
      maxConcurrentImage: 8,
      maxConcurrentVideo: 2,
      maxConcurrentAudio: 4,
    },
    strictDocs: {
      source: 'https://api.wuyinkeji.com/type/all',
      catalog: 'https://api.wuyinkeji.com/type/all',
      notes: 'Wuyin 必须按模型文档分 task 执行：chat 走 /api/chat/index 表单；image/video/audio/utility 走各自产品文档 contract。',
    },
  },
  {
    id: 'vodeshop-relay',
    label: 'Vodeshop Relay (future-api.vodeshop.com)',
    providerKind: 'relay',
    protocolFamily: 'openai-compatible',
    adapterId: 'openai_chat_completions',
    domains: ['future-api.vodeshop.com'],
    providerHints: ['vodeshop', 'future-api'],
    defaultBaseUrl: 'https://future-api.vodeshop.com/v1',
    modelDiscovery: 'manual-or-openai-compatible',
    fallbackModels: ['gemini-2.5-flash-image'],
    // 中转站(relay)：密钥使用 VODESHOP_RELAY_API_KEY，禁止借用官方 GEMINI_API_KEY 命名。
    authKeyEnv: 'VODESHOP_RELAY_API_KEY',
    strictDocs: {
      source: 'https://future-api.vodeshop.com',
      notes: 'Vodeshop 为 OpenAI 兼容中转站：chat 走 /v1/chat/completions，模型列表 /v1beta/models（按其文档）。不要与官方 Gemini profile 混用，密钥用 VODESHOP_RELAY_API_KEY。',
    },
  },
  {
    id: 'generic-openai-compatible',
    label: 'Generic OpenAI-Compatible Relay',
    providerKind: 'relay',
    protocolFamily: 'openai-compatible',
    adapterId: 'openai_chat_completions',
    modelDiscovery: 'openai-models',
    fallbackModels: ['gpt-4o-mini'],
  },
];

function profileIdMatches(profile, id) {
  return profile.id === id || (Array.isArray(profile.aliases) && profile.aliases.includes(id));
}

function matchProviderProfile(input = {}) {
  const baseUrl = String(input.baseUrl || input.base_url || '').trim();
  const hostname = safeHostname(baseUrl);
  const providerHint = String(input.providerHint || input.provider_id || input.providerName || input.provider_name || '').trim();
  const requestProfileId = String(input.requestProfileId || input.request_profile_id || '').trim();
  const endpointType = String(input.endpointType || input.endpoint_type || '').trim();
  const lowerBaseUrl = baseUrl.toLowerCase();

  if (requestProfileId) {
    const byId = PROVIDER_PROFILES.find((profile) => profileIdMatches(profile, requestProfileId));
    if (byId) return byId;
    const byProtocol = PROVIDER_PROFILES.find((profile) => profile.protocolFamily === requestProfileId);
    if (byProtocol) return byProtocol;
  }

  if (endpointType) {
    const byAdapter = PROVIDER_PROFILES.find((profile) => profile.adapterId === endpointType);
    if (byAdapter && !['openai_chat_completions', 'apimart_chat_completions'].includes(endpointType)) return byAdapter;
  }

  for (const profile of PROVIDER_PROFILES) {
    if (Array.isArray(profile.domains) && hostname && profile.domains.some((domain) => hostname === domain || hostname.endsWith(`.${domain}`) || hostname.includes(domain))) {
      if (!profile.pathHints || includesAny(lowerBaseUrl, profile.pathHints) || !profile.pathHints.length) {
        return profile;
      }
    }
  }

  for (const profile of PROVIDER_PROFILES) {
    if (Array.isArray(profile.providerHints) && includesAny(providerHint, profile.providerHints)) {
      return profile;
    }
  }

  for (const profile of PROVIDER_PROFILES) {
    if (Array.isArray(profile.pathHints) && includesAny(lowerBaseUrl, profile.pathHints)) {
      return profile;
    }
  }

  return PROVIDER_PROFILES.find((profile) => profile.id === 'generic-openai-compatible');
}

function getProviderProfile(profileId) {
  return PROVIDER_PROFILES.find((profile) => profileIdMatches(profile, profileId)) || null;
}

module.exports = {
  PROVIDER_PROFILES,
  getProviderProfile,
  matchProviderProfile,
  safeHostname,
};
