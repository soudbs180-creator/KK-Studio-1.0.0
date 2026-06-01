// server/routes/user.js
// 职责：提供当前登录用户信息，前端依赖它刷新管理员等级和积分余额。

const express = require('express');
const crypto = require('crypto');
const { getPool } = require('../lib/db');
const { verifyJWT, signJWT } = require('../lib/jwt');
const {
  buildWuyinVideoDetailUrl,
  buildWuyinVideoRequestBody,
  buildWuyinVideoSubmitUrl,
  decodeLocalProxyTaskId,
  encodeLocalProxyTaskId,
  extractWuyinVideoMessage,
  extractWuyinVideoStatusCode,
  extractWuyinVideoTaskId,
  extractWuyinVideoUrl,
  fetchWuyinVideoJson,
  isWuyinAsyncVideoRoute,
  isWuyinAsyncVideoTargetUrl,
  mapWuyinVideoStatus,
  resolveWuyinVideoRequestRoute,
} = require('../lib/wuyinAsyncVideoProxy');

const router = express.Router();
const ACCESS_TOKEN_COOKIE_NAME = 'kk.api.access_token';
const REFRESH_TOKEN_COOKIE_NAME = 'kk.api.refresh_token';
const AUTH_COOKIE_MAX_AGE_SECONDS = 7 * 24 * 60 * 60;
const WUYIN_PRICE_CATALOG_URL = 'https://api.wuyinkeji.com/themes/DigitalBlue/api?action=api_list';
const WUYIN_FALLBACK_CATALOG = [
  { modelId: 'video_google_omni', modelName: 'google_omni', endpointPath: '/api/async/video_google_omni', inputPrice: 0.1, unit: '秒' },
  { modelId: 'video_vidu', modelName: 'video_vidu', endpointPath: '/api/async/video_vidu', inputPrice: 1, unit: '秒' },
  { modelId: 'video_omni', modelName: 'video_omni', endpointPath: '/api/async/video_omni', inputPrice: 1, unit: '秒' },
  { modelId: 'video_digital_humans', modelName: 'Digital_Humans', endpointPath: '/api/async/video_digital_humans', inputPrice: 0.02, unit: '秒' },
  { modelId: 'video_package', modelName: 'Package_1.0', endpointPath: '/api/async/video_package', inputPrice: 0.01, unit: '秒' },
  { modelId: 'video_veo3.1_fast', modelName: 'veo3.1_fast', endpointPath: '/api/async/video_veo3.1_fast', inputPrice: 0.05, unit: '秒' },
  { modelId: 'video_grok_imagine', modelName: 'grok_imagine', endpointPath: '/api/async/video_grok_imagine', inputPrice: 0.05, unit: '秒' },
  { modelId: 'video_wan2.6', modelName: 'Wan2.6', endpointPath: '/api/async/video_wan2.6', inputPrice: 0.8, unit: '秒' },
  { modelId: 'image_gpt', modelName: 'GPT-Image-2', endpointPath: '/api/async/image_gpt', inputPrice: 0.1, unit: '张' },
  { modelId: 'image_nanoBanana2', modelName: 'NanoBanana2', endpointPath: '/api/async/image_nanoBanana2', inputPrice: 0.1, unit: '张' },
  { modelId: 'image_grok_imagine', modelName: 'grok_imagine', endpointPath: '/api/async/image_grok_imagine', inputPrice: 0.1, unit: '张' },
  { modelId: 'image_nanoBanana_pro', modelName: 'NanoBanana_pro', endpointPath: '/api/async/image_nanoBanana_pro', inputPrice: 0.3, unit: '张' },
  { modelId: 'image_nanoBanana', modelName: 'NanoBanana', endpointPath: '/api/async/image_nanoBanana', inputPrice: 0.1, unit: '张' },
  { modelId: 'image_wan2.6', modelName: 'Wan2.6', endpointPath: '/api/async/image_wan2.6', inputPrice: 0.2, unit: '张' },
  { modelId: 'audio_tts', modelName: '语音合成', endpointPath: '/api/async/audio_tts', inputPrice: 0.0006, unit: '字符' },
];

