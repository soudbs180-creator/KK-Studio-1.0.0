/**
 * @file wuyinModelExecutor.js
 * @description 速创 API 通用模型执行器。负责请求参数组装、调用提交接口、判定异步状态、解析最终返回的资源 URL。
 */

const LOCAL_PROXY_TASK_PREFIX = 'local_proxy:';
const { normalizeUserApiSecretForTransport } = require('./userApiSecret');

/**
 * 递归深度寻找并提取 API 响应中所有的有效 HTTP(S) 资源 URL
 */
function extractWuyinOutputUrls(payload) {
  const urls = [];
  const seen = new Set();

  const add = (value) => {
    if (typeof value !== 'string') return;
    const matches = value.match(/https?:\/\/[^\s"'<>]+/g) || [];
    for (const url of matches) {
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
      const obj = value;
      // 优先扫描常见结果字段
      const keys = [
        'result', 'results', 'url', 'urls', 'remote_url',
        'image_url', 'video_url', 'audio_url', 'output', 'outputs', 'data'
      ];
      keys.forEach(key => visit(obj[key]));
      
      // 为防止嵌套在其它非常规属性中，遍历一遍对象的所有键
      for (const k in obj) {
        if (Object.prototype.hasOwnProperty.call(obj, k) && !keys.includes(k)) {
          visit(obj[k]);
        }
      }
    }
  };

  visit(payload);
  return urls;
}

/**
 * 提取 API 返回的任务 ID
 */
function readWuyinString(value, keys) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return '';
  for (const key of keys) {
    const item = value[key];
    if (typeof item === 'string' && item.trim()) return item.trim();
    if (typeof item === 'number' && Number.isFinite(item)) return String(item);
  }
  return '';
}

function extractProviderTaskId(payload) {
  const data = payload && typeof payload === 'object' ? payload.data : null;
  return String(
    readWuyinString(data, ['id', 'task_id', 'taskId', 'taskID']) ||
    readWuyinString(payload, ['id', 'task_id', 'taskId', 'taskID']) ||
    ''
  ).trim();
}

/**
 * 提取 API 的失败错误信息
 */
function extractWuyinMessage(payload) {
  if (!payload || typeof payload !== 'object') return '';
  const candidates = ['message', 'error', 'msg', 'fail_reason', 'error_msg', 'error_message', 'err_msg'];
  
  // 优先扫描里层 data
  if (payload.data && typeof payload.data === 'object') {
    for (const key of candidates) {
      if (payload.data[key] !== undefined && payload.data[key] !== null) {
        const val = String(payload.data[key]).trim();
        if (val) return val;
      }
    }
  }
  
  // 其次扫描外层
  for (const key of candidates) {
    if (payload[key] !== undefined && payload[key] !== null) {
      const val = String(payload[key]).trim();
      if (val) return val;
    }
  }
  return '';
}

/**
 * 校验 API 响应的外层 Code 状态
 */
function assertWuyinSuccess(payload) {
  if (!payload || typeof payload !== 'object') {
    throw new Error('速创 API 上游响应体为空或不是有效的 JSON 格式');
  }

  const code = payload.code;
  if (code === undefined || code === null || code === '') return;

  const normalizedCode = typeof code === 'number' ? code : Number(String(code).trim());
  if (normalizedCode === 200 || normalizedCode === 0) return;

  const message = extractWuyinMessage(payload) || JSON.stringify(payload);
  throw new Error(`速创 API 错误 (Code ${code}): ${message}`);
}

/**
 * 编码本地代理任务 ID，以便前端与对应的 API 渠道和配置做绑定
 */
function encodeLocalProxyTaskId(routeId, providerTaskId, modelId = '') {
  const base = `${LOCAL_PROXY_TASK_PREFIX}${encodeURIComponent(String(routeId || '').trim())}:${encodeURIComponent(String(providerTaskId || '').trim())}`;
  const cleanModelId = String(modelId || '').trim();
  return cleanModelId ? `${base}:${encodeURIComponent(cleanModelId)}` : base;
}

/**
 * 安全的 URI 解码
 */
function safeDecodeURIComponent(value) {
  try {
    return decodeURIComponent(String(value || ''));
  } catch {
    return String(value || '');
  }
}

/**
 * 解码本地代理任务 ID
 */
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

/**
 * 清洗图片参考图，剥离 base64 的 data: 前缀，限定最大数量 7
 */
function normalizeImageReferences(references) {
  if (!Array.isArray(references)) return [];
  return references
    .map(item => {
      if (!item) return '';
      if (typeof item === 'string') {
        const raw = item.trim();
        if (/^https?:\/\//i.test(raw)) return raw;
        if (/^data:image\/\w+;base64,/i.test(raw)) {
          return raw.replace(/^data:image\/\w+;base64,/i, '').replace(/\s+/g, '');
        }
        return raw.replace(/\s+/g, '');
      }
      
      const url = String(item.url || '').trim();
      if (/^https?:\/\//i.test(url)) return url;
      
      const data = String(item.data || '').trim();
      if (/^data:image\/\w+;base64,/i.test(data)) {
        return data.replace(/^data:image\/\w+;base64,/i, '').replace(/\s+/g, '');
      }
      return data.replace(/\s+/g, '');
    })
    .filter(Boolean)
    .slice(0, 7);
}

/**
 * 清洗视频参考图链接，以逗号分隔，限定最大数量 7
 */
function normalizeVideoImages(imageUrl, imageTailUrl) {
  const rawItems = [imageUrl, imageTailUrl]
    .flatMap((value) => String(value || '').split(','))
    .map((value) => value.trim())
    .filter(Boolean);

  if (rawItems.length === 0) {
    return '';
  }

  return rawItems.slice(0, 7).map((item, index) => {
    if (/^blob:/i.test(item)) {
      throw new Error(`参考图 ${index + 1} 仍是本地预览地址 (blob)，请等待图片上传完成后再试。`);
    }
    if (/^data:/i.test(item) || (/^[a-z0-9+/=\s]+$/i.test(item) && item.length > 80)) {
      throw new Error(`视频模型参考图 ${index + 1} 不支持 base64，必须是公开的 HTTP(S) 图片链接。`);
    }
    if (!/^https?:\/\//i.test(item)) {
      throw new Error(`参考图 ${index + 1} 格式不正确，必须以 http:// 或 https:// 开头。`);
    }
    return item;
  }).join(',');
}

function normalizeModelId(value) {
  return String(value || '')
    .trim()
    .split('@')[0]
    .split('|')[0]
    .replace(/^models\//i, '')
    .replace(/^\/+/, '')
    .replace(/^api\/async\//i, '')
    .toLowerCase()
    .replace(/[^a-z0-9_.-]+/g, '');
}

function getCatalogModelId(catalogItem) {
  const explicit = catalogItem && (catalogItem.id || catalogItem.modelId);
  if (explicit) return normalizeModelId(explicit);
  const endpointPath = String(catalogItem && catalogItem.endpointPath || '').trim();
  return normalizeModelId(endpointPath.split('/').pop() || '');
}

function normalizeAspectRatio(raw, fallback = 'auto', allowed = ['auto', '1:1', '16:9', '9:16', '4:3', '3:4', '3:2', '2:3', '5:4', '4:5', '21:9']) {
  const value = String(raw || '').trim() || fallback;
  if (value === 'auto' && allowed.includes('auto')) return value;
  return allowed.includes(value) ? value : fallback;
}

function normalizeGptImageRatio(raw) {
  return normalizeAspectRatio(raw, 'auto', ['auto', '1:1', '3:2', '2:3', '16:9', '9:16', '4:3', '3:4', '21:9', '9:21', '1:3', '3:1', '2:1', '1:2']);
}

function normalizeGrokAspectRatio(raw) {
  return normalizeAspectRatio(raw === 'auto' ? '' : raw, '2:3', ['2:3', '3:2', '1:1', '16:9', '9:16']);
}

function normalizeVideoAspectRatio(raw) {
  return normalizeAspectRatio(raw, '16:9', ['16:9', '9:16', '1:1', '4:3', '3:4']);
}

function normalizeWanPixelSize(input, fallback) {
  const explicit = String(input && (input.size || input.imageSize || input.resolution) || '').trim();
  if (/^\d{3,4}[*x]\d{3,4}$/i.test(explicit)) {
    return explicit.replace(/x/i, '*');
  }

  const byRatio = {
    '1:1': fallback === '1280*720' ? '960*960' : '1280*1280',
    '3:4': fallback === '1280*720' ? '832*1088' : '1104*1472',
    '4:3': fallback === '1280*720' ? '1088*832' : '1472*1104',
    '9:16': fallback === '1280*720' ? '720*1280' : '960*1696',
    '16:9': fallback === '1280*720' ? '1280*720' : '1696*960',
  };
  return byRatio[String(input && input.aspectRatio || '').trim()] || fallback;
}

function normalizeVideoResolution(raw) {
  const value = String(raw || '').trim().toLowerCase();
  if (value.includes('4k')) return '4k';
  if (value.includes('1080')) return '1080p';
  if (value.includes('540')) return '540p';
  if (value.includes('std')) return 'std';
  if (value.includes('pro')) return 'pro';
  return '720p';
}

function normalizeDurationValue(primary, secondary, fallback = '10') {
  const parsed = Number.parseFloat(String(primary ?? secondary ?? '').trim());
  if (Number.isFinite(parsed) && parsed > 0) {
    return String(Math.round(parsed));
  }
  return fallback;
}

function joinReferenceUrls(...values) {
  return values
    .flatMap(value => String(value || '').split(','))
    .map(value => value.trim())
    .filter(Boolean)
    .join(',');
}

function addBodyValue(body, key, value) {
  if (value === undefined || value === null) return;
  if (typeof value === 'string' && value.trim() === '') return;
  if (Array.isArray(value) && value.length === 0) return;
  body[key] = value;
}

function buildImageRequestBody(catalogItem, input) {
  const rawRefs = input.referenceImages || input.urls || input.image_urls || [];
  const urls = normalizeImageReferences(rawRefs);
  const body = {
    prompt: String(input.prompt || ''),
    size: input.imageSize || input.size || '1K',
    aspectRatio: normalizeAspectRatio(input.aspectRatio),
  };
  if (urls.length > 0) {
    body.urls = urls;
  }
  return body;
}

function buildVideoRequestBody(catalogItem, input) {
  const modelId = getCatalogModelId(catalogItem);
  const body = {};
  const duration = normalizeDurationValue(input.duration, input.videoDuration, modelId === 'sora2-new' || modelId === 'submit' ? '8' : '10');
  const imageUrls = joinReferenceUrls(input.imageUrl, input.image_url);
  const firstFrameUrl = String(input.firstFrameUrl || input.first_frame_url || imageUrls.split(',')[0] || '').trim();
  const lastFrameUrl = String(input.lastFrameUrl || input.last_frame_url || input.imageTailUrl || '').trim();
  const videoUrl = String(input.videoUrl || input.video_url || '').trim();

  if (modelId === 'video_package') {
    const sourceVideo = videoUrl || String(input.video || input.imageUrl || '').trim();
    if (!sourceVideo) {
      throw new Error('Package_1.0 需要 video 参数，请提供公网可访问的视频 URL。');
    }
    body.video = sourceVideo;
    addBodyValue(body, 'template_id', input.templateId || input.template_id || '1');
    return body;
  }

  if (modelId === 'video_digital_humans') {
    body.videoName = input.videoName || input.prompt || 'digital-human-video';
    addBodyValue(body, 'audioUrl', input.audioUrl || input.audio_url);
    addBodyValue(body, 'videoUrl', input.videoUrl || input.video_url);
    return body;
  }

  if (modelId === 'sora2-new' || modelId === 'submit') {
    body.prompt = String(input.prompt || '');
    addBodyValue(body, 'url', input.url || input.imageUrl || firstFrameUrl);
    body.aspectRatio = input.aspectRatio === '16:9' ? '16:9' : '9:16';
    body.duration = duration;
    body.size = String(input.size || '').toLowerCase() === 'large' ? 'large' : 'small';
    addBodyValue(body, 'remixTargetId', input.remixTargetId || input.remix_target_id);
    return body;
  }

  if (modelId === 'video_grok_imagine') {
    body.prompt = String(input.prompt || '');
    body.duration = duration;
    body.aspect_ratio = normalizeGrokAspectRatio(input.aspectRatio || input.aspect_ratio);
    const refs = imageUrls ? imageUrls.split(',') : [];
    addBodyValue(body, 'image_urls', refs);
    return body;
  }

  if (modelId === 'video_wan2.6' || modelId === 'video_wan26') {
    body.prompt = String(input.prompt || '');
    addBodyValue(body, 'negative_prompt', input.negativePrompt || input.negative_prompt);
    addBodyValue(body, 'audio_url', input.audioUrl || input.audio_url);
    addBodyValue(body, 'firstFrameUrl', firstFrameUrl);
    body.size = normalizeWanPixelSize(input, '1280*720');
    body.duration = ['5', '10', '15'].includes(duration) ? duration : '5';
    addBodyValue(body, 'prompt_extend', input.promptExtend ?? input.prompt_extend);
    addBodyValue(body, 'shot_type', input.shotType || input.shot_type);
    addBodyValue(body, 'watermark', input.watermark);
    addBodyValue(body, 'seed', input.seed);
    addBodyValue(body, 'urls', joinReferenceUrls(input.urls, input.imageUrl, input.imageTailUrl, videoUrl));
    return body;
  }

  body.prompt = String(input.prompt || '');

  if (modelId === 'video_vidu') {
    body.aspectRatio = normalizeVideoAspectRatio(input.aspectRatio);
    body.resolution = normalizeVideoResolution(input.resolution);
    addBodyValue(body, 'subjects', input.subjects);
    addBodyValue(body, 'image_url', imageUrls);
    addBodyValue(body, 'video_url', videoUrl);
    addBodyValue(body, 'bgm', input.bgm);
    body.duration = duration;
    return body;
  }

  if (modelId === 'video_omni') {
    body.aspectRatio = normalizeVideoAspectRatio(input.aspectRatio);
    body.resolution = String(input.resolution || '').trim() || 'pro';
    body.sound = input.sound || 'on';
    addBodyValue(body, 'image_url', imageUrls);
    addBodyValue(body, 'firstFrameUrl', firstFrameUrl);
    addBodyValue(body, 'lastFrameUrl', lastFrameUrl);
    addBodyValue(body, 'video_url', videoUrl);
    body.duration = duration;
    return body;
  }

  if (modelId === 'video_veo3.1_fast') {
    addBodyValue(body, 'firstFrameUrl', firstFrameUrl);
    addBodyValue(body, 'lastFrameUrl', lastFrameUrl);
    const refs = joinReferenceUrls(input.urls, input.imageUrl, input.imageTailUrl);
    addBodyValue(body, 'urls', refs ? refs.split(',').slice(0, 3) : []);
    body.aspectRatio = input.aspectRatio === '9:16' ? '9:16' : '16:9';
    body.size = normalizeVideoResolution(input.size || input.resolution) === '1080p' ? '1080p' : '720p';
    return body;
  }

  const size = input.size || resolveWuyinVideoSize(input);
  if (size) body.size = size;
  if (duration) body.duration = duration;

  const images = normalizeVideoImages(input.imageUrl, input.imageTailUrl);
  if (images) body.images = images;
  return body;
}

function buildAudioRequestBody(catalogItem, input) {
  const modelId = getCatalogModelId(catalogItem);
  if (modelId === 'voice_clone' || modelId === 'clone') {
    const audioUrl = String(input.audioUrl || input.audio_url || '').trim();
    if (!audioUrl) {
      throw new Error('语音克隆需要 audio_url 参数，请提供公网可访问的音频 URL。');
    }
    return {
      audio_url: audioUrl,
      text: String(input.prompt || input.text || ''),
      name: input.name || input.audioTitle || input.title,
    };
  }

  const body = {
    text: String(input.prompt || input.text || ''),
    voice_id: String(input.voiceId || input.voice_id || 'male-qn-qingse'),
    speed: input.speed !== undefined && input.speed !== null ? input.speed : 1,
  };
  addBodyValue(body, 'vol', input.volume || input.vol);
  addBodyValue(body, 'language_boost', input.languageBoost || input.language_boost || 'auto');
  addBodyValue(body, 'duration', input.audioDuration || input.duration);
  addBodyValue(body, 'lyrics', input.audioLyrics || input.lyrics);
  addBodyValue(body, 'style', input.audioStyle || input.style);
  addBodyValue(body, 'title', input.audioTitle || input.title);
  return body;
}

function readLastUserMessage(messages) {
  if (!Array.isArray(messages)) return '';
  for (let i = messages.length - 1; i >= 0; i -= 1) {
    const item = messages[i];
    if (item && item.role === 'user') {
      return String(item.content || '').trim();
    }
  }
  return '';
}

/**
 * 根据模型 kind 拼装请求体参数
 */
function buildSubmitRequestBody(catalogItem, input) {
  input = input || {};
  if (catalogItem.kind === 'image') {
    return buildImageRequestBody(catalogItem, input);
  }

  if (catalogItem.kind === 'video') {
    return buildVideoRequestBody(catalogItem, input);
  }

  if (catalogItem.kind === 'audio') {
    return buildAudioRequestBody(catalogItem, input);
  }

  if (catalogItem.kind === 'chat') {
    return {
      content: String(input.content || input.prompt || readLastUserMessage(input.messages) || ''),
      model: input.modelId || input.model || 'gemini-3-pro',
      stream: input.stream ? 'true' : 'false',
    };
  }

  if (catalogItem.kind === 'utility' && getCatalogModelId(catalogItem) === 'split') {
    return {
      video_url: input.video_url || input.videoUrl || input.imageUrl || input.prompt || '',
      key_words: input.key_words || input.keyWords || '',
    };
  }

  // 默认直接透传所有输入
  return input;
}

/**
 * 序列化请求 Body
 */
function serializeBody(body, contentType) {
  if (/application\/x-www-form-urlencoded/i.test(String(contentType || ''))) {
    const params = new URLSearchParams();
    Object.entries(body || {}).forEach(([key, value]) => {
      if (value === undefined || value === null) return;
      if (Array.isArray(value)) {
        if (value.length > 0) params.set(key, value.join(','));
        return;
      }
      if (typeof value === 'object') {
        params.set(key, JSON.stringify(value));
        return;
      }
      params.set(key, String(value));
    });
    return params.toString();
  }
  return JSON.stringify(body);
}

/**
 * 提交 API 模型任务
 */
async function submitWuyinTask({ catalogItem, apiKey, input, baseUrl }) {
  apiKey = normalizeUserApiSecretForTransport(apiKey);
  if (!apiKey) {
    throw new Error('Wuyin API key is required.');
  }

  let targetUrl = catalogItem.endpointUrl || `https://api.wuyinkeji.com${catalogItem.endpointPath || ''}`;
  
  if (baseUrl) {
    try {
      const parsedBase = new URL(baseUrl);
      const parsedTarget = new URL(targetUrl);
      parsedTarget.protocol = parsedBase.protocol;
      parsedTarget.host = parsedBase.host;
      targetUrl = parsedTarget.toString();
    } catch (e) {
      // ignore
    }
  }
  
  const contentType = catalogItem.contentType || catalogItem.submitContentType || 'application/json';
  const headers = {
    Authorization: apiKey,
    Accept: 'application/json',
    'Content-Type': contentType,
  };

  const bodyObj = buildSubmitRequestBody(catalogItem, input);

  const init = {
    method: catalogItem.method || 'POST',
    headers,
  };

  if (init.method !== 'GET' && init.method !== 'HEAD') {
    init.body = serializeBody(bodyObj, headers['Content-Type']);
  }

  const response = await fetch(targetUrl, init);
  const responseText = await response.text().catch(() => '');
  let payload = {};
  try {
    payload = responseText ? JSON.parse(responseText) : {};
  } catch {
    throw new Error(`上游响应不是有效的 JSON 格式: ${responseText.slice(0, 300)}`);
  }

  if (!response.ok) {
    throw new Error(responseText || `HTTP 错误 ${response.status}`);
  }

  assertWuyinSuccess(payload);

  // 异步状态判定
  if (catalogItem.executionMode === 'async-detail' || catalogItem.executionMode === 'sora2-special') {
    const providerTaskId = extractProviderTaskId(payload);
    if (!providerTaskId) {
      let errMsg = extractWuyinMessage(payload);
      const isSuccessMsg = errMsg && (
        errMsg.includes('操作成功') ||
        errMsg.toLowerCase().includes('success') ||
        errMsg.toLowerCase().includes('ok')
      );
      if (!errMsg || isSuccessMsg) {
        errMsg = '速创 API 提交响应未返回有效的任务 ID (data.id)';
      }
      throw new Error(`提交接口失败: ${errMsg}`);
    }
    return {
      status: 'pending',
      providerTaskId,
      taskId: encodeLocalProxyTaskId(catalogItem.id, providerTaskId),
      submitExecTime: Number(payload.exec_time || 0),
      urls: [],
      raw: payload,
    };
  }

  // 同步状态判定
  const urls = extractWuyinOutputUrls(payload);
  return {
    status: 'success',
    providerTaskId: '',
    taskId: '',
    submitExecTime: Number(payload.exec_time || 0),
    urls,
    raw: payload,
  };
}

/**
 * 查询异步模型任务状态
 */
async function checkWuyinTaskStatus({ catalogItem, apiKey, providerTaskId, submitExecTime, baseUrl }) {
  apiKey = normalizeUserApiSecretForTransport(apiKey);
  if (!apiKey) {
    throw new Error('Wuyin API key is required.');
  }

  const detailPath = catalogItem.detailPath || '/api/async/detail';
  let detailUrl = `https://api.wuyinkeji.com${detailPath}`;

  if (baseUrl) {
    try {
      const parsedBase = new URL(baseUrl);
      detailUrl = `${parsedBase.protocol}//${parsedBase.host}${detailPath}`;
    } catch (e) {
      // ignore
    }
  }

  const parsed = new URL(detailUrl);
  parsed.searchParams.set('id', providerTaskId);
  if (apiKey) {
    parsed.searchParams.set('key', apiKey);
  }
  detailUrl = parsed.toString();

  const response = await fetch(detailUrl, {
    method: 'GET',
    headers: {
      Authorization: apiKey,
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
  });

  const responseText = await response.text().catch(() => '');
  let payload = {};
  try {
    payload = responseText ? JSON.parse(responseText) : {};
  } catch {
    throw new Error(`上游状态详情响应不是有效的 JSON 格式: ${responseText.slice(0, 300)}`);
  }

  if (!response.ok) {
    throw new Error(responseText || `HTTP 错误 ${response.status}`);
  }

  assertWuyinSuccess(payload);

  const detailExecTime = Number(payload.exec_time || 0);
  const rawStatus = payload.data && payload.data.status !== undefined ? payload.data.status : payload.status;
  
  let status = 'processing';
  const detailStatusMode = catalogItem.detailStatusMode || 'wuyin-async';

  if (detailStatusMode === 'sora2') {
    // Sora2: 1 = success, 2 = failed, 0 or 3 = processing
    const n = Number(rawStatus);
    if (n === 1) status = 'success';
    else if (n === 2) status = 'failed';
    else status = 'processing';
  } else {
    // wuyin-async: 2 = success, 3 = failed, 0 or 1 = processing
    const n = Number(rawStatus);
    if (n === 2) status = 'success';
    else if (n === 3) status = 'failed';
    else status = 'processing';
  }

  let urls = [];
  if (status === 'success') {
    urls = extractWuyinOutputUrls(payload);
    // 即使状态判定为 success，但未提取到 URL 时，应当降级判定为 processing/pending，防止前端报错
    if (urls.length === 0) {
      status = 'processing';
    }
  }

  const message = status === 'failed' ? (extractWuyinMessage(payload) || 'Wuyin task failed.') : undefined;

  return {
    status,
    providerTaskId,
    urls,
    submitExecTime: Number(submitExecTime || 0),
    detailExecTime,
    totalExecTime: Number(submitExecTime || 0) + detailExecTime,
    message,
    raw: payload,
  };
}

module.exports = {
  submitWuyinTask,
  checkWuyinTaskStatus,
  buildWuyinSubmitRequestBody: buildSubmitRequestBody,
  serializeWuyinRequestBody: serializeBody,
  extractWuyinOutputUrls,
  encodeLocalProxyTaskId,
  decodeLocalProxyTaskId,
};
