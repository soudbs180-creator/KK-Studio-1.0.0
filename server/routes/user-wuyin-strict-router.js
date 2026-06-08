/**
 * @file user-wuyin-strict-router.js
 * @module server/routes
 * @description 用户自带 Key 的 Wuyin/速创严格文档路由。该路由在 legacy user.js 之前拦截 Wuyin image/video/status/audio：
 *              - 已核对文档的 image/video 严格走 /api/async/<model> JSON 提交
 *              - 状态查询严格走 /api/async/detail?id=...
 *              - audio 与任意未核对模型直接拒绝
 *              - 禁止 x-proxy-target-url 通用转发绕过文档契约
 */

const fs = require('fs');
const path = require('path');
const http = require('http');
const https = require('https');
const express = require('express');
const fetch = require('node-fetch');
const { verifyJWT, signJWT } = require('../lib/jwt');
const {
  assertStrictTaskSupported,
  resolveWuyinTaskTypeByModel,
} = require('../lib/dispatcher/strictProviderContracts');
const {
  WUYIN_ASYNC_DETAIL_ENDPOINT,
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
  return raw.includes('wuyinkeji.com') || raw.includes('/api/async/') || raw.includes('/api/chat/index') || raw.includes('/api/sora') || raw.includes('/api/img/');
}

