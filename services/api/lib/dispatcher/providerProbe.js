/**
 * @file providerProbe.js
 * @module services/api/lib/dispatcher
 * @description AI Router 通用供应商探测器。用户或管理员只需要填写 Base URL 与 Key，
 *              系统根据供应商画像库自动识别协议族、模型发现方式、推荐适配器和规范化地址。
 *              命中强预设时返回 strictContract；文档未解析的预设返回 ok=false，禁止误认为可执行。
 */

const { isPrivateHost } = require('../fetchClient');
const { normalizeBaseUrl } = require('./adapterRegistry');
const { matchProviderProfile } = require('./providerProfiles');
const { getStrictProviderContract } = require('./strictProviderContracts');
const crypto = require('crypto');

const PROBE_TIMEOUT_MS = 12000;
const PROBE_CACHE_TTL_MS = 300000; // 🚀 5分钟探测结果缓存
const DEFAULT_MODELS = ['gpt-4o-mini', 'gpt-4o', 'chat_index'];

// 🚀 内存探测缓存：基于 (baseUrl + apiKey) 的哈希
const probeCache = new Map();

function probeCacheKey(baseUrl, apiKey) {
  return crypto.createHash('sha256')
    .update(`${String(baseUrl || '').trim().toLowerCase()}\n${String(apiKey || '').trim()}`)
    .digest('hex');
}

function getCachedProbe(baseUrl, apiKey) {
  const key = probeCacheKey(baseUrl, apiKey);
  const cached = probeCache.get(key);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.result;
  }
  if (cached) {
    probeCache.delete(key);
  }
  return null;
}

function setCachedProbe(baseUrl, apiKey, result) {
  const key = probeCacheKey(baseUrl, apiKey);
  probeCache.set(key, {
    result,
    expiresAt: Date.now() + PROBE_CACHE_TTL_MS,
  });
}

function evictExpiredProbeCacheEntries() {
  const now = Date.now();
  for (const [key, entry] of probeCache.entries()) {
    if (entry.expiresAt <= now) {
      probeCache.delete(key);
    }
  }
}

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
  try {
    const parsed = new URL(url);
    if (isPrivateHost(parsed.hostname)) {
      return { ok: false, status: 400, text: 'SSRF Blocked: Private host access rejected.', data: null };
    }
  } catch (err) {
    return { ok: false, status: 400, text: err.message, data: null };
  }

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
  if (profile.protocolFamily === 'wuyin-form' || profile.protocolFamily === 'wuyin-documented-multi-task') {
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
  if (profile.requiresDocsVerification || profile.adapterId === 'docs_pending_adapter') {
    return withStrictContract({
      ok: false,
      confidence: 0.98,
      providerKind: profile.providerKind || input.providerKind || 'relay',
      adapterId: profile.adapterId || 'docs_pending_adapter',
      requestProfileId: profile.id,
      protocolFamily: profile.protocolFamily,
      normalizedBaseUrl: normalizeBaseUrlForProfile(input.baseUrl, profile),
      models: [],
      executable: false,
      warnings: [
        `${profile.label || profile.id} 文档入口未返回可解析的 endpoint/鉴权/请求体/响应结构。`,
        '该预设只允许保存为待核对状态，不允许发起任何模型请求，也不会回落 generic-openai-compatible。',
      ],
      diagnostics: [{
        step: 'profile.docs_pending',
        ok: false,
        reason: profile.id,
        docs: profile.strictDocs?.source || profile.strictDocs?.sources || null,
      }],
    }, profile);
  }

  return withStrictContract({
    ok: true,
    confidence: profile.id === 'generic-openai-compatible' ? 0.6 : 0.86,
    providerKind: profile.providerKind || input.providerKind || 'relay',
    adapterId: profile.adapterId || 'openai_chat_completions',
    requestProfileId: profile.id,
    protocolFamily: profile.protocolFamily,
    normalizedBaseUrl: normalizeBaseUrlForProfile(input.baseUrl, profile),
    models: normalizeModelRows([], input.modelId ? [input.modelId] : profile.fallbackModels || DEFAULT_MODELS),
    warnings: profile.protocolFamily === 'wuyin-form' || profile.protocolFamily === 'wuyin-documented-multi-task'
      ? ['已识别为 Wuyin/速创强预设：聊天、图片、视频、音频和工具必须按各自文档 contract 执行，旧表单逻辑不得影响其它模型。']
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

  // 🚀 优先命中缓存，避免重复探测
  const cached = getCachedProbe(baseUrl, apiKey);
  if (cached) {
    return cached;
  }

  const profile = matchProviderProfile(input);
  let result;
  if (profile.protocolFamily === 'wuyin-form' || profile.protocolFamily === 'wuyin-documented-multi-task' || profile.modelDiscovery === 'manual') {
    result = await probeProfileOnly(input, profile);
  } else if (profile.protocolFamily === 'gemini-native') {
    result = await probeGeminiNative(input, profile);
  } else {
    result = await probeOpenAICompatible(input, profile);
  }

  // 🚀 缓存探测结果（仅缓存成功的探测）
  if (result && result.ok) {
    setCachedProbe(baseUrl, apiKey, result);
  }

  return result;
}

module.exports = {
  probeProvider,
  getCachedProbe,
  setCachedProbe,
  evictExpiredProbeCacheEntries,
};
