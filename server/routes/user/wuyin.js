// server/routes/user.js
// 职责：提供当前登录用户信息，前端依赖它刷新管理员等级和积分余额。

const express = require('express');
const INITIAL_ADMIN_EMAIL = process.env.ADMIN_INITIAL_EMAIL || 'admin@example.com';

const crypto = require('crypto');
const { getPool } = require('../../lib/db');
const { verifyJWT, signJWT } = require('../../lib/jwt');
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
  refreshWuyinCatalog,
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

const router = express.Router();
const ACCESS_TOKEN_COOKIE_NAME = 'kk.api.access_token';
const REFRESH_TOKEN_COOKIE_NAME = 'kk.api.refresh_token';
const AUTH_COOKIE_MAX_AGE_SECONDS = 7 * 24 * 60 * 60;
// 静态默认配置已从 crawler 库引入

const WUYIN_FULL_DEFAULT_CATALOG = [
  {
    id: 'image_gpt',
    name: 'GPT-Image-2',
    kind: 'image',
    endpointPath: '/api/async/image_gpt',
    method: 'POST',
    submitContentType: 'application/json',
    detailPath: '/api/async/detail',
    price: 0.1,
    priceUnit: '张',
    aliases: ['gpt-image-2', 'gpt image 2', 'image_gpt'],
    enabled: true,
  },
  {
    id: 'image_nanoBanana2',
    name: 'NanoBanana2',
    kind: 'image',
    endpointPath: '/api/async/image_nanoBanana2',
    method: 'POST',
    submitContentType: 'application/json',
    detailPath: '/api/async/detail',
    price: 0.1,
    priceUnit: '张',
    aliases: ['nanobanana2', 'nano-banana-2', 'nano banana 2', 'gemini-3.1-flash-image-preview', 'gemini-3.1-flash-image', 'image_nanoBanana2'],
    enabled: true,
  },
  {
    id: 'image_grok_imagine',
    name: 'grok_imagine',
    kind: 'image',
    endpointPath: '/api/async/image_grok_imagine',
    method: 'POST',
    submitContentType: 'application/json',
    detailPath: '/api/async/detail',
    price: 0.1,
    priceUnit: '张',
    aliases: ['grok_imagine', 'grok imagine', 'image_grok_imagine'],
    enabled: true,
  },
  {
    id: 'image_nanoBanana_pro',
    name: 'NanoBanana_pro',
    kind: 'image',
    endpointPath: '/api/async/image_nanoBanana_pro',
    method: 'POST',
    submitContentType: 'application/json',
    detailPath: '/api/async/detail',
    price: 0.3,
    priceUnit: '张',
    aliases: ['nanobanana_pro', 'nanobanana-pro', 'nano-banana-pro', 'nano banana pro', 'gemini-3-pro-image-preview', 'image_nanoBanana_pro'],
    enabled: true,
  },
  {
    id: 'image_nanoBanana',
    name: 'NanoBanana',
    kind: 'image',
    endpointPath: '/api/async/image_nanoBanana',
    method: 'POST',
    submitContentType: 'application/json',
    detailPath: '/api/async/detail',
    price: 0.1,
    priceUnit: '张',
    aliases: ['nanobanana', 'nano-banana', 'nano banana', 'gemini-2.5-flash-image', 'image_nanoBanana'],
    enabled: true,
  },
  {
    id: 'image_wan2.6',
    name: 'Wan2.6',
    kind: 'image',
    endpointPath: '/api/async/image_wan2.6',
    method: 'POST',
    submitContentType: 'application/x-www-form-urlencoded',
    detailPath: '/api/async/detail',
    price: 0.2,
    priceUnit: '张',
    aliases: ['wan2.6', 'wan26', 'wan image', 'image_wan2.6'],
    enabled: true,
  },
  {
    id: 'video_google_omni',
    name: 'google_omni',
    kind: 'video',
    endpointPath: '/api/async/video_google_omni',
    method: 'POST',
    submitContentType: 'application/json',
    detailPath: '/api/async/detail',
    price: 0.1,
    priceUnit: '秒',
    aliases: ['google_omni', 'google omni', 'video_google_omni'],
    enabled: true,
  },
  {
    id: 'video_vidu',
    name: 'video_vidu',
    kind: 'video',
    endpointPath: '/api/async/video_vidu',
    method: 'POST',
    submitContentType: 'application/json',
    detailPath: '/api/async/detail',
    price: 1,
    priceUnit: '秒',
    aliases: ['vidu', 'video_vidu'],
    enabled: true,
  },
  {
    id: 'video_omni',
    name: 'video_omni',
    kind: 'video',
    endpointPath: '/api/async/video_omni',
    method: 'POST',
    submitContentType: 'application/json',
    detailPath: '/api/async/detail',
    price: 1,
    priceUnit: '秒',
    aliases: ['video_omni', 'omni video'],
    enabled: true,
  },
  {
    id: 'video_digital_humans',
    name: 'Digital_Humans',
    kind: 'video',
    endpointPath: '/api/async/video_digital_humans',
    method: 'POST',
    submitContentType: 'application/json',
    detailPath: '/api/async/detail',
    price: 0.02,
    priceUnit: '秒',
    aliases: ['digital_humans', 'digital humans', 'video_digital_humans'],
    enabled: true,
  },
  {
    id: 'video_package',
    name: 'Package_1.0',
    kind: 'video',
    endpointPath: '/api/async/video_package',
    method: 'POST',
    submitContentType: 'application/json',
    detailPath: '/api/async/detail',
    price: 0.02,
    priceUnit: '秒',
    aliases: ['package_1.0', 'video_package'],
    enabled: true,
  },
  {
    id: 'video_veo3.1_fast',
    name: 'veo3.1_fast',
    kind: 'video',
    endpointPath: '/api/async/video_veo3.1_fast',
    method: 'POST',
    submitContentType: 'application/json',
    detailPath: '/api/async/detail',
    price: 0.05,
    priceUnit: '秒',
    aliases: ['veo3.1_fast', 'veo 3.1 fast', 'video_veo3.1_fast'],
    enabled: true,
  },
  {
    id: 'video_grok_imagine',
    name: 'grok_imagine',
    kind: 'video',
    endpointPath: '/api/async/video_grok_imagine',
    method: 'POST',
    submitContentType: 'application/json',
    detailPath: '/api/async/detail',
    price: 0.05,
    priceUnit: '秒',
    aliases: ['grok_imagine', 'grok imagine video', 'video_grok_imagine'],
    enabled: true,
  },
  {
    id: 'video_wan2.6',
    name: 'Wan2.6',
    kind: 'video',
    endpointPath: '/api/async/video_wan2.6',
    method: 'POST',
    submitContentType: 'application/json',
    detailPath: '/api/async/detail',
    price: 0.8,
    priceUnit: '秒',
    aliases: ['wan2.6', 'wan26', 'wan video', 'video_wan2.6'],
    enabled: true,
  },
  {
    id: 'chat_index',
    name: 'ChatAPI',
    kind: 'chat',
    endpointPath: '/api/chat/index',
    method: 'POST',
    submitContentType: 'application/x-www-form-urlencoded',
    price: 0,
    priceUnit: 'token',
    aliases: ['chatapi', 'chat_index', 'api/chat/index'],
    enabled: true,
  },
  {
    id: 'audio_tts',
    name: '语音合成',
    kind: 'audio',
    endpointPath: '/api/async/audio_tts',
    method: 'POST',
    submitContentType: 'application/json',
    detailPath: '/api/async/detail',
    price: 0.0006,
    priceUnit: '字符',
    aliases: ['audio_tts', 'tts'],
    enabled: true,
  },
  {
    id: 'voice_composite',
    name: '语音合成（同步）',
    kind: 'audio',
    endpointPath: '/api/voice/composite',
    method: 'POST',
    submitContentType: 'application/json',
    price: 0.0006,
    priceUnit: '字符',
    aliases: ['voice_composite', 'voice composite'],
    enabled: true,
  },
  {
    id: 'voice_clone',
    name: '语音克隆（同步）',
    kind: 'audio',
    endpointPath: '/api/voice/clone',
    method: 'POST',
    submitContentType: 'application/json',
    price: 6,
    priceUnit: '次',
    aliases: ['voice_clone', 'voice clone'],
    enabled: true,
  },
  {
    id: 'sora2-new',
    name: 'sora2-new',
    kind: 'video',
    endpointPath: '/api/sora2-new/submit',
    method: 'POST',
    submitContentType: 'application/json',
    detailPath: '/api/sora2/detail',
    price: 1.2,
    priceUnit: '次',
    aliases: ['sora2-new', 'sora2'],
    enabled: true,
  },
  {
    id: 'img_split',
    name: '智能拼图',
    kind: 'utility',
    endpointPath: '/api/img/split',
    method: 'POST',
    submitContentType: 'application/x-www-form-urlencoded',
    price: 0.03,
    priceUnit: '次',
    aliases: ['img_split', 'split'],
    enabled: false,
  },
];

