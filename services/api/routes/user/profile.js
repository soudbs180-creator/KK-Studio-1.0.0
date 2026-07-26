// User profile, Key Manager, and user-owned Provider route APIs.

const express = require('express');
const INITIAL_ADMIN_EMAIL = String(process.env.ADMIN_INITIAL_EMAIL || '').trim().toLowerCase(); // 安全：禁止硬编码默认值，抢注默认邮箱即可自助提权；未配置则不提权
const { getPool } = require('../../lib/db');
const { signJWT } = require('../../lib/jwt');
const { rejectUnsafeOutboundUrl, safeOutboundFetch } = require('./shared/outboundUrlGuard');
const {
  buildWuyinVideoDetailUrl,
  buildWuyinVideoRequestBody,
  buildWuyinVideoSubmitUrl,
  buildWuyinImageRequestBody,
  extractWuyinVideoMessage,
  extractWuyinVideoStatusCode,
  extractWuyinVideoTaskId,
  extractWuyinTaskId,
  extractWuyinProviderTaskId,
  extractWuyinVideoUrl,
  fetchWuyinVideoJson,
} = require('../../lib/dispatcher/adapters/wuyin/wuyinAsyncVideoProxy');

const {
  getCachedWuyinCatalog,
  WUYIN_FALLBACK_CATALOG
} = require('../../lib/dispatcher/adapters/wuyin/wuyinCatalogCrawler');

const {
  submitWuyinTask,
  checkWuyinTaskStatus,
  decodeLocalProxyTaskId,
  encodeLocalProxyTaskId,
  extractWuyinOutputUrls
} = require('../../lib/dispatcher/adapters/wuyin/wuyinModelExecutor');
const {
  isSendableUserApiSecret,
  normalizeUserApiSecretForTransport,
} = require('../../lib/userApiSecret');
const { WUYIN_CATALOG_URL: WUYIN_PRICE_CATALOG_URL } = require('../../lib/dispatcher/wuyinProducts');
const {
  authErrorEnvelope,
  buildMeta,
  okEnvelope,
  resolveProfileUserId,
  verifyRequestJwt,
} = require('./shared/requestContext');
const { resolveProfileUserRoute } = require('./shared/profileRouteResolver');

