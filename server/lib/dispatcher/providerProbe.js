/**
 * @file providerProbe.js
 * @module server/lib/dispatcher
 * @description 第三方/官方 API 地址与密钥的自动探测器。用户只需要填写 Base URL 与 Key，
 *              系统负责识别 OpenAI-compatible、速创/悟因表单协议、模型列表和推荐适配器。
 */

const fetch = require('node-fetch');
const { normalizeAdapterId, normalizeBaseUrl } = require('./adapterRegistry');

const PROBE_TIMEOUT_MS = 12000;
const DEFAULT_MODELS = ['gpt-4o-mini', 'gpt-4o', 'chat_index'];

function safeHostname(value) {
  try {
    return new URL(String(value || '').trim()).hostname.toLowerCase();
  } catch {
    return '';
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

function isLikelyWuyinLike(input) {
  const baseUrl = String(input.baseUrl || '').toLowerCase();
  const profile = String(input.providerHint || '').toLowerCase();
  const hostname = safeHostname(input.baseUrl);
  return hostname.includes('wuyinkeji.com')
    || profile.includes('wuyin')
    || profile.includes('suchuang')
    || input.providerName?.includes?.('速创')
    || baseUrl.includes('/api/chat/index')
    || baseUrl.includes('/api/async/');
}

function normalizeModelRows(rows, fallbackModels = []) {
  const ids = [];
  if (Array.isArray(rows)) {
    for (const row of rows) {
      if (typeof row === 'string') {
        ids.push(row);
      } else if (row && typeof row === 'object') {
        ids.push(row.id || row.model || row.name || row.model_id);
      }
    }
  }

  const merged = uniqueStrings([...ids, ...fallbackModels]);
  return merged.map((id) => ({
    id,
    displayName: id,
  }));
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

function buildOpenAIModelsUrl(baseUrl) {
  return `${normalizeBaseUrl(baseUrl).replace(/\/+$/, '')}/models`;
}

async function probeOpenAICompatible(input) {
  const normalizedBaseUrl = normalizeBaseUrl(input.baseUrl);
  const modelsUrl = buildOpenAIModelsUrl(input.baseUrl);
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
      step: 'openai.models',
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
      const models = normalizeModelRows(modelRows, input.modelId ? [input.modelId] : []);
      return {
        ok: true,
        confidence: models.length > 0 ? 0.92 : 0.78,
        providerKind: input.providerKind || 'relay',
        adapterId: 'openai_chat_completions',
        requestProfileId: 'openai-compatible',
        normalizedBaseUrl,
        models,
        warnings,
        diagnostics,
      };
    }

    if (response.status === 401 || response.status === 403) {
      return {
        ok: false,
        confidence: 0.75,
        providerKind: input.providerKind || 'relay',
        adapterId: 'openai_chat_completions',
        requestProfileId: 'openai-compatible',
        normalizedBaseUrl,
        models: normalizeModelRows([], input.modelId ? [input.modelId] : DEFAULT_MODELS),
        warnings: [`模型列表接口鉴权失败 (${response.status})，请检查 API Key。`],
        diagnostics,
      };
    }

    warnings.push(`模型列表接口不可用 (${response.status})，将按 OpenAI-compatible 第三方中转继续配置。`);
  } catch (error) {
    warnings.push(`模型列表探测失败：${error.name === 'AbortError' ? '请求超时' : error.message}`);
    diagnostics.push({
      step: 'openai.models',
      url: redactUrl(modelsUrl),
      ok: false,
      error: error.name === 'AbortError' ? 'timeout' : error.message,
    });
  }

  return {
    ok: true,
    confidence: 0.62,
    providerKind: input.providerKind || 'relay',
    adapterId: 'openai_chat_completions',
    requestProfileId: 'openai-compatible',
    normalizedBaseUrl,
    models: normalizeModelRows([], input.modelId ? [input.modelId] : DEFAULT_MODELS),
    warnings,
    diagnostics,
  };
}

function probeWuyinLike(input) {
  const rawBaseUrl = String(input.baseUrl || '').trim();
  const fallbackBase = rawBaseUrl || 'https://api.wuyinkeji.com';
  let normalizedBaseUrl = fallbackBase.replace(/\/+$/, '');
  if (!normalizedBaseUrl.toLowerCase().includes('/api/chat/index') && !normalizedBaseUrl.toLowerCase().includes('/api/async/')) {
    normalizedBaseUrl = `${normalizedBaseUrl}/api/chat/index`;
  }

  const modelHints = uniqueStrings([
    input.modelId,
    'chat_index',
    'gemini-2.5-flash',
    'gemini-2.5-pro',
    'image_nanoBanana2',
    'image_nanoBanana',
  ]);

  return {
    ok: true,
    confidence: 0.88,
    providerKind: input.providerKind || 'relay',
    adapterId: 'custom_form_urlencoded',
    requestProfileId: 'wuyin-form-url-encoded',
    normalizedBaseUrl,
    models: normalizeModelRows(modelHints),
    warnings: ['已识别为速创/悟因类非标准协议，系统会自动使用表单适配器，不需要用户手动选择接口类型。'],
    diagnostics: [{
      step: 'profile.match',
      ok: true,
      reason: 'wuyin-like-url-or-provider-hint',
    }],
  };
}

function inferOfficialProvider(input) {
  const hostname = safeHostname(input.baseUrl);
  if (hostname.includes('api.openai.com')) {
    return {
      providerKind: 'official',
      requestProfileId: 'openai-official',
      adapterId: 'openai_chat_completions',
    };
  }
  if (hostname.includes('dashscope.aliyuncs.com')) {
    return {
      providerKind: 'official',
      requestProfileId: 'dashscope-openai-compatible',
      adapterId: 'openai_chat_completions',
    };
  }
  if (hostname.includes('ark.cn-beijing.volces.com')) {
    return {
      providerKind: 'official',
      requestProfileId: 'volcengine-openai-compatible',
      adapterId: 'openai_chat_completions',
    };
  }
  if (hostname.includes('api.deepseek.com')) {
    return {
      providerKind: 'official',
      requestProfileId: 'deepseek-openai-compatible',
      adapterId: 'openai_chat_completions',
    };
  }
  return null;
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

  if (isLikelyWuyinLike(input)) {
    return probeWuyinLike(input);
  }

  const officialProfile = inferOfficialProvider(input);
  const result = await probeOpenAICompatible({
    ...input,
    providerKind: officialProfile?.providerKind || input.providerKind,
  });

  if (officialProfile) {
    return {
      ...result,
      providerKind: officialProfile.providerKind,
      requestProfileId: officialProfile.requestProfileId,
      adapterId: officialProfile.adapterId,
      confidence: Math.max(result.confidence, 0.9),
    };
  }

  const inferredAdapter = normalizeAdapterId(input.endpointType || 'auto', {
    base_url: baseUrl,
    provider_id: input.providerHint,
    provider_kind: input.providerKind,
    request_profile_id: input.requestProfileId,
  });

  return {
    ...result,
    adapterId: inferredAdapter,
  };
}

module.exports = {
  probeProvider,
};
