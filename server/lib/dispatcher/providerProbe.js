/**
 * @file providerProbe.js
 * @module server/lib/dispatcher
 * @description AI Router 通用供应商探测器。用户或管理员只需要填写 Base URL 与 Key，
 *              系统根据供应商画像库自动识别协议族、模型发现方式、推荐适配器和规范化地址。
 *              命中强预设时返回 strictContract，提示执行层禁止 generic/旧逻辑回落。
 */

const fetch = require('node-fetch');
const { normalizeBaseUrl } = require('./adapterRegistry');
const { matchProviderProfile } = require('./providerProfiles');
const { getStrictProviderContract } = require('./strictProviderContracts');

const PROBE_TIMEOUT_MS = 12000;
const DEFAULT_MODELS = ['gpt-4o-mini', 'gpt-4o', 'chat_index'];

function uniqueStrings(values) {
  return Array.from(new Set(
    values
      .map((item) => String(item || '').trim())
      .filter(Boolean)
  ));
}

function withTimeout() {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), PROBE_TIMEOUT_MS);
  return {
    signal: controller.signal,
    done: () => clearTimeout(timeoutId),
  };
}

function redactUrl(url) {
  try {
    const parsed = new URL(url);
    parsed.searchParams.delete('key');
    parsed.searchParams.delete('api_key');
    parsed.searchParams.delete('token');
    return parsed.toString();
  } catch {
    return String(url || '').replace(/(key|api_key|token)=([^&]+)/gi, '$1=***');
  }
}

function normalizeModelRows(rows, fallbackModels = []) {
  const ids = [];
  if (Array.isArray(rows)) {
    for (const row of rows) {
      if (typeof row === 'string') {
        ids.push(row);
      } else if (row && typeof row === 'object') {
        ids.push(row.id || row.model || row.name || row.model_id || row.display_name);
      }
    }
  }

  const merged = uniqueStrings([...ids, ...fallbackModels]);
  return merged.map((id) => ({
    id,
    displayName: id,
  }));
}

function withStrictContract(result, profile) {
  const contract = getStrictProviderContract(profile.id);
  if (!contract) return result;
  return {
    ...result,
    strictContract: {
      providerId: contract.providerId,
      displayName: contract.displayName,
      docs: contract.docs,
      allowGenericFallback: Boolean(contract.allowGenericFallback),
      requiresDocsVerification: Boolean(contract.requiresDocsVerification),
      supportedTasks: Object.keys(contract.supportedTasks || {}),
    },
    warnings: [
      ...(result.warnings || []),
      contract.allowGenericFallback === false
        ? `${contract.displayName} 已命中强预设：执行时只允许使用官方文档 contract，不允许回落 generic/旧逻辑。`
        : '',
      contract.requiresDocsVerification
        ? `${contract.displayName} 文档未核对完整，已禁止猜测式请求。`
        : '',
    ].filter(Boolean),
  };
}

async function fetchJson(url, options) {
  const timeout = withTimeout();
  try {
    const response = await fetch(url, {
      ...options,
      signal: timeout.signal,
    });
    const text = await response.text();
    let data = null;
    try {
      data = text ? JSON.parse(text) : null;
    } catch {
      data = null;
    }
    return {
      ok: response.ok,
      status: response.status,
      text,
      data,
    };
  } finally {
    timeout.done();
  }
}

function normalizeBaseUrlForProfile(baseUrl, profile) {
  if (profile.defaultBaseUrl && (!baseUrl || baseUrl === profile.defaultBaseUrl)) {
    return profile.defaultBaseUrl;
  }
  if (profile.protocolFamily === 'gemini-native') {
    return normalizeBaseUrl(baseUrl || profile.defaultBaseUrl, { noVersionAppend: true });
  }
  if (profile.protocolFamily === 'wuyin-form') {
    const rawBaseUrl = String(baseUrl || profile.defaultBaseUrl || 'https://api.wuyinkeji.com').trim();
    let normalizedBaseUrl = rawBaseUrl.replace(/\/+$/, '');
    if (!normalizedBaseUrl.toLowerCase().includes('/api/chat/index') && !normalizedBaseUrl.toLowerCase().includes('/api/async/')) {
      normalizedBaseUrl = `${normalizedBaseUrl}/api/chat/index`;
    }
    return normalizedBaseUrl;
  }
  return normalizeBaseUrl(baseUrl || profile.defaultBaseUrl || '');
}