const router = express.Router();
function extractWuyinEndpointPath(url) {
  const raw = String(url || '').trim();
  if (!raw) return '';
  try {
    const parsed = new URL(/^https?:\/\//i.test(raw) ? raw : `https://api.wuyinkeji.com${raw.startsWith('/') ? raw : `/${raw}`}`);
    return parsed.pathname.replace(/\/+$/, '');
  } catch {
    return '';
  }
}

function buildProfileFromUserRow(user) {
  const email = String(user.email || '').trim();
  const timestamp = user.updated_at || user.created_at || new Date().toISOString();
  const adminLevel = Number(user.admin_level || 0);
  return {
    id: user.id,
    email,
    nickname: email.split('@')[0] || 'KK User',
    avatarUrl: '',
    adminLevel,
    role: adminLevel > 0 ? 'admin' : 'user',
    status: 'active',
    createdAt: user.created_at || timestamp,
    updatedAt: timestamp,
  };
}

function buildLocalProfile(userId, email = (process.env.NODE_ENV === 'test' ? 'local-user@example.com' : INITIAL_ADMIN_EMAIL)) {
  const now = new Date().toISOString();
  return {
    id: userId || 'local-user',
    email,
    nickname: email.split('@')[0] || 'Local User',
    avatarUrl: '',
    adminLevel: 1,
    role: 'admin',
    status: 'active',
    createdAt: now,
    updatedAt: now,
  };
}

async function loadProfileForUserId(userId) {
  if (!process.env.DATABASE_URL || process.env.KKAI_LOCAL_ONLY === 'true') {
    const defaultEmail = process.env.NODE_ENV === 'test' ? 'local-user@example.com' : INITIAL_ADMIN_EMAIL;
    return buildLocalProfile(userId, defaultEmail);
  }

  const pool = getPool();
  const result = await pool.query(
    'SELECT id, email, created_at, updated_at, COALESCE(admin_level, 0) AS admin_level FROM public.users WHERE id = $1',
    [userId]
  );

  if (result.rows.length > 0) {
    const user = result.rows[0];
    if (INITIAL_ADMIN_EMAIL && String(user.email || '').trim().toLowerCase() === INITIAL_ADMIN_EMAIL && Number(user.admin_level || 0) !== 1) {
      user.admin_level = 1;
      await pool.query('UPDATE public.users SET admin_level = 1, updated_at = NOW() WHERE id = $1', [user.id]);
    }
    return buildProfileFromUserRow(user);
  }
  return null;
}

router.get('/user/me', async (req, res) => {
  const userId = verifyRequestJwt(req);
  if (!userId) {
    return res.status(401).json({ error: 'Unauthorized.' });
  }

  if (!process.env.DATABASE_URL || process.env.KKAI_LOCAL_ONLY === 'true') {
    // 调试模式下，如果无数据库，直接返回固定的本地用户 mock 数据
    const defaultEmail = process.env.NODE_ENV === 'test' ? 'local-user@example.com' : INITIAL_ADMIN_EMAIL;
    return res.json({
      id: userId || 'local-user',
      email: defaultEmail,
      credits: 999999,
      created_at: new Date().toISOString(),
      adminLevel: 1, // 给予管理员权限，方便调测
    });
  }

  const pool = getPool();
  const result = await pool.query(
    'SELECT id, email, credits, created_at, COALESCE(admin_level, 0) AS admin_level FROM public.users WHERE id = $1',
    [userId]
  );

  if (result.rows.length === 0) {
    return res.status(401).json({ error: 'User not found.' });
  }

  res.setHeader('X-Refresh-Token', signJWT({ userId }));
  const user = result.rows[0];
  let adminLevel = Number(user.admin_level || 0);
  if (INITIAL_ADMIN_EMAIL && String(user.email || '').trim().toLowerCase() === INITIAL_ADMIN_EMAIL && adminLevel !== 1) {
    adminLevel = 1;
    await pool.query('UPDATE public.users SET admin_level = 1, updated_at = NOW() WHERE id = $1', [user.id]);
  }
  return res.json({
    id: user.id,
    email: user.email,
    credits: Number(user.credits),
    created_at: user.created_at,
    adminLevel: adminLevel,
  });
});

// ==========================================
// KKAI 本地文件持久化模拟路由 (解决 404 / 500)
// ==========================================
const fs = require('fs');
const path = require('path');

const LOCAL_STORAGE_PATH = path.resolve(__dirname, '../../../../.kk-local/local-user-apis.json');

async function resolveAuthenticatedProfile(req, res, tokenOverride = '') {
  const userId = verifyRequestJwt(req, tokenOverride);
  if (!userId) {
    res.status(401).json(authErrorEnvelope(req, 'AUTH_REQUIRED', 'Authentication is required.'));
    return null;
  }

  const profile = await loadProfileForUserId(userId);
  if (!profile) {
    res.status(401).json(authErrorEnvelope(req, 'AUTH_USER_NOT_FOUND', 'User not found.'));
    return null;
  }

  res.setHeader('X-Refresh-Token', signJWT({ userId }));
  return profile;
}

router.get('/v1/profile', async (req, res) => {
  const profile = await resolveAuthenticatedProfile(req, res);
  if (!profile) {
    return;
  }

  return res.json(okEnvelope(profile, req));
});

function requireProfileAuth(req, res, next) {
  const authState = resolveProfileUserId(req);
  if (!authState) {
    return res.status(401).json({
      success: false,
      error: {
        code: 'UNAUTHORIZED',
        message: 'Authentication is required for profile user API storage.',
      },
      meta: buildMeta(req),
    });
  }

  req.profileUserId = authState.userId;
  if (authState.refreshToken) {
    res.setHeader('X-Refresh-Token', authState.refreshToken);
  }
  return next();
}

const {
  readOwnerProfileState,
  writeOwnerProfileState,
} = require('../../lib/dispatcher/localUserRouteStore');

function localProxyErrorEnvelope(req, code, message) {
  return {
    success: false,
    error: {
      code,
      message,
    },
    meta: buildMeta(req),
  };
}

function sendLocalProxyError(res, req, status, code, message) {
  let cleanMessage = String(message || '');
  const lowerMessage = cleanMessage.toLowerCase();
  if (
    lowerMessage.includes('<html>') ||
    lowerMessage.includes('nginx') ||
    lowerMessage.includes('404 not found') ||
    lowerMessage.includes('upstream error')
  ) {
    cleanMessage = '[速创 API 转发异常] 上游返回了 HTML/404 响应。系统会严格按你选择的速创模型提交，不会自动切换模型；请检查当前部署版本、代理目标 URL、请求参数和参考图是否为公网可访问 URL。';
  }
  return res.status(status).json(localProxyErrorEnvelope(req, code, cleanMessage));
}

function normalizeLocalRouteValue(value) {
  return String(value || '').trim().toLowerCase();
}

function normalizeLocalProviderLinkValue(value) {
  return String(value || '').trim().replace(/\/+$/, '').toLowerCase();
}

function resolveLocalRouteIdCandidate(value) {
  const decoded = (() => {
    try {
      return decodeURIComponent(String(value || '').trim());
    } catch {
      return String(value || '').trim();
    }
  })();
  const normalized = decoded.toLowerCase();
  if (normalized.startsWith('slot_key_')) return normalized.slice(5);
  if (normalized.startsWith('slot_')) return normalized.slice(5);
  if (normalized.startsWith('provider_')) return normalized.slice('provider_'.length);
  return normalized;
}

function findLocalProviderLinkedToSlot(slot, providers) {
  const slotBaseUrl = normalizeLocalProviderLinkValue(slot && slot.baseUrl);
  const slotKey = String(slot && slot.key || '').trim();
  const slotName = normalizeLocalRouteValue(slot && slot.name);

  const strongMatch = providers.find((provider) => {
    const providerBaseUrl = normalizeLocalProviderLinkValue(provider && provider.baseUrl);
    if (!providerBaseUrl || providerBaseUrl !== slotBaseUrl) return false;
    const providerKey = String(provider && provider.apiKey || '').trim();
    const providerName = normalizeLocalRouteValue(provider && provider.name);
    return (slotKey && providerKey && slotKey === providerKey) || (slotName && providerName && slotName === providerName);
  });
  if (strongMatch) return strongMatch;

  const sameBaseProviders = providers.filter((provider) => (
    slotBaseUrl && normalizeLocalProviderLinkValue(provider && provider.baseUrl) === slotBaseUrl
  ));
  return sameBaseProviders.length === 1 ? sameBaseProviders[0] : null;
}

function buildLocalUserRouteFromProvider(provider) {
  return {
    id: String(provider.id || '').trim(),
    legacyIds: Array.isArray(provider.legacyIds) ? provider.legacyIds : [],
    name: String(provider.name || '').trim(),
    baseUrl: String(provider.baseUrl || '').trim(),
    apiKey: String(provider.apiKey || '').trim(),
    models: Array.isArray(provider.models) ? provider.models : [],
    format: String(provider.format || 'openai').trim() || 'openai',
  };
}

function buildLocalUserRouteFromSlot(slot, providers) {
  const linkedProvider = findLocalProviderLinkedToSlot(slot, providers);
  return {
    id: String(slot.id || '').trim(),
    legacyIds: Array.isArray(slot.legacyIds) ? slot.legacyIds : [],
    name: String(linkedProvider && linkedProvider.name || slot.name || '').trim(),
    baseUrl: String(linkedProvider && linkedProvider.baseUrl || slot.baseUrl || '').trim(),
    apiKey: String(linkedProvider && linkedProvider.apiKey || slot.key || '').trim(),
    models: Array.isArray(linkedProvider && linkedProvider.models)
      ? linkedProvider.models
      : Array.isArray(slot.supportedModels)
        ? slot.supportedModels
        : [],
    format: String(linkedProvider && linkedProvider.format || slot.format || 'openai').trim() || 'openai',
  };
}

function getLocalRouteApiKeyForTransport(route) {
  return normalizeUserApiSecretForTransport(route && route.apiKey);
}

function getLocalRecordIdAliases(record) {
  const aliases = [
    String(record && record.id || '').trim(),
    ...(Array.isArray(record && record.legacyIds) ? record.legacyIds : []),
  ]
    .map((value) => normalizeLocalRouteValue(value))
    .filter(Boolean);

  return Array.from(new Set(aliases));
}

// 简体中文注释：动态根据记录的内容推导前端的规范化 ID 候选
function getRecordCanonicalIdCandidate(record) {
  if (!record) return null;
  const id = String(record.id || '').trim().toLowerCase();
  const name = String(record.name || '').trim().toLowerCase();
  const provider = String(record.provider || '').trim().toLowerCase();
  const baseUrl = String(record.baseUrl || record.base_url || '').trim().toLowerCase();

  const source = [id, name, provider, baseUrl].join(' ');

  let channel = 'custom';
  let prefix = '2000';

  // 判断是否是速创
  const isWuyin = source.includes('wuyin') ||
                  source.includes('wuyinkeji') ||
                  source.includes('api.wuyinkeji.com') ||
                  source.includes('速创') ||
                  source.includes('五音');

  if (isWuyin) {
    channel = 'wuyinkeji-google-omni';
    prefix = '1015';
  } else if (source.includes('google') || source.includes('gemini')) {
    channel = 'google';
    prefix = '1017';
  } else if (source.includes('openai')) {
    channel = 'openai';
    prefix = '1018';
  } else if (source.includes('anthropic') || source.includes('claude')) {
    channel = 'anthropic';
    prefix = '1019';
  } else if (source.includes('deepseek')) {
    channel = 'deepseek';
    prefix = '1007';
  } else if (source.includes('siliconflow')) {
    channel = 'siliconflow';
    prefix = '1009';
  }

  return `${channel}-${prefix}-1`;
}

function localRecordMatchesId(record, recordId) {
  const target = normalizeLocalRouteValue(recordId);
  if (!target) return false;

  // 1. 优先匹配已有的 ID 和 legacyIds
  if (getLocalRecordIdAliases(record).includes(target)) {
    return true;
  }

  // 2. 软匹配动态规范化 ID，解决前端在内存中升级了规范 ID，而本地文件尚未保存升级而造成 reveal-secret 匹配失败的 Bug
  const canonical = getRecordCanonicalIdCandidate(record);
  if (canonical && canonical === target) {
    return true;
  }

  return false;
}

function revealProfileApiSecret(profileState, input) {
  const recordType = String(input && input.recordType || '').trim();
  const recordId = String(input && input.recordId || '').trim();
  const field = String(input && input.field || '').trim();

  const collection =
    recordType === 'slot'
      ? profileState.slots
      : recordType === 'provider'
        ? profileState.providers
        : recordType === 'entry'
          ? profileState.entries
          : null;
  const expectedField = recordType === 'provider' ? 'apiKey' : recordType === 'slot' || recordType === 'entry' ? 'key' : '';

  if (!Array.isArray(collection) || !recordId || field !== expectedField) {
    return { ok: false, status: 400, code: 'INVALID_REVEAL_REQUEST' };
  }

  const record = collection.find((item) => localRecordMatchesId(item, recordId));
  if (!record) {
    return { ok: false, status: 404, code: 'USER_API_SECRET_NOT_FOUND' };
  }

  const secret = String(record && record[field] || '').trim();
  if (!isSendableUserApiSecret(secret)) {
    return { ok: false, status: 404, code: 'USER_API_SECRET_NOT_AVAILABLE' };
  }

  return {
    ok: true,
    value: {
      recordType,
      recordId: String(record.id || recordId),
      field,
      secret,
    },
  };
}

function localRecordMatchesRoute(record, routeTarget, rawRouteId) {
  const aliases = getLocalRecordIdAliases(record);
  const name = normalizeLocalRouteValue(record && record.name);
  return aliases.includes(routeTarget)
    || aliases.includes(rawRouteId)
    || name === routeTarget;
}

function appendWuyinApiKeyToTargetUrl(targetUrl, apiKey) {
  const token = String(apiKey || '').trim();
  if (!token) return targetUrl;
  try {
    const parsed = new URL(targetUrl);
    const pathname = parsed.pathname.replace(/\/+$/, '');
    const isDetailQuery =
      pathname === '/api/async/detail'
      || pathname === '/api/sora2/detail'
      || pathname === '/api/img/drawDetail';
    if (!isDetailQuery) {
      return parsed.toString();
    }
    parsed.searchParams.set('key', token);
    return parsed.toString();
  } catch {
    if (!/(?:\/api\/async\/detail|\/api\/sora2\/detail|\/api\/img\/drawDetail)(?:\?|$)/i.test(String(targetUrl || ''))) {
      return targetUrl;
    }
    const separator = String(targetUrl || '').includes('?') ? '&' : '?';
    return `${targetUrl}${separator}key=${encodeURIComponent(token)}`;
  }
}

function findFirstWuyinVideoRoute(profileState) {
  const providers = Array.isArray(profileState.providers) ? profileState.providers : [];
  for (const provider of providers) {
    const route = buildLocalUserRouteFromProvider(provider);
    if (isWuyinAsyncVideoRoute(route, 'video_google_omni')) {
      return route;
    }
  }

  const slots = Array.isArray(profileState.slots) ? profileState.slots : [];
  for (const slot of slots) {
    const route = buildLocalUserRouteFromSlot(slot, providers);
    if (isWuyinAsyncVideoRoute(route, 'video_google_omni')) {
      return route;
    }
  }

  return null;
}

async function handleWuyinGenericProxy(req, res, profileState) {
  const targetUrl = String(req.headers['x-proxy-target-url'] || '').trim();
  const routeId = String(req.headers['x-key-slot-id'] || '').trim();
  if (!targetUrl) {
    return null;
  }

  const unsafeTarget = rejectUnsafeOutboundUrl(targetUrl); // SSRF 守卫：见 shared/outboundUrlGuard.js
  if (unsafeTarget) return sendLocalProxyError(res, req, 400, 'PROXY_TARGET_REJECTED', unsafeTarget);

  const route = await resolveProfileUserRoute(req.profileUserId, profileState, routeId);
  if (!route) {
    return sendLocalProxyError(res, req, 404, 'USER_ROUTE_NOT_FOUND', 'User API route was not found.');
  }
  const apiKey = getLocalRouteApiKeyForTransport(route);
  if (!apiKey) {
    return sendLocalProxyError(res, req, 400, 'USER_ROUTE_SECRET_REQUIRED', 'API key is required.');
  }

  try {
    // 简体中文注释：根据是否为速创 (Wuyin) API，来决定 Authorization 的组装格式。
    // 如果是速创，原样发送 apiKey；如果是其它标准 OpenAI 接口，自动补齐 'Bearer ' 前缀以确保兼容性。
    let upstreamAuth = apiKey;
    const isWuyin = /wuyin/i.test(route.baseUrl) || /wuyin/i.test(route.name) || /wuyinkeji/i.test(route.baseUrl) || isWuyinAsyncVideoTargetUrl(targetUrl);
    if (!isWuyin && !apiKey.toLowerCase().startsWith('bearer ')) {
      upstreamAuth = `Bearer ${apiKey}`;
    }

    const headers = {
      Authorization: upstreamAuth,
      Accept: String(req.headers.accept || 'application/json'),
    };
    const init = {
      method: req.method,
      headers,
    };
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      const contentType = String(req.headers['content-type'] || '');
      headers['Content-Type'] = contentType || 'application/json';
      init.body = typeof req.body === 'string'
        ? req.body
        : contentType.includes('application/x-www-form-urlencoded')
          ? new URLSearchParams(req.body || {}).toString()
          : JSON.stringify(req.body || {});
    }

    const upstream = await safeOutboundFetch(isWuyin ? appendWuyinApiKeyToTargetUrl(targetUrl, apiKey) : targetUrl, init);
    const responseText = await upstream.text().catch(() => '');
    const contentType = upstream.headers.get('content-type') || 'application/json; charset=utf-8';
    const safeText = apiKey ? responseText.replaceAll(apiKey, '[REDACTED]') : responseText;
    return res.status(upstream.status).type(contentType).send(safeText);
  } catch (error) {
    let errMsg = error instanceof Error ? error.message : String(error || 'Generic proxy failed.');
    if (apiKey) {
      errMsg = errMsg.replaceAll(apiKey, '[REDACTED]');
    }
    return sendLocalProxyError(res, req, 502, 'LOCAL_USER_ROUTE_PROXY_UPSTREAM_ERROR', errMsg);
  }
}

