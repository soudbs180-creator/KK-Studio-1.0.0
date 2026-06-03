/**
 * @file wuyinModelExecutor.js
 * @description 速创 API 通用模型执行器。负责请求参数组装、调用提交接口、判定异步状态、解析最终返回的资源 URL。
 */

const LOCAL_PROXY_TASK_PREFIX = 'local_proxy:';

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
function encodeLocalProxyTaskId(routeId, providerTaskId) {
  return `${LOCAL_PROXY_TASK_PREFIX}${encodeURIComponent(String(routeId || '').trim())}:${encodeURIComponent(String(providerTaskId || '').trim())}`;
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

/**
 * 根据模型 kind 拼装请求体参数
 */
function buildSubmitRequestBody(catalogItem, input) {
  if (catalogItem.kind === 'image') {
    const size = input.imageSize || input.size || '1K';
    const aspectRatio = input.aspectRatio || 'auto';
    const body = {
      prompt: String(input.prompt || ''),
      size,
      aspectRatio,
    };
    
    // 清洗参考图
    const rawRefs = input.referenceImages || input.urls || [];
    const urls = normalizeImageReferences(rawRefs);
    if (urls.length > 0) {
      body.urls = urls;
    }
    return body;
  }

  if (catalogItem.kind === 'video') {
    const body = {
      prompt: String(input.prompt || ''),
      size: input.size || '1280x720',
      duration: String(input.duration || '10'),
      aspectRatio: input.aspectRatio || '16:9',
    };
    
    const images = normalizeVideoImages(input.imageUrl, input.imageTailUrl);
    if (images) {
      body.images = images;
    }
    return body;
  }

  if (catalogItem.kind === 'audio') {
    return {
      prompt: String(input.prompt || ''),
      text: String(input.prompt || ''),
      voice_id: String(input.voiceId || input.voice_id || ''),
      speed: Number(input.speed || 1.0),
      duration: input.audioDuration || input.duration,
      lyrics: input.audioLyrics || input.lyrics,
      style: input.audioStyle || input.style,
      title: input.audioTitle || input.title,
    };
  }

  // 默认直接透传所有输入
  return input;
}

/**
 * 序列化请求 Body
 */
function serializeBody(body, contentType) {
  if (contentType === 'application/x-www-form-urlencoded') {
    return new URLSearchParams(body).toString();
  }
  return JSON.stringify(body);
}

/**
 * 提交 API 模型任务
 */
async function submitWuyinTask({ catalogItem, apiKey, input }) {
  let targetUrl = catalogItem.endpointUrl;
  
  // 在 URL 上面拼接 key 用于上游代理鉴权
  if (apiKey) {
    const parsed = new URL(targetUrl);
    parsed.searchParams.set('key', apiKey);
    targetUrl = parsed.toString();
  }

  const headers = {
    Authorization: apiKey,
    Accept: 'application/json',
    'Content-Type': catalogItem.contentType || 'application/json',
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
async function checkWuyinTaskStatus({ catalogItem, apiKey, providerTaskId, submitExecTime }) {
  const detailPath = catalogItem.detailPath || '/api/async/detail';
  let detailUrl = `https://api.wuyinkeji.com${detailPath}`;

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
  extractWuyinOutputUrls,
  encodeLocalProxyTaskId,
  decodeLocalProxyTaskId,
};
