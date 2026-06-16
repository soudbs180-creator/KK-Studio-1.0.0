/**
 * @file pricing-proxy.js
 * @module api
 * @description Vercel serverless proxy for the public Wuyin model and pricing catalog.
 * @author KK-Studio Team
 * @version 1.5.7
 */

const WUYIN_PRICE_CATALOG_URL = 'https://api.wuyinkeji.com/themes/DigitalBlue/api?action=api_list';
const FALLBACK_CATALOG = [
  ['video_google_omni', 'google_omni', '/api/async/video_google_omni', 0.1, 'second'],
  ['video_vidu', 'video_vidu', '/api/async/video_vidu', 1, 'second'],
  ['video_omni', 'video_omni', '/api/async/video_omni', 1, 'second'],
  ['video_digital_humans', 'Digital_Humans', '/api/async/video_digital_humans', 0.02, 'second'],
  ['video_veo3.1_fast', 'veo3.1_fast', '/api/async/video_veo3.1_fast', 0.05, 'second'],
  ['video_grok_imagine', 'grok_imagine', '/api/async/video_grok_imagine', 0.05, 'second'],
  ['video_wan2.6', 'Wan2.6', '/api/async/video_wan2.6', 0.8, 'second'],
  ['image_gpt', 'GPT-Image-2', '/api/async/image_gpt', 0.1, 'image'],
  ['image_nanoBanana2', 'NanoBanana2', '/api/async/image_nanoBanana2', 0.1, 'image'],
  ['image_grok_imagine', 'grok_imagine', '/api/async/image_grok_imagine', 0.1, 'image'],
  ['image_nanoBanana_pro', 'NanoBanana_pro', '/api/async/image_nanoBanana_pro', 0.3, 'image'],
  ['image_nanoBanana', 'NanoBanana', '/api/async/image_nanoBanana', 0.1, 'image'],
  ['image_wan2.6', 'Wan2.6', '/api/async/image_wan2.6', 0.2, 'image'],
  ['audio_tts', 'text_to_speech', '/api/async/audio_tts', 0.0006, 'character'],
];

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

function getFallbackCatalogItems() {
  return FALLBACK_CATALOG.map(([modelId, modelName, endpointPath, inputPrice, unit], index) => ({
    id: String(index + 1),
    name: modelName,
    url: `https://api.wuyinkeji.com${endpointPath}`,
    method: endpointPath.includes('/detail') ? 'GET' : 'POST',
    price: `${inputPrice}${unit}`,
    balance_sum: inputPrice,
    pay_unit: unit,
    api_type: '',
    the: modelName,
    modelId,
  }));
}

async function readJsonBody(req) {
  if (req.body && typeof req.body === 'object') return req.body;
  if (typeof req.body === 'string' && req.body.trim()) {
    return JSON.parse(req.body);
  }
  return {};
}

async function fetchWuyinCatalogPayload() {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10000);
  try {
    const response = await fetch(WUYIN_PRICE_CATALOG_URL, {
      method: 'GET',
      headers: {
        Accept: 'application/json',
        'User-Agent': 'KK-Studio/1.0',
      },
      signal: controller.signal,
    });
    if (!response.ok) {
      throw new Error(`Wuyin catalog returned HTTP ${response.status}`);
    }
    return await response.json();
  } finally {
    clearTimeout(timeout);
  }
}

function sendJson(res, status, payload) {
  res.status(status);
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.json(payload);
}

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return;
  }
  if (req.method !== 'POST') {
    sendJson(res, 405, { error: 'Method not allowed', data: [], group_ratio: {} });
    return;
  }

  const body = await readJsonBody(req).catch(() => ({}));
  if (!isWuyinPricingProxyRequest(body.baseUrl, body.provider)) {
    sendJson(res, 400, {
      error: 'Pricing proxy currently supports the Wuyin catalog endpoint only.',
      data: [],
      group_ratio: {},
    });
    return;
  }

  try {
    const payload = await fetchWuyinCatalogPayload();
    const data = payload && payload.data && Array.isArray(payload.data.api_list)
      ? payload.data.api_list
      : [];
    const apiTypeData = payload && payload.data && Array.isArray(payload.data.api_type_data)
      ? payload.data.api_type_data
      : [];
    sendJson(res, 200, {
      success: true,
      source: 'wuyinkeji',
      endpointUrl: WUYIN_PRICE_CATALOG_URL,
      data,
      api_type_data: apiTypeData,
      group_ratio: {},
    });
  } catch (error) {
    sendJson(res, 200, {
      success: true,
      source: 'wuyinkeji',
      endpointUrl: WUYIN_PRICE_CATALOG_URL,
      data: getFallbackCatalogItems(),
      api_type_data: [],
      group_ratio: {},
      fallback: true,
      message: error instanceof Error ? error.message : String(error || 'Wuyin catalog fetch failed.'),
    });
  }
}