// 简体中文注释：在 10 分钟的时间窗口内，对速创的详情接口进行详情轮询
async function pollWuyinImageResultUntilComplete({ route, routeId, providerTaskId, requestId, attemptId }) {
  const startedAt = Date.now();
  const maxDurationMs = 10 * 60 * 1000;
  let delayMs = 2500;
  const apiKey = getLocalRouteApiKeyForTransport(route);

  if (!apiKey) {
    throw new Error('Wuyin API key is required.');
  }

  while (Date.now() - startedAt < maxDurationMs) {
    const detailUrl = buildWuyinVideoDetailUrl(route.baseUrl, providerTaskId);
    const payload = await fetchWuyinVideoJson(detailUrl, apiKey, 'GET');

    const status = mapWuyinVideoStatus(extractWuyinVideoStatusCode(payload));
    const urls = extractWuyinOutputUrls(payload);
    const message = extractWuyinVideoMessage(payload);

    if (status === 'success') {
      if (!urls.length) {
        throw new Error('Wuyin image task succeeded but returned no image URL.');
      }

      return {
        urls,
        taskId: encodeLocalProxyTaskId(route.id || routeId, providerTaskId),
        providerTaskId,
        status: 'success',
        endpointType: 'wuyin-async-image',
        requestId: typeof requestId === 'string' ? requestId : undefined,
        attemptId: typeof attemptId === 'string' ? attemptId : undefined,
        execTime: typeof payload.exec_time === 'number' ? payload.exec_time : undefined,
      };
    }

    if (status === 'failed') {
      throw new Error(message || 'Wuyin image generation failed.');
    }

    await new Promise(resolve => setTimeout(resolve, delayMs));
    delayMs = Math.min(Math.round(delayMs * 1.4), 12000);
  }

  throw new Error('Wuyin image generation timed out after 10 minutes.');
}

const WUYIN_PRIMARY_IMAGE_MODEL_ID = 'image_nanoBanana2';

