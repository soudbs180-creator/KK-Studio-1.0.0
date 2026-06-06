const WUYIN_ASYNC_VIDEO_DEFAULT_BASE_URL = 'https://api.wuyinkeji.com';
const WUYIN_ASYNC_VIDEO_DETAIL_PATH = '/api/async/detail';
const WUYIN_ASYNC_VIDEO_DEFAULT_ENDPOINT_PATH = '/api/async/video_google_omni';
const WUYIN_ASYNC_VIDEO_DEFAULT_MODEL = 'video_google_omni';
const LOCAL_PROXY_TASK_PREFIX = 'local_proxy:';
const { normalizeUserApiSecretForTransport } = require('./userApiSecret');

let wuyinEndpoints = {};
try {
  wuyinEndpoints = require('./wuyinEndpoints.json');
} catch (e) {
  // 忽略，回退到硬编码
}
const WUYIN_ASYNC_VIDEO_ROUTE_ALIASES = [
  { endpointPath: WUYIN_ASYNC_VIDEO_DEFAULT_ENDPOINT_PATH, aliases: ['video_google_omni', 'google_omni', 'google omni', 'omni google'] },
  { endpointPath: '/api/async/video_vidu', aliases: ['video_vidu', 'vidu'] },
  { endpointPath: '/api/async/video_omni', aliases: ['video_omni', 'kling omni', 'video omni'] },
  { endpointPath: '/api/async/video_digital_humans', aliases: ['video_digital_humans', 'digital_humans', 'digital humans'] },
  { endpointPath: '/api/async/video_package', aliases: ['video_package', 'package_1.0', 'package 1.0'] },
  { endpointPath: '/api/async/video_veo3.1_fast', aliases: ['video_veo3.1_fast', 'veo3.1_fast', 'veo 3.1 fast'] },
  { endpointPath: '/api/async/video_grok_imagine', aliases: ['video_grok_imagine', 'grok_imagine', 'grok imagine video'] },
  { endpointPath: '/api/async/video_wan2.6', aliases: ['video_wan2.6', 'wan2.6', 'wan26', 'wan video'] },
];

function normalizeWuyinVideoBaseUrl(baseUrl) {
  const raw = String(baseUrl || '').trim();
  if (!raw) return WUYIN_ASYNC_VIDEO_DEFAULT_BASE_URL;

  const withProtocol = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
  try {
    const parsed = new URL(withProtocol);
    if (/^api\.wuyinkeji\.com$/i.test(parsed.hostname)) {
      return `${parsed.protocol}//${parsed.host}`;
    }

    const sanitizedPath = parsed.pathname
      .replace(/\/+(doc\/\d+)?$/i, '')
      .replace(/\/+(api\/async(\/[a-z0-9_.-]+)?)?$/i, '')
      .replace(/\/+$/, '');
    return `${parsed.protocol}//${parsed.host}${sanitizedPath}`;
  } catch {
    return WUYIN_ASYNC_VIDEO_DEFAULT_BASE_URL;
  }
}

function extractWuyinVideoEndpointPath(baseUrl) {
  const raw = String(baseUrl || '').trim();
  if (!raw) return null;

  const candidates = /^https?:\/\//i.test(raw) ? [raw] : [`https://${raw}`];
  for (const candidate of candidates) {
    try {
      const parsed = new URL(candidate);
      const pathname = parsed.pathname.replace(/\/+$/, '');
      if (/^\/api\/async\/video[a-z0-9_.-]*$/i.test(pathname)) {
        return pathname;
      }
    } catch {
      continue;
    }
  }

  return null;
}