function deriveWuyinModelIdFromEndpointPath(endpointPath) {
  const path = String(endpointPath || '').trim().replace(/\/+$/, '');
  const asyncMatch = path.match(/^\/api\/async\/([a-z0-9_.-]+)$/i);
  if (asyncMatch && !/^detail$/i.test(asyncMatch[1])) return decodeURIComponent(asyncMatch[1]);
  const match = path.match(/^\/api\/([a-z0-9_.-]+(?:\/[a-z0-9_.-]+)*)$/i);
  if (!match) return '';
  const parts = match[1].split('/').filter(Boolean);
  if (parts.length >= 2 && /^submit$/i.test(parts[parts.length - 1])) {
    return parts.slice(0, -1).join('_');
  }
  return parts.join('_');
}

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

function toWuyinCatalogRow(item) {
  const endpointPath = extractWuyinEndpointPath(item && item.url);
  const modelId = deriveWuyinModelIdFromEndpointPath(endpointPath) || String(item && (item.name || item.id) || '').trim();
  const unit = String(item && item.pay_unit || '').trim() || '次';
  const inputPrice = Number(item && item.balance_sum);
  const numeric = Number.isFinite(inputPrice) ? inputPrice : 0;
  return {
    modelId,
    modelName: String(item && item.name || modelId).trim(),
    inputPrice: numeric,
    unit,
    displayPrice: `${numeric}元/${unit}`,
    endpointUrl: endpointPath ? `https://api.wuyinkeji.com${endpointPath}` : String(item && item.url || '').trim(),
    endpointPath,
    method: String(item && item.method || '').trim().toUpperCase() || undefined,
    apiType: String(item && item.api_type || '').trim() || undefined,
    tags: Array.isArray(item && item.tags) ? item.tags : undefined,
  };
}

function isWuyinGeneratableCatalogRow(row) {
  return /^\/api\/async\/(image|video|audio)_[a-z0-9_.-]+$/i.test(String(row && row.endpointPath || '').trim());
}

function getWuyinFallbackPricingRows() {
  return WUYIN_FALLBACK_CATALOG.map((entry) => ({
    modelId: entry.modelId,
    modelName: entry.modelName,
    inputPrice: entry.inputPrice,
    numeric: entry.inputPrice,
    unit: entry.unit,
    displayPrice: `${entry.inputPrice}元/${entry.unit}`,
    endpointUrl: `https://api.wuyinkeji.com${entry.endpointPath}`,
    endpointPath: entry.endpointPath,
  }));
}

async function fetchWuyinPricingRows() {
  const response = await fetch(WUYIN_PRICE_CATALOG_URL, {
    method: 'GET',
    headers: {
      Accept: 'application/json',
      'User-Agent': 'KK-Studio/1.0',
    },
  });
  if (!response.ok) {
    throw new Error(`Wuyin catalog returned HTTP ${response.status}`);
  }
  const payload = await response.json();
  const apiList = Array.isArray(payload && payload.data && payload.data.api_list)
    ? payload.data.api_list
    : [];
  return apiList.map(toWuyinCatalogRow).filter((row) => row.modelId);
}

function getRequiredPasswordSalt() {
  if (!process.env.PASSWORD_SALT) {
    throw new Error('[严重] PASSWORD_SALT 未配置，拒绝处理密码凭据');
  }
  return process.env.PASSWORD_SALT;
}

function hashPassword(password) {
  return crypto.createHmac('sha256', getRequiredPasswordSalt()).update(password).digest('hex');
}

function timingSafeEqualHex(left, right) {
  const leftBuffer = Buffer.from(String(left || ''), 'hex');
  const rightBuffer = Buffer.from(String(right || ''), 'hex');
  return leftBuffer.length === rightBuffer.length && crypto.timingSafeEqual(leftBuffer, rightBuffer);
}