function mergeWuyinCatalogWithRemoteRows(remoteRows) {
  const catalog = WUYIN_FULL_DEFAULT_CATALOG.map(item => ({ ...item }));
  if (!Array.isArray(remoteRows) || remoteRows.length === 0) {
    return catalog;
  }

  for (const row of remoteRows) {
    const matched = catalog.find(item => {
      if (item.endpointPath === row.endpointPath) return true;
      if (item.id === row.modelId) return true;
      return item.aliases.some(alias => alias.toLowerCase() === String(row.modelId || '').toLowerCase());
    });

    if (matched) {
      matched.price = row.inputPrice;
      matched.priceUnit = row.unit;
      if (row.modelName) {
        matched.name = row.modelName;
      }
      matched.enabled = true;
    } else {
      const path = String(row.endpointPath || '').toLowerCase();
      let kind = 'utility';
      if (path.includes('image') || path.includes('draw') || path.includes('img')) {
        kind = 'image';
      } else if (path.includes('video') || path.includes('sora') || path.includes('veo') || path.includes('vidu')) {
        kind = 'video';
      } else if (path.includes('audio') || path.includes('tts') || path.includes('voice') || path.includes('clone')) {
        kind = 'audio';
      } else if (path.includes('chat') || path.includes('gpt') || path.includes('grok')) {
        kind = 'chat';
      }

      let submitContentType = 'application/json';
      if (path.includes('chat') || path.includes('split') || path.includes('image_wan2.6')) {
        submitContentType = 'application/x-www-form-urlencoded';
      }

      let detailPath = undefined;
      if (path.includes('/api/async/') && !path.includes('/detail')) {
        detailPath = '/api/async/detail';
      } else if (path.includes('sora2-new')) {
        detailPath = '/api/sora2/detail';
      }

      catalog.push({
        id: row.modelId,
        name: row.modelName || row.modelId,
        kind,
        endpointPath: row.endpointPath,
        method: row.method || 'POST',
        submitContentType,
        detailPath,
        price: row.inputPrice,
        priceUnit: row.unit,
        aliases: [row.modelId, row.modelName].filter(Boolean),
        enabled: true,
      });
    }
  }

  return catalog;
}

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

