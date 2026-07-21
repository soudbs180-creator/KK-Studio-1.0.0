// services/api/routes/user.js
// 职责：提供当前登录用户信息，前端依赖它刷新管理员等级和积分余额。

const express = require('express');
const INITIAL_ADMIN_EMAIL = process.env.ADMIN_INITIAL_EMAIL || '977483863@qq.com';

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

const LOCAL_STORAGE_PATH = path.resolve(__dirname, '../../../../.kk-local/local-user-apis.json');
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
    const isTest = process.env.NODE_ENV === 'test';
    if (!isTest && String(password).trim() !== 'admin123456') {
      return res.status(401).json({
        success: false,
        error: {
          code: 'AUTH_INVALID_CREDENTIALS',
          message: 'Invalid login credentials (Mock password must be admin123456).'
        },
        meta: buildMeta(req)
      });
    }

    const userId = 'mock-user-id';
    const defaultEmail = isTest ? 'local-user@example.com' : INITIAL_ADMIN_EMAIL;
    const loginEmail = String(email).trim() || defaultEmail;
    const session = buildAuthSession({
      id: userId,
      email: loginEmail,
      nickname: loginEmail.split('@')[0] || 'Mock User',
      avatarUrl: '',
      adminLevel: 1,
      role: 'admin',
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

    let adminLevel = Number(user.admin_level || 0);
    if (user.email === INITIAL_ADMIN_EMAIL && adminLevel !== 1) {
      adminLevel = 1;
      await pool.query('UPDATE public.users SET admin_level = 1, updated_at = NOW() WHERE id = $1', [user.id]);
    }

    const session = buildAuthSession({
      id: user.id,
      email: user.email,
      nickname: user.email.split('@')[0],
      avatarUrl: '',
      adminLevel: adminLevel,
      role: adminLevel > 0 ? 'admin' : 'user',
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

const PASSWORD_RESET_ACCEPTED_MESSAGE = 'If an account exists for this email, password reset instructions will be sent shortly.';
const PASSWORD_RESET_COMPLETED_MESSAGE = 'Password has been reset. You can sign in with the new password.';
const PASSWORD_RESET_TOKEN_TTL_MINUTES = Number(process.env.PASSWORD_RESET_TOKEN_TTL_MINUTES || 30);
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function buildPasswordResetRequestResponse(email) {
  return {
    requested: true,
    email,
    delivery: 'email',
    status: 'accepted',
    message: PASSWORD_RESET_ACCEPTED_MESSAGE
  };
}

function getPasswordResetTokenSecret() {
  return process.env.PASSWORD_RESET_TOKEN_SECRET || getRequiredPasswordSalt();
}

function hashPasswordResetToken(token) {
  return crypto.createHmac('sha256', getPasswordResetTokenSecret()).update(String(token || '')).digest('hex');
}

function createPasswordResetToken() {
  return crypto.randomBytes(32).toString('base64url');
}

function getRequestIp(req) {
  const forwardedFor = String(req.headers['x-forwarded-for'] || '').split(',')[0]?.trim();
  return forwardedFor || req.socket?.remoteAddress || '';
}

function getPublicAppOrigin(req) {
  const configured = process.env.PUBLIC_APP_URL || process.env.KK_PUBLIC_APP_URL || process.env.WEB_PUBLIC_URL || '';
  if (configured) {
    return configured.replace(/\/+$/, '');
  }

  const forwardedHost = String(req.headers['x-forwarded-host'] || '').split(',')[0]?.trim();
  const host = forwardedHost || req.headers.host || 'localhost:3000';
  const forwardedProto = String(req.headers['x-forwarded-proto'] || '').split(',')[0]?.trim();
  const protocol = forwardedProto || (isHttpsRequest(req) ? 'https' : 'http');
  return `${protocol}://${host}`.replace(/\/+$/, '');
}

function buildPasswordResetUrl(req, token) {
  const url = new URL(getPublicAppOrigin(req));
  url.searchParams.set('auth-mode', 'reset-password');
  url.searchParams.set('token', token);
  return url.toString();
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

async function sendPasswordResetEmail(email, resetUrl) {
  const resendApiKey = process.env.RESEND_API_KEY || '';
  const from = process.env.PASSWORD_RESET_EMAIL_FROM || '';
  if (!resendApiKey || !from || typeof fetch !== 'function') {
    return { queued: false, reason: 'mail_provider_not_configured' };
  }

  const safeResetUrl = escapeHtml(resetUrl);
  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${resendApiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      from,
      to: [email],
      subject: 'Reset your KK Studio password',
      text: `Use this link to reset your KK Studio password. The link expires in ${PASSWORD_RESET_TOKEN_TTL_MINUTES} minutes.\n\n${resetUrl}`,
      html: `<p>Use this link to reset your KK Studio password. The link expires in ${PASSWORD_RESET_TOKEN_TTL_MINUTES} minutes.</p><p><a href="${safeResetUrl}">Reset password</a></p>`
    })
  });

  if (!response.ok) {
    throw new Error(`password reset email provider returned HTTP ${response.status}`);
  }

  return { queued: true };
}

// privacy-preserving: never reveal whether the submitted email belongs to an existing account.
async function handlePasswordResetRequest(req, res) {
  const normalizedEmail = String(req.body?.email || '').trim().toLowerCase();
  if (!normalizedEmail || !EMAIL_RE.test(normalizedEmail)) {
    return res.status(400).json({
      success: false,
      error: {
        code: 'AUTH_INVALID_EMAIL',
        message: 'Enter a valid email address.'
      },
      meta: buildMeta(req)
    });
  }

  const data = buildPasswordResetRequestResponse(normalizedEmail);
  const isNoDb = !process.env.DATABASE_URL || process.env.KKAI_LOCAL_ONLY === 'true';

  if (!isNoDb) {
    try {
      const pool = getPool();
      const result = await pool.query(
        'SELECT id, email FROM public.users WHERE email = $1 LIMIT 1',
        [normalizedEmail]
      );
      if (result.rows.length > 0) {
        const user = result.rows[0];
        const rawToken = createPasswordResetToken();
        const tokenHash = hashPasswordResetToken(rawToken);
        const expiresAt = new Date(Date.now() + Math.max(5, PASSWORD_RESET_TOKEN_TTL_MINUTES) * 60 * 1000).toISOString();
        await pool.query(
          'UPDATE public.password_reset_tokens SET consumed_at = NOW() WHERE user_id = $1 AND consumed_at IS NULL',
          [user.id]
        );
        await pool.query(
          'INSERT INTO public.password_reset_tokens (id, user_id, email, token_hash, expires_at, request_ip, user_agent) VALUES ($1, $2, $3, $4, $5, $6, $7)',
          [
            crypto.randomUUID ? crypto.randomUUID() : crypto.randomBytes(16).toString('hex'),
            user.id,
            user.email,
            tokenHash,
            expiresAt,
            getRequestIp(req),
            String(req.headers['user-agent'] || '').slice(0, 500)
          ]
        );
        await sendPasswordResetEmail(user.email, buildPasswordResetUrl(req, rawToken));
      }
      console.info('[auth] Password reset request accepted.');
    } catch (err) {
      console.error('[auth] Password reset request lookup failed:', err?.message || err);
    }
  }

  return res.json({
    success: true,
    data: {
      ...data,
      code: 'AUTH_PASSWORD_RESET_REQUESTED'
    },
    meta: buildMeta(req)
  });
}

async function handlePasswordResetConfirm(req, res) {
  const token = String(req.body?.token || '').trim();
  const newPassword = String(req.body?.newPassword || '');
  if (!token || token.length < 24) {
    return res.status(400).json({
      success: false,
      error: {
        code: 'AUTH_INVALID_RESET_TOKEN',
        message: 'Password reset token is invalid or expired.'
      },
      meta: buildMeta(req)
    });
  }

  if (newPassword.length < 8) {
    return res.status(400).json({
      success: false,
      error: {
        code: 'AUTH_WEAK_PASSWORD',
        message: 'Password must be at least 8 characters.'
      },
      meta: buildMeta(req)
    });
  }

  if (!process.env.DATABASE_URL || process.env.KKAI_LOCAL_ONLY === 'true') {
    return res.status(503).json({
      success: false,
      error: {
        code: 'AUTH_PASSWORD_RESET_UNAVAILABLE',
        message: 'Password reset confirmation requires the hosted database runtime.'
      },
      meta: buildMeta(req)
    });
  }

  const tokenHash = hashPasswordResetToken(token);
  const pool = getPool();
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const tokenResult = await client.query(
      'SELECT id, user_id, expires_at, consumed_at FROM public.password_reset_tokens WHERE token_hash = $1 LIMIT 1 FOR UPDATE',
      [tokenHash]
    );
    const tokenRow = tokenResult.rows[0];
    const tokenExpired = !tokenRow || tokenRow.consumed_at || new Date(tokenRow.expires_at).getTime() <= Date.now();
    if (tokenExpired) {
      await client.query('ROLLBACK');
      return res.status(400).json({
        success: false,
        error: {
          code: 'AUTH_INVALID_RESET_TOKEN',
          message: 'Password reset token is invalid or expired.'
        },
        meta: buildMeta(req)
      });
    }

    await client.query(
      'UPDATE public.users SET password_hash = $1, updated_at = NOW() WHERE id = $2',
      [hashPassword(newPassword), tokenRow.user_id]
    );
    await client.query(
      'UPDATE public.password_reset_tokens SET consumed_at = NOW() WHERE user_id = $1 AND consumed_at IS NULL',
      [tokenRow.user_id]
    );
    await client.query('COMMIT');
    return res.json({
      success: true,
      data: {
        updated: true,
        status: 'completed',
        code: 'AUTH_PASSWORD_RESET_COMPLETED',
        message: PASSWORD_RESET_COMPLETED_MESSAGE
      },
      meta: buildMeta(req)
    });
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    console.error('[auth] Password reset confirmation failed:', err?.message || err);
    return res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Internal server error during password reset.'
      },
      meta: buildMeta(req)
    });
  } finally {
    client.release();
  }
}

router.post('/v1/auth/password-reset/request', handlePasswordResetRequest);
router.post('/auth/password-reset/request', handlePasswordResetRequest);
router.post('/v1/auth/password-reset/confirm', handlePasswordResetConfirm);
router.post('/auth/password-reset/confirm', handlePasswordResetConfirm);

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


module.exports = router;
