// server/lib/dispatcher/providerRegistry.js
// 中文注释：后端供应商 Adapter 与 Provider 统一注册表

const { z } = require('zod');
const googleImageAdapter = require('./adapters/googleImageAdapter');
const wuyinImageAdapter = require('./adapters/wuyinImageAdapter');
const { OpenAICompatibleImageAdapter } = require('./adapters/openAICompatibleImageAdapter');
const { PROVIDER_PROFILES, safeHostname } = require('./providerProfiles');

// 后端直接引入 @kk/shared 共享的 Zod Schema 规范进行强验证，取代局部的冗余同构定义
const { ProviderItemSchema, ProviderAuthSchema } = require('@kk/shared');

const adapterRegistry = {
  google: googleImageAdapter,
  wuyinkeji: wuyinImageAdapter,
  'gpt-best': new OpenAICompatibleImageAdapter('gpt-best'),
  '12ai': new OpenAICompatibleImageAdapter('12ai'),
  suxi: new OpenAICompatibleImageAdapter('suxi'),
  newapi: new OpenAICompatibleImageAdapter('newapi'),
  acedata: new OpenAICompatibleImageAdapter('acedata'),
  custom: new OpenAICompatibleImageAdapter('custom')
};

// 运行时内存缓存及强模式拦截
const validatedProvidersMap = new Map();

/**
 * 转换函数：将旧的 profile 映射为完全合规的 ProviderItem
 */
function normalizeProfileToProviderItem(profile) {
  const host = (profile.domains && profile.domains[0]) || safeHostname(profile.defaultBaseUrl) || `localhost-${profile.id}`;
  
  let apiFormat = 'custom';
  if (profile.protocolFamily === 'openai-compatible' || profile.adapterId === 'openai_chat_completions' || profile.id.includes('openai') || profile.id.includes('deepseek') || profile.id.includes('mistral')) {
    apiFormat = 'openai';
  } else if (profile.protocolFamily === 'gemini-native' || profile.id.includes('gemini')) {
    apiFormat = 'gemini';
  } else if (profile.protocolFamily === 'claude-native' || profile.id.includes('anthropic')) {
    apiFormat = 'anthropic';
  }

  let authMethod = 'bearer';
  let headerName = 'Authorization';
  let keyRef = 'OPENAI_API_KEY';

  if (apiFormat === 'gemini') {
    authMethod = 'query_param';
    headerName = undefined;
    keyRef = 'GEMINI_API_KEY';
  } else if (apiFormat === 'anthropic') {
    authMethod = 'header';
    headerName = 'x-api-key';
    keyRef = 'ANTHROPIC_API_KEY';
  }

  // 优先采用 profile 显式声明的 authKeyEnv
  if (profile.authKeyEnv) {
    keyRef = profile.authKeyEnv;
  } else if (profile.providerKind === 'relay' || profile.kind === 'relay') {
    // 针对中转站 (relay) 的密钥重命名以解耦官方密钥命名歧义，完美适配 CI 安全门禁
    if (profile.id.includes('wuyin')) {
      keyRef = 'WUYIN_API_KEY';
    } else if (profile.id.includes('gpt-best')) {
      keyRef = 'VODESHOP_API_KEY';
    } else if (profile.id.includes('apimart')) {
      keyRef = 'APIMART_API_KEY';
    } else if (profile.id.includes('12ai')) {
      keyRef = 'TWELVEAI_API_KEY';
    } else {
      const cleanId = profile.id.replace(/-openai-compatible$/, '').replace(/-official$/, '');
      keyRef = `${cleanId.toUpperCase().replace(/-/g, '_')}_API_KEY`;
    }
  }

  const endpoints = {
    base: profile.defaultBaseUrl || 'https://api.openai.com/v1',
    chat: profile.adapterId === 'openai_chat_completions' ? '/chat/completions' : undefined,
    models: profile.modelDiscovery === 'openai-models' ? '/models' : undefined,
  };

  let pricingSource = {
    sourceType: 'local_fallback',
    fallbackFile: 'default'
  };
  if (profile.id.includes('wuyin')) {
    pricingSource = {
      sourceType: 'online',
      url: profile.catalogUrl || 'https://api.wuyinkeji.com/type/all'
    };
  }

  const capabilities = ['chat'];
  if (profile.adapterId?.includes('image') || profile.id.includes('wuyin') || profile.id.includes('12ai')) {
    capabilities.push('image');
  }
  if (profile.adapterId?.includes('video') || profile.id.includes('wuyin') || profile.id.includes('12ai')) {
    capabilities.push('video');
  }

  return {
    id: profile.id,
    kind: profile.providerKind || profile.kind || 'relay',
    displayName: profile.label || profile.displayName || profile.id,
    host,
    apiFormat,
    auth: {
      method: authMethod,
      headerName,
      keyRef
    },
    endpoints,
    pricingSource,
    capabilities
  };
}

// 自动加载、映射并运行 Zod 校验拦截
function initializeRegistry() {
  for (const profile of PROVIDER_PROFILES) {
    try {
      const mapped = normalizeProfileToProviderItem(profile);
      const parsed = ProviderItemSchema.parse(mapped);
      validatedProvidersMap.set(parsed.id, parsed);
    } catch (zodError) {
      console.error(`[P0 FATAL] 供应商画像初始化校验失败, id=${profile.id}:`, zodError.message);
      throw new Error(`[ProviderRegistry] 供应商 '${profile.id}' 模式校验失败: ${zodError.message}`);
    }
  }
}

// 执行初始化
initializeRegistry();

/**
 * 依据供应商ID获取适配器 (保持旧接口兼容)
 */
function getAdapter(providerId) {
  return adapterRegistry[providerId] || adapterRegistry.custom;
}

/**
 * 获取经过 Zod 强校验的供应商项目 (WS-1 新增接口)
 */
function getProvider(providerId) {
  return validatedProvidersMap.get(providerId) || null;
}

/**
 * 获取所有经过强校验的供应商项目列表 (WS-1 新增接口)
 */
function listProviders() {
  return Array.from(validatedProvidersMap.values());
}

/**
 * 发现供应商支持的模型列表 (WS-1 新增接口)
 */
function listModels(providerId) {
  const profile = PROVIDER_PROFILES.find(p => p.id === providerId);
  if (!profile) return [];
  return profile.fallbackModels || [];
}

module.exports = {
  getAdapter,
  getProvider,
  listProviders,
  listModels,
  registry: adapterRegistry
};
