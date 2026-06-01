const WUYIN_ASYNC_VIDEO_DEFAULT_BASE_URL = 'https://api.wuyinkeji.com';
const WUYIN_ASYNC_VIDEO_DETAIL_PATH = '/api/async/detail';
const WUYIN_ASYNC_VIDEO_DEFAULT_ENDPOINT_PATH = '/api/async/video_google_omni';
const WUYIN_ASYNC_VIDEO_DEFAULT_MODEL = 'video_google_omni';
const LOCAL_PROXY_TASK_PREFIX = 'local_proxy:';

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
      .replace(/\/+(api\/async\/video[a-z0-9_.-]*)$/i, '')
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
  const directEndpointPath = extractWuyinVideoEndpointPath(baseUrl);
  if (directEndpointPath) {
    return {
      endpointPath: directEndpointPath,
      endpointModelId: directEndpointPath.split('/').filter(Boolean).pop() || WUYIN_ASYNC_VIDEO_DEFAULT_MODEL,
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

  if (normalized.includes('google') && normalized.includes('omni')) {
    return {
      endpointPath: WUYIN_ASYNC_VIDEO_DEFAULT_ENDPOINT_PATH,
      endpointModelId: WUYIN_ASYNC_VIDEO_DEFAULT_MODEL,
    };
  }

  throw new Error(`Wuyin provider does not know how to route video model "${modelId || ''}". Please use video_google_omni.`);
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
    || /wuyin/i.test(routeName);
}

function buildWuyinVideoSubmitUrl(baseUrl, route) {
  return `${normalizeWuyinVideoBaseUrl(baseUrl)}${route.endpointPath}`;
}

function buildWuyinVideoDetailUrl(baseUrl, taskId) {
  return `${normalizeWuyinVideoBaseUrl(baseUrl)}${WUYIN_ASYNC_VIDEO_DETAIL_PATH}?id=${encodeURIComponent(String(taskId || '').trim())}`;
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
    if (typeof item === 'string' && item.trim()) return item.trim();
    if (typeof item === 'number' && Number.isFinite(item)) return String(item);
  }
  return '';
}

function extractWuyinVideoTaskId(payload) {
  const data = payload && typeof payload === 'object' ? payload.data : null;
  return String(
    readWuyinString(data, ['id', 'task_id', 'taskId']) ||
    readWuyinString(payload, ['id', 'task_id', 'taskId'])
  ).trim();
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

function mapWuyinVideoStatus(statusCode) {
  if (statusCode === 2) return 'success';
  if (statusCode === 3) return 'failed';
  return 'pending';
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
  return readWuyinString(data, ['message', 'error', 'msg'])
    || readWuyinString(payload, ['message', 'error', 'msg'])
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

  const response = await fetch(url, init);
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

function encodeLocalProxyTaskId(routeId, providerTaskId) {
  return `${LOCAL_PROXY_TASK_PREFIX}${encodeURIComponent(String(routeId || '').trim())}:${encodeURIComponent(String(providerTaskId || '').trim())}`;
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
  const separatorIndex = withoutPrefix.indexOf(':');
  if (separatorIndex === -1) {
    return {
      routeId: '',
      providerTaskId: safeDecodeURIComponent(withoutPrefix),
    };
  }

  return {
    routeId: safeDecodeURIComponent(withoutPrefix.slice(0, separatorIndex)),
    providerTaskId: safeDecodeURIComponent(withoutPrefix.slice(separatorIndex + 1)),
  };
}

function isWuyinAsyncVideoTargetUrl(targetUrl) {
  const raw = String(targetUrl || '').trim();
  if (!raw) return false;
  try {
    const parsed = new URL(raw);
    return /^api\.wuyinkeji\.com$/i.test(parsed.hostname)
      && (/^\/api\/async\/video[a-z0-9_.-]*$/i.test(parsed.pathname.replace(/\/+$/, '')) || parsed.pathname.replace(/\/+$/, '') === WUYIN_ASYNC_VIDEO_DETAIL_PATH);
  } catch {
    return false;
  }
}

module.exports = {
  WUYIN_ASYNC_VIDEO_DEFAULT_MODEL,
  WUYIN_ASYNC_VIDEO_DETAIL_PATH,
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
};