function normalizeWuyinVideoModelAlias(value) {
  return String(value || '')
    .trim()
    .split('@')[0]
    .split('|')[0]
    .replace(/^models\//i, '')
    .replace(/^\/+/, '')
    .replace(/^api\/async\//i, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '');
}

function resolveWuyinVideoRequestRoute(baseUrl, modelId) {
  // 简体中文注释：检查 baseUrl 是否为五音科技的通用异步端点前缀（即去掉末尾斜杠后为 /api/async）。
  const cleanBaseUrl = normalizeWuyinVideoBaseUrl(baseUrl);
  try {
    const parsedBase = new URL(cleanBaseUrl);
    const baseRoutePath = parsedBase.pathname.replace(/\/+$/, '');
    if (baseRoutePath === '/api/async') {
      const rawModelId = String(modelId || WUYIN_ASYNC_VIDEO_DEFAULT_MODEL)
        .trim()
        .split('@')[0]
        .split('|')[0]
        .replace(/^models\//i, '')
        .replace(/^\/+/, '')
        .replace(/^api\/async\//i, '');
      return {
        endpointPath: `/api/async/${rawModelId}`,
        endpointModelId: rawModelId,
      };
    }
  } catch (e) {
    // 忽略错误并回退
  }

  const directEndpointPath = extractWuyinVideoEndpointPath(baseUrl);
  if (directEndpointPath) {
    // 简体中文注释：即便后端的 baseUrl 带有特定模型后缀，也应当能够根据选中的视频 modelId 动态拼装出实际请求路径
    const rawModelId = String(modelId || WUYIN_ASYNC_VIDEO_DEFAULT_MODEL)
      .trim()
      .split('@')[0]
      .split('|')[0]
      .replace(/^models\//i, '')
      .replace(/^\/+/, '')
      .replace(/^api\/async\//i, '');
    return {
      endpointPath: `/api/async/${rawModelId}`,
      endpointModelId: rawModelId,
    };
  }

  const rawModelId = String(modelId || WUYIN_ASYNC_VIDEO_DEFAULT_MODEL)
    .trim()
    .split('@')[0]
    .split('|')[0]
    .replace(/^models\//i, '')
    .replace(/^\/+/, '')
    .replace(/^api\/async\//i, '');
  const normalized = normalizeWuyinVideoModelAlias(rawModelId);

  if (/^video[a-z0-9]+$/i.test(normalized) && !normalized.startsWith('videos')) {
    return {
      endpointPath: `/api/async/${rawModelId}`,
      endpointModelId: rawModelId,
    };
  }

  const matchedRoute = WUYIN_ASYNC_VIDEO_ROUTE_ALIASES.find((route) =>
    route.aliases.some((alias) => normalizeWuyinVideoModelAlias(alias) === normalized)
  );
  if (matchedRoute) {
    return {
      endpointPath: matchedRoute.endpointPath,
      endpointModelId: matchedRoute.endpointPath.split('/').pop() || WUYIN_ASYNC_VIDEO_DEFAULT_MODEL,
    };
  }

  if (normalized.includes('google') && normalized.includes('omni')) {
    return {
      endpointPath: WUYIN_ASYNC_VIDEO_DEFAULT_ENDPOINT_PATH,
      endpointModelId: WUYIN_ASYNC_VIDEO_DEFAULT_MODEL,
    };
  }

  return {
    endpointPath: `/api/async/${rawModelId}`,
    endpointModelId: rawModelId,
  };
}

function isWuyinBaseUrl(baseUrl) {
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

function isWuyinAsyncVideoRoute(route, modelId) {
  const routeName = String(route && route.name || '').trim();
  return isWuyinBaseUrl(route && route.baseUrl)
    || Boolean(extractWuyinVideoEndpointPath(route && route.baseUrl))
    || (route && route.provider === 'Wuyin')
    || /wuyin/i.test(routeName);
}

function buildWuyinVideoSubmitUrl(baseUrl, route) {
  return `${normalizeWuyinVideoBaseUrl(baseUrl)}${route.endpointPath}`;
}

function buildWuyinVideoDetailUrl(baseUrl, taskId) {
  return `${normalizeWuyinVideoBaseUrl(baseUrl)}${WUYIN_ASYNC_VIDEO_DETAIL_PATH}?id=${encodeURIComponent(String(taskId || '').trim())}`;
}

function isWuyinDetailQueryUrl(url) {
  try {
    const parsed = new URL(String(url || ''));
    const pathname = parsed.pathname.replace(/\/+$/, '');
    return (
      pathname === '/api/async/detail'
      || pathname === '/api/sora2/detail'
      || pathname === '/api/img/drawDetail'
    );
  } catch {
    return false;
  }
}

function resolveWuyinVideoSize(input) {
  const explicitSize = String(input && input.size || '').trim();
  if (/^\d+x\d+$/i.test(explicitSize)) return explicitSize.toLowerCase();

  const rawAspectRatio = String(input && input.aspectRatio || '').trim();
  const aspectRatio = rawAspectRatio === '9:16' || rawAspectRatio === '1:1' ? rawAspectRatio : '16:9';
  const normalizedResolution = String(input && input.resolution || '').trim().toLowerCase();
  const resolution = normalizedResolution.includes('1080') ? '1080p' : '720p';
  const sizeMap = {
    '720p': {
      '16:9': '1280x720',
      '9:16': '720x1280',
      '1:1': '720x720',
    },
    '1080p': {
      '16:9': '1920x1080',
      '9:16': '1080x1920',
      '1:1': '1080x1080',
    },
  };
  return sizeMap[resolution][aspectRatio];
}

function resolveWuyinVideoDuration(duration, videoDuration) {
  if (typeof duration === 'number' && Number.isFinite(duration) && duration > 0) {
    return String(Math.round(duration));
  }

  const parsed = Number.parseFloat(String(videoDuration || '').trim());
  if (Number.isFinite(parsed) && parsed > 0) {
    return String(Math.round(parsed));
  }

  return '10';
}

function normalizeWuyinVideoImages(imageUrl, imageTailUrl) {
  const rawItems = [imageUrl, imageTailUrl]
    .flatMap((value) => String(value || '').split(','))
    .map((value) => value.trim())
    .filter(Boolean);

  if (rawItems.length === 0) {
    return '';
  }

  return rawItems.slice(0, 7).map((item, index) => {
    if (/^blob:/i.test(item)) {
      throw new Error(`Wuyin video reference image ${index + 1} is a local blob URL. Please use a public HTTPS image URL.`);
    }
    if (/^data:/i.test(item) || (/^[a-z0-9+/=\s]+$/i.test(item) && item.length > 80)) {
      throw new Error(`Wuyin video reference image ${index + 1} must be a public HTTPS image URL; base64 upload is not supported yet.`);
    }
    if (!/^https?:\/\//i.test(item)) {
      throw new Error(`Wuyin video reference image ${index + 1} must be a public HTTP(S) image URL.`);
    }
    return item;
  }).join(',');
}

function buildWuyinVideoRequestBody(input) {
  const body = {
    prompt: String(input && input.prompt || ''),
    size: resolveWuyinVideoSize(input),
    duration: resolveWuyinVideoDuration(input && input.duration, input && input.videoDuration),
  };
  const images = normalizeWuyinVideoImages(input && input.imageUrl, input && input.imageTailUrl);
  if (images) {
    body.images = images;
  }
  return body;
}

function readWuyinString(value, keys) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return '';

  for (const key of keys) {
    const item = value[key];

    if (typeof item === 'string' && item.trim()) {
      return item.trim();
    }

    if (typeof item === 'number' && Number.isFinite(item)) {
      return String(item);
    }
  }

  return '';
}

function extractWuyinProviderTaskId(payload) {
  const data = payload && typeof payload === 'object' ? payload.data : null;

  return String(
    readWuyinString(data, ['id', 'task_id', 'taskId', 'taskID'])
    || readWuyinString(payload, ['id', 'task_id', 'taskId', 'taskID'])
    || ''
  ).trim();
}

function extractWuyinTaskId(payload) {
  return extractWuyinProviderTaskId(payload);
}

function extractWuyinVideoTaskId(payload) {
  return extractWuyinProviderTaskId(payload);
}

function inferWuyinEndpointTypeFromProviderTaskId(providerTaskId, fallback = 'wuyin-async') {
  const raw = String(providerTaskId || '').toLowerCase();

  if (raw.startsWith('image_')) return 'wuyin-async-image';
  if (raw.startsWith('video_')) return 'wuyin-async-video';
  if (raw.startsWith('audio_')) return 'wuyin-async-audio';

  return fallback;
}

function extractWuyinVideoStatusCode(payload) {
  const data = payload && typeof payload === 'object' ? payload.data : null;
  const value = data && typeof data === 'object' ? data.status : payload && typeof payload === 'object' ? payload.status : undefined;
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return undefined;
}

function mapWuyinStatus(statusCode) {
  if (statusCode === 2 || String(statusCode) === '2') return 'success';
  if (statusCode === 3 || String(statusCode) === '3') return 'failed';
  if (statusCode === 1 || String(statusCode) === '1') return 'processing';
  return 'pending';
}

function mapWuyinVideoStatus(statusCode) {
  const status = mapWuyinStatus(statusCode);
  return status === 'processing' ? 'pending' : status;
}

function extractFirstWuyinString(value) {
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) return '';
    if ((trimmed.startsWith('{') && trimmed.endsWith('}')) || (trimmed.startsWith('[') && trimmed.endsWith(']'))) {
      try {
        return extractFirstWuyinString(JSON.parse(trimmed));
      } catch {
        return trimmed;
      }
    }
    const urlMatch = trimmed.match(/https?:\/\/[^\s"'<>]+/i);
    return urlMatch && urlMatch[0] || trimmed;
  }

  if (Array.isArray(value)) {
    for (const item of value) {
      const extracted = extractFirstWuyinString(item);
      if (extracted) return extracted;
    }
    return '';
  }

  if (!value || typeof value !== 'object') return '';
  for (const key of ['url', 'video_url', 'videoUrl', 'output', 'result']) {
    const extracted = extractFirstWuyinString(value[key]);
    if (extracted) return extracted;
  }
  return '';
}

function extractWuyinVideoUrl(payload) {
  const record = payload && typeof payload === 'object' ? payload : {};
  const data = record.data && typeof record.data === 'object' ? record.data : {};
  const candidates = [
    data.url,
    data.video_url,
    data.videoUrl,
    data.output,
    data.result,
    data.outputs,
    record.url,
    record.video_url,
    record.videoUrl,
    record.output,
    record.result,
    record.outputs,
  ];

  for (const candidate of candidates) {
    const extracted = extractFirstWuyinString(candidate);
    if (extracted) return extracted;
  }

  return '';
}

function extractWuyinVideoMessage(payload) {
  const data = payload && typeof payload === 'object' ? payload.data : null;
  return readWuyinString(data, ['message', 'error', 'msg', 'error_msg', 'error_message', 'err_msg'])
    || readWuyinString(payload, ['message', 'error', 'msg', 'error_msg', 'error_message', 'err_msg'])
    || '';
}

function assertWuyinVideoSuccessEnvelope(payload) {
  const code = payload && typeof payload === 'object' ? payload.code : undefined;
  if (code === undefined || code === null || code === '') return;

  const normalizedCode = typeof code === 'number' ? code : Number(String(code).trim());
  if (normalizedCode === 200 || normalizedCode === 0) return;

  const message = extractWuyinVideoMessage(payload) || JSON.stringify(payload);
  throw new Error(`Wuyin video API error ${String(code)}: ${message}`);
}

async function fetchWuyinVideoJson(url, apiKey, method = 'GET', body) {
  apiKey = normalizeUserApiSecretForTransport(apiKey);
  if (!apiKey) {
    throw new Error('Wuyin API key is required.');
  }

  let targetUrl = url;
  if (isWuyinDetailQueryUrl(targetUrl)) {
    const parsed = new URL(targetUrl);
    parsed.searchParams.set('key', apiKey);
    targetUrl = parsed.toString();
  }

  const headers = {
    Authorization: apiKey,
    Accept: 'application/json',
  };

  const init = {
    method,
    headers,
  };
  if (body !== undefined) {
    headers['Content-Type'] = 'application/json';
    init.body = JSON.stringify(body);
  }

  const response = await fetch(targetUrl, init);
  const responseText = await response.text().catch(() => '');
  let payload = {};
  try {
    payload = responseText ? JSON.parse(responseText) : {};
  } catch {
    payload = {};
  }

  if (!response.ok) {
    throw new Error(responseText || `HTTP ${response.status}`);
  }

  assertWuyinVideoSuccessEnvelope(payload);
  return payload;
}

function encodeLocalProxyTaskId(routeId, providerTaskId, modelId = '') {
  const base = `${LOCAL_PROXY_TASK_PREFIX}${encodeURIComponent(String(routeId || '').trim())}:${encodeURIComponent(String(providerTaskId || '').trim())}`;
  const cleanModelId = String(modelId || '').trim();
  return cleanModelId ? `${base}:${encodeURIComponent(cleanModelId)}` : base;
}

function safeDecodeURIComponent(value) {
  try {
    return decodeURIComponent(String(value || ''));
  } catch {
    return String(value || '');
  }
}

function decodeLocalProxyTaskId(localTaskId) {
  const raw = String(localTaskId || '').trim();
  const withoutPrefix = raw.startsWith(LOCAL_PROXY_TASK_PREFIX)
    ? raw.slice(LOCAL_PROXY_TASK_PREFIX.length)
    : raw;
  const firstSeparatorIndex = withoutPrefix.indexOf(':');
  if (firstSeparatorIndex === -1) {
    return {
      routeId: '',
      providerTaskId: safeDecodeURIComponent(withoutPrefix),
      modelId: '',
    };
  }

  const routeId = safeDecodeURIComponent(withoutPrefix.slice(0, firstSeparatorIndex));
  const rest = withoutPrefix.slice(firstSeparatorIndex + 1);
  const secondSeparatorIndex = rest.indexOf(':');
  if (secondSeparatorIndex === -1) {
    return {
      routeId,
      providerTaskId: safeDecodeURIComponent(rest),
      modelId: '',
    };
  }

  return {
    routeId,
    providerTaskId: safeDecodeURIComponent(rest.slice(0, secondSeparatorIndex)),
    modelId: safeDecodeURIComponent(rest.slice(secondSeparatorIndex + 1)),
  };
}

function isAllowedWuyinTargetUrl(targetUrl) {
  const raw = String(targetUrl || '').trim();
  if (!raw) return false;

  try {
    const parsed = new URL(raw);
    if (!/^api\.wuyinkeji\.com$/i.test(parsed.hostname)) return false;

    const path = parsed.pathname.replace(/\/+$/, '');

    return (
      /^\/api\/async(?:$|\/[a-z0-9_.-]+)$/i.test(path)
      || path === '/api/async/detail'
      || path === '/api/chat/index'
      || path === '/api/voice/composite'
      || path === '/api/voice/clone'
      || path === '/api/sora2-new/submit'
      || path === '/api/sora2/detail'
      || path === '/api/img/split'

      // 旧版兼容，不作为主链路
      || path === '/api/img/nanoBanana'
      || path === '/api/img/drawDetail'
    );
  } catch {
    return false;
  }
}

// 简体中文注释：将速创图片模型 ID 映射到具体的 API 路径
function resolveWuyinImageEndpointPath(modelId) {
  const raw = String(modelId || '')
    .trim()
    .split('@')[0]
    .split('|')[0]
    .replace(/^models\//i, '')
    .replace(/^\/+/, '')
    .replace(/^api\/async\//i, '');

  // 1. 优先使用爬虫自动同步抓取的映射关系进行自适应匹配
  if (wuyinEndpoints[raw]) {
    return wuyinEndpoints[raw];
  }
  if (wuyinEndpoints[raw.toLowerCase()]) {
    return wuyinEndpoints[raw.toLowerCase()];
  }
  const cleanRaw = raw.replace(/^image_/, '');
  if (wuyinEndpoints[cleanRaw]) {
    return wuyinEndpoints[cleanRaw];
  }
  if (wuyinEndpoints[cleanRaw.toLowerCase()]) {
    return wuyinEndpoints[cleanRaw.toLowerCase()];
  }

  const normalized = raw.toLowerCase().replace(/[^a-z0-9]+/g, '');

  if (
    normalized === 'imagenanobanana2'
    || normalized === 'nanobanana2'
    || normalized === 'nanobanana2preview'
    || normalized === 'gemini31flashimagepreview'
    || normalized === 'gemini31flashimage'
  ) {
    return '/api/async/image_nanoBanana2';
  }

  if (
    normalized === 'imagenanobananapro'
    || normalized === 'nanobananapro'
    || normalized === 'gemini3proimagepreview'
  ) {
    return '/api/async/image_nanoBanana_pro';
  }

  if (
    normalized === 'imagenanobanana'
    || normalized === 'nanobanana'
    || normalized === 'gemini25flashimage'
  ) {
    return '/api/async/image_nanoBanana';
  }

  if (
    normalized === 'imagegpt'
    || normalized === 'gptimage2'
    || normalized === 'gptimage'
  ) {
    return '/api/async/image_gpt';
  }

  if (
    normalized === 'imagegrokimagine'
    || normalized === 'grokimagine'
  ) {
    return '/api/async/image_grok_imagine';
  }

  if (
    normalized === 'imagewan26'
    || normalized === 'wan26'
    || normalized === 'wan'
  ) {
    return '/api/async/image_wan2.6';
  }

  if (/^image[a-z0-9_.-]+$/i.test(raw)) {
    return `/api/async/${raw}`;
  }

  throw new Error(`Unknown Wuyin image model: ${modelId}`);
}

// 简体中文注释：规范化速创图片尺寸，默认返回 1K
function normalizeWuyinImageSize(raw) {
  const normalized = String(raw || '').trim().toUpperCase();

  if (normalized.includes('4K')) return '4K';
  if (normalized.includes('2K')) return '2K';

  return '1K';
}

// 简体中文注释：规范化速创图片比例，支持速创允许的值，否则默认返回 auto
function normalizeWuyinImageAspectRatio(raw) {
  const value = String(raw || '').trim();

  const allowed = new Set([
    'auto',
    '1:1',
    '16:9',
    '9:16',
    '4:3',
    '3:4',
    '3:2',
    '2:3',
    '5:4',
    '4:5',
    '21:9'
  ]);

  return allowed.has(value) ? value : 'auto';
}

// 简体中文注释：清洗规范化参考图 URL 或 Base64 数据，限制最多 7 个
function normalizeWuyinImageReferences(referenceImages) {
  if (!Array.isArray(referenceImages)) return [];

  return referenceImages
    .map((item) => {
      if (!item) return '';

      if (typeof item === 'string') {
        const raw = item.trim();

        if (/^https?:\/\//i.test(raw)) return raw;

        if (/^data:/i.test(raw)) {
          const index = raw.indexOf(',');
          return index >= 0 ? raw.slice(index + 1).replace(/\s+/g, '') : '';
        }

        return raw.replace(/\s+/g, '');
      }

      const url = String(item.url || '').trim();
      if (/^https?:\/\//i.test(url)) return url;

      const data = String(item.data || '').trim();
      if (!data) return '';

      if (/^data:/i.test(data)) {
        const index = data.indexOf(',');
        return index >= 0 ? data.slice(index + 1).replace(/\s+/g, '') : '';
      }

      return data.replace(/\s+/g, '');
    })
    .filter(Boolean)
    .slice(0, 7);
}

// 简体中文注释：构造速创图片的请求数据体
function buildWuyinImageRequestBody(input) {
  const size = normalizeWuyinImageSize(input.imageSize || input.size);
  const aspectRatio = normalizeWuyinImageAspectRatio(input.aspectRatio);

  const body = {
    prompt: String(input.prompt || ''),
    size,
    aspectRatio,
  };

  const urls = normalizeWuyinImageReferences(input.referenceImages || []);
  if (urls.length > 0) {
    body.urls = urls;
  }

  return body;
}

// 简体中文注释：递归深度寻找并提取速创 API 响应 payload 中所有的有效图片 URL 列表
function extractWuyinOutputUrls(payload) {
  const urls = [];
  const seen = new Set();

  const add = (value) => {
    if (typeof value !== 'string') return;

    const candidates = value.match(/https?:\/\/[^\s"'<>]+/g) || [];

    for (const url of candidates) {
      if (!seen.has(url)) {
        seen.add(url);
        urls.push(url);
      }
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
      for (const key in value) {
        if (Object.prototype.hasOwnProperty.call(value, key)) {
          visit(value[key]);
        }
      }
    }
  };

  visit(payload);
  return urls;
}

const isWuyinAsyncVideoTargetUrl = isAllowedWuyinTargetUrl;

module.exports = {
  WUYIN_ASYNC_VIDEO_DEFAULT_MODEL,
  WUYIN_ASYNC_VIDEO_DETAIL_PATH,
  buildWuyinVideoDetailUrl,
  buildWuyinVideoRequestBody,
  buildWuyinVideoSubmitUrl,
  buildWuyinImageRequestBody,
  decodeLocalProxyTaskId,
  encodeLocalProxyTaskId,
  extractWuyinOutputUrls,
  extractWuyinVideoMessage,
  extractWuyinVideoStatusCode,
  extractWuyinVideoTaskId,
  extractWuyinTaskId,
  extractWuyinProviderTaskId,
  extractWuyinVideoUrl,
  fetchWuyinVideoJson,
  isWuyinAsyncVideoRoute,
  isWuyinAsyncVideoTargetUrl,
  mapWuyinVideoStatus,
  mapWuyinStatus,
  normalizeWuyinVideoBaseUrl,
  resolveWuyinImageEndpointPath,
  resolveWuyinVideoRequestRoute,
  inferWuyinEndpointTypeFromProviderTaskId,
};
