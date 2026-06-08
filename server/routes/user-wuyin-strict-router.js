/**
 * @file user-wuyin-strict-router.js
 * @module server/routes
 * @description 用户自带 Key 的 Wuyin/速创严格文档路由。该路由在 legacy user.js 之前拦截 Wuyin image/video/audio/utility/status：
 *              - 提交请求严格由 wuyinProducts.js 的模型文档 contract 生成
 *              - JSON / form-urlencoded / sync / async / sora2-special 按各自文档执行
 *              - 状态查询按 resultMode 走 /api/async/detail 或 /api/sora2/detail
 *              - 禁止 x-proxy-target-url 通用转发绕过文档契约
 */

const fs = require('fs');
const path = require('path');
const http = require('http');
const https = require('https');
const express = require('express');
const fetch = require('node-fetch');
const { verifyJWT, signJWT } = require('../lib/jwt');
const { assertStrictTaskSupported } = require('../lib/dispatcher/strictProviderContracts');
const {
  WUYIN_ASYNC_DETAIL_ENDPOINT,
  WUYIN_SORA2_DETAIL_ENDPOINT,
  getWuyinProduct,
} = require('../lib/dispatcher/wuyinProducts');
const {
  decodeLocalProxyTaskId,
  encodeLocalProxyTaskId,
} = require('../lib/wuyinModelExecutor');
const { normalizeUserApiSecretForTransport } = require('../lib/userApiSecret');

const router = express.Router();
const LOCAL_STORAGE_PATH = path.resolve(__dirname, '../../.kk-local/local-user-apis.json');
const TEMP_USER_ID_HEADER = 'x-kk-temp-user-id';

const httpAgent = new http.Agent({ keepAlive: true, maxSockets: 80, maxFreeSockets: 10, timeout: 60000, freeSocketTimeout: 30000 });
const httpsAgent = new https.Agent({ keepAlive: true, maxSockets: 80, maxFreeSockets: 10, timeout: 60000, freeSocketTimeout: 30000 });

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

