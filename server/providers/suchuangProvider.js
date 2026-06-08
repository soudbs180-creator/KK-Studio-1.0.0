/**
 * @file suchuangProvider.js
 * @description 独立的速创 API Provider。支持文本 (Form-urlencoded)、生图、生视频、音频等原生协议。
 * 密钥只在 Authorization 请求头传输，不进行 URL query 拼接。
 */

const { buildGatewayUrl, getGatewayBaseUrl } = require('../utils/apiGatewayConfig');

function getApiKey() {
  const apiKey = String(process.env.SUCHUANG_API_KEY || '').trim();
  if (!apiKey) {
    throw new Error('SUCHUANG_API_KEY 未配置，请在设置中心配置速创 API Key');
  }
  return apiKey;
}

function authHeaders(apiKey = getApiKey()) {
  return { Authorization: apiKey };
}

function isSuccessCode(code) {
  return code === undefined || code === null || ['0', '200'].includes(String(code));
}

function assertSuchuangCode(data, action = '速创 API 请求') {
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

const RUNNING_STATUSES = new Set(['0', '1', 'init', 'initializing', 'running', 'processing', 'pending']);
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
      // 忽略
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

  throw new Error('速创 API 需要公网可访问的素材 URL，请先配置 TOS 或带 R2_PUBLIC_BASE_URL 的 Cloudflare R2。');
}

function normalizeImageSize(size) {
  const s = String(size || '').toUpperCase().trim();
  if (['1K', '2K', '4K'].includes(s)) return s;
  return '1K';
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

async function _submitJson(endpointPath, body, apiKey, nodeId, projectId, modelId, useProxy) {
  const targetUrl = buildGatewayUrl('suchuang', '', endpointPath);
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
    throw new Error(`速创 API 请求失败 (${response.status}): ${errorText}`);
  }

  const data = await response.json();
  assertSuchuangCode(data, '速创任务提交');
  return data;
}

async function _pollAsyncDetail(taskId, mediaType, apiKey, modelId, useProxy) {
  const baseUrl = getGatewayBaseUrl('suchuang');
  const detailUrl = `${baseUrl.replace(/\/+$/, '')}/api/async/detail?key=${encodeURIComponent(apiKey)}&id=${encodeURIComponent(taskId)}`;
  
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
    throw new Error(`速创 API 状态查询失败 (${response.status}): ${errorText}`);
  }

  const data = await response.json();
  assertSuchuangCode(data, '速创任务状态查询');

  const payload = data.data || data;
  const statusVal = String(payload.status !== undefined ? payload.status : data.status || '').toLowerCase();
  
  let mappedStatus = 'processing';
  
  // Sora2: 1 = success, 2 = failed, 0 or 3 = processing
  if (String(modelId).toLowerCase() === 'sora2-new' || String(modelId).toLowerCase() === 'sora2') {
    if (statusVal === '1') mappedStatus = 'success';
    else if (statusVal === '2') mappedStatus = 'failed';
  } else {
    // wuyin-async: 2 = success, 3 = failed, 0 or 1 = processing
    if (statusVal === '2' || SUCCESS_STATUSES.has(statusVal)) mappedStatus = 'success';
    else if (statusVal === '3' || FAILED_STATUSES.has(statusVal)) mappedStatus = 'failed';
  }

  const urls = mappedStatus === 'success' ? extractWuyinOutputUrls(data) : [];
  if (mappedStatus === 'success' && urls.length === 0) {
    mappedStatus = 'processing'; // 降级判定，等有了 URL 再判定成功
  }

  const message = mappedStatus === 'failed' ? (payload.message || payload.msg || data.msg || 'Wuyin task failed') : undefined;

  return {
    status: mappedStatus,
    urls,
    message
  };
}

