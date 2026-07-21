/**
 * @file wuyinRouteHandler.js
 * @module services/api/lib/dispatcher/adapters/wuyin
 * @description 将 Wuyin / Suchuang 专属严格文档处理函数从路由模块中剥离，移入插件目录。
 *              消除全栈屋音耦合，并在统一影子端点 generate-v1.js 中直接调用。
 */

const { assertStrictTaskSupported } = require('../../strictProviderContracts');
const {
  WUYIN_ASYNC_DETAIL_ENDPOINT,
  WUYIN_SORA2_DETAIL_ENDPOINT,
  getWuyinProduct,
} = require('../../wuyinProducts');
const {
  decodeLocalProxyTaskId,
  encodeLocalProxyTaskId,
} = require('./wuyinModelExecutor');
const { normalizeUserApiSecretForTransport } = require('../../../userApiSecret');
const { resolveLocalUserRoute } = require('../../localUserRouteStore');
const { fetchWithRetries } = require('../../../fetchClient');

const TEMP_USER_ID_HEADER = 'x-kk-temp-user-id';

function isObjectRecord(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function buildMeta(req) {
  return {
    requestId: req.headers['x-request-id'] || req.body?.requestId || `req-${Date.now()}`,
    timestamp: new Date().toISOString(),
  };
}

function okEnvelope(data, req) {
  return { success: true, data, meta: buildMeta(req) };
}

function errorEnvelope(req, code, message, extra = {}) {
  return { success: false, error: { code, message, ...extra }, meta: buildMeta(req) };
}

function sendError(res, req, status, code, message, extra = {}) {
  return res.status(status).json(errorEnvelope(req, code, message, extra));
}

function extractModelId(req) {
  return String(req.body?.modelId || req.body?.model || '')
    .split('@')[0]
    .split('|')[0]
    .replace(/^models\//i, '')
    .replace(/^api\/async\//i, '')
    .trim();
}

function isWuyinLikeText(value) {
  const raw = String(value || '').trim().toLowerCase();
  return raw.includes('wuyin')
    || raw.includes('wuyinkeji')
    || raw.includes('suchuang')
    || raw.includes('速创')
    || raw.includes('悟因');
}

function isWuyinRoute(route, context = {}) {
  const routeText = `${route?.baseUrl || ''} ${route?.name || ''} ${route?.requestProfileId || ''} ${route?.endpointType || ''}`;
  const modelId = String(context.modelId || '').trim();
  const routeId = String(context.routeId || '').trim();
  return Boolean(getWuyinProduct(modelId))
    || isWuyinLikeText(routeText)
    || isWuyinLikeText(routeId);
}

function getRouteApiKey(route) {
  return normalizeUserApiSecretForTransport(route?.apiKey);
}

function isWuyinProxyTarget(value) {
  const raw = String(value || '').trim().toLowerCase();
  return raw.includes('wuyinkeji.com') || raw.includes('/api/async/') || raw.includes('/api/chat/index') || raw.includes('/api/sora') || raw.includes('/api/img/') || raw.includes('/api/voice/');
}

function appendQuery(url, params = {}) {
  const parsed = new URL(url);
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && String(value).trim()) {
      parsed.searchParams.set(key, String(value));
    }
  });
  return parsed.toString();
}

function makeWuyinUrl(productOrEndpoint, apiKey, extraQuery = {}) {
  const endpoint = typeof productOrEndpoint === 'string' ? productOrEndpoint : productOrEndpoint.endpoint;
  const auth = typeof productOrEndpoint === 'string' ? '' : String(productOrEndpoint.auth || '');
  const needsQueryKey = auth.includes('key query') || auth.includes('?key') || endpoint.includes('/api/async/') || endpoint.includes('/api/sora2') || endpoint.includes('/api/img/');
  return appendQuery(endpoint, { ...(needsQueryKey ? { key: apiKey } : {}), ...extraQuery });
}

function responseCodeOk(payload) {
  const code = payload?.code;
  if (code === undefined || code === null || code === '') return true;
  return ['0', '1', '200'].includes(String(code));
}