function normalizeWuyinModelLookupValue(value) {
  return String(value || '')
    .split('@')[0]
    .split('|')[0]
    .replace(/^models\//i, '')
    .replace(/^\/+/, '')
    .replace(/^api\/async\//i, '')
    .trim()
    .toLowerCase();
}

function findCatalogItemInCachedCatalog(modelId, baseUrl) {
  const catalog = getCachedWuyinCatalog();
  const directEndpointPath = extractWuyinEndpointPath(baseUrl);
  if (directEndpointPath) {
    const directMatch = catalog.find(item => String(item.endpointPath || '').toLowerCase() === directEndpointPath.toLowerCase());
    if (directMatch) return directMatch;
  }

  const cleanId = String(modelId || '')
    .split('@')[0]
    .split('|')[0]
    .replace(/^models\//i, '')
    .replace(/^\/+/, '')
    .replace(/^api\/async\//i, '')
    .trim();
  
  let matched = catalog.find(item => item.id.toLowerCase() === cleanId.toLowerCase());
  if (!matched) {
    matched = catalog.find(item => item.aliases.some(alias => alias.toLowerCase() === cleanId.toLowerCase()));
  }
  if (!matched) {
    matched = catalog.find(item => {
      const lastSegment = item.endpointPath.split('/').pop() || '';
      return lastSegment.toLowerCase() === cleanId.toLowerCase();
    });
  }
  return matched || null;
}

function isWuyinUpstreamEndpointUnavailable(error) {
  const message = String(error && error.message || error || '').toLowerCase();
  return (
    message.includes('<html')
    || message.includes('nginx')
    || message.includes('404')
    || message.includes('not found')
    || message.includes('bad gateway')
    || message.includes('502')
    || message.includes('upstream')
  );
}

async function submitWuyinImageTaskWithFallback({ catalogItem, route, input }) {
  try {
    const apiKey = getLocalRouteApiKeyForTransport(route);
    if (!apiKey) {
      throw new Error('Wuyin API key is required.');
    }
    return {
      result: await submitWuyinTask({ catalogItem, apiKey, input, baseUrl: route.baseUrl }),
      catalogItem,
      fallbackApplied: false,
    };
  } catch (error) {
    throw error;
  }
}

function buildWuyinLocalTaskId(route, routeId, result, catalogItem) {
  if (!result || !result.providerTaskId) return result && result.taskId || '';
  return encodeLocalProxyTaskId(route.id || routeId, result.providerTaskId, catalogItem && catalogItem.id);
}

// 简体中文注释：处理速创 API 的图片模型提交，由统一的 wuyinModelExecutor 处理参数清洗和路由执行
async function handleWuyinImageMode(req, res, profileState) {
  const routeId = String(req.body && req.body.routeId || '').trim();
  const route = await resolveProfileUserRoute(req.profileUserId, profileState, routeId);

  if (!route) {
    return sendLocalProxyError(res, req, 404, 'USER_ROUTE_NOT_FOUND', 'User API route was not found.');
  }
  const apiKey = getLocalRouteApiKeyForTransport(route);
  if (!apiKey) {
    return sendLocalProxyError(res, req, 400, 'USER_ROUTE_SECRET_REQUIRED', 'Wuyin API key is required.');
  }

  const modelId = req.body && req.body.modelId;
  const catalogItem = findCatalogItemInCachedCatalog(modelId, route.baseUrl);
  if (!catalogItem) {
    return sendLocalProxyError(res, req, 404, 'MODEL_NOT_FOUND', `Wuyin model "${modelId}" was not found in catalog.`);
  }

  try {
    const { result, catalogItem: effectiveCatalogItem, fallbackApplied } = await submitWuyinImageTaskWithFallback({
      catalogItem,
      route,
      input: req.body,
    });
    
    if (result.status === 'pending') {
      return res.json(okEnvelope({
        urls: [],
        taskId: buildWuyinLocalTaskId(route, routeId, result, effectiveCatalogItem),
        providerTaskId: result.providerTaskId,
        status: 'pending',
        endpointType: 'wuyin-async-image',
        modelId: effectiveCatalogItem.id,
        fallbackApplied,
        submitExecTime: result.submitExecTime,
        execTime: result.submitExecTime,
        requestId: req.body && req.body.requestId,
        attemptId: req.body && req.body.attemptId,
      }, req));
    }

    return res.json(okEnvelope({
      urls: result.urls,
      taskId: '',
      providerTaskId: '',
      status: 'success',
      endpointType: 'wuyin-async-image',
      modelId: effectiveCatalogItem.id,
      fallbackApplied,
      submitExecTime: result.submitExecTime,
      execTime: result.submitExecTime,
      requestId: req.body && req.body.requestId,
      attemptId: req.body && req.body.attemptId,
    }, req));
  } catch (err) {
    return sendLocalProxyError(res, req, 502, 'LOCAL_USER_ROUTE_PROXY_UPSTREAM_ERROR', err.message);
  }
}

// 简体中文注释：处理速创 API 的视频模型提交，利用通用执行器自动分流和适配参数
async function handleWuyinVideoMode(req, res, profileState) {
  const routeId = String(req.body && req.body.routeId || '').trim();
  const route = await resolveProfileUserRoute(req.profileUserId, profileState, routeId);

  if (!route) {
    return sendLocalProxyError(res, req, 404, 'USER_ROUTE_NOT_FOUND', 'User API route was not found.');
  }
  const apiKey = getLocalRouteApiKeyForTransport(route);
  if (!apiKey) {
    return sendLocalProxyError(res, req, 400, 'USER_ROUTE_SECRET_REQUIRED', 'Wuyin API key is required.');
  }

  const modelId = req.body && req.body.modelId;
  const catalogItem = findCatalogItemInCachedCatalog(modelId, route.baseUrl);
  if (!catalogItem) {
    return sendLocalProxyError(res, req, 404, 'MODEL_NOT_FOUND', `Wuyin model "${modelId}" was not found in catalog.`);
  }

  try {
    const result = await submitWuyinTask({ catalogItem, apiKey, input: req.body, baseUrl: route.baseUrl });
    
    return res.json(okEnvelope({
      taskId: buildWuyinLocalTaskId(route, routeId, result, catalogItem),
      providerTaskId: result.providerTaskId || '',
      status: result.status,
      url: result.urls[0] || '',
      urls: result.urls,
      endpointType: 'wuyin-async-video',
      requestId: req.body && req.body.requestId,
      attemptId: req.body && req.body.attemptId,
      execTime: result.submitExecTime,
    }, req));
  } catch (err) {
    return sendLocalProxyError(res, req, 502, 'LOCAL_USER_ROUTE_PROXY_UPSTREAM_ERROR', err.message);
  }
}

async function handleWuyinAudioMode(req, res, profileState) {
  const routeId = String(req.body && req.body.routeId || '').trim();
  const route = await resolveProfileUserRoute(req.profileUserId, profileState, routeId);

  if (!route) {
    return sendLocalProxyError(res, req, 404, 'USER_ROUTE_NOT_FOUND', 'User API route was not found.');
  }
  const apiKey = getLocalRouteApiKeyForTransport(route);
  if (!apiKey) {
    return sendLocalProxyError(res, req, 400, 'USER_ROUTE_SECRET_REQUIRED', 'Wuyin API key is required.');
  }

  const modelId = req.body && req.body.modelId;
  const catalogItem = findCatalogItemInCachedCatalog(modelId, route.baseUrl);
  if (!catalogItem) {
    return sendLocalProxyError(res, req, 404, 'MODEL_NOT_FOUND', `Wuyin model "${modelId}" was not found in catalog.`);
  }
  if (catalogItem.kind !== 'audio') {
    return sendLocalProxyError(res, req, 400, 'INVALID_REQUEST', `Wuyin model "${modelId}" is not an audio model.`);
  }

  try {
    const result = await submitWuyinTask({ catalogItem, apiKey, input: req.body, baseUrl: route.baseUrl });
    return res.json(okEnvelope({
      url: result.urls[0] || '',
      urls: result.urls,
      taskId: buildWuyinLocalTaskId(route, routeId, result, catalogItem),
      providerTaskId: result.providerTaskId || '',
      status: result.status,
      endpointType: 'wuyin-async-audio',
      requestId: req.body && req.body.requestId,
      attemptId: req.body && req.body.attemptId,
      execTime: result.submitExecTime,
    }, req));
  } catch (err) {
    return sendLocalProxyError(res, req, 502, 'LOCAL_USER_ROUTE_PROXY_UPSTREAM_ERROR', err.message);
  }
}

function extractWuyinChatContent(payload) {
  if (typeof payload === 'string') return payload;
  if (!payload || typeof payload !== 'object') return '';
  return String(
    payload.content ||
    payload.text ||
    payload.message ||
    payload.msg ||
    payload.data?.content ||
    payload.data?.text ||
    payload.data?.message ||
    payload.data?.answer ||
    payload.data?.output ||
    ''
  ).trim();
}

async function handleWuyinChatMode(req, res, profileState) {
  const routeId = String(req.body && req.body.routeId || '').trim();
  const route = await resolveProfileUserRoute(req.profileUserId, profileState, routeId);

  if (!route) {
    return sendLocalProxyError(res, req, 404, 'USER_ROUTE_NOT_FOUND', 'User API route was not found.');
  }
  const apiKey = getLocalRouteApiKeyForTransport(route);
  if (!apiKey) {
    return sendLocalProxyError(res, req, 400, 'USER_ROUTE_SECRET_REQUIRED', 'Wuyin API key is required.');
  }

  const catalogItem = findCatalogItemInCachedCatalog(req.body && req.body.modelId, route.baseUrl)
    || findCatalogItemInCachedCatalog('chat_index', route.baseUrl);
  if (!catalogItem || catalogItem.kind !== 'chat') {
    return sendLocalProxyError(res, req, 404, 'MODEL_NOT_FOUND', 'Wuyin ChatAPI model was not found in catalog.');
  }

  try {
    const result = await submitWuyinTask({ catalogItem, apiKey, input: req.body, baseUrl: route.baseUrl });
    const content = extractWuyinChatContent(result.raw) || JSON.stringify(result.raw || {});
    return res.json(okEnvelope({
      content,
      endpointType: 'openai',
      requestId: req.body && req.body.requestId,
      attemptId: req.body && req.body.attemptId,
      execTime: result.submitExecTime,
    }, req));
  } catch (err) {
    return sendLocalProxyError(res, req, 502, 'LOCAL_USER_ROUTE_PROXY_UPSTREAM_ERROR', err.message);
  }
}

// 简体中文注释：查询速创异步任务详情，利用通用执行器进行状态码匹配和结果 URL 深度提取
async function handleWuyinTaskStatusMode(req, res, profileState) {
  const localTaskId = String(req.body && (req.body.localTaskId || req.body.taskId) || '').trim();
  const parsed = decodeLocalProxyTaskId(localTaskId);
  if (!parsed.providerTaskId) {
    return sendLocalProxyError(res, req, 400, 'INVALID_REQUEST', 'localTaskId is required for Wuyin task status.');
  }

  let route = parsed.routeId
    ? await resolveProfileUserRoute(req.profileUserId, profileState, parsed.routeId)
    : findFirstWuyinVideoRoute(profileState);
  if (!route && /^(image|video|audio)_[a-z0-9_.-]+$/i.test(String(parsed.routeId || ''))) {
    route = findFirstWuyinVideoRoute(profileState);
  }
  if (!route) {
    return sendLocalProxyError(res, req, 404, 'USER_ROUTE_NOT_FOUND', 'Wuyin API route for this local task was not found.');
  }
  const apiKey = getLocalRouteApiKeyForTransport(route);
  if (!apiKey) {
    return sendLocalProxyError(res, req, 400, 'USER_ROUTE_SECRET_REQUIRED', 'Wuyin API key is required.');
  }

  const catalog = getCachedWuyinCatalog();
  let catalogItem = null;
  const rawTaskId = String(parsed.providerTaskId || '').toLowerCase();
  const parsedModelId = normalizeWuyinModelLookupValue(parsed.modelId);

  if (parsedModelId) {
    catalogItem = catalog.find(x => normalizeWuyinModelLookupValue(x && x.id) === parsedModelId)
      || catalog.find(x => normalizeWuyinModelLookupValue(x && x.name) === parsedModelId)
      || catalog.find(x => Array.isArray(x.aliases) && x.aliases.some(alias => normalizeWuyinModelLookupValue(alias) === parsedModelId));
  }
  
  if (!catalogItem && rawTaskId.startsWith('image_')) {
    catalogItem = catalog.find(x => x.id === 'image_nanoBanana2') || catalog[0];
  } else if (!catalogItem && (rawTaskId.startsWith('video_') || rawTaskId.startsWith('sora_') || rawTaskId.startsWith('s_') || rawTaskId.includes('sora'))) {
    catalogItem = catalog.find(x => x.id === 'video_google_omni') || catalog.find(x => x.kind === 'video');
  } else if (!catalogItem && rawTaskId.startsWith('audio_')) {
    catalogItem = catalog.find(x => x.id === 'audio_tts') || catalog.find(x => x.kind === 'audio');
  }

  if (!catalogItem) {
    catalogItem = catalog.find(x => x.detailPath === '/api/async/detail') || {
      detailPath: '/api/async/detail',
      detailStatusMode: 'wuyin-async'
    };
  }

  try {
    const result = await checkWuyinTaskStatus({
      catalogItem,
      apiKey,
      providerTaskId: parsed.providerTaskId,
      submitExecTime: req.body.submitExecTime || 0,
      baseUrl: route.baseUrl
    });

    let endpointType = 'wuyin-async';
    if (catalogItem && catalogItem.kind) {
      if (catalogItem.kind === 'image') endpointType = 'wuyin-async-image';
      else if (catalogItem.kind === 'video') endpointType = 'wuyin-async-video';
      else if (catalogItem.kind === 'audio') endpointType = 'wuyin-async-audio';
    } else {
      endpointType = inferWuyinEndpointTypeFromProviderTaskId(parsed.providerTaskId);
    }

    return res.json(okEnvelope({
      taskId: localTaskId,
      providerTaskId: parsed.providerTaskId,
      status: result.status,
      url: result.urls[0] || undefined,
      urls: result.urls,
      message: result.message || undefined,
      error: result.status === 'failed' ? (result.message || 'Wuyin task failed.') : undefined,
      endpointType,
      detailExecTime: result.detailExecTime,
      execTime: result.detailExecTime,
    }, req));
  } catch (err) {
    return sendLocalProxyError(res, req, 502, 'LOCAL_USER_ROUTE_PROXY_UPSTREAM_ERROR', err.message);
  }
}

// 简体中文注释：处理 12AI 自有 Key 的图片生成，支持同步 Gemini Native 和异步生图任务
function extractTwelveAIUrls(payload) {
  const urls = [];
  const seen = new Set();
  const add = (value) => {
    const url = String(value || '').trim();
    if (!url || seen.has(url)) return;
    if (/^(https?:|data:)/i.test(url)) {
      seen.add(url);
      urls.push(url);
    }
  };
  const visit = (value) => {
    if (!value) return;
    if (typeof value === 'string') {
      add(value);
      return;
    }
    if (Array.isArray(value)) {
      value.forEach(visit);
      return;
    }
    if (typeof value === 'object') {
      [
        'outputs',
        'output',
        'result',
        'results',
        'url',
        'urls',
        'video_url',
        'image_url',
        'remote_url',
        'data',
      ].forEach((key) => visit(value[key]));
    }
  };
  if (payload && typeof payload === 'object' && payload.outputs) {
    visit(payload.outputs);
  }
  visit(payload);
  return urls;
}

function collectTwelveAIImageUrls(body) {
  const values = [
    body && body.imageUrl,
    body && body.image_url,
    body && body.url,
    body && body.images,
    body && body.imageUrls,
    body && body.image_urls,
    body && body.referenceImages,
  ];
  const urls = [];
  const seen = new Set();
  const add = (value) => {
    const url = String(value || '').trim();
    if (!url || seen.has(url)) return;
    seen.add(url);
    urls.push(url);
  };
  values.forEach((value) => {
    if (Array.isArray(value)) {
      value.forEach(add);
    } else if (typeof value === 'string' && value.includes(',')) {
      value.split(',').forEach(add);
    } else {
      add(value);
    }
  });
  return urls;
}

function buildTwelveAIVideoPayload(body, modelId, prompt, aspectRatio, duration, size) {
  const seconds = Number(duration) || 8;
  const images = collectTwelveAIImageUrls(body);

  if (/seedance/i.test(modelId)) {
    const payload = {
      model: modelId,
      prompt,
      duration: seconds,
      resolution: String(body && (body.resolution || body.quality) || '720p'),
      ratio: aspectRatio || '16:9',
    };
    if (images.length > 0) payload.image_url = images[0];
    if (images.length > 1) payload.image_urls = images;
    if (body && body.mode) payload.mode = body.mode;
    if (body && body.webhook_url) payload.webhook_url = body.webhook_url;
    if (body && body.auto_review !== undefined) payload.auto_review = body.auto_review;
    return payload;
  }

  if (/veo|omni/i.test(modelId)) {
    const payload = {
      model: modelId,
      prompt,
      duration: seconds,
      aspect_ratio: aspectRatio || '16:9',
    };
    if (images.length > 0) payload.images = images;
    return payload;
  }

  return {
    model: modelId,
    prompt,
    size,
    seconds,
  };
}

async function handleTwelveAIImageMode(req, res, route, profileState) {
  const apiKey = getLocalRouteApiKeyForTransport(route);
  if (!apiKey) {
    return sendLocalProxyError(res, req, 400, 'USER_ROUTE_SECRET_REQUIRED', '12AI API key is required.');
  }

  const modelId = String(req.body && req.body.modelId || '').trim();
  const prompt = String(req.body && req.body.prompt || '').trim();
  const aspectRatio = String(req.body && (req.body.aspect_ratio || req.body.aspectRatio) || '1:1').trim();
  const preferAsync = req.body && (req.body.executionLane === 'local-user-api' || req.body.preferAsync);

  const isGeminiModel = /gemini|nanobanana/i.test(modelId);
  const baseUrl = route.baseUrl || 'https://cdn.12ai.org';

  try {
    if (isGeminiModel && !preferAsync) {
      // 1. 同步生成 (Gemini Native)
      const url = `${baseUrl.replace(/\/+$/, '')}/v1beta/models/${modelId}:generateContent?key=${apiKey}`;
      const payload = {
        contents: req.body.contents || [{
          parts: [{ text: prompt }]
        }],
        generationConfig: req.body.generationConfig || {
          responseModalities: ["IMAGE"],
          imageConfig: {
            aspectRatio: aspectRatio,
            imageSize: "1K"
          }
        }
      };

      const upstream = await safeOutboundFetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });

      if (!upstream.ok) {
        const errText = await upstream.text().catch(() => '');
        throw new Error(`12AI Gemini Image API returned HTTP ${upstream.status}: ${errText}`);
      }

      const resJson = await upstream.json();
      const parts = resJson.candidates?.[0]?.content?.parts || [];
      const imagePart = parts.find(part => part.inlineData);
      if (!imagePart?.inlineData?.data) {
        throw new Error('12AI Gemini Image API failed to return inlineData image.');
      }

      const generatedMimeType = imagePart.inlineData.mimeType || 'image/png';
      const fileExt = generatedMimeType.split('/')[1] || 'png';
      const filename = `kkai-gen-${Date.now()}-${crypto.randomUUID()}.${fileExt}`;
      const uploadsDir = path.join(__dirname, '../uploads');
      if (!fs.existsSync(uploadsDir)) {
        await fs.promises.mkdir(uploadsDir, { recursive: true });
      }
      const filePath = path.join(uploadsDir, filename);
      await fs.promises.writeFile(filePath, Buffer.from(imagePart.inlineData.data, 'base64'));
      const staticImageUrl = `/uploads/${filename}`;

      return res.json(okEnvelope({
        urls: [staticImageUrl],
        taskId: '',
        providerTaskId: '',
        status: 'success',
        endpointType: '12ai-sync-image',
        modelId,
        requestId: req.body && req.body.requestId,
        attemptId: req.body && req.body.attemptId,
      }, req));
    } else {
      // 2. 异步生成 (Standard or Gemini Async)
      let url = `${baseUrl.replace(/\/+$/, '')}/v1/task/submit`;
      let payload = {};

      if (isGeminiModel) {
        // Gemini Async 需要 query 参数 model
        url = `${url}?model=${modelId}`;
        payload = {
          contents: req.body.contents || [{
            parts: [{ text: prompt }]
          }],
          generationConfig: req.body.generationConfig || {
            responseModalities: ["IMAGE"],
            imageConfig: {
              aspectRatio: aspectRatio,
              imageSize: "1K"
            }
          }
        };
      } else {
        // Standard Async (FLUX / SD3 等)
        payload = {
          model: modelId,
          input: {
            prompt: prompt,
            aspect_ratio: aspectRatio
          }
        };
      }

      const upstream = await safeOutboundFetch(url, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });

      if (!upstream.ok) {
        const errText = await upstream.text().catch(() => '');
        throw new Error(`12AI Async Image API returned HTTP ${upstream.status}: ${errText}`);
      }

      const resJson = await upstream.json();
      const providerTaskId = resJson.id || resJson.task_id || resJson.taskId || (resJson.data && resJson.data.id);
      if (!providerTaskId) {
        throw new Error(`12AI Async Image API did not return id/task_id: ${JSON.stringify(resJson)}`);
      }

      const localTaskId = encodeLocalProxyTaskId(route.id, providerTaskId, modelId);

      return res.json(okEnvelope({
        urls: [],
        taskId: localTaskId,
        providerTaskId,
        status: 'pending',
        endpointType: '12ai-async-image',
        modelId,
        requestId: req.body && req.body.requestId,
        attemptId: req.body && req.body.attemptId,
      }, req));
    }
  } catch (err) {
    const safeMsg = err.message && apiKey ? err.message.replaceAll(apiKey, '[REDACTED]') : String(err);
    return sendLocalProxyError(res, req, 502, 'LOCAL_USER_ROUTE_PROXY_UPSTREAM_ERROR', safeMsg);
  }
}

// 简体中文注释：处理 12AI 自有 Key 的视频生成提交
async function handleTwelveAIVideoMode(req, res, route, profileState) {
  const apiKey = getLocalRouteApiKeyForTransport(route);
  if (!apiKey) {
    return sendLocalProxyError(res, req, 400, 'USER_ROUTE_SECRET_REQUIRED', '12AI API key is required.');
  }

  const modelId = String(req.body && req.body.modelId || 'sora-2').trim();
  const prompt = String(req.body && req.body.prompt || '').trim();
  const aspectRatio = String(req.body && (req.body.aspect_ratio || req.body.aspectRatio) || '16:9').trim();
  const duration = String(req.body && (req.body.duration || req.body.seconds) || '8').trim();

  // 映射 aspect_ratio 到 size (根据 12AI 支持 1280x720 或者是 720x1280)
  let size = '1280x720';
  if (aspectRatio === '9:16') {
    size = '720x1280';
  } else if (aspectRatio === '1:1') {
    size = '1024x1024';
  }

  const baseUrl = route.baseUrl || 'https://cdn.12ai.org';

  try {
    const url = `${baseUrl.replace(/\/+$/, '')}/v1/videos`;
    const payload = buildTwelveAIVideoPayload(req.body || {}, modelId, prompt, aspectRatio, duration, size);

    const upstream = await safeOutboundFetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    if (!upstream.ok) {
      const errText = await upstream.text().catch(() => '');
      throw new Error(`12AI Video API returned HTTP ${upstream.status}: ${errText}`);
    }

    const resJson = await upstream.json();
    const providerTaskId = resJson.id;
    if (!providerTaskId) {
      throw new Error(`12AI Video API did not return id: ${JSON.stringify(resJson)}`);
    }

    const localTaskId = encodeLocalProxyTaskId(route.id, providerTaskId, modelId);

    return res.json(okEnvelope({
      taskId: localTaskId,
      providerTaskId,
      status: 'pending',
      endpointType: '12ai-async-video',
      requestId: req.body && req.body.requestId,
      attemptId: req.body && req.body.attemptId,
    }, req));
  } catch (err) {
    const safeMsg = err.message && apiKey ? err.message.replaceAll(apiKey, '[REDACTED]') : String(err);
    return sendLocalProxyError(res, req, 502, 'LOCAL_USER_ROUTE_PROXY_UPSTREAM_ERROR', safeMsg);
  }
}

// 简体中文注释：查询 12AI 异步任务的状态 (涵盖图片异步生成及视频异步生成)
async function handleTwelveAITaskStatusMode(req, res, route, profileState) {
  const apiKey = getLocalRouteApiKeyForTransport(route);
  if (!apiKey) {
    return sendLocalProxyError(res, req, 400, 'USER_ROUTE_SECRET_REQUIRED', '12AI API key is required.');
  }

  const localTaskId = String(req.body && (req.body.localTaskId || req.body.taskId) || '').trim();
  const parsed = decodeLocalProxyTaskId(localTaskId);
  if (!parsed.providerTaskId) {
    return sendLocalProxyError(res, req, 400, 'INVALID_REQUEST', 'localTaskId is required for 12AI task status.');
  }

  const providerTaskId = parsed.providerTaskId;
  const modelId = parsed.modelId || '';
  const isVideo = /video|sora|veo|omni|vidu|seedance/i.test(modelId);

  const baseUrl = route.baseUrl || 'https://cdn.12ai.org';

  try {
    let url = '';
    if (isVideo) {
      url = `${baseUrl.replace(/\/+$/, '')}/v1/videos/${providerTaskId}`;
    } else {
      url = `${baseUrl.replace(/\/+$/, '')}/v1/task/${providerTaskId}`;
    }

    const upstream = await safeOutboundFetch(url, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Accept': 'application/json'
      }
    });

    if (!upstream.ok) {
      const errText = await upstream.text().catch(() => '');
      throw new Error(`12AI Task Status API returned HTTP ${upstream.status}: ${errText}`);
    }

    const resJson = await upstream.json();
    let normalizedStatus = 'pending';
    let urls = [];
    let errorMessage = '';

    const upstreamStatus = String(resJson.status || '').toLowerCase();
    urls = extractTwelveAIUrls(resJson);

    if (isVideo) {
      if (upstreamStatus === 'completed' || upstreamStatus === 'success') {
        normalizedStatus = 'success';
      } else if (upstreamStatus === 'failed' || upstreamStatus === 'cancelled' || upstreamStatus === 'canceled' || upstreamStatus === 'error') {
        normalizedStatus = 'failed';
        errorMessage = resJson.error?.message || '12AI video generation failed.';
      } else {
        normalizedStatus = 'pending';
      }
    } else {
      if (upstreamStatus === 'completed' || upstreamStatus === 'partial_completed' || upstreamStatus === 'success') {
        normalizedStatus = 'success';
      } else if (upstreamStatus === 'failed' || upstreamStatus === 'cancelled' || upstreamStatus === 'canceled' || upstreamStatus === 'error') {
        normalizedStatus = 'failed';
        errorMessage = resJson.error?.message || '12AI image generation failed.';
      } else {
        normalizedStatus = 'pending';
      }
    }

    return res.json(okEnvelope({
      taskId: localTaskId,
      providerTaskId,
      status: normalizedStatus,
      url: urls[0] || undefined,
      urls: urls,
      message: errorMessage || undefined,
      error: normalizedStatus === 'failed' ? (errorMessage || '12AI task failed.') : undefined,
      endpointType: isVideo ? '12ai-async-video' : '12ai-async-image',
    }, req));
  } catch (err) {
    const safeMsg = err.message && apiKey ? err.message.replaceAll(apiKey, '[REDACTED]') : String(err);
    return sendLocalProxyError(res, req, 502, 'LOCAL_USER_ROUTE_PROXY_UPSTREAM_ERROR', safeMsg);
  }
}

