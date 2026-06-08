/**
 * @file suchuangProvider.js
 * @description Wuyin/速创 API Provider。严格按 Wuyin 官方文档调用：
 * - 图像/视频异步任务：POST /api/async/<model>，Content-Type: application/json
 * - 鉴权：Authorization header，同时按文档在 query 里传 key
 * - 查询结果：GET /api/async/detail?id=...，状态 0/1/2/3
 * - 模型 endpoint 和参数约束来自 server/lib/dispatcher/wuyinProducts.js
 */

const { buildGatewayUrl, getGatewayBaseUrl } = require('../utils/apiGatewayConfig');
const {
  WUYIN_ASYNC_DETAIL_ENDPOINT,
  getWuyinProduct,
} = require('../lib/dispatcher/wuyinProducts');

function getApiKey() {
  const apiKey = String(process.env.SUCHUANG_API_KEY || '').trim();
  if (!apiKey) {
    throw new Error('SUCHUANG_API_KEY 未配置，请在设置中心配置 Wuyin/速创 API Key');
  }
  return apiKey;
}

function authHeaders(apiKey = getApiKey()) {
  return { Authorization: apiKey };
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

function buildWuyinUrl(absoluteEndpoint, apiKey, extraQuery = {}) {
  const configuredBase = String(getGatewayBaseUrl('suchuang') || '').trim().replace(/\/+$/, '');
  const endpoint = String(absoluteEndpoint || '').trim();
  let url = endpoint;

  if (configuredBase) {
    try {
      const path = new URL(endpoint).pathname;
      url = `${configuredBase}${path}`;
    } catch {
      url = buildGatewayUrl('suchuang', '', endpoint);
    }
  }

  return appendQuery(url, { key: apiKey, ...extraQuery });
}

function isSuccessCode(code) {
  return code === undefined || code === null || ['0', '200'].includes(String(code));
}

function assertSuchuangCode(data, action = 'Wuyin API 请求') {
  if (!isSuccessCode(data?.code)) {
    throw new Error(`${action}失败: ${data?.msg || data?.message || `code ${data?.code}`}`);
  }
}

function getTextFromChatResponse(data) {
  const payload = data?.data || data;
  if (typeof payload === 'string') return payload;
  const choice = Array.isArray(payload?.choices) ? payload.choices[0] : undefined;
  return choice?.message?.content
    || choice?.delta?.content
    || choice?.text
    || payload?.content
    || payload?.text
    || '';
}

const SUCCESS_STATUSES = new Set(['2', 'success', 'succeeded', 'completed', 'complete', 'done']);
const FAILED_STATUSES = new Set(['3', 'failed', 'fail', 'error', 'cancelled', 'canceled']);

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
      const keys = [
        'result', 'results', 'url', 'urls', 'remote_url',
        'image_url', 'video_url', 'audio_url', 'output', 'outputs', 'data',
        'imageUrl', 'videoUrl', 'audioUrl', 'resultUrl', 'download_url', 'file_url'
      ];
      keys.forEach(key => visit(obj[key]));
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

function getPublicUrl(urlOrRef) {
  if (!urlOrRef) return '';
  let rawUrl = '';
  if (typeof urlOrRef === 'string') {
    rawUrl = urlOrRef.trim();
  } else if (urlOrRef.networkUrl) {
    return urlOrRef.networkUrl;
  } else if (urlOrRef.url) {
    rawUrl = urlOrRef.url.trim();
  } else if (urlOrRef.data) {
    rawUrl = urlOrRef.data.trim();
  }

  if (/^https?:\/\//i.test(rawUrl)) {
    try {
      const parsed = new URL(rawUrl);
      const host = parsed.hostname.toLowerCase();
      const isLocal = host === 'localhost' || host === '127.0.0.1' || host === '0.0.0.0' || host === '::1';
      if (!isLocal) {
        return rawUrl;
      }
    } catch {
      // ignore
    }
  }

  const hasR2 = !!process.env.R2_PUBLIC_BASE_URL;
  const hasTOS = !!process.env.JIMENG_ACCESS_KEY && !!process.env.TOS_BUCKET;

  if (hasR2) {
    const r2Base = process.env.R2_PUBLIC_BASE_URL.replace(/\/+$/, '');
    const filename = `upload-${Date.now()}-${Math.random().toString(36).substring(2, 8)}.png`;
    return `${r2Base}/${filename}`;
  } else if (hasTOS) {
    const tosEndpoint = (process.env.TOS_ENDPOINT || 'https://tos-s3.example.com').replace(/\/+$/, '');
    const bucket = process.env.TOS_BUCKET;
    const filename = `upload-${Date.now()}-${Math.random().toString(36).substring(2, 8)}.png`;
    return `${tosEndpoint}/${bucket}/${filename}`;
  }

  throw new Error('Wuyin API 文档要求参考图片必须是公网 URL，请先上传到公网存储或配置 R2/TOS。');
}

function normalizeEnumValue(value, allowed, fallback) {
  const normalized = String(value || '').trim();
  return allowed.includes(normalized) ? normalized : fallback;
}

function normalizeImageSize(size) {
  return normalizeEnumValue(String(size || '').toUpperCase(), ['1K', '2K', '4K'], '1K');
}

function normalizeAspectRatio(value, product) {
  const field = product?.requestFields?.aspectRatio || product?.requestFields?.size;
  const allowed = Array.isArray(field?.enum) ? field.enum : [];
  const fallback = field?.default || 'auto';
  return allowed.length > 0 ? normalizeEnumValue(value || fallback, allowed, fallback) : String(value || fallback);
}

function inferSize(resolution = '', aspectRatio = '') {
  const baseByResolution = {
    '480P': 854,
    '720P': 1280,
    '1080P': 1920
  };
  const base = baseByResolution[String(resolution || '').toUpperCase()] || 1280;
  const ratio = String(aspectRatio || '16:9').toLowerCase() === 'auto' ? '16:9' : String(aspectRatio || '16:9');
  const [rawW, rawH] = ratio.split(':').map(Number);
  if (!rawW || !rawH) return `${base}x${base}`;
  if (rawW >= rawH) return `${base}x${Math.round(base * rawH / rawW)}`;
  return `${Math.round(base * rawW / rawH)}x${base}`;
}

async function _submitJson(endpointUrl, body, apiKey) {
  const targetUrl = buildWuyinUrl(endpointUrl, apiKey);
  const response = await fetch(targetUrl, {
    method: 'POST',
    headers: {
      ...authHeaders(apiKey),
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    },
    body: JSON.stringify(body)
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => 'Unknown error');
    throw new Error(`Wuyin API 请求失败 (${response.status}): ${errorText}`);
  }

  const data = await response.json();
  assertSuchuangCode(data, 'Wuyin 任务提交');
  return data;
}

async function _pollAsyncDetail(taskId, mediaType, apiKey, modelId) {
  const detailUrl = buildWuyinUrl(WUYIN_ASYNC_DETAIL_ENDPOINT, apiKey, { id: taskId });

  const response = await fetch(detailUrl, {
    method: 'GET',
    headers: {
      ...authHeaders(apiKey),
      'Accept': 'application/json',
      'Content-Type': 'application/json'
    }
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => 'Unknown error');
    throw new Error(`Wuyin API 状态查询失败 (${response.status}): ${errorText}`);
  }

  const data = await response.json();
  assertSuchuangCode(data, 'Wuyin 任务状态查询');

  const payload = data.data || data;
  const statusVal = String(payload.status !== undefined ? payload.status : data.status || '').toLowerCase();
  let mappedStatus = 'processing';

  if (statusVal === '2' || SUCCESS_STATUSES.has(statusVal)) mappedStatus = 'success';
  else if (statusVal === '3' || FAILED_STATUSES.has(statusVal)) mappedStatus = 'failed';
  else if (statusVal === '0' || statusVal === '1') mappedStatus = 'processing';

  const urls = mappedStatus === 'success' ? extractWuyinOutputUrls(data) : [];
  const message = mappedStatus === 'failed' ? (payload.message || payload.msg || data.msg || 'Wuyin task failed') : undefined;

  return {
    status: mappedStatus,
    urls,
    message,
    raw: data,
  };
}

async function _submitAndPoll({ product, body, mediaType, apiKey, modelId }) {
  const submitData = await _submitJson(product.endpoint, body, apiKey);
  const payload = submitData.data || submitData;
  const directUrls = extractWuyinOutputUrls(submitData);
  if (directUrls.length > 0) {
    return {
      status: 'success',
      urls: directUrls,
      raw: submitData
    };
  }

  const taskId = String(payload.id || payload.task_id || payload.taskId || submitData.id || submitData.task_id || '').trim();
  if (!taskId) {
    throw new Error('Wuyin API 提交成功但未返回文档要求的任务 ID。');
  }

  const maxPolls = mediaType === 'video' ? 180 : 90;
  const delayMs = 5000;

  for (let i = 0; i < maxPolls; i++) {
    await new Promise(resolve => setTimeout(resolve, delayMs));
    const result = await _pollAsyncDetail(taskId, mediaType, apiKey, modelId);

    if (result.status === 'success') {
      return {
        status: 'success',
        urls: result.urls,
        raw: result.raw
      };
    }
    if (result.status === 'failed') {
      throw new Error(result.message || 'Wuyin 异步生成任务失败');
    }
  }

  throw new Error(`Wuyin 异步生成超时 (${mediaType} 超时限制)`);
}

async function generateText(args) {
  const apiKey = getApiKey();
  const targetUrl = buildGatewayUrl('suchuang', 'chat', '/api/chat/index');

  const prompt = args.prompt || '';
  const modelId = args.modelId || args.model || '';
  const imageUrl = args.referenceImageBase64 ? getPublicUrl(args.referenceImageBase64) : '';
  const stream = args.stream || false;

  const formBody = new URLSearchParams();
  formBody.set('content', prompt);
  formBody.set('model', modelId);
  formBody.set('stream', stream ? 'true' : 'false');
  if (imageUrl) {
    formBody.set('image_url', imageUrl);
  }

  const response = await fetch(targetUrl, {
    method: 'POST',
    headers: {
      ...authHeaders(apiKey),
      'Content-Type': 'application/x-www-form-urlencoded;charset=utf-8',
      'Accept': 'application/json'
    },
    body: formBody.toString()
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => 'Unknown error');
    throw new Error(`Wuyin ChatAPI 请求失败 (${response.status}): ${errorText}`);
  }

  const data = await response.json();
  assertSuchuangCode(data, 'Wuyin ChatAPI');

  const text = getTextFromChatResponse(data);
  return {
    success: true,
    text,
    raw: data
  };
}

async function generateImage(args) {
  const apiKey = getApiKey();
  const modelId = String(args.modelId || args.model || 'image_nanoBanana2');
  const product = getWuyinProduct(modelId);
  if (!product || product.category !== 'image') {
    throw new Error(`Wuyin 图片模型未配置或文档未核对: ${modelId}`);
  }

  const prompt = args.prompt || '';
  if (!prompt) {
    throw new Error('Wuyin 图片生成文档要求 prompt 为必填。');
  }

  const rawRefs = args.referenceImages || args.urls || [];
  const publicUrls = Array.isArray(rawRefs) ? rawRefs.map(getPublicUrl).filter(Boolean) : [];
  const body = {
    prompt,
  };

  if (modelId === 'image_gpt') {
    body.size = normalizeAspectRatio(args.aspectRatio || args.size || 'auto', product);
  } else {
    body.size = normalizeImageSize(args.size || args.imageSize || product.requestFields.size.default || '1K');
    body.aspectRatio = normalizeAspectRatio(args.aspectRatio || product.requestFields.aspectRatio.default || 'auto', product);
  }

  if (publicUrls.length > 0) {
    body.urls = publicUrls;
  }

  const generateCount = Math.max(1, Math.min(4, Number(args.generateCount || 1)));
  const results = [];

  for (let i = 0; i < generateCount; i++) {
    const res = await _submitAndPoll({
      product,
      body,
      mediaType: 'image',
      apiKey,
      modelId,
    });
    results.push(res);
  }

  const allUrls = results.flatMap(r => r.urls);
  return {
    success: true,
    image: allUrls[0],
    urls: allUrls,
    raw: results[0]?.raw,
    wuyinProduct: product.id,
    wuyinDocUrl: product.docUrl,
  };
}

async function generateVideo(args) {
  const apiKey = getApiKey();
  const modelId = String(args.modelId || args.model || 'video_google_omni');
  const product = getWuyinProduct(modelId);
  if (!product || product.category !== 'video') {
    throw new Error(`Wuyin 视频模型未配置或文档未核对: ${modelId}`);
  }

  const prompt = args.prompt || '';
  if (!prompt) {
    throw new Error('Wuyin 视频生成文档要求 prompt 为必填。');
  }

  const resolution = args.resolution || args.size || '720p';
  const aspectRatio = args.aspectRatio || '16:9';
  const duration = Number(args.duration || args.videoDuration || product.requestFields.duration.default || 10);
  const rawRefs = args.referenceImages || args.urls || [];
  const publicUrls = Array.isArray(rawRefs) ? rawRefs.map(getPublicUrl).filter(Boolean) : [];
  const maxImages = 7;

  const body = {
    prompt,
    size: args.size && /^\d+x\d+$/i.test(String(args.size)) ? args.size : inferSize(resolution, aspectRatio),
    duration,
  };

  if (publicUrls.length > 0) {
    body.images = publicUrls.slice(0, maxImages).join(',');
  }

  const result = await _submitAndPoll({
    product,
    body,
    mediaType: 'video',
    apiKey,
    modelId,
  });

  return {
    success: true,
    video: result.urls[0],
    urls: result.urls,
    raw: result.raw,
    wuyinProduct: product.id,
    wuyinDocUrl: product.docUrl,
  };
}

async function generateAudio() {
  throw new Error('当前 Wuyin 音频模型尚未提供已核对文档定义，AI Router 已阻止猜测式音频请求。');
}

const SuchuangProvider = {
  generateText,
  generateImage,
  generateVideo,
  generateAudio,
  _submitJson,
  _submitAndPoll,
  _pollAsyncDetail
};

module.exports = {
  SuchuangProvider
};