function readMessage(payload) {
  return String(payload?.data?.message || payload?.data?.msg || payload?.message || payload?.msg || payload?.error || '').trim();
}

function assertWuyinOk(payload, action) {
  if (!responseCodeOk(payload)) {
    throw new Error(`${action}失败: ${readMessage(payload) || `code=${payload?.code}`}`);
  }
}

function extractProviderTaskId(payload) {
  const data = isObjectRecord(payload?.data) ? payload.data : {};
  return String(data.id || data.task_id || data.taskId || payload?.id || payload?.task_id || payload?.taskId || '').trim();
}

function extractUrls(payload) {
  const urls = [];
  const seen = new Set();
  const add = (value) => {
    if (typeof value !== 'string') return;
    const matches = value.match(/https?:\/\/[^\s"'<>]+/g) || [];
    matches.forEach((url) => {
      if (!seen.has(url)) {
        seen.add(url);
        urls.push(url);
      }
    });
  };
  const visit = (value) => {
    if (!value) return;
    if (typeof value === 'string') return add(value);
    if (Array.isArray(value)) return value.forEach(visit);
    if (typeof value === 'object') Object.values(value).forEach(visit);
  };
  visit(payload);
  return urls;
}

function toInputAliases(fieldName) {
  const aliases = [fieldName];
  const map = {
    urls: ['referenceImages', 'imageUrls', 'image_urls', 'images'],
    image_urls: ['referenceImages', 'urls', 'imageUrls', 'images'],
    images: ['referenceImages', 'urls', 'imageUrls', 'image_urls'],
    image_url: ['referenceImages', 'urls', 'imageUrl', 'firstFrameUrl'],
    subjects: ['referenceImages', 'urls', 'subjectUrls'],
    firstFrameUrl: ['firstFrameUrl', 'first_frame_url', 'referenceImages'],
    lastFrameUrl: ['lastFrameUrl', 'last_frame_url'],
    video_url: ['videoUrl', 'video_url', 'url'],
    videoUrl: ['videoUrl', 'video_url', 'url'],
    audio_url: ['audioUrl', 'audio_url'],
    audioUrl: ['audioUrl', 'audio_url'],
    video: ['video', 'videoUrl', 'video_url', 'url'],
    url: ['url', 'imageUrl', 'videoUrl'],
    text: ['text', 'prompt'],
    prompt: ['prompt'],
    size: ['size', 'imageSize', 'resolution'],
    imageSize: ['imageSize', 'size'],
    aspectRatio: ['aspectRatio', 'aspect_ratio'],
    aspect_ratio: ['aspect_ratio', 'aspectRatio'],
    duration: ['duration', 'videoDuration'],
  };
  return Array.from(new Set([...aliases, ...(map[fieldName] || [])]));
}

function readInputValue(input, fieldName) {
  for (const alias of toInputAliases(fieldName)) {
    if (input?.[alias] !== undefined && input?.[alias] !== null && input?.[alias] !== '') {
      return input[alias];
    }
  }
  return undefined;
}

function normalizeBooleanLike(value, fallback) {
  if (value === undefined || value === null || value === '') return fallback;
  if (typeof value === 'boolean') return value;
  const normalized = String(value).trim().toLowerCase();
  if (['true', '1', 'yes', 'on'].includes(normalized)) return true;
  if (['false', '0', 'no', 'off'].includes(normalized)) return false;
  return fallback;
}

function normalizeList(value) {
  if (Array.isArray(value)) return value.map((item) => String(item || '').trim()).filter(Boolean);
  return String(value || '').split(',').map((item) => item.trim()).filter(Boolean);
}

function validateUrlValue(value, fieldName, options = {}) {
  const normalized = String(value || '').trim();
  if (!normalized) return normalized;
  if (options.allowBase64 && (/^data:/i.test(normalized) || /^[A-Za-z0-9+/]+=*$/.test(normalized.slice(0, 120)))) {
    return normalized;
  }
  if (!/^https?:\/\//i.test(normalized)) {
    throw new Error(`Wuyin 文档要求 ${fieldName} 必须是 HTTP(S) URL${options.allowBase64 ? ' 或文档允许的 base64' : ''}。`);
  }
  return normalized;
}

function normalizeFieldValue(fieldName, spec, rawValue) {
  if (rawValue === undefined || rawValue === null || rawValue === '') {
    if (spec.default !== undefined) return spec.default;
    if (spec.required) throw new Error(`Wuyin 文档要求 ${fieldName} 为必填。`);
    return undefined;
  }

  if (Array.isArray(spec.enum)) {
    const candidate = String(rawValue).trim();
    return spec.enum.includes(candidate) ? candidate : (spec.default !== undefined ? spec.default : candidate);
  }

  if (spec.type === 'boolean') return normalizeBooleanLike(rawValue, spec.default);
  if (spec.type === 'float') {
    const numberValue = Number(rawValue);
    return Number.isFinite(numberValue) ? numberValue : spec.default;
  }

  if (String(spec.type).startsWith('array')) {
    const values = normalizeList(rawValue).slice(0, spec.maxItems || 100);
    if (spec.publicUrl || spec.publicUrlCsv || spec.allowBase64) return values.map((value) => validateUrlValue(value, fieldName, spec));
    return values;
  }

  if (spec.publicUrl || spec.allowBase64) return validateUrlValue(rawValue, fieldName, spec);
  if (spec.publicUrlCsv) return normalizeList(rawValue).slice(0, spec.maxItems || 100).map((value) => validateUrlValue(value, fieldName, spec)).join(',');
  return String(rawValue).trim();
}

function buildDocumentedBody(product, input) {
  const body = {};
  for (const [fieldName, spec] of Object.entries(product.requestFields || {})) {
    const raw = readInputValue(input, fieldName);
    const value = normalizeFieldValue(fieldName, spec, raw);
    if (value !== undefined && value !== null && value !== '') body[fieldName] = value;
  }
  return body;
}

async function fetchWuyinJson(url, apiKey, method, product, body) {
  const hasBody = body !== undefined && body !== null;
  const serializeBody = (prod, b) => {
    const contentType = String(prod.contentType || 'application/json').toLowerCase();
    if (contentType.includes('x-www-form-urlencoded')) {
      const params = new URLSearchParams();
      Object.entries(b).forEach(([key, val]) => params.set(key, Array.isArray(val) ? JSON.stringify(val) : String(val)));
      return params.toString();
    }
    return JSON.stringify(b);
  };
  
  const response = await fetchWithRetries(url, {
    method,
    headers: {
      Authorization: apiKey,
      Accept: 'application/json',
      ...(hasBody ? { 'Content-Type': product.contentType || 'application/json' } : {}),
    },
    body: hasBody ? serializeBody(product, body) : undefined,
  });
  const text = await response.text();
  let payload = null;
  try {
    payload = text ? JSON.parse(text) : null;
  } catch {
    payload = null;
  }
  if (!response.ok) {
    const error = new Error(`Wuyin API HTTP ${response.status}: ${text.slice(0, 500)}`);
    error.statusCode = response.status;
    throw error;
  }
  if (!payload) throw new Error(`Wuyin API 返回非 JSON 内容: ${text.slice(0, 300)}`);
  return payload;
}

function mapAsyncStatus(value) {
  const normalized = String(value ?? '').toLowerCase();
  if (normalized === '2' || normalized === 'success' || normalized === 'succeeded' || normalized === 'completed') return 'success';
  if (normalized === '3' || normalized === 'failed' || normalized === 'fail' || normalized === 'error') return 'failed';
  return 'pending';
}

function mapSora2Status(value) {
  const normalized = String(value ?? '').toLowerCase();
  if (normalized === '1' || normalized === 'success' || normalized === 'succeeded' || normalized === 'completed') return 'success';
  if (normalized === '2' || normalized === 'failed' || normalized === 'fail' || normalized === 'error') return 'failed';
  return 'pending';
}

function mapStatusByProduct(product, value) {
  return product.resultMode === 'wuyin-sora2-detail' ? mapSora2Status(value) : mapAsyncStatus(value);
}

function parseWuyinTargetUrl(targetUrl) {
  const raw = String(targetUrl || '').trim();
  if (!raw) return null;
  try {
    const parsed = new URL(raw);
    if (!/^api\.wuyinkeji\.com$/i.test(parsed.hostname)) return null;
    const pathname = parsed.pathname.replace(/\/+$/, '');

    if (pathname === '/api/async/detail') {
      return { kind: 'detail', endpoint: WUYIN_ASYNC_DETAIL_ENDPOINT, resultMode: 'wuyin-async-detail', id: parsed.searchParams.get('id') || '' };
    }
    if (pathname === '/api/sora2/detail') {
      return { kind: 'detail', endpoint: WUYIN_SORA2_DETAIL_ENDPOINT, resultMode: 'wuyin-sora2-detail', id: parsed.searchParams.get('id') || '' };
    }
    if (pathname === '/api/sora2-new/submit') {
      return { kind: 'submit', product: getWuyinProduct('sora2-new') };
    }
    if (pathname === '/api/voice/composite') {
      return { kind: 'submit', product: getWuyinProduct('voice_composite') };
    }
    if (pathname === '/api/voice/clone') {
      return { kind: 'submit', product: getWuyinProduct('voice_clone') };
    }
    if (pathname === '/api/img/split') {
      return { kind: 'submit', product: getWuyinProduct('img_split') };
    }

    const asyncMatch = pathname.match(/^\/api\/async\/([a-z0-9_.-]+)$/i);
    if (asyncMatch) {
      return { kind: 'submit', product: getWuyinProduct(asyncMatch[1]) };
    }
  } catch {
    return null;
  }
  return null;
}

function readGenericProxyInputBody(req) {
  if (isObjectRecord(req.body)) return req.body;
  if (typeof req.body === 'string') {
    const text = req.body.trim();
    if (!text) return {};
    try {
      return JSON.parse(text);
    } catch {
      return Object.fromEntries(new URLSearchParams(text));
    }
  }
  return {};
}

async function handleGenericWuyinProxy(req, res, authState, target) {
  const routeId = String(req.headers['x-key-slot-id'] || req.body?.routeId || '').trim();
  const route = await resolveLocalUserRoute(authState.userId, routeId);
  if (!route) return sendError(res, req, 404, 'USER_ROUTE_NOT_FOUND', 'Wuyin user API route was not found for generic proxy compatibility.');
  if (!isWuyinRoute(route, { modelId: target.product?.id, routeId })) {
    return sendError(res, req, 400, 'WUYIN_ROUTE_NOT_RECOGNIZED', '当前用户路由不是 Wuyin/速创 API，已阻止旧通用代理。');
  }

  const apiKey = getRouteApiKey(route);
  if (!apiKey) return sendError(res, req, 400, 'USER_ROUTE_SECRET_REQUIRED', 'Wuyin API key is required.');

  try {
    if (target.kind === 'detail') {
      const providerTaskId = String(target.id || req.query?.id || req.body?.id || '').trim();
      if (!providerTaskId) return sendError(res, req, 400, 'INVALID_REQUEST', 'Wuyin detail query requires id.');
      const detailProduct = {
        endpoint: target.endpoint,
        contentType: target.resultMode === 'wuyin-sora2-detail' ? 'application/x-www-form-urlencoded;charset:utf-8;' : 'application/json',
        auth: 'Authorization header and key query parameter',
      };
      const url = makeWuyinUrl(detailProduct, apiKey, { id: providerTaskId });
      const payload = await fetchWuyinJson(url, apiKey, 'GET', detailProduct);
      return res.json(payload);
    }

    const product = target.product;
    if (!product) return sendError(res, req, 400, 'WUYIN_MODEL_NOT_DOCUMENTED', '旧通用代理目标不是已核对文档模型，已阻止。');
    if (product.enabled === false || product.executable === false) {
      return sendError(res, req, 400, 'WUYIN_MODEL_DISABLED_BY_DOC', `Wuyin 模型 ${product.id} 当前文档标记为不可用或禁用执行，已阻止请求。`);
    }
    assertStrictTaskSupported('wuyin-suchuang-form', product.category, { modelId: product.id });
    const body = buildDocumentedBody(product, readGenericProxyInputBody(req));
    const url = makeWuyinUrl(product, apiKey);
    const payload = await fetchWuyinJson(url, apiKey, product.method || req.method || 'POST', product, body);
    assertWuyinOk(payload, 'Wuyin 任务提交');
    return res.json(payload);
  } catch (err) {
    return sendError(res, req, err.statusCode || 502, err.code || 'WUYIN_STRICT_GENERIC_PROXY_ERROR', err.message);
  }
}

async function submitStrictTask({ req, mode, modelId, apiKey }) {
  const product = getWuyinProduct(modelId);
  if (!product) throw Object.assign(new Error(`Wuyin 模型 ${modelId || '(empty)'} 没有在已核对文档中声明，已阻止请求。`), { statusCode: 400, code: 'WUYIN_MODEL_NOT_DOCUMENTED' });
  if (product.enabled === false || product.executable === false) throw Object.assign(new Error(`Wuyin 模型 ${modelId} 当前文档标记为不可用或禁用执行，已阻止请求。`), { statusCode: 400, code: 'WUYIN_MODEL_DISABLED_BY_DOC' });
  if (product.category !== mode) throw Object.assign(new Error(`Wuyin 模型 ${modelId} 是 ${product.category}，不能用于 ${mode}。`), { statusCode: 400, code: 'WUYIN_MODEL_TASK_MISMATCH' });
  assertStrictTaskSupported('wuyin-suchuang-form', mode, { modelId });

  const body = buildDocumentedBody(product, req.body || {});
  const submitUrl = makeWuyinUrl(product, apiKey);
  const startedAt = Date.now();
  const payload = await fetchWuyinJson(submitUrl, apiKey, product.method || 'POST', product, body);
  assertWuyinOk(payload, 'Wuyin 任务提交');

  const urls = extractUrls(payload);
  const providerTaskId = extractProviderTaskId(payload);
  const isAsync = product.resultEndpoint && product.executionMode !== 'sync';
  if (!isAsync || urls.length > 0) return { status: 'success', urls, providerTaskId: providerTaskId || '', product, submitExecTime: Date.now() - startedAt, body, raw: payload };
  if (!providerTaskId) throw new Error('Wuyin API 提交成功但没有返回文档要求的任务 ID。');
  return { status: 'pending', urls: [], providerTaskId, product, submitExecTime: Date.now() - startedAt, body, raw: payload };
}

async function queryStrictTaskStatus({ providerTaskId, apiKey, product }) {
  const detailEndpoint = product.resultMode === 'wuyin-sora2-detail' ? WUYIN_SORA2_DETAIL_ENDPOINT : WUYIN_ASYNC_DETAIL_ENDPOINT;
  const detailProduct = {
    endpoint: detailEndpoint,
    contentType: product.resultMode === 'wuyin-sora2-detail' ? 'application/x-www-form-urlencoded;charset:utf-8;' : 'application/json',
    auth: 'Authorization header and key query parameter',
  };
  const url = makeWuyinUrl(detailProduct, apiKey, { id: providerTaskId });
  const startedAt = Date.now();
  const payload = await fetchWuyinJson(url, apiKey, 'GET', detailProduct);
  assertWuyinOk(payload, 'Wuyin 任务状态查询');
  const data = isObjectRecord(payload.data) ? payload.data : payload;
  const status = mapStatusByProduct(product, data.status ?? payload.status);
  return { status, urls: status === 'success' ? extractUrls(payload) : [], message: status === 'failed' ? readMessage(payload) || 'Wuyin task failed.' : '', raw: payload, detailExecTime: Date.now() - startedAt };
}

async function handleSubmitMode(req, res, userId, mode) {
  const routeId = String(req.body?.routeId || req.headers['x-key-slot-id'] || '').trim();
  const modelId = extractModelId(req);
  const route = await resolveLocalUserRoute(userId, routeId);
  if (!route) return sendError(res, req, 404, 'USER_ROUTE_NOT_FOUND', 'User API route was not found.');
  if (!isWuyinRoute(route, { modelId, routeId })) return null;

  const apiKey = getRouteApiKey(route);
  if (!apiKey) return sendError(res, req, 400, 'USER_ROUTE_SECRET_REQUIRED', 'Wuyin API key is required.');

  try {
    const result = await submitStrictTask({ req, mode, modelId, apiKey });
    const taskId = result.providerTaskId ? encodeLocalProxyTaskId(route.id || routeId, result.providerTaskId, result.product.id) : '';
    return res.json(okEnvelope({
      urls: result.urls,
      url: result.urls[0] || '',
      taskId,
      providerTaskId: result.providerTaskId,
      status: result.status,
      endpointType: `wuyin-${result.product.executionMode || result.product.resultMode || 'documented'}-${mode}`,
      modelId: result.product.id,
      requestId: req.body?.requestId,
      attemptId: req.body?.attemptId,
      submitExecTime: result.submitExecTime,
      execTime: result.submitExecTime,
      route: {
        provider: 'wuyin-suchuang-form',
        adapter: 'wuyin_documented_task',
        strictContractChecked: true,
        docUrl: result.product.docUrl,
        contentType: result.product.contentType,
        resultMode: result.product.resultMode || result.product.executionMode || 'sync',
      },
    }, req));
  } catch (err) {
    return sendError(res, req, err.statusCode || 502, err.code || 'WUYIN_STRICT_UPSTREAM_ERROR', err.message, { route: { provider: 'wuyin-suchuang-form', modelId } });
  }
}

async function handleStatusMode(req, res, userId) {
  const localTaskId = String(req.body?.localTaskId || req.body?.taskId || '').trim();
  const parsed = decodeLocalProxyTaskId(localTaskId);
  if (!parsed.providerTaskId) return sendError(res, req, 400, 'INVALID_REQUEST', 'localTaskId/taskId is required for Wuyin task status.');
  const product = getWuyinProduct(parsed.modelId);
  if (!product) return sendError(res, req, 400, 'WUYIN_STATUS_MODEL_REQUIRED', '严格 Wuyin 状态查询要求 taskId 内包含已核对文档模型 ID。旧格式 taskId 不再允许猜测查询。');
  if (!product.resultEndpoint) return sendError(res, req, 400, 'WUYIN_STATUS_NOT_ASYNC', '该 Wuyin 模型按文档不是异步详情查询任务。');

  const route = await resolveLocalUserRoute(userId, parsed.routeId || req.body?.routeId || req.headers['x-key-slot-id']);
  if (!route) return sendError(res, req, 404, 'USER_ROUTE_NOT_FOUND', 'Wuyin API route for this task was not found.');
  if (!isWuyinRoute(route, { modelId: product.id, routeId: parsed.routeId })) return null;

  const apiKey = getRouteApiKey(route);
  if (!apiKey) return sendError(res, req, 400, 'USER_ROUTE_SECRET_REQUIRED', 'Wuyin API key is required.');

  try {
    const result = await queryStrictTaskStatus({ providerTaskId: parsed.providerTaskId, apiKey, product });
    return res.json(okEnvelope({
      taskId: localTaskId,
      providerTaskId: parsed.providerTaskId,
      status: result.status,
      url: result.urls[0] || undefined,
      urls: result.urls,
      message: result.message || undefined,
      error: result.status === 'failed' ? (result.message || 'Wuyin task failed.') : undefined,
      endpointType: `wuyin-${product.resultMode || 'detail'}-${product.category}`,
      modelId: product.id,
      detailExecTime: result.detailExecTime,
      execTime: result.detailExecTime,
      route: {
        provider: 'wuyin-suchuang-form',
        adapter: 'wuyin_documented_task',
        strictContractChecked: true,
        docUrl: product.resultMode === 'wuyin-sora2-detail' ? 'https://api.wuyinkeji.com/doc/36' : 'https://api.wuyinkeji.com/doc/47',
        resultMode: product.resultMode,
      },
    }, req));
  } catch (err) {
    return sendError(res, req, err.statusCode || 502, err.code || 'WUYIN_STRICT_STATUS_ERROR', err.message);
  }
}

module.exports = {
  isWuyinRoute,
  isWuyinProxyTarget,
  parseWuyinTargetUrl,
  handleGenericWuyinProxy,
  handleSubmitMode,
  handleStatusMode,
  extractModelId
};