router.use('/v1/model-proxy/user', (req, res, next) => {
  const startTime = Date.now();
  const oldJson = res.json;
  res.json = function(data) {
    const metricsCollector = require('../../lib/dispatcher/metricsCollector');
    const success = res.statusCode >= 200 && res.statusCode < 300 && !(data && data.success === false);
    metricsCollector.recordRouteCall({
      routePath: '/api/v1/model-proxy/user(legacy)',
      success,
      latency: Date.now() - startTime
    });
    return oldJson.apply(res, arguments);
  };
  next();
});

router.all('/v1/model-proxy/user', requireProfileAuth, async (req, res) => {
  const profileState = await readOwnerProfileState(req.profileUserId);

  try {
    const genericResponse = await handleWuyinGenericProxy(req, res, profileState);
    if (genericResponse) {
      return genericResponse;
    }

    const mode = String(req.body && req.body.mode || '').trim();

    // 简体中文注释：在分流逻辑前，先获取 route 并判断是否为 12AI 策略渠道
    let route = null;
    let is12AI = false;
    const routeId = String(req.body && req.body.routeId || '').trim();
    if (routeId) {
      route = await resolveProfileUserRoute(req.profileUserId, profileState, routeId);
    } else if (mode === 'task_status') {
      const localTaskId = String(req.body && (req.body.localTaskId || req.body.taskId) || '').trim();
      const parsed = decodeLocalProxyTaskId(localTaskId);
      if (parsed.routeId) {
        route = await resolveProfileUserRoute(req.profileUserId, profileState, parsed.routeId);
      }
    }

    if (route) {
      is12AI = String(route.requestProfileId || '').toLowerCase().startsWith('12ai') 
        || /12ai/i.test(route.baseUrl) 
        || /12ai/i.test(route.name);
    }

    if (is12AI) {
      if (mode === 'image') {
        return await handleTwelveAIImageMode(req, res, route, profileState);
      }
      if (mode === 'video') {
        return await handleTwelveAIVideoMode(req, res, route, profileState);
      }
      if (mode === 'task_status') {
        return await handleTwelveAITaskStatusMode(req, res, route, profileState);
      }
    }

    if (mode === 'image') {
      return await handleWuyinImageMode(req, res, profileState);
    }
    if (mode === 'video') {
      return await handleWuyinVideoMode(req, res, profileState);
    }
    if (mode === 'audio') {
      return await handleWuyinAudioMode(req, res, profileState);
    }
    if (mode === 'chat') {
      return await handleWuyinChatMode(req, res, profileState);
    }
    if (mode === 'task_status') {
      return await handleWuyinTaskStatusMode(req, res, profileState);
    }

    return sendLocalProxyError(res, req, 404, 'USER_ROUTE_NOT_FOUND', 'Local user-route proxy does not handle this mode.');
  } catch (error) {
    let message = error instanceof Error ? error.message : String(error || 'Wuyin user-route proxy failed.');

    return sendLocalProxyError(res, req, 502, 'LOCAL_USER_ROUTE_PROXY_UPSTREAM_ERROR', message);
  }
});