function isWuyinPricingProxyRequest(baseUrl, provider) {
  if (/wuyin/i.test(String(provider || ''))) return true;
  const raw = String(baseUrl || '').trim();
  if (!raw) return false;
  const withProtocol = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
  try {
    const parsed = new URL(withProtocol);
    return /^api\.wuyinkeji\.com$/i.test(parsed.hostname) || /wuyinkeji/i.test(parsed.hostname);
  } catch {
    return /wuyinkeji/i.test(raw);
  }
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

function getWuyinFallbackCatalogItems() {
  return WUYIN_FALLBACK_CATALOG.map((entry, index) => ({
    id: String(index + 1),
    name: entry.modelName,
    url: `https://api.wuyinkeji.com${entry.endpointPath}`,
    method: entry.endpointPath.includes('/detail') ? 'GET' : 'POST',
    price: `${entry.inputPrice}${entry.unit}`,
    balance_sum: entry.inputPrice,
    pay_unit: entry.unit,
    api_type: '',
    the: entry.modelName,
  }));
}

async function fetchWuyinCatalogPayload() {
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
  return await response.json();
}

async function fetchWuyinPricingRows() {
  const payload = await fetchWuyinCatalogPayload();
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
    if (user.email === INITIAL_ADMIN_EMAIL && Number(user.admin_level || 0) !== 1) {
      user.admin_level = 1;
      await pool.query('UPDATE public.users SET admin_level = 1, updated_at = NOW() WHERE id = $1', [user.id]);
    }
    return buildProfileFromUserRow(user);
  }
  return null;
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


// ==========================================
// KKAI 本地文件持久化模拟路由 (解决 404 / 500)
// ==========================================
const fs = require('fs');
const path = require('path');

const LOCAL_STORAGE_PATH = path.resolve(__dirname, '../../../.kk-local/local-user-apis.json');
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
  const allowLocalTempUser = process.env.KKAI_LOCAL_ONLY === 'true';
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

router.get('/v1/wuyin/catalog', async (req, res) => {
  const shouldRefresh = req.query.refresh === 'true';

  try {
    if (shouldRefresh) {
      const catalog = await refreshWuyinCatalog();
      return res.json({
        success: true,
        data: catalog,
        source: 'remote'
      });
    }

    const catalog = getCachedWuyinCatalog();
    return res.json({
      success: true,
      data: catalog,
      source: 'cache'
    });
  } catch (error) {
    console.warn('[wuyin-catalog] 获取速创 Catalog 发生异常，回退静态 fallback:', error.message);
    const catalog = getCachedWuyinCatalog();
    return res.json({
      success: true,
      data: catalog,
      source: 'fallback'
    });
  }
});

// 简体中文注释：提供独立的 Catalog 自动爬取刷新 POST 接口
router.post('/v1/wuyin/catalog/refresh', async (req, res) => {
  try {
    const catalog = await refreshWuyinCatalog();
    return res.json({
      success: true,
      data: catalog,
      source: 'remote'
    });
  } catch (error) {
    console.error('[wuyin-catalog] 刷新 Catalog 接口执行失败:', error.message);
    return res.status(502).json({
      success: false,
      error: `文档爬取刷新失败: ${error.message}`
    });
  }
});

router.all('/pricing-proxy', async (req, res) => {
  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed', data: [], group_ratio: {} });
  }

  const baseUrl = String(req.body && req.body.baseUrl || '');
  const provider = String(req.body && req.body.provider || '');
  if (!isWuyinPricingProxyRequest(baseUrl, provider)) {
    return res.status(400).json({
      error: 'Pricing proxy currently supports the Wuyin catalog endpoint only.',
      data: [],
      group_ratio: {},
    });
  }

  try {
    const payload = await fetchWuyinCatalogPayload();
    const apiList = Array.isArray(payload && payload.data && payload.data.api_list)
      ? payload.data.api_list
      : [];
    const apiTypeData = Array.isArray(payload && payload.data && payload.data.api_type_data)
      ? payload.data.api_type_data
      : [];

    return res.json({
      success: true,
      source: 'wuyinkeji',
      endpointUrl: WUYIN_PRICE_CATALOG_URL,
      data: apiList,
      api_type_data: apiTypeData,
      group_ratio: {},
    });
  } catch (error) {
    console.warn('[pricing-proxy] Failed to fetch Wuyin catalog, using fallback:', error && error.message || error);
    return res.json({
      success: true,
      source: 'wuyinkeji',
      endpointUrl: WUYIN_PRICE_CATALOG_URL,
      data: getWuyinFallbackCatalogItems(),
      api_type_data: [],
      group_ratio: {},
      fallback: true,
    });
  }
});


module.exports = router;