function isObjectRecord(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function readLocalStorage() {
  try {
    const raw = fs.readFileSync(LOCAL_STORAGE_PATH, 'utf8');
    const parsed = JSON.parse(raw);
    return isObjectRecord(parsed) ? parsed : { version: 2, profiles: {} };
  } catch {
    return { version: 2, profiles: {} };
  }
}

function normalizeProfileState(value) {
  const source = isObjectRecord(value) ? value : {};
  return {
    version: Number.parseInt(source.version, 10) || 2,
    slots: Array.isArray(source.slots) ? source.slots : [],
    providers: Array.isArray(source.providers) ? source.providers : [],
    entries: Array.isArray(source.entries) ? source.entries : [],
  };
}

function readProfileState(data, userId) {
  if (isObjectRecord(data.profiles) && isObjectRecord(data.profiles[userId])) {
    return normalizeProfileState(data.profiles[userId]);
  }
  return normalizeProfileState(data);
}

function resolveProfileUserId(req) {
  const verifiedUserId = verifyJWT(req.headers.authorization || '');
  if (verifiedUserId) {
    return { userId: verifiedUserId, refreshToken: signJWT({ userId: verifiedUserId }) };
  }

  const tempUserId = String(req.headers[TEMP_USER_ID_HEADER] || '').trim();
  const allowLocalTempUser = process.env.KKAI_LOCAL_ONLY === 'true' || process.env.NODE_ENV !== 'production';
  if (allowLocalTempUser && /^temp-[a-zA-Z0-9_.-]{4,128}$/.test(tempUserId)) {
    return { userId: tempUserId, refreshToken: null };
  }
  return null;
}

function normalizeRouteValue(value) {
  return String(value || '').trim().toLowerCase();
}

function normalizeProviderLinkValue(value) {
  return String(value || '').trim().replace(/\/+$/, '').toLowerCase();
}

function resolveRouteIdCandidate(value) {
  const decoded = (() => {
    try { return decodeURIComponent(String(value || '').trim()); } catch { return String(value || '').trim(); }
  })();
  const normalized = decoded.toLowerCase();
  if (normalized.startsWith('slot_key_')) return normalized.slice(5);
  if (normalized.startsWith('slot_')) return normalized.slice(5);
  if (normalized.startsWith('provider_')) return normalized.slice('provider_'.length);
  return normalized;
}

function recordAliases(record) {
  return [String(record?.id || '').trim(), ...(Array.isArray(record?.legacyIds) ? record.legacyIds : [])]
    .map(normalizeRouteValue)
    .filter(Boolean);
}

function recordMatchesRoute(record, routeTarget, rawRouteId) {
  const aliases = recordAliases(record);
  const name = normalizeRouteValue(record?.name);
  return aliases.includes(routeTarget) || aliases.includes(rawRouteId) || name === routeTarget;
}

function findProviderLinkedToSlot(slot, providers) {
  const slotBaseUrl = normalizeProviderLinkValue(slot?.baseUrl);
  const slotKey = String(slot?.key || '').trim();
  const slotName = normalizeRouteValue(slot?.name);

  const strongMatch = providers.find((provider) => {
    const providerBaseUrl = normalizeProviderLinkValue(provider?.baseUrl);
    if (!providerBaseUrl || providerBaseUrl !== slotBaseUrl) return false;
    const providerKey = String(provider?.apiKey || '').trim();
    const providerName = normalizeRouteValue(provider?.name);
    return (slotKey && providerKey && slotKey === providerKey) || (slotName && providerName && slotName === providerName);
  });
  if (strongMatch) return strongMatch;

  const sameBaseProviders = providers.filter((provider) => slotBaseUrl && normalizeProviderLinkValue(provider?.baseUrl) === slotBaseUrl);
  return sameBaseProviders.length === 1 ? sameBaseProviders[0] : null;
}

function buildRouteFromProvider(provider) {
  return {
    id: String(provider?.id || '').trim(),
    legacyIds: Array.isArray(provider?.legacyIds) ? provider.legacyIds : [],
    name: String(provider?.name || '').trim(),
    baseUrl: String(provider?.baseUrl || '').trim(),
    apiKey: String(provider?.apiKey || '').trim(),
    requestProfileId: String(provider?.requestProfileId || provider?.profileId || '').trim(),
  };
}

function buildRouteFromSlot(slot, providers) {
  const linkedProvider = findProviderLinkedToSlot(slot, providers);
  return {
    id: String(slot?.id || '').trim(),
    legacyIds: Array.isArray(slot?.legacyIds) ? slot.legacyIds : [],
    name: String(linkedProvider?.name || slot?.name || '').trim(),
    baseUrl: String(linkedProvider?.baseUrl || slot?.baseUrl || '').trim(),
    apiKey: String(linkedProvider?.apiKey || slot?.key || '').trim(),
    requestProfileId: String(linkedProvider?.requestProfileId || slot?.requestProfileId || linkedProvider?.profileId || '').trim(),
  };
}

function resolveLocalUserRoute(profileState, routeId) {
  const routeTarget = resolveRouteIdCandidate(routeId);
  const rawRouteId = String(routeId || '').trim().toLowerCase();
  const providers = Array.isArray(profileState.providers) ? profileState.providers : [];
  const slots = Array.isArray(profileState.slots) ? profileState.slots : [];

  const provider = providers.find((item) => recordMatchesRoute(item, routeTarget, rawRouteId));
  if (provider) return buildRouteFromProvider(provider);

  const slot = slots.find((item) => recordMatchesRoute(item, routeTarget, rawRouteId));
  if (slot) return buildRouteFromSlot(slot, providers);

  return null;
}

function isWuyinRoute(route) {
  const haystack = `${route?.baseUrl || ''} ${route?.name || ''} ${route?.requestProfileId || ''}`.toLowerCase();
  return haystack.includes('wuyin') || haystack.includes('wuyinkeji') || haystack.includes('suchuang') || haystack.includes('速创') || haystack.includes('悟因');
}

function getRouteApiKey(route) {
  return normalizeUserApiSecretForTransport(route?.apiKey);
}

function isWuyinProxyTarget(value) {
  const raw = String(value || '').trim().toLowerCase();
  return raw.includes('wuyinkeji.com') || raw.includes('/api/async/') || raw.includes('/api/chat/index') || raw.includes('/api/sora') || raw.includes('/api/img/') || raw.includes('/api/voice/');
}

function extractModelId(req) {
  return String(req.body?.modelId || req.body?.model || '')
    .split('@')[0]
    .split('|')[0]
    .replace(/^models\//i, '')
    .replace(/^api\/async\//i, '')
    .trim();
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

  if (spec.type === 'boolean') {
    return normalizeBooleanLike(rawValue, spec.default);
  }

  if (spec.type === 'float') {
    const numberValue = Number(rawValue);
    return Number.isFinite(numberValue) ? numberValue : spec.default;
  }

  if (String(spec.type).startsWith('array')) {
    const values = normalizeList(rawValue).slice(0, spec.maxItems || 100);
    if (spec.publicUrl || spec.publicUrlCsv || spec.allowBase64) {
      return values.map((value) => validateUrlValue(value, fieldName, spec));
    }
    return values;
  }

  if (spec.publicUrl || spec.allowBase64) {
    return validateUrlValue(rawValue, fieldName, spec);
  }

  if (spec.publicUrlCsv) {
    return normalizeList(rawValue).slice(0, spec.maxItems || 100).map((value) => validateUrlValue(value, fieldName, spec)).join(',');
  }

  return String(rawValue).trim();
}

function buildDocumentedBody(product, input) {
  const body = {};
  for (const [fieldName, spec] of Object.entries(product.requestFields || {})) {
    const raw = readInputValue(input, fieldName);
    const value = normalizeFieldValue(fieldName, spec, raw);
    if (value !== undefined && value !== null && value !== '') {
      body[fieldName] = value;
    }
  }
  return body;
}

function serializeBody(product, body) {
  const contentType = String(product.contentType || 'application/json').toLowerCase();
  if (contentType.includes('x-www-form-urlencoded')) {
    const params = new URLSearchParams();
    Object.entries(body).forEach(([key, value]) => {
      if (Array.isArray(value)) {
        params.set(key, JSON.stringify(value));
      } else {
        params.set(key, String(value));
      }
    });
    return params.toString();
  }
  return JSON.stringify(body);
}

async function fetchWuyinJson(url, apiKey, method, product, body) {
  const isHttps = url.startsWith('https');
  const hasBody = body !== undefined && body !== null;
  const response = await fetch(url, {
    method,
    headers: {
      Authorization: apiKey,
      Accept: 'application/json',
      ...(hasBody ? { 'Content-Type': product.contentType || 'application/json' } : {}),
    },
    body: hasBody ? serializeBody(product, body) : undefined,
    agent: isHttps ? httpsAgent : httpAgent,
  });
  const text = await response.text();
  let json = null;
  try { json = text ? JSON.parse(text) : null; } catch { json = null; }
  if (!response.ok) {
    throw new Error(`Wuyin API HTTP ${response.status}: ${text.slice(0, 500)}`);
  }
  if (!json) throw new Error('Wuyin API 返回的不是有效 JSON。');
  return json;
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

async function submitStrictTask({ req, mode, modelId, apiKey }) {
  const product = getWuyinProduct(modelId);
  if (!product) {
    throw Object.assign(new Error(`Wuyin 模型 ${modelId || '(empty)'} 没有在已核对文档中声明，已阻止请求。`), { statusCode: 400, code: 'WUYIN_MODEL_NOT_DOCUMENTED' });
  }
  if (product.enabled === false) {
    throw Object.assign(new Error(`Wuyin 模型 ${modelId} 当前文档标记为不可用或维护中，已阻止请求。`), { statusCode: 400, code: 'WUYIN_MODEL_DISABLED_BY_DOC' });
  }
  if (product.category !== mode) {
    throw Object.assign(new Error(`Wuyin 模型 ${modelId} 是 ${product.category}，不能用于 ${mode}。`), { statusCode: 400, code: 'WUYIN_MODEL_TASK_MISMATCH' });
  }
  assertStrictTaskSupported('wuyin-suchuang-form', mode, { modelId });

  const body = buildDocumentedBody(product, req.body || {});
  const submitUrl = makeWuyinUrl(product, apiKey);
  const startedAt = Date.now();
  const payload = await fetchWuyinJson(submitUrl, apiKey, product.method || 'POST', product, body);
  assertWuyinOk(payload, 'Wuyin 任务提交');

  const urls = extractUrls(payload);
  const providerTaskId = extractProviderTaskId(payload);
  const isAsync = product.resultEndpoint && product.executionMode !== 'sync';
  if (!isAsync || urls.length > 0) {
    return { status: 'success', urls, providerTaskId: providerTaskId || '', product, submitExecTime: Date.now() - startedAt, body, raw: payload };
  }
  if (!providerTaskId) {
    throw new Error('Wuyin API 提交成功但没有返回文档要求的任务 ID。');
  }
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
  return {
    status,
    urls: status === 'success' ? extractUrls(payload) : [],
    message: status === 'failed' ? readMessage(payload) || 'Wuyin task failed.' : '',
    raw: payload,
    detailExecTime: Date.now() - startedAt,
  };
}

async function handleSubmitMode(req, res, profileState, mode) {
  const routeId = String(req.body?.routeId || req.headers['x-key-slot-id'] || '').trim();
  const route = resolveLocalUserRoute(profileState, routeId);
  if (!route) return sendError(res, req, 404, 'USER_ROUTE_NOT_FOUND', 'User API route was not found.');
  if (!isWuyinRoute(route)) return null;

  const apiKey = getRouteApiKey(route);
  if (!apiKey) return sendError(res, req, 400, 'USER_ROUTE_SECRET_REQUIRED', 'Wuyin API key is required.');
  const modelId = extractModelId(req);

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
    return sendError(res, req, err.statusCode || 502, err.code || 'WUYIN_STRICT_UPSTREAM_ERROR', err.message);
  }
}

async function handleStatusMode(req, res, profileState) {
  const localTaskId = String(req.body?.localTaskId || req.body?.taskId || '').trim();
  const parsed = decodeLocalProxyTaskId(localTaskId);
  if (!parsed.providerTaskId) return sendError(res, req, 400, 'INVALID_REQUEST', 'localTaskId/taskId is required for Wuyin task status.');
  const product = getWuyinProduct(parsed.modelId);
  if (!product) {
    return sendError(res, req, 400, 'WUYIN_STATUS_MODEL_REQUIRED', '严格 Wuyin 状态查询要求 taskId 内包含已核对文档模型 ID。旧格式 taskId 不再允许猜测查询。');
  }
  if (!product.resultEndpoint) {
    return sendError(res, req, 400, 'WUYIN_STATUS_NOT_ASYNC', '该 Wuyin 模型按文档不是异步详情查询任务。');
  }

  const route = resolveLocalUserRoute(profileState, parsed.routeId || req.body?.routeId || req.headers['x-key-slot-id']);
  if (!route) return sendError(res, req, 404, 'USER_ROUTE_NOT_FOUND', 'Wuyin API route for this task was not found.');
  if (!isWuyinRoute(route)) return null;

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

router.all('/v1/model-proxy/user', async (req, res, next) => {
  const targetUrl = String(req.headers['x-proxy-target-url'] || '').trim();
  if (targetUrl && isWuyinProxyTarget(targetUrl)) {
    return sendError(res, req, 400, 'WUYIN_GENERIC_PROXY_DISABLED', 'Wuyin 通用转发已禁用。请使用 image/video/audio/task_status 模式并按官方文档契约执行。');
  }

  const mode = String(req.body?.mode || '').trim();
  if (!['image', 'video', 'audio', 'utility', 'task_status'].includes(mode)) return next();

  const authState = resolveProfileUserId(req);
  if (!authState) return sendError(res, req, 401, 'UNAUTHORIZED', 'Authentication is required for Wuyin strict routing.');
  if (authState.refreshToken) res.setHeader('X-Refresh-Token', authState.refreshToken);

  const data = readLocalStorage();
  const profileState = readProfileState(data, authState.userId);

  if (mode === 'task_status') return handleStatusMode(req, res, profileState);
  const handled = await handleSubmitMode(req, res, profileState, mode);
  if (handled) return handled;
  return next();
});

module.exports = router;