router.use([
  '/v1/profile/key-manager',
  '/v1/profile/key-manager-state',
  '/v1/profile/user-apis',
], requireProfileAuth);

// 1. 获取 key-manager 状态
router.get(['/v1/profile/key-manager', '/v1/profile/key-manager-state'], async (req, res) => {
  const profileState = await readOwnerProfileState(req.profileUserId);
  return res.json({
    success: true,
    data: {
      version: profileState.version || 2,
      slots: profileState.slots || [],
      providers: profileState.providers || []
    },
    meta: buildMeta(req),
  });
});

// 2. 覆盖 key-manager 状态
router.put(['/v1/profile/key-manager', '/v1/profile/key-manager-state'], async (req, res) => {
  const profileState = await readOwnerProfileState(req.profileUserId);
  const nextData = {
    ...profileState,
    version: req.body.version || profileState.version || 2,
    slots: req.body.slots || profileState.slots || [],
    providers: req.body.providers || profileState.providers || []
  };
  await writeOwnerProfileState(req.profileUserId, nextData);
  return res.json({
    success: true,
    data: {
      version: nextData.version,
      slots: nextData.slots,
      providers: nextData.providers
    },
    meta: buildMeta(req),
  });
});

// 3. 获取 user-apis 列表
router.get('/v1/profile/user-apis', async (req, res) => {
  const profileState = await readOwnerProfileState(req.profileUserId);
  return res.json({
    success: true,
    data: {
      entries: profileState.entries || []
    },
    meta: buildMeta(req),
  });
});