async function _submitAndPoll({ endpointPath, body, mediaType, apiKey, nodeId, projectId, modelId, useProxy }) {
  const submitData = await _submitJson(endpointPath, body, apiKey, nodeId, projectId, modelId, useProxy);
  const payload = submitData.data || submitData;
  
  // 3. 如果提交响应已直接返回媒体 URL，直接使用。
  const directUrls = extractWuyinOutputUrls(submitData);
  if (directUrls.length > 0) {
    return {
      status: 'success',
      urls: directUrls,
      raw: submitData
    };
  }

  // 4. 否则提取任务 ID 并进行轮询
  const taskId = String(payload.id || payload.task_id || payload.taskId || submitData.id || submitData.task_id || '').trim();
  if (!taskId) {
    throw new Error('速创 API 提交成功但未返回有效的任务 ID (data.id)');
  }

  const maxPolls = mediaType === 'video' ? 180 : 90;
  const delayMs = 5000;

  for (let i = 0; i < maxPolls; i++) {
    await new Promise(resolve => setTimeout(resolve, delayMs));
    const result = await _pollAsyncDetail(taskId, mediaType, apiKey, modelId, useProxy);
    
    if (result.status === 'success') {
      return {
        status: 'success',
        urls: result.urls,
        raw: submitData
      };
    }
    if (result.status === 'failed') {
      throw new Error(result.message || '速创异步生成任务失败');
    }
  }

  throw new Error(`速创异步生成超时 (${mediaType} 超时限制)`);
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
    throw new Error(`速创 ChatAPI 请求失败 (${response.status}): ${errorText}`);
  }

  const data = await response.json();
  assertSuchuangCode(data, '速创 ChatAPI');
  
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
  const endpointPath = args.endpointPath || `/api/async/${modelId}`;

  const prompt = args.prompt || '';
  const size = args.size || args.imageSize || '1K';
  const aspectRatio = args.aspectRatio || '1:1';
  
  const rawRefs = args.referenceImages || args.urls || [];
  const publicUrls = Array.isArray(rawRefs) ? rawRefs.map(getPublicUrl).filter(Boolean) : [];

  const normalizedEndpoint = String(endpointPath).toLowerCase();
  const ratio = !aspectRatio || String(aspectRatio).toLowerCase() === 'auto' ? '1:1' : String(aspectRatio);

  const body = normalizedEndpoint.includes('/api/async/image_gpt')
    ? { prompt, size: ratio }
    : { prompt, size: normalizeImageSize(size), aspectRatio: ratio };

  if (publicUrls.length > 0) {
    body.urls = publicUrls;
  }

  // generateCount 用循环提交实现，限制在 1 到 4
  const generateCount = Math.max(1, Math.min(4, Number(args.generateCount || 1)));
  const results = [];

  for (let i = 0; i < generateCount; i++) {
    const res = await _submitAndPoll({
      endpointPath,
      body,
      mediaType: 'image',
      apiKey,
      nodeId: args.nodeId,
      projectId: args.projectId,
      modelId,
      useProxy: args.useProxy
    });
    results.push(res);
  }

  const allUrls = results.flatMap(r => r.urls);
  return {
    success: true,
    image: allUrls[0],
    urls: allUrls,
    raw: results[0]?.raw
  };
}

async function generateVideo(args) {
  const apiKey = getApiKey();
  const modelId = String(args.modelId || args.model || 'video_google_omni');
  const endpointPath = args.endpointPath || `/api/async/${modelId}`;

  const prompt = args.prompt || '';
  const resolution = args.resolution || args.size || '720p';
  const aspectRatio = args.aspectRatio || '16:9';
  const duration = Number(args.duration || args.videoDuration || 10);
  
  const rawRefs = args.referenceImages || args.urls || [];
  const publicUrls = Array.isArray(rawRefs) ? rawRefs.map(getPublicUrl).filter(Boolean) : [];

  const maxImages = modelId === 'video_google_omni' || modelId === 'video_vidu' || modelId === 'video_omni' ? 7 : 1;

  const size = inferSize(resolution, aspectRatio);
  const body = {
    prompt,
    size,
    duration,
  };

  if (publicUrls.length > 0) {
    body.images = publicUrls.slice(0, maxImages).join(',');
  }

  const result = await _submitAndPoll({
    endpointPath,
    body,
    mediaType: 'video',
    apiKey,
    nodeId: args.nodeId,
    projectId: args.projectId,
    modelId,
    useProxy: args.useProxy
  });

  return {
    success: true,
    video: result.urls[0],
    urls: result.urls,
    raw: result.raw
  };
}

async function generateAudio(args) {
  const apiKey = getApiKey();
  const modelId = String(args.modelId || args.model || 'audio_tts');
  const endpointPath = args.endpointPath || `/api/async/${modelId}`;

  const text = args.prompt || args.text || '';
  const voice = args.voice || args.voiceId || 'zh_female_qingxin';
  const advancedParams = args.advancedParams || {};

  const body = {
    text,
    voice_id: voice || advancedParams.voice_id || advancedParams.voice || 'zh_female_qingxin',
    speed: Number(advancedParams.speed || 1),
    vol: Number(advancedParams.vol || 1),
    language_boost: advancedParams.language_boost || 'auto'
  };

  const isSync = endpointPath.includes('/api/voice/composite') || endpointPath.includes('/api/voice/clone');

  if (isSync) {
    const result = await _submitJson(endpointPath, body, apiKey, args.nodeId, args.projectId, modelId, args.useProxy);
    const urls = extractWuyinOutputUrls(result);
    return {
      success: true,
      audio: urls[0],
      urls,
      raw: result
    };
  } else {
    const result = await _submitAndPoll({
      endpointPath,
      body,
      mediaType: 'audio',
      apiKey,
      nodeId: args.nodeId,
      projectId: args.projectId,
      modelId,
      useProxy: args.useProxy
    });
    return {
      success: true,
      audio: result.urls[0],
      urls: result.urls,
      raw: result.raw
    };
  }
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