function extractModelId(req) {
  return String(req.body?.modelId || req.body?.model || '').split('@')[0].split('|')[0].replace(/^models\//i, '').replace(/^api\/async\//i, '').trim();
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

function makeWuyinUrl(endpoint, apiKey, extraQuery = {}) {
  return appendQuery(endpoint, { key: apiKey, ...extraQuery });
}

function responseCodeOk(payload) {
  const code = payload?.code;
  if (code === undefined || code === null || code === '') return true;
  return ['0', '200'].includes(String(code));
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

function requireHttpUrls(values, fieldName, maxCount) {
  const raw = Array.isArray(values) ? values : String(values || '').split(',');
  return raw
    .map((value) => String(value || '').trim())
    .filter(Boolean)
    .slice(0, maxCount)
    .map((value, index) => {
      if (/^blob:/i.test(value) || /^data:/i.test(value) || (!/^https?:\/\//i.test(value))) {
        throw new Error(`Wuyin 文档要求 ${fieldName} ${index + 1} 必须是公网 HTTP(S) URL，不能使用 base64/blob/本地地址。`);
      }
      return value;
    });
}

function enumValue(value, allowed, fallback) {
  const normalized = String(value || '').trim();
  return allowed.includes(normalized) ? normalized : fallback;
}

function buildImageBody(product, input) {
  const prompt = String(input?.prompt || '').trim();
  if (!prompt) throw new Error('Wuyin 文档要求 prompt 为必填。');
  const urls = requireHttpUrls(input?.referenceImages || input?.urls || input?.image_urls || [], 'urls', 14);
  const body = { prompt };

  if (product.id === 'image_gpt') {
    const allowed = product.requestFields.size.enum;
    body.size = enumValue(input?.size || input?.aspectRatio || product.requestFields.size.default, allowed, product.requestFields.size.default);
  } else {
    body.size = enumValue(String(input?.size || input?.imageSize || product.requestFields.size.default || '1K').toUpperCase(), product.requestFields.size.enum, product.requestFields.size.default);
    body.aspectRatio = enumValue(input?.aspectRatio || product.requestFields.aspectRatio.default, product.requestFields.aspectRatio.enum, product.requestFields.aspectRatio.default);
  }

  if (urls.length > 0) body.urls = urls;
  return body;
}

function buildVideoBody(product, input) {
  const prompt = String(input?.prompt || '').trim();
  if (!prompt) throw new Error('Wuyin 文档要求 prompt 为必填。');
  const body = {
    prompt,
    size: /^\d+x\d+$/i.test(String(input?.size || '')) ? String(input.size) : product.requestFields.size.default,
    duration: String(input?.duration || input?.videoDuration || product.requestFields.duration.default),
  };
  const images = requireHttpUrls(input?.referenceImages || input?.urls || input?.images || [], 'images', 7);
  if (images.length > 0) body.images = images.join(',');
  return body;
}

async function fetchWuyinJson(url, apiKey, method, body) {
  const isHttps = url.startsWith('https');
  const response = await fetch(url, {
    method,
    headers: {
      Authorization: apiKey,
      Accept: 'application/json',
      ...(body ? { 'Content-Type': 'application/json' } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
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

function mapStatus(value) {
  const normalized = String(value ?? '').toLowerCase();
  if (normalized === '2' || normalized === 'success' || normalized === 'succeeded' || normalized === 'completed') return 'success';
  if (normalized === '3' || normalized === 'failed' || normalized === 'fail' || normalized === 'error') return 'failed';
  return 'pending';
}

async function submitStrictTask({ req, route, mode, modelId, apiKey }) {
  const product = getWuyinProduct(modelId);
  if (!product) {
    throw Object.assign(new Error(`Wuyin 模型 ${modelId || '(empty)'} 没有在已核对文档中声明，已阻止请求。`), { statusCode: 400, code: 'WUYIN_MODEL_NOT_DOCUMENTED' });
  }
  if (product.category !== mode) {
    throw Object.assign(new Error(`Wuyin 模型 ${modelId} 是 ${product.category}，不能用于 ${mode}。`), { statusCode: 400, code: 'WUYIN_MODEL_TASK_MISMATCH' });
  }
  assertStrictTaskSupported('wuyin-suchuang-form', mode, { modelId });

  const body = mode === 'image' ? buildImageBody(product, req.body || {}) : buildVideoBody(product, req.body || {});
  const submitUrl = makeWuyinUrl(product.endpoint, apiKey);
  const startedAt = Date.now();
  const payload = await fetchWuyinJson(submitUrl, apiKey, 'POST', body);
  assertWuyinOk(payload, 'Wuyin 任务提交');

  const urls = extractUrls(payload);
  const providerTaskId = extractProviderTaskId(payload);
  if (urls.length > 0) {
    return { status: 'success', urls, providerTaskId: '', product, submitExecTime: Date.now() - startedAt, body };
  }
  if (!providerTaskId) {
    throw new Error('Wuyin API 提交成功但没有返回文档要求的任务 ID。');
  }
  return { status: 'pending', urls: [], providerTaskId, product, submitExecTime: Date.now() - startedAt, body };
}

async function queryStrictTaskStatus({ providerTaskId, apiKey }) {
  const url = makeWuyinUrl(WUYIN_ASYNC_DETAIL_ENDPOINT, apiKey, { id: providerTaskId });
  const startedAt = Date.now();
  const payload = await fetchWuyinJson(url, apiKey, 'GET');
  assertWuyinOk(payload, 'Wuyin 任务状态查询');
  const data = isObjectRecord(payload.data) ? payload.data : payload;
  const status = mapStatus(data.status ?? payload.status);
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
    const result = await submitStrictTask({ req, route, mode, modelId, apiKey });
    const taskId = result.providerTaskId ? encodeLocalProxyTaskId(route.id || routeId, result.providerTaskId, result.product.id) : '';
    return res.json(okEnvelope({
      urls: result.urls,
      url: result.urls[0] || '',
      taskId,
      providerTaskId: result.providerTaskId,
      status: result.status,
      endpointType: `wuyin-async-${mode}`,
      modelId: result.product.id,
      requestId: req.body?.requestId,
      attemptId: req.body?.attemptId,
      submitExecTime: result.submitExecTime,
      execTime: result.submitExecTime,
      route: {
        provider: 'wuyin-suchuang-form',
        adapter: 'wuyin_async_task',
        strictContractChecked: true,
        docUrl: result.product.docUrl,
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
  if (!parsed.modelId || !getWuyinProduct(parsed.modelId)) {
    return sendError(res, req, 400, 'WUYIN_STATUS_MODEL_REQUIRED', '严格 Wuyin 状态查询要求 taskId 内包含已核对文档模型 ID。旧格式 taskId 不再允许猜测查询。');
  }

  const route = resolveLocalUserRoute(profileState, parsed.routeId || req.body?.routeId || req.headers['x-key-slot-id']);
  if (!route) return sendError(res, req, 404, 'USER_ROUTE_NOT_FOUND', 'Wuyin API route for this task was not found.');
  if (!isWuyinRoute(route)) return null;

  const apiKey = getRouteApiKey(route);
  if (!apiKey) return sendError(res, req, 400, 'USER_ROUTE_SECRET_REQUIRED', 'Wuyin API key is required.');

  try {
    const result = await queryStrictTaskStatus({ providerTaskId: parsed.providerTaskId, apiKey });
    const product = getWuyinProduct(parsed.modelId);
    return res.json(okEnvelope({
      taskId: localTaskId,
      providerTaskId: parsed.providerTaskId,
      status: result.status,
      url: result.urls[0] || undefined,
      urls: result.urls,
      message: result.message || undefined,
      error: result.status === 'failed' ? (result.message || 'Wuyin task failed.') : undefined,
      endpointType: `wuyin-async-${product.category}`,
      modelId: product.id,
      detailExecTime: result.detailExecTime,
      execTime: result.detailExecTime,
      route: {
        provider: 'wuyin-suchuang-form',
        adapter: 'wuyin_async_task',
        strictContractChecked: true,
        docUrl: 'https://api.wuyinkeji.com/doc/47',
      },
    }, req));
  } catch (err) {
    return sendError(res, req, err.statusCode || 502, err.code || 'WUYIN_STRICT_STATUS_ERROR', err.message);
  }
}

router.all('/v1/model-proxy/user', async (req, res, next) => {
  const targetUrl = String(req.headers['x-proxy-target-url'] || '').trim();
  if (targetUrl && isWuyinProxyTarget(targetUrl)) {
    return sendError(res, req, 400, 'WUYIN_GENERIC_PROXY_DISABLED', 'Wuyin 通用转发已禁用。请使用 image/video/task_status 模式并按官方文档契约执行。');
  }

  const mode = String(req.body?.mode || '').trim();
  if (!['image', 'video', 'audio', 'task_status'].includes(mode)) return next();

  const authState = resolveProfileUserId(req);
  if (!authState) return sendError(res, req, 401, 'UNAUTHORIZED', 'Authentication is required for Wuyin strict routing.');
  if (authState.refreshToken) res.setHeader('X-Refresh-Token', authState.refreshToken);

  const data = readLocalStorage();
  const profileState = readProfileState(data, authState.userId);

  if (mode === 'audio') {
    return sendError(res, req, 400, 'WUYIN_AUDIO_DOC_NOT_CONFIGURED', '当前没有已核对的 Wuyin 音频文档 contract，已阻止猜测式音频请求。');
  }
  if (mode === 'task_status') return handleStatusMode(req, res, profileState);
  const handled = await handleSubmitMode(req, res, profileState, mode);
  if (handled) return handled;
  return next();
});

module.exports = router;