function buildOpenAIModelsUrl(baseUrl, profile) {
  return `${normalizeBaseUrlForProfile(baseUrl, profile).replace(/\/+$/, '')}/models`;
}

function buildGeminiModelsUrl(baseUrl, apiKey, profile) {
  const normalized = normalizeBaseUrlForProfile(baseUrl, profile).replace(/\/+$/, '');
  return `${normalized}/models?key=${encodeURIComponent(apiKey)}`;
}

async function probeOpenAICompatible(input, profile) {
  const normalizedBaseUrl = normalizeBaseUrlForProfile(input.baseUrl, profile);
  const modelsUrl = buildOpenAIModelsUrl(input.baseUrl, profile);
  const warnings = [];
  const diagnostics = [];

  try {
    const response = await fetchJson(modelsUrl, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${input.apiKey}`,
        Accept: 'application/json',
      },
    });

    diagnostics.push({
      step: `${profile.id}.models`,
      url: redactUrl(modelsUrl),
      ok: response.ok,
      status: response.status,
    });

    if (response.ok) {
      const modelRows = Array.isArray(response.data?.data)
        ? response.data.data
        : Array.isArray(response.data?.models)
          ? response.data.models
          : [];
      const models = normalizeModelRows(modelRows, input.modelId ? [input.modelId] : profile.fallbackModels || []);
      return withStrictContract({
        ok: true,
        confidence: models.length > 0 ? 0.93 : 0.78,
        providerKind: profile.providerKind || input.providerKind || 'relay',
        adapterId: profile.adapterId || 'openai_chat_completions',
        requestProfileId: profile.id,
        protocolFamily: profile.protocolFamily,
        normalizedBaseUrl,
        models,
        warnings,
        diagnostics,
      }, profile);
    }

    if (response.status === 401 || response.status === 403) {
      return withStrictContract({
        ok: false,
        confidence: 0.75,
        providerKind: profile.providerKind || input.providerKind || 'relay',
        adapterId: profile.adapterId || 'openai_chat_completions',
        requestProfileId: profile.id,
        protocolFamily: profile.protocolFamily,
        normalizedBaseUrl,
        models: normalizeModelRows([], input.modelId ? [input.modelId] : profile.fallbackModels || DEFAULT_MODELS),
        warnings: [`模型列表接口鉴权失败 (${response.status})，请检查 API Key。`],
        diagnostics,
      }, profile);
    }

    warnings.push(`模型列表接口不可用 (${response.status})，将按 ${profile.label || profile.id} 继续配置。`);
  } catch (error) {
    warnings.push(`模型列表探测失败：${error.name === 'AbortError' ? '请求超时' : error.message}`);
    diagnostics.push({
      step: `${profile.id}.models`,
      url: redactUrl(modelsUrl),
      ok: false,
      error: error.name === 'AbortError' ? 'timeout' : error.message,
    });
  }

  return withStrictContract({
    ok: true,
    confidence: profile.id === 'generic-openai-compatible' ? 0.62 : 0.82,
    providerKind: profile.providerKind || input.providerKind || 'relay',
    adapterId: profile.adapterId || 'openai_chat_completions',
    requestProfileId: profile.id,
    protocolFamily: profile.protocolFamily,
    normalizedBaseUrl,
    models: normalizeModelRows([], input.modelId ? [input.modelId] : profile.fallbackModels || DEFAULT_MODELS),
    warnings,
    diagnostics,
  }, profile);
}

async function probeGeminiNative(input, profile) {
  const normalizedBaseUrl = normalizeBaseUrlForProfile(input.baseUrl, profile);
  const modelsUrl = buildGeminiModelsUrl(input.baseUrl, input.apiKey, profile);
  const diagnostics = [];
  const warnings = [];

  try {
    const response = await fetchJson(modelsUrl, {
      method: 'GET',
      headers: { Accept: 'application/json' },
    });
    diagnostics.push({ step: `${profile.id}.models`, url: redactUrl(modelsUrl), ok: response.ok, status: response.status });
    if (response.ok) {
      const modelRows = Array.isArray(response.data?.models) ? response.data.models : [];
      const models = normalizeModelRows(
        modelRows.map((row) => ({ id: String(row.name || '').replace(/^models\//, '') })),
        input.modelId ? [input.modelId] : profile.fallbackModels || []
      );
      return withStrictContract({
        ok: true,
        confidence: 0.92,
        providerKind: profile.providerKind,
        adapterId: profile.adapterId,
        requestProfileId: profile.id,
        protocolFamily: profile.protocolFamily,
        normalizedBaseUrl,
        models,
        warnings,
        diagnostics,
      }, profile);
    }
    warnings.push(`Gemini 模型列表不可用 (${response.status})，将使用内置模型候选。`);
  } catch (error) {
    warnings.push(`Gemini 模型列表探测失败：${error.name === 'AbortError' ? '请求超时' : error.message}`);
    diagnostics.push({ step: `${profile.id}.models`, url: redactUrl(modelsUrl), ok: false, error: error.name === 'AbortError' ? 'timeout' : error.message });
  }

  return withStrictContract({
    ok: true,
    confidence: 0.78,
    providerKind: profile.providerKind,
    adapterId: profile.adapterId,
    requestProfileId: profile.id,
    protocolFamily: profile.protocolFamily,
    normalizedBaseUrl,
    models: normalizeModelRows([], input.modelId ? [input.modelId] : profile.fallbackModels || []),
    warnings,
    diagnostics,
  }, profile);
}

function probeProfileOnly(input, profile) {
  return withStrictContract({
    ok: true,
    confidence: profile.id === 'generic-openai-compatible' ? 0.6 : 0.86,
    providerKind: profile.providerKind || input.providerKind || 'relay',
    adapterId: profile.adapterId || 'openai_chat_completions',
    requestProfileId: profile.id,
    protocolFamily: profile.protocolFamily,
    normalizedBaseUrl: normalizeBaseUrlForProfile(input.baseUrl, profile),
    models: normalizeModelRows([], input.modelId ? [input.modelId] : profile.fallbackModels || DEFAULT_MODELS),
    warnings: profile.protocolFamily === 'wuyin-form'
      ? ['已识别为 Wuyin/速创强预设：聊天、图片、视频必须按各自文档 contract 执行，旧表单逻辑不得影响异步模型。']
      : ['该供应商不一定支持标准 /models 接口，系统将使用画像库与手动模型候选。'],
    diagnostics: [{
      step: 'profile.match',
      ok: true,
      reason: profile.id,
    }],
  }, profile);
}

async function probeProvider(input) {
  const baseUrl = String(input.baseUrl || '').trim();
  const apiKey = String(input.apiKey || '').trim();
  if (!baseUrl) {
    const error = new Error('baseUrl is required.');
    error.statusCode = 400;
    throw error;
  }
  if (!apiKey) {
    const error = new Error('apiKey is required.');
    error.statusCode = 400;
    throw error;
  }

  const profile = matchProviderProfile(input);
  if (profile.protocolFamily === 'wuyin-form' || profile.modelDiscovery === 'manual') {
    return probeProfileOnly(input, profile);
  }
  if (profile.protocolFamily === 'gemini-native') {
    return probeGeminiNative(input, profile);
  }
  return probeOpenAICompatible(input, profile);
}

module.exports = {
  probeProvider,
};
