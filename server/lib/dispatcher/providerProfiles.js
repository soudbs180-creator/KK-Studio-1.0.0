/**
 * @file providerProfiles.js
 * @module server/lib/dispatcher
 * @description AI Router 供应商画像库。画像只描述“如何识别/归类供应商”，不承载积分、用户或管理员差异。
 *              管理员系统渠道和用户自带 Key 共享这些画像；管理员只在外层增加计费与审计。
 *              对已知第三方预设必须严格按官方文档声明的协议调用，禁止落入 generic 猜测路径。
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
    adapterId: 'openai_chat_completions',
    domains: ['openai.azure.com'],
    modelDiscovery: 'manual-or-openai-compatible',
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
    protocolFamily: 'openai-compatible',
    adapterId: 'openai_chat_completions',
    domains: ['api.deepseek.com'],
    defaultBaseUrl: 'https://api.deepseek.com/v1',
    modelDiscovery: 'openai-models',
    fallbackModels: ['deepseek-chat', 'deepseek-reasoner'],
  },
  {
    id: 'dashscope-openai-compatible',
    label: 'Alibaba DashScope OpenAI-Compatible',
    providerKind: 'official',
    protocolFamily: 'openai-compatible',
    adapterId: 'openai_chat_completions',
    domains: ['dashscope.aliyuncs.com'],
    pathHints: ['/compatible-mode'],
    defaultBaseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
    modelDiscovery: 'openai-models',
    fallbackModels: ['qwen-plus', 'qwen-turbo', 'qwen-max'],
  },
  {
    id: 'volcengine-ark-openai-compatible',
    label: 'Volcengine Ark OpenAI-Compatible',
    providerKind: 'official',
    protocolFamily: 'openai-compatible',
    adapterId: 'openai_chat_completions',
    domains: ['ark.cn-beijing.volces.com'],
    defaultBaseUrl: 'https://ark.cn-beijing.volces.com/api/v3',
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
      chatEndpoint: '/v1/chat/completions',
      auth: 'Authorization: Bearer <token>',
      notes: 'GPT-Best 文档索引声明所有对话模型兼容 OpenAI 格式，并提供 Models、OpenAI Chat、Claude 官方格式、Gemini 官方格式等 API 文档入口。',
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
    fallbackModels: [
      'gpt-5',
      'gpt-5-mini',
      'gpt-5-nano',
      'claude-sonnet-4-5-20250929',
      'claude-haiku-4-5-20251001',
      'gemini-2.5-flash',
      'gemini-2.5-pro',
      'deepseek-v3.1-250821',
    ],
    strictDocs: {
      source: 'https://docs.apimart.ai/cn',
      chatEndpoint: '/v1/chat/completions',
      auth: 'Authorization: Bearer <token>',
      responseEnvelope: 'APIMart examples wrap OpenAI chat response under { code, data }.',
      defaultStream: true,
    },
  },
  {
    id: '12ai-docs-pending',
    label: '12AI Docs-Pending Preset',
    providerKind: 'relay',
    protocolFamily: '12ai-docs-pending',
    adapterId: 'docs_pending_adapter',
    domains: ['12ai.org', 'doc.12ai.org'],
    providerHints: ['12ai', '12AI'],
    modelDiscovery: 'manual',
    requiresDocsVerification: true,
    strictDocs: {
      source: 'https://doc.12ai.org/docs/api',
      notes: '当前文档入口在抓取环境没有返回可解析的接口细节；为避免私加错误 endpoint，命中 12AI 时必须显式补充官方 endpoint/鉴权/请求体后再启用。',
    },
  },
  {
    id: 'siliconflow-openai-compatible',
    label: 'SiliconFlow OpenAI-Compatible',
    providerKind: 'relay',
    protocolFamily: 'openai-compatible',
    adapterId: 'openai_chat_completions',
    domains: ['api.siliconflow.cn'],
    defaultBaseUrl: 'https://api.siliconflow.cn/v1',
    modelDiscovery: 'openai-models',
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
  },
  {
    id: 'moonshot-openai-compatible',
    label: 'Moonshot OpenAI-Compatible',
    providerKind: 'official',
    protocolFamily: 'openai-compatible',
    adapterId: 'openai_chat_completions',
    domains: ['api.moonshot.cn'],
    defaultBaseUrl: 'https://api.moonshot.cn/v1',
    modelDiscovery: 'openai-models',
  },
  {
    id: 'zhipu-openai-compatible',
    label: 'Zhipu OpenAI-Compatible',
    providerKind: 'official',
    protocolFamily: 'openai-compatible',
    adapterId: 'openai_chat_completions',
    domains: ['open.bigmodel.cn'],
    defaultBaseUrl: 'https://open.bigmodel.cn/api/paas/v4',
    modelDiscovery: 'manual-or-openai-compatible',
  },
  {
    id: 'mistral-openai-compatible',
    label: 'Mistral Official',
    providerKind: 'official',
    protocolFamily: 'openai-compatible',
    adapterId: 'openai_chat_completions',
    domains: ['api.mistral.ai'],
    defaultBaseUrl: 'https://api.mistral.ai/v1',
    modelDiscovery: 'openai-models',
  },
  {
    id: 'cohere-openai-compatible',
    label: 'Cohere OpenAI-Compatible',
    providerKind: 'official',
    protocolFamily: 'openai-compatible',
    adapterId: 'openai_chat_completions',
    domains: ['api.cohere.ai'],
    defaultBaseUrl: 'https://api.cohere.ai/compatibility/v1',
    modelDiscovery: 'manual-or-openai-compatible',
  },
  {
    id: 'ollama-openai-compatible',
    label: 'Ollama Local OpenAI-Compatible',
    providerKind: 'relay',
    protocolFamily: 'openai-compatible',
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
    label: 'Wuyin/Suchuang Form API',
    providerKind: 'relay',
    protocolFamily: 'wuyin-form',
    adapterId: 'custom_form_urlencoded',
    domains: ['wuyinkeji.com', 'api.wuyinkeji.com'],
    providerHints: ['wuyin', 'suchuang', '速创', '悟因'],
    pathHints: ['/api/chat/index', '/api/async/', '/type/all'],
    defaultBaseUrl: 'https://api.wuyinkeji.com/api/chat/index',
    modelDiscovery: 'wuyin-catalog',
    catalogUrl: 'https://api.wuyinkeji.com/type/all',
    fallbackModels: ['chat_index', 'image_nanoBanana2', 'image_nanoBanana', 'image_gpt', 'video_google_omni', 'audio_tts'],
    strictDocs: {
      source: 'https://api.wuyinkeji.com/type/all',
      catalog: 'https://api.wuyinkeji.com/type/all',
      notes: 'Wuyin/速创目录入口是产品目录，聊天接口走现有专用表单适配器；不要把它强行当成 OpenAI-compatible。',
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

function matchProviderProfile(input = {}) {
  const baseUrl = String(input.baseUrl || input.base_url || '').trim();
  const hostname = safeHostname(baseUrl);
  const providerHint = String(input.providerHint || input.provider_id || input.providerName || input.provider_name || '').trim();
  const requestProfileId = String(input.requestProfileId || input.request_profile_id || '').trim();
  const endpointType = String(input.endpointType || input.endpoint_type || '').trim();
  const lowerBaseUrl = baseUrl.toLowerCase();

  if (requestProfileId) {
    const byId = PROVIDER_PROFILES.find((profile) => profile.id === requestProfileId);
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
  return PROVIDER_PROFILES.find((profile) => profile.id === profileId) || null;
}

module.exports = {
  PROVIDER_PROFILES,
  getProviderProfile,
  matchProviderProfile,
  safeHostname,
};