// 3.1 显式查看单条已保存密钥。普通列表接口仍不应默认返回所有明文密钥。
router.post('/v1/profile/user-apis/reveal-secret', async (req, res) => {
  const profileState = await readOwnerProfileState(req.profileUserId);

  const result = revealProfileApiSecret(profileState, req.body);
  if (!result.ok) {
    return res.status(result.status).json({
      success: false,
      error: {
        code: result.code,
        message: result.code === 'INVALID_REVEAL_REQUEST'
          ? 'Invalid user API secret reveal request.'
          : 'The requested user API secret is not available.',
      },
      meta: buildMeta(req),
    });
  }

  return res.json({
    success: true,
    data: result.value,
    meta: buildMeta(req),
  });
});

// 4. 覆盖整个 user-apis 列表以及大 Payload (replaceUserApisPayload)
router.put(['/v1/profile/user-apis', '/v1/profile/user-apis/payload'], async (req, res) => {
  const nextData = {
    version: req.body.version || 2,
    slots: req.body.slots || [],
    providers: req.body.providers || [],
    entries: req.body.entries || []
  };
  await writeOwnerProfileState(req.profileUserId, nextData);
  return res.json({
    success: true,
    data: nextData,
    meta: buildMeta(req),
  });
});

// 5. 新增/覆盖 user-apis entries (replaceUserApiEntries)
router.post('/v1/profile/user-apis', async (req, res) => {
  const profileState = await readOwnerProfileState(req.profileUserId);
  const nextData = {
    ...profileState,
    entries: req.body.entries || []
  };
  await writeOwnerProfileState(req.profileUserId, nextData);
  return res.json({
    success: true,
    data: {
      entries: nextData.entries
    },
    meta: buildMeta(req),
  });
});

