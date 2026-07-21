/**
 * @file fetchClient.js
 * @module services/api/lib
 * @description 生产级内置原生 fetch 封装。提供重试、退避、Retry-After 解析、响应体大小限制与严格 Host SSRF 拦截防御。
 */

const { URL } = require('url');

/**
 * 校验 Host 是否为私有 IP/本地回环（SSRF 防御）
 * @param {string} hostname 域名或 IP 字符串
 * @returns {boolean} 是否为私有 Host
 */
function isPrivateHost(hostname) {
  const host = String(hostname || '').trim().toLowerCase();
  if (!host) return true;
  if (host === 'localhost' || host === 'localhost.localdomain') return true;

  // 127.0.0.1/8 (回环地址)
  // 10.0.0.0/8 (私有 A 类)
  // 192.168.0.0/16 (私有 C 类)
  // 169.254.0.0/16 (链路本地)
  // 0.0.0.0
  if (/^(?:127|10)\.\d+\.\d+\.\d+$/.test(host)) return true;
  if (/^192\.168\.\d+\.\d+$/.test(host)) return true;
  if (/^169\.254\.\d+\.\d+$/.test(host)) return true;
  if (/^0\.0\.0\.0$/.test(host)) return true;

  // 172.16.0.0/12 (私有 B 类)
  const match172 = host.match(/^172\.(\d+)\.\d+\.\d+$/);
  if (match172) {
    const secondOctet = parseInt(match172[1], 10);
    if (secondOctet >= 16 && secondOctet <= 31) return true;
  }

  // IPv6 本地/私有检查
  if (host === '::1' || host === '0:0:0:0:0:0:0:1' || host === '[::1]') return true;
  if (host.startsWith('fe80:') || host.startsWith('fc00:') || host.startsWith('fd00:')) return true;

  return false;
}

/**
 * 在限制字节数内异步读取流数据，若超出则抛出错误以防止内存溢出
 * @param {Response} response 原生 Response 对象
 * @param {number} limitBytes 最大限制字节数
 * @returns {Promise<string>} 响应体文本
 */
async function readResponseBodyWithLimit(response, limitBytes) {
  if (!response.body) return '';
  let totalBytes = 0;
  const chunks = [];

  try {
    for await (const chunk of response.body) {
      totalBytes += chunk.length;
      if (totalBytes > limitBytes) {
        throw new Error(`Response body limit exceeded (${limitBytes} bytes).`);
      }
      chunks.push(Buffer.from(chunk));
    }
    return Buffer.concat(chunks).toString('utf8');
  } catch (err) {
    if (err.message && err.message.includes('limit exceeded')) {
      throw err;
    }
    // 降级 fallback 处理部分不支持 AsyncIterator 的情况
    const text = await response.text();
    if (Buffer.byteLength(text, 'utf8') > limitBytes) {
      throw new Error(`Response body limit exceeded (${limitBytes} bytes).`);
    }
    return text;
  }
}

/**
 * 生产级 fetchWithRetries
 * @param {string} url 目标请求 URL
 * @param {object} options fetch 参数，支持自定义的 maxRetries, timeout, limitBytes, stream
 * @returns {Promise<Response|object>} 响应体，流式请求返回原生 Response，非流式返回包裹后的 response
 */
async function fetchWithRetries(url, options = {}) {
  const parsedUrl = new URL(url);
  if (isPrivateHost(parsedUrl.hostname)) {
    const err = new Error(`SSRF Blocked: Private host access rejected.`);
    err.statusCode = 400;
    throw err;
  }

  const maxRetries = options.maxRetries !== undefined ? Number(options.maxRetries) : 3;
  const timeoutMs = options.timeout !== undefined ? Number(options.timeout) : 60000;
  const limitBytes = options.limitBytes !== undefined ? Number(options.limitBytes) : 10 * 1024 * 1024; // 默认 10MB
  const isStream = Boolean(options.stream);

  let lastError = null;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const fetchOptions = { ...options, signal: controller.signal };
      // 剥离非标准 fetch 参数防止报错
      delete fetchOptions.maxRetries;
      delete fetchOptions.timeout;
      delete fetchOptions.limitBytes;
      delete fetchOptions.stream;

      // 使用 Node.js 内置全局 fetch
      const response = await fetch(url, fetchOptions);
      clearTimeout(timeoutId);

      // 如果响应非 OK，读取错误信息并抛出，若可以重试则由 catch 处理
      if (!response.ok) {
        const errorText = await readResponseBodyWithLimit(response, limitBytes).catch(() => '');
        const errObj = new Error(errorText || `Upstream returned HTTP ${response.status}`);
        errObj.statusCode = response.status;
        errObj.headers = response.headers;
        throw errObj;
      }

      // 如果是流式请求，且 OK，直接返回原生 response
      if (isStream || response.headers.get('content-type')?.includes('text/event-stream')) {
        return response;
      }

      // 读取响应并校验大小限制
      const text = await readResponseBodyWithLimit(response, limitBytes);
      return {
        ok: response.ok,
        status: response.status,
        headers: response.headers,
        text: async () => text,
        json: async () => JSON.parse(text),
      };

    } catch (err) {
      clearTimeout(timeoutId);
      lastError = err;

      // 判断是否触发重试：429 或 5xx 状态码，或者网络连接/超时错误
      const isStatusRetryable = err.statusCode === 429 || (err.statusCode >= 500 && err.statusCode <= 599);
      const isNetworkError = !err.statusCode; // 如超时 AbortError 或网络断开
      const canRetry = (isStatusRetryable || isNetworkError) && attempt < maxRetries;

      if (canRetry) {
        let delayMs = Math.pow(2, attempt) * 1000 + Math.random() * 200;

        // 如果是 429/503 等，并带有 Retry-After 头，优先解析退避时间
        if (err.headers && err.headers.get('retry-after')) {
          const retryAfter = err.headers.get('retry-after');
          const seconds = parseInt(retryAfter, 10);
          if (!isNaN(seconds)) {
            delayMs = seconds * 1000;
          } else {
            const dateMs = Date.parse(retryAfter);
            if (!isNaN(dateMs)) {
              delayMs = Math.max(0, dateMs - Date.now());
            }
          }
        }

        console.warn(`[fetchWithRetries] 请求失败 (status=${err.statusCode || 'network_error'})。将在 ${Math.round(delayMs)}ms 后重试 (${attempt + 1}/${maxRetries})。URL: ${url}`);
        await new Promise((resolve) => setTimeout(resolve, delayMs));
        continue;
      }

      throw err;
    }
  }

  throw lastError || new Error(`Request failed after ${maxRetries} retries.`);
}

module.exports = {
  fetchWithRetries,
  isPrivateHost,
};
