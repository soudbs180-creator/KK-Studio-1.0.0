/**
 * @file apiGatewayConfig.js
 * @description 统一 API 网关配置。支持根据 ACTIVE_API_PROVIDER 分流到 suchuang/yunwu/comfly，并处理 baseUrl 和端点映射。
 */

const SUCHUANG_DEFAULT_BASE_URL = 'https://api.wuyinkeji.com';

function getActiveGatewayProvider() {
  const activeProvider = String(process.env.ACTIVE_API_PROVIDER || '').trim().toLowerCase();
  return ['yunwu', 'comfly', 'suchuang'].includes(activeProvider) ? activeProvider : '';
}

function normalizeGatewayBaseUrl(provider, url, fallback) {
  const raw = String(url || '').trim();
  if (!raw) return fallback;
  try {
    const parsed = new URL(raw);
    return parsed.origin;
  } catch {
    return fallback;
  }
}

function getGatewayBaseUrl(provider) {
  if (provider === 'suchuang') {
    return normalizeGatewayBaseUrl('suchuang', process.env.SUCHUANG_BASE_URL, SUCHUANG_DEFAULT_BASE_URL);
  }
  if (provider === 'yunwu') {
    return process.env.YUNWU_BASE_URL || 'https://yunwu.ai/v1';
  }
  if (provider === 'comfly') {
    return process.env.COMFLY_BASE_URL || 'https://ai.comfly.org';
  }
  return '';
}

function getSuchuangEndpointPathFromFallback(fallbackUrl = '') {
  const rawUrl = String(fallbackUrl || '').trim();
  if (!rawUrl) return '';

  try {
    const parsed = new URL(rawUrl, 'https://api.wuyinkeji.com');
    return parsed.pathname.startsWith('/api/') ? parsed.pathname : '';
  } catch {
    const match = rawUrl.match(/\/api\/[A-Za-z0-9_./-]+/);
    return match ? match[0] : '';
  }
}

function getGatewayEndpointPath(provider, mode = '') {
  const normalizedMode = String(mode || '').toLowerCase();

  if (provider === 'suchuang') {
    if (normalizedMode === 'text-to-speech') return '/api/async/audio_tts';
    if (normalizedMode.includes('music') || normalizedMode.includes('audio')) return '/api/async/audio_tts';
    if (normalizedMode.includes('video')) return '/api/async/video_google_omni';
    if (normalizedMode.includes('image')) return '/api/async/image_nanoBanana2';
    return '/api/chat/index';
  }
  return '';
}

function buildGatewayUrl(provider, mode, fallbackUrl) {
  const baseUrl = getGatewayBaseUrl(provider);
  if (!baseUrl) return fallbackUrl;

  if (provider === 'suchuang') {
    const modelSpecificPath = getSuchuangEndpointPathFromFallback(fallbackUrl);
    return `${baseUrl.replace(/\/+$/, '')}${modelSpecificPath || getGatewayEndpointPath(provider, mode)}`;
  }
  return fallbackUrl;
}

module.exports = {
  getActiveGatewayProvider,
  getGatewayBaseUrl,
  getGatewayEndpointPath,
  buildGatewayUrl,
  SUCHUANG_DEFAULT_BASE_URL
};