// 6. 检测个人通道连通性与自动获取模型列表
router.post('/v1/profile/user-routes/:routeId/connectivity', requireProfileAuth, async (req, res) => {
  const routeId = req.params.routeId;
  const profileState = await readOwnerProfileState(req.profileUserId);

  let route;
  if (routeId === 'test') {
    route = {
      name: req.body && req.body.name || 'Test Route',
      baseUrl: req.body && req.body.baseUrl,
      apiKey: req.body && req.body.apiKey,
      format: req.body && req.body.format || 'openai'
    };
  } else {
    route = await resolveProfileUserRoute(req.profileUserId, profileState, routeId);
  }

  if (!route) {
    return res.status(404).json({
      success: false,
      error: {
        code: 'USER_ROUTE_NOT_FOUND',
        message: 'API route configuration was not found.'
      },
      meta: buildMeta(req)
    });
  }

  const cleanBase = String(route.baseUrl || '').trim().replace(/\/$/, '');
  const format = route.format || 'openai';
  const apiKey = getLocalRouteApiKeyForTransport(route);

  // Wuyin/Suchuang exposes its catalog through a site endpoint, not /v1/models.
  const isWuyin = routeId === 'wuyinkeji'
    || routeId === 'provider_wuyin'
    || routeId === 'slot_wuyin'
    || (route && route.provider === 'Wuyin')
    || /wuyin/i.test(route.name)
    || /wuyinkeji/i.test(route.baseUrl);

  if (isWuyin) {
    const baseUrl = String(route.baseUrl || '').trim();

    if (!apiKey) {
      return res.json({
        success: true,
        data: {
          routeId,
          ok: false,
          message: 'API Key 不能为空',
          models: []
        },
        meta: buildMeta(req)
      });
    }

    if (!baseUrl || !/^https?:\/\/api\.wuyinkeji\.com/i.test(baseUrl)) {
      return res.json({
        success: true,
        data: {
          routeId,
          ok: false,
          message: 'Base URL 必须指向 https://api.wuyinkeji.com',
          models: []
        },
        meta: buildMeta(req)
      });
    }

    let catalogItems = [];
    try {
      catalogItems = getCachedWuyinCatalog();
    } catch (error) {
      console.warn('[user-routes] Failed to fetch Wuyin catalog, using fallback models:', error && error.message || error);
      catalogItems = WUYIN_FALLBACK_CATALOG;
    }
    const modelIds = catalogItems.filter(item => item.enabled).map((item) => item.id);

    return res.json({
      success: true,
      data: {
        routeId,
        ok: true,
        endpointUrl: WUYIN_PRICE_CATALOG_URL,
        resolvedFormat: 'openai',
        models: Array.from(new Set(modelIds))
      },
      meta: buildMeta(req)
    });
  }

  // 对于其它普通的 Proxy 或官方 API
  let models = [];
  let ok = false;
  let message = '';
  let latencyMs = null;
  const start = Date.now();

  if (!apiKey) {
    return res.json({
      success: true,
      data: {
        routeId,
        ok: false,
        message: 'API Key 涓嶈兘涓虹┖',
        models: []
      },
      meta: buildMeta(req)
    });
  }

  try {
    let targetUrl = `${cleanBase}/v1/models`;
    const headers = {
      'Accept': 'application/json',
    };
    
    if (format === 'gemini') {
      targetUrl = `${cleanBase}/v1beta/models?key=${apiKey}`;
    } else {
      headers['Authorization'] = `Bearer ${apiKey}`;
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);

    const response = await safeOutboundFetch(targetUrl, {
      method: 'GET',
      headers,
      signal: controller.signal
    });
    clearTimeout(timeoutId);
    latencyMs = Date.now() - start;

    if (response.ok) {
      ok = true;
      const resJson = await response.json();
      if (format === 'gemini') {
        const rawModels = resJson.models || [];
        models = rawModels.map(m => m.name.replace('models/', '')).filter(Boolean);
      } else {
        const rawModels = Array.isArray(resJson.data) ? resJson.data : (resJson.models || []);
        models = rawModels.map(m => m.id || m.name || String(m)).filter(Boolean);
      }
    } else {
      ok = false;
      message = `HTTP error ${response.status}: ${response.statusText}`;
    }
  } catch (err) {
    ok = false;
    message = err.message || 'Connection failed';
  }

  // 如果常规校验失败了，但用户填了模型，用原有的模型作为兜底
  if (!ok && route.models && route.models.length > 0) {
    ok = true;
    models = route.models;
  }

  if (models.length === 0) {
    models = ['gpt-3.5-turbo', 'gpt-4o', 'gemini-2.5-flash'];
  }

  return res.json({
    success: true,
    data: {
      routeId,
      ok,
      message: ok ? undefined : message,
      endpointUrl: route.baseUrl,
      latencyMs,
      resolvedFormat: format,
      models
    },
    meta: buildMeta(req)
  });
});

// 7. 同步个人通道价格目录
router.post('/v1/profile/user-routes/:routeId/pricing-sync', requireProfileAuth, async (req, res) => {
  const routeId = req.params.routeId;
  const profileState = await readOwnerProfileState(req.profileUserId);

  const route = await resolveProfileUserRoute(req.profileUserId, profileState, routeId);
  if (!route) {
    return res.status(404).json({
      success: false,
      error: {
        code: 'USER_ROUTE_NOT_FOUND',
        message: 'API route configuration was not found.'
      },
      meta: buildMeta(req)
    });
  }

  const isWuyin = routeId === 'wuyinkeji' || /wuyin/i.test(route.name) || /wuyinkeji/i.test(route.baseUrl);

  if (isWuyin) {
    let pricingData = [];
    try {
      const catalogItems = getCachedWuyinCatalog();
      pricingData = catalogItems.map(item => ({
        modelId: item.id,
        modelName: item.displayName,
        inputPrice: item.price || 0,
        numeric: item.price || 0,
        unit: item.priceUnit || '次',
        displayPrice: item.priceText || `${item.price || 0}元/${item.priceUnit || '次'}`,
        endpointUrl: item.endpointUrl,
        endpointPath: item.endpointPath
      }));
    } catch (error) {
      console.warn('[user-routes] Failed to fetch Wuyin pricing catalog, using fallback pricing:', error && error.message || error);
      pricingData = WUYIN_FALLBACK_CATALOG.map(item => ({
        modelId: item.id,
        modelName: item.displayName,
        inputPrice: item.price || 0,
        numeric: item.price || 0,
        unit: item.priceUnit || '次',
        displayPrice: item.priceText || `${item.price || 0}元/${item.priceUnit || '次'}`,
        endpointUrl: item.endpointUrl,
        endpointPath: item.endpointPath
      }));
    }

    return res.json({
      success: true,
      data: {
        routeId,
        ok: true,
        endpointUrl: WUYIN_PRICE_CATALOG_URL,
        count: pricingData.length,
        pricingData,
        groupRatio: {}
      },
      meta: buildMeta(req)
    });
  }

  return res.json({
    success: true,
    data: {
      routeId,
      ok: false,
      message: '该提供商暂不支持自动价格同步，请手动配置。',
      count: 0,
      pricingData: [],
      groupRatio: {}
    },
    meta: buildMeta(req)
  });
});

module.exports = router;