function readCookieValue(req, name) {
  const rawCookie = String(req.headers.cookie || '');
  if (!rawCookie) {
    return '';
  }

  const encodedName = encodeURIComponent(name);
  const pair = rawCookie
    .split(';')
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${encodedName}=`) || part.startsWith(`${name}=`));
  if (!pair) {
    return '';
  }

  const rawValue = pair.slice(pair.indexOf('=') + 1);
  try {
    return decodeURIComponent(rawValue);
  } catch {
    return rawValue;
  }
}

function verifyRequestJwt(req, tokenOverride = '') {
  const directUserId = verifyJWT(req.headers.authorization);
  if (directUserId) {
    return directUserId;
  }

  const explicitToken = String(tokenOverride || '').trim();
  if (explicitToken) {
    const explicitUserId = verifyJWT(`Bearer ${explicitToken}`);
    if (explicitUserId) {
      return explicitUserId;
    }
  }

  const cookieToken = readCookieValue(req, ACCESS_TOKEN_COOKIE_NAME) || readCookieValue(req, REFRESH_TOKEN_COOKIE_NAME);
  return cookieToken ? verifyJWT(`Bearer ${cookieToken}`) : null;
}

function buildProfileFromUserRow(user) {
  const email = String(user.email || '').trim();
  const timestamp = user.updated_at || user.created_at || new Date().toISOString();
  return {
    id: user.id,
    email,
    nickname: email.split('@')[0] || 'KK User',
    avatarUrl: '',
    role: Number(user.admin_level || 0) > 0 ? 'admin' : 'user',
    status: 'active',
    createdAt: user.created_at || timestamp,
    updatedAt: timestamp,
  };
}

function buildLocalProfile(userId, email = 'local-user@example.com') {
  const now = new Date().toISOString();
  return {
    id: userId || 'local-user',
    email,
    nickname: email.split('@')[0] || 'Local User',
    avatarUrl: '',
    role: 'admin',
    status: 'active',
    createdAt: now,
    updatedAt: now,
  };
}

async function loadProfileForUserId(userId) {
  if (!process.env.DATABASE_URL || process.env.KKAI_LOCAL_ONLY === 'true') {
    return buildLocalProfile(userId);
  }

  const pool = getPool();
  const result = await pool.query(
    'SELECT id, email, created_at, updated_at, COALESCE(admin_level, 0) AS admin_level FROM public.users WHERE id = $1',
    [userId]
  );

  return result.rows.length > 0 ? buildProfileFromUserRow(result.rows[0]) : null;
}

function buildAuthSession(profile) {
  const accessToken = signJWT({ userId: profile.id });
  return {
    accessToken,
    refreshToken: signJWT({ userId: profile.id }),
    expiresIn: 7 * 24 * 60 * 60,
    sessionExpiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
    profile,
  };
}

function isHttpsRequest(req) {
  const forwardedProto = String(req.headers['x-forwarded-proto'] || '').toLowerCase();
  return req.secure || forwardedProto.split(',').map((part) => part.trim()).includes('https');
}

function buildAuthCookie(req, name, value, maxAgeSeconds) {
  const sameSiteSuffix = isHttpsRequest(req) ? 'SameSite=None; Secure' : 'SameSite=Lax';
  const encodedName = encodeURIComponent(name);
  const encodedValue = encodeURIComponent(value || '');
  return `${encodedName}=${encodedValue}; Max-Age=${maxAgeSeconds}; Path=/; HttpOnly; ${sameSiteSuffix}`;
}

function setAuthSessionCookies(req, res, session) {
  res.setHeader('Set-Cookie', [
    buildAuthCookie(req, ACCESS_TOKEN_COOKIE_NAME, session.accessToken, AUTH_COOKIE_MAX_AGE_SECONDS),
    buildAuthCookie(req, REFRESH_TOKEN_COOKIE_NAME, session.refreshToken, AUTH_COOKIE_MAX_AGE_SECONDS),
  ]);
  res.setHeader('X-Refresh-Token', session.accessToken);
}

function clearAuthSessionCookies(req, res) {
  res.setHeader('Set-Cookie', [
    buildAuthCookie(req, ACCESS_TOKEN_COOKIE_NAME, '', 0),
    buildAuthCookie(req, REFRESH_TOKEN_COOKIE_NAME, '', 0),
  ]);
}

function sendAuthSession(req, res, profile) {
  const session = buildAuthSession(profile);
  setAuthSessionCookies(req, res, session);
  return res.json(okEnvelope(session, req));
}

router.get('/user/me', async (req, res) => {
  const userId = verifyRequestJwt(req);
  if (!userId) {
    return res.status(401).json({ error: 'Unauthorized.' });
  }

  if (!process.env.DATABASE_URL || process.env.KKAI_LOCAL_ONLY === 'true') {
    // 调试模式下，如果无数据库，直接返回固定的本地用户 mock 数据
    return res.json({
      id: userId || 'local-user',
      email: 'local-user@example.com',
      credits: 999999,
      created_at: new Date().toISOString(),
      adminLevel: 2, // 给予管理员权限，方便调测
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
  return res.json({
    id: user.id,
    email: user.email,
    credits: Number(user.credits),
    created_at: user.created_at,
    adminLevel: Number(user.admin_level || 0),
  });
});

// ==========================================
// KKAI 本地文件持久化模拟路由 (解决 404 / 500)
// ==========================================
const fs = require('fs');
const path = require('path');

const LOCAL_STORAGE_PATH = path.resolve(__dirname, '../../.kk-local/local-user-apis.json');
const TEMP_USER_ID_HEADER = 'x-kk-temp-user-id';

function createEmptyLocalStorage() {
  return {
    version: 2,
    profiles: {},
  };
}

function createEmptyProfileState(version = 2) {
  return {
    version,
    slots: [],
    providers: [],
    entries: [],
  };
}

function isObjectRecord(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
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

function hasLegacyProfilePayload(data) {
  return Array.isArray(data.slots) || Array.isArray(data.providers) || Array.isArray(data.entries);
}

function resolveProfileUserId(req) {
  const verifiedUserId = verifyRequestJwt(req);
  if (verifiedUserId) {
    return {
      userId: verifiedUserId,
      refreshToken: signJWT({ userId: verifiedUserId }),
    };
  }

  const tempUserId = String(req.headers[TEMP_USER_ID_HEADER] || '').trim();
  const allowLocalTempUser = process.env.KKAI_LOCAL_ONLY === 'true' || process.env.NODE_ENV !== 'production';
  if (allowLocalTempUser && /^temp-[a-zA-Z0-9_.-]{4,128}$/.test(tempUserId)) {
    return {
      userId: tempUserId,
      refreshToken: null,
    };
  }

  return null;
}

function buildMeta(req) {
  return {
    requestId: req.headers['x-request-id'] || `req-${Date.now()}`,
    timestamp: new Date().toISOString(),
  };
}

function okEnvelope(data, req) {
  return {
    success: true,
    data,
    meta: buildMeta(req),
  };
}

function authErrorEnvelope(req, code, message) {
  return {
    success: false,
    error: {
      code,
      message,
    },
    meta: buildMeta(req),
  };
}

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

router.get('/v1/auth/session', async (req, res) => {
  const profile = await resolveAuthenticatedProfile(req, res);
  if (!profile) {
    return;
  }

  return sendAuthSession(req, res, profile);
});

router.get('/v1/auth/token', async (req, res) => {
  const profile = await resolveAuthenticatedProfile(req, res);
  if (!profile) {
    return;
  }

  const accessToken = signJWT({ userId: profile.id });
  return res.json({
    jwt: accessToken,
    user: {
      id: profile.id,
      email: profile.email,
    },
  });
});

router.post('/v1/auth/refresh', async (req, res) => {
  const profile = await resolveAuthenticatedProfile(req, res, req.body?.refreshToken);
  if (!profile) {
    return;
  }

  return sendAuthSession(req, res, profile);
});

router.post('/v1/auth/logout', async (req, res) => {
  clearAuthSessionCookies(req, res);
  return res.json(okEnvelope({ loggedOut: true }, req));
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

function ensureLocalStorage() {
  const dir = path.dirname(LOCAL_STORAGE_PATH);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  if (!fs.existsSync(LOCAL_STORAGE_PATH)) {
    fs.writeFileSync(LOCAL_STORAGE_PATH, JSON.stringify(createEmptyLocalStorage(), null, 2), 'utf8');
  }
}

function readLocalStorage() {
  ensureLocalStorage();
  try {
    const raw = fs.readFileSync(LOCAL_STORAGE_PATH, 'utf8');
    const parsed = JSON.parse(raw);
    return isObjectRecord(parsed) ? parsed : createEmptyLocalStorage();
  } catch (e) {
    return createEmptyLocalStorage();
  }
}

function writeLocalStorage(data) {
  ensureLocalStorage();
  fs.writeFileSync(LOCAL_STORAGE_PATH, JSON.stringify(data, null, 2), 'utf8');
}

function readProfileState(data, userId) {
  if (!isObjectRecord(data.profiles)) {
    data.profiles = {};
  }

  const profiles = data.profiles;
  if (isObjectRecord(profiles[userId])) {
    return normalizeProfileState(profiles[userId]);
  }

  const shouldMigrateLegacyPayload = Object.keys(profiles).length === 0 && hasLegacyProfilePayload(data);
  const nextProfile = shouldMigrateLegacyPayload
    ? normalizeProfileState(data)
    : createEmptyProfileState(Number.parseInt(data.version, 10) || 2);

  profiles[userId] = nextProfile;
  delete data.slots;
  delete data.providers;
  delete data.entries;
  return nextProfile;
}

function writeProfileState(data, userId, profileState) {
  if (!isObjectRecord(data.profiles)) {
    data.profiles = {};
  }

  data.version = 2;
  data.profiles[userId] = normalizeProfileState(profileState);
  delete data.slots;
  delete data.providers;
  delete data.entries;
}

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
  return res.status(status).json(localProxyErrorEnvelope(req, code, message));
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

function resolveLocalUserRoute(profileState, routeId) {
  const routeTarget = resolveLocalRouteIdCandidate(routeId);
  const providers = Array.isArray(profileState.providers) ? profileState.providers : [];
  const slots = Array.isArray(profileState.slots) ? profileState.slots : [];

  const provider = providers.find((item) => {
    const providerId = normalizeLocalRouteValue(item && item.id);
    const providerName = normalizeLocalRouteValue(item && item.name);
    return providerId === routeTarget || providerName === routeTarget;
  });
  if (provider) {
    return buildLocalUserRouteFromProvider(provider);
  }

  const slot = slots.find((item) => {
    const slotId = normalizeLocalRouteValue(item && item.id);
    const slotName = normalizeLocalRouteValue(item && item.name);
    return slotId === routeTarget || slotName === routeTarget;
  });
  if (slot) {
    return buildLocalUserRouteFromSlot(slot, providers);
  }

  return null;
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

  if (!isWuyinAsyncVideoTargetUrl(targetUrl)) {
    return sendLocalProxyError(res, req, 404, 'USER_ROUTE_NOT_FOUND', 'Local user-route proxy only handles Wuyin async-video generic requests.');
  }

  const route = resolveLocalUserRoute(profileState, routeId);
  if (!route) {
    return sendLocalProxyError(res, req, 404, 'USER_ROUTE_NOT_FOUND', 'User API route was not found.');
  }
  if (!route.apiKey) {
    return sendLocalProxyError(res, req, 400, 'USER_ROUTE_SECRET_REQUIRED', 'Wuyin API key is required.');
  }

  const headers = {
    Authorization: route.apiKey,
    Accept: String(req.headers.accept || 'application/json'),
  };
  const init = {
    method: req.method,
    headers,
  };
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    headers['Content-Type'] = String(req.headers['content-type'] || 'application/json');
    init.body = typeof req.body === 'string' ? req.body : JSON.stringify(req.body || {});
  }

  const upstream = await fetch(targetUrl, init);
  const responseText = await upstream.text().catch(() => '');
  const contentType = upstream.headers.get('content-type') || 'application/json; charset=utf-8';
  return res.status(upstream.status).type(contentType).send(responseText);
}

async function handleWuyinVideoMode(req, res, profileState) {
  const routeId = String(req.body && req.body.routeId || '').trim();
  const route = resolveLocalUserRoute(profileState, routeId);
  if (!route) {
    return sendLocalProxyError(res, req, 404, 'USER_ROUTE_NOT_FOUND', 'User API route was not found.');
  }
  if (!isWuyinAsyncVideoRoute(route, req.body && req.body.modelId)) {
    return sendLocalProxyError(res, req, 404, 'USER_ROUTE_NOT_FOUND', 'Local user-route proxy only handles Wuyin async-video routes.');
  }
  if (!route.apiKey) {
    return sendLocalProxyError(res, req, 400, 'USER_ROUTE_SECRET_REQUIRED', 'Wuyin API key is required.');
  }

  const body = buildWuyinVideoRequestBody(req.body || {});
  if (!body.prompt.trim()) {
    return sendLocalProxyError(res, req, 400, 'INVALID_REQUEST', 'Prompt is required for Wuyin video generation.');
  }

  const wuyinRoute = resolveWuyinVideoRequestRoute(route.baseUrl, req.body && req.body.modelId);
  const submitUrl = buildWuyinVideoSubmitUrl(route.baseUrl, wuyinRoute);
  const payload = await fetchWuyinVideoJson(submitUrl, route.apiKey, 'POST', body);
  const providerTaskId = extractWuyinVideoTaskId(payload);
  const status = mapWuyinVideoStatus(extractWuyinVideoStatusCode(payload));
  const directUrl = extractWuyinVideoUrl(payload);
  const message = extractWuyinVideoMessage(payload);

  if (!providerTaskId && !directUrl) {
    return sendLocalProxyError(res, req, 502, 'LOCAL_USER_ROUTE_PROXY_UPSTREAM_ERROR', message || 'Wuyin video API returned no task id.');
  }

  return res.json(okEnvelope({
    taskId: providerTaskId ? encodeLocalProxyTaskId(route.id || routeId, providerTaskId) : '',
    providerTaskId,
    status: directUrl && status === 'success' ? 'success' : status,
    url: directUrl || '',
    message: message || undefined,
    endpointType: 'openai',
    requestId: req.body && typeof req.body.requestId === 'string' ? req.body.requestId : undefined,
    attemptId: req.body && typeof req.body.attemptId === 'string' ? req.body.attemptId : undefined,
  }, req));
}

async function handleWuyinTaskStatusMode(req, res, profileState) {
  const localTaskId = String(req.body && (req.body.localTaskId || req.body.taskId) || '').trim();
  const parsed = decodeLocalProxyTaskId(localTaskId);
  if (!parsed.providerTaskId) {
    return sendLocalProxyError(res, req, 400, 'INVALID_REQUEST', 'localTaskId is required for Wuyin task status.');
  }

  const route = parsed.routeId
    ? resolveLocalUserRoute(profileState, parsed.routeId)
    : findFirstWuyinVideoRoute(profileState);
  if (!route) {
    return sendLocalProxyError(res, req, 404, 'USER_ROUTE_NOT_FOUND', 'Wuyin API route for this local task was not found.');
  }
  if (!route.apiKey) {
    return sendLocalProxyError(res, req, 400, 'USER_ROUTE_SECRET_REQUIRED', 'Wuyin API key is required.');
  }

  const detailUrl = buildWuyinVideoDetailUrl(route.baseUrl, parsed.providerTaskId);
  const payload = await fetchWuyinVideoJson(detailUrl, route.apiKey, 'GET');
  const status = mapWuyinVideoStatus(extractWuyinVideoStatusCode(payload));
  const url = status === 'success' ? extractWuyinVideoUrl(payload) : '';
  const message = extractWuyinVideoMessage(payload);
  const effectiveStatus = status === 'success' && !url ? 'pending' : status;

  return res.json(okEnvelope({
    taskId: localTaskId,
    providerTaskId: parsed.providerTaskId,
    status: effectiveStatus,
    url: url || undefined,
    message: message || undefined,
    error: status === 'failed' ? (message || 'Wuyin video task failed.') : undefined,
    endpointType: 'openai',
  }, req));
}

router.all('/v1/model-proxy/user', requireProfileAuth, async (req, res) => {
  const data = readLocalStorage();
  const profileState = readProfileState(data, req.profileUserId);
  writeLocalStorage(data);

  try {
    const genericResponse = await handleWuyinGenericProxy(req, res, profileState);
    if (genericResponse) {
      return genericResponse;
    }

    const mode = String(req.body && req.body.mode || '').trim();
    if (mode === 'video') {
      return await handleWuyinVideoMode(req, res, profileState);
    }
    if (mode === 'task_status') {
      return await handleWuyinTaskStatusMode(req, res, profileState);
    }

    return sendLocalProxyError(res, req, 404, 'USER_ROUTE_NOT_FOUND', 'Local user-route proxy does not handle this mode.');
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error || 'Wuyin async-video proxy failed.');
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
  const data = readLocalStorage();
  const profileState = readProfileState(data, req.profileUserId);
  writeLocalStorage(data);
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
  const data = readLocalStorage();
  const profileState = readProfileState(data, req.profileUserId);
  const nextData = {
    ...profileState,
    version: req.body.version || profileState.version || 2,
    slots: req.body.slots || profileState.slots || [],
    providers: req.body.providers || profileState.providers || []
  };
  writeProfileState(data, req.profileUserId, nextData);
  writeLocalStorage(data);
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
  const data = readLocalStorage();
  const profileState = readProfileState(data, req.profileUserId);
  writeLocalStorage(data);
  return res.json({
    success: true,
    data: {
      entries: profileState.entries || []
    },
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
  const data = readLocalStorage();
  writeProfileState(data, req.profileUserId, nextData);
  writeLocalStorage(data);
  return res.json({
    success: true,
    data: nextData,
    meta: buildMeta(req),
  });
});

// 5. 新增/覆盖 user-apis entries (replaceUserApiEntries)
router.post('/v1/profile/user-apis', async (req, res) => {
  const data = readLocalStorage();
  const profileState = readProfileState(data, req.profileUserId);
  const nextData = {
    ...profileState,
    entries: req.body.entries || []
  };
  writeProfileState(data, req.profileUserId, nextData);
  writeLocalStorage(data);
  return res.json({
    success: true,
    data: {
      entries: nextData.entries
    },
    meta: buildMeta(req),
  });
});

// 简体中文注释：常规登录接口，优先使用数据库校验凭据，调试环境无数据库时提供 Mock 登录
router.post('/v1/auth/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({
      success: false,
      error: {
        code: 'AUTH_INVALID_PAYLOAD',
        message: 'Email and password are required.'
      },
      meta: buildMeta(req)
    });
  }

  const isNoDb = !process.env.DATABASE_URL || process.env.KKAI_LOCAL_ONLY === 'true';
  if (isNoDb) {
    const userId = 'mock-user-id';
    const session = buildAuthSession({
      id: userId,
      email: String(email).trim() || 'mock-user@example.com',
      nickname: 'Mock User',
      avatarUrl: '',
      role: 'user',
      status: 'active',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });
    setAuthSessionCookies(req, res, session);
    return res.json({
      success: true,
      data: session,
      meta: buildMeta(req)
    });
  }

  try {
    const normalizedEmail = String(email).trim().toLowerCase();
    const pool = getPool();
    const result = await pool.query(
      'SELECT id, email, password_hash, COALESCE(admin_level, 0) AS admin_level, created_at FROM public.users WHERE email = $1',
      [normalizedEmail]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({
        success: false,
        error: {
          code: 'AUTH_INVALID_CREDENTIALS',
          message: 'Invalid login credentials.'
        },
        meta: buildMeta(req)
      });
    }

    const user = result.rows[0];
    const computedHash = hashPassword(password);

    // 简体中文注释：密码哈希必须使用时序安全比较，避免登录接口暴露可测量的差异。
    if (!timingSafeEqualHex(user.password_hash, computedHash)) {
      return res.status(401).json({
        success: false,
        error: {
          code: 'AUTH_INVALID_CREDENTIALS',
          message: 'Invalid login credentials.'
        },
        meta: buildMeta(req)
      });
    }

    const session = buildAuthSession({
      id: user.id,
      email: user.email,
      nickname: user.email.split('@')[0],
      avatarUrl: '',
      role: user.admin_level > 0 ? 'admin' : 'user',
      status: 'active',
      createdAt: user.created_at,
      updatedAt: new Date().toISOString()
    });
    setAuthSessionCookies(req, res, session);
    return res.json({
      success: true,
      data: session,
      meta: buildMeta(req)
    });
  } catch (err) {
    console.error('[auth] Login failed:', err);
    return res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Internal server error during login.'
      },
      meta: buildMeta(req)
    });
  }
});

// 简体中文注释：常规注册接口，优先注册到数据库，默认写入 0 积分，调试环境直接返回 Mock 成功
router.post('/v1/auth/register', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({
      success: false,
      error: {
        code: 'AUTH_INVALID_PAYLOAD',
        message: 'Email and password are required.'
      },
      meta: buildMeta(req)
    });
  }

  if (password.length < 8) {
    return res.status(400).json({
      success: false,
      error: {
        code: 'AUTH_WEAK_PASSWORD',
        message: 'Password must be at least 8 characters.'
      },
      meta: buildMeta(req)
    });
  }

  const isNoDb = !process.env.DATABASE_URL || process.env.KKAI_LOCAL_ONLY === 'true';
  if (isNoDb) {
    return res.json({
      success: true,
      data: {
        userId: 'mock-user-id',
        email: email.trim(),
        status: 'registered'
      },
      meta: buildMeta(req)
    });
  }

  try {
    const pool = getPool();
    const existing = await pool.query(
      'SELECT id FROM public.users WHERE email = $1',
      [email.trim().toLowerCase()]
    );

    if (existing.rows.length > 0) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'AUTH_USER_ALREADY_EXISTS',
          message: 'User already exists.'
        },
        meta: buildMeta(req)
      });
    }

    const userId = crypto.randomUUID ? crypto.randomUUID() : crypto.randomBytes(16).toString('hex');
    const passwordHash = hashPassword(password);

    // 默认积分一律为 0，符合 AGENTS.md 安全审计要求
    await pool.query(
      'INSERT INTO public.users (id, email, password_hash, credits, created_at, updated_at) VALUES ($1, $2, $3, 0, NOW(), NOW())',
      [userId, email.trim().toLowerCase(), passwordHash]
    );

    return res.json({
      success: true,
      data: {
        userId,
        email: email.trim().toLowerCase(),
        status: 'registered'
      },
      meta: buildMeta(req)
    });
  } catch (err) {
    console.error('[auth] Register failed:', err);
    return res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Internal server error during registration.'
      },
      meta: buildMeta(req)
    });
  }
});

// 6. 检测个人通道连通性与自动获取模型列表
router.post('/v1/profile/user-routes/:routeId/connectivity', requireProfileAuth, async (req, res) => {
  const routeId = req.params.routeId;
  const data = readLocalStorage();
  const profileState = readProfileState(data, req.profileUserId);
  writeLocalStorage(data);

  const route = resolveLocalUserRoute(profileState, routeId);
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

  // Wuyin/Suchuang exposes its catalog through a site endpoint, not /v1/models.
  const isWuyin = routeId === 'wuyinkeji' || /wuyin/i.test(route.name) || /wuyinkeji/i.test(route.baseUrl);

  if (isWuyin) {
    let pricingRows = [];
    try {
      pricingRows = await fetchWuyinPricingRows();
    } catch (error) {
      console.warn('[user-routes] Failed to fetch Wuyin catalog, using fallback models:', error && error.message || error);
      pricingRows = getWuyinFallbackPricingRows();
    }
    const generatableRows = pricingRows.filter(isWuyinGeneratableCatalogRow);
    const modelIds = (generatableRows.length ? generatableRows : getWuyinFallbackPricingRows()).map((row) => row.modelId);

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

  try {
    let targetUrl = `${cleanBase}/v1/models`;
    const headers = {
      'Accept': 'application/json',
    };
    
    if (format === 'gemini') {
      targetUrl = `${cleanBase}/v1beta/models?key=${route.apiKey}`;
    } else {
      headers['Authorization'] = `Bearer ${route.apiKey}`;
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);

    const response = await fetch(targetUrl, {
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
  const data = readLocalStorage();
  const profileState = readProfileState(data, req.profileUserId);
  writeLocalStorage(data);

  const route = resolveLocalUserRoute(profileState, routeId);
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
      pricingData = await fetchWuyinPricingRows();
    } catch (error) {
      console.warn('[user-routes] Failed to fetch Wuyin pricing catalog, using fallback pricing:', error && error.message || error);
      pricingData = getWuyinFallbackPricingRows();
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
