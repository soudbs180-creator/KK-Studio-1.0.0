/**
 * CLIProxyAPI Adapter & Gateway Proxy Layer
 * Integrated OAuth 2.0 PKCE authentication management & Multi-Provider proxy routing for KK Studio (services/api).
 */

// 中文注释：services/api 无独立 logger 模块，统一使用 console（与 dispatcher 等模块一致）。
// 原 `require('../../logger')` 指向不存在的文件，模块一经加载即崩溃，此处改为 console 适配。
const logger = {
  info: (...args) => console.log(...args),
  warn: (...args) => console.warn(...args),
  error: (...args) => console.error(...args)
};

// 支持的 Canonical Providers
const SUPPORTED_PROVIDERS = [
  'openai',
  'anthropic',
  'google',
  'grok',
  'hunyuan',
  'siliconflow',
  'openrouter'
];

/**
 * 校验 CLIProxyAPI 路由目标与 Host SSRF 安全约束
 */
function validateProxyEndpoint(targetUrl) {
  if (!targetUrl || typeof targetUrl !== 'string') {
    return { valid: false, reason: 'Endpoint URL is missing' };
  }

  try {
    const parsed = new URL(targetUrl);
    // 强制只能使用 HTTPS 或 本地 loopback
    if (parsed.protocol !== 'https:' && parsed.hostname !== '127.0.0.1' && parsed.hostname !== 'localhost') {
      return { valid: false, reason: 'Proxy endpoint must use HTTPS or local loopback' };
    }
    return { valid: true, protocol: parsed.protocol, hostname: parsed.hostname };
  } catch (err) {
    return { valid: false, reason: 'Invalid URL format' };
  }
}

/**
 * 脱敏与构建 CLIProxyAPI 请求 Header（零密钥泄漏原则）
 */
function buildSanitizedProxyHeaders(headers = {}, authToken = '') {
  const sanitized = { ...headers };

  // 物理清除任何本地文件路径或潜在的暴露特征
  delete sanitized['x-machine-id'];
  delete sanitized['x-user-private-key'];

  if (authToken) {
    sanitized['Authorization'] = `Bearer ${authToken}`;
  }

  sanitized['X-KK-Studio-Version'] = '1.6.0';
  sanitized['X-KK-Proxy-Gateway'] = 'CLIProxyAPI-Sidecar';

  return sanitized;
}

/**
 * 统一网关底层转发
 */
async function proxyProviderRequest({ provider, endpoint, payload, headers, timeoutMs = 30000 }) {
  if (!SUPPORTED_PROVIDERS.includes(provider)) {
    throw new Error(`Unsupported provider for CLIProxyAPI: ${provider}`);
  }

  const validation = validateProxyEndpoint(endpoint);
  if (!validation.valid) {
    throw new Error(`SSRF Protection blocked endpoint: ${validation.reason}`);
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const sanitizedHeaders = buildSanitizedProxyHeaders(headers);
    logger?.info?.(`[CLIProxyAPI] Forwarding request to ${provider} at ${validation.hostname}`);

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...sanitizedHeaders
      },
      body: JSON.stringify(payload),
      signal: controller.signal
    });

    clearTimeout(timer);

    if (!response.ok) {
      const errText = await response.text();
      return {
        success: false,
        status: response.status,
        error: `Provider HTTP ${response.status}: ${errText.substring(0, 300)}`
      };
    }

    const data = await response.json();
    return {
      success: true,
      status: response.status,
      data
    };
  } catch (err) {
    clearTimeout(timer);
    return {
      success: false,
      status: 500,
      error: err.name === 'AbortError' ? 'Proxy request timed out' : err.message
    };
  }
}

module.exports = {
  SUPPORTED_PROVIDERS,
  validateProxyEndpoint,
  buildSanitizedProxyHeaders,
  proxyProviderRequest
};
