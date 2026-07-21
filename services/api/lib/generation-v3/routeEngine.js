// services/api/lib/generation-v3/routeEngine.js
// 中文注释：根据 Quote 请求选择 Provider 与 Adapter，生成 routeSnapshot。
//          Phase 1 聚焦接口冻结与通道互斥；真实 Provider 映射在后续 Phase 逐步替换。

const { registry } = require('./providerAdapter');
// 注册 Fake Provider 作为默认兜底（后续真实 Provider Adapter 注册后优先匹配）
require('./fakeProviderAdapter');

/**
 * @typedef {import('@kk/shared').MediaType} MediaType
 * @typedef {import('@kk/shared').GenerationChannel} GenerationChannel
 * @typedef {import('@kk/shared').ProviderRouteSnapshot} ProviderRouteSnapshot
 */

const MODEL_TO_PROVIDER_HINT = {
  'gpt-best': { providerId: 'gpt-best', adapterId: 'openai-compatible-image', capabilityVersion: '1.0.0' },
  'gemini': { providerId: 'google', adapterId: 'google-image', capabilityVersion: '1.0.0' },
  'imagen': { providerId: 'google', adapterId: 'google-image', capabilityVersion: '1.0.0' },
  'image_nanoBanana2': { providerId: 'wuyinkeji', adapterId: 'wuyin-image', capabilityVersion: '1.0.0' },
  'wuyin': { providerId: 'wuyinkeji', adapterId: 'wuyin-documented', capabilityVersion: '1.0.0' },
  'sora': { providerId: 'wuyinkeji', adapterId: 'wuyin-documented', capabilityVersion: '1.0.0' },
  'voice': { providerId: 'wuyinkeji', adapterId: 'wuyin-documented', capabilityVersion: '1.0.0' },
};

function detectProviderHint(model, mediaType) {
  const normalized = String(model || '').toLowerCase();
  for (const [prefix, hint] of Object.entries(MODEL_TO_PROVIDER_HINT)) {
    if (normalized.includes(prefix.toLowerCase())) return hint;
  }

  // 按 mediaType 兜底：视频/音频走 Wuyin 文档化异步任务，图片默认走 Wuyin 同步图片
  if (mediaType === 'video' || mediaType === 'audio') {
    return { providerId: 'wuyinkeji', adapterId: 'wuyin-documented', capabilityVersion: '1.0.0' };
  }
  if (mediaType === 'image' && normalized.startsWith('image_')) {
    return { providerId: 'wuyinkeji', adapterId: 'wuyin-image', capabilityVersion: '1.0.0' };
  }

  return { providerId: 'fake-provider', adapterId: 'fake-provider', capabilityVersion: '1.0.0' };
}

/**
 * 选择 Provider 路由。
 * @param {Object} params
 * @param {MediaType} params.mediaType
 * @param {string} params.model
 * @param {GenerationChannel} params.channel
 * @param {string} [params.providerHint]
 * @param {Object} [params.options]
 * @returns {{ providerId: string, adapterId: string, capabilityVersion: string, adapter: import('./providerAdapter').ProviderAdapter }}
 */
function selectRoute({ mediaType, model, channel, providerHint, options = {} }) {
  if (channel === 'setup-required') {
    const err = new Error('This channel requires provider setup before routing.');
    err.code = 'SETUP_REQUIRED';
    err.statusCode = 403;
    throw err;
  }

  let hint;
  if (options.connectionRoute) {
    hint = options.connectionRoute;
  } else if (providerHint && MODEL_TO_PROVIDER_HINT[providerHint.toLowerCase()]) {
    hint = MODEL_TO_PROVIDER_HINT[providerHint.toLowerCase()];
  } else {
    hint = detectProviderHint(model, mediaType);
  }

  // 测试模式下强制使用 fake-provider
  if (options.useFakeProvider === true) {
    hint = { providerId: 'fake-provider', adapterId: 'fake-provider', capabilityVersion: '1.0.0' };
  }

  const adapter = registry.get(hint.adapterId);
  if (!adapter) {
    const err = new Error(`No adapter registered for ${hint.adapterId}`);
    err.code = 'PROVIDER_ROUTE_MISMATCH';
    err.statusCode = 400;
    throw err;
  }

  return {
    providerId: hint.providerId,
    adapterId: hint.adapterId,
    capabilityVersion: hint.capabilityVersion,
    adapter,
  };
}

/**
 * 构造冻结用的 ProviderRouteSnapshot。
 * @param {Object} params
 * @param {string} params.providerId
 * @param {string} params.model
 * @param {string} params.adapterId
 * @param {string} params.capabilityVersion
 * @param {string} [params.baseUrl]
 * @returns {ProviderRouteSnapshot}
 */
function buildRouteSnapshot({
  providerId,
  connectionId,
  model,
  capabilityId,
  channel,
  requestProfile,
  adapterId,
  capabilityVersion,
  baseUrl,
  connectionUpdatedAt,
  bindingUpdatedAt,
}) {
  return {
    providerId,
    connectionId,
    modelId: model,
    capabilityId,
    channel,
    requestProfile,
    adapterId,
    adapterVersion: capabilityVersion,
    baseUrl,
    capabilityVersion,
    connectionUpdatedAt,
    bindingUpdatedAt,
  };
}

module.exports = {
  selectRoute,
  buildRouteSnapshot,
  detectProviderHint,
};
