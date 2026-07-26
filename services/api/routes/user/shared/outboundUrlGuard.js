const { isPrivateHost } = require('../../../lib/fetchClient');

/**
 * BYOK 代理的出站 URL 守卫（SSRF 防御）。
 *
 * BYOK 链路有两条互相独立的用户可控出站路径：
 *   1) `X-Proxy-Target-Url` 请求头
 *   2) 用户自建槽位里的 `route.baseUrl`
 * 两者都会被直接 fetch，且上游响应体会经错误消息原样回吐，构成可完整读取的 SSRF。
 * 只修其中一条关不掉漏洞，因此两条路径共用本模块的同一判定。
 *
 * 私有地址判定复用仓库既有的 `isPrivateHost`（providerProbe 使用的同一实现），
 * 不另起一套规则，避免两处规则漂移。
 */

/**
 * @param {string} rawUrl 待校验的出站地址
 * @returns {string|null} 不通过时返回拒绝原因，通过返回 null
 */
function rejectUnsafeOutboundUrl(rawUrl) {
  const value = String(rawUrl || '').trim();
  if (!value) return 'Target URL is required.';

  let parsed;
  try {
    parsed = new URL(value);
  } catch {
    return 'Target URL is malformed.';
  }

  if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
    return 'Only http(s) target URLs are allowed.';
  }
  if (parsed.username || parsed.password) {
    return 'Credentials embedded in the target URL are not allowed.';
  }
  if (isPrivateHost(parsed.hostname)) {
    return 'Private or loopback target hosts are not allowed.';
  }
  return null;
}

/**
 * 槽位 baseUrl 的布尔封装。空值交由下游各自的必填校验处理，不在此改变既有行为。
 * @param {{ baseUrl?: string }} route
 * @returns {boolean} 是否为不安全的出站目标
 */
function hasUnsafeBaseUrl(route) {
  const raw = String((route && route.baseUrl) || '').trim();
  if (!raw) return false;
  return rejectUnsafeOutboundUrl(raw) !== null;
}

const MAX_REDIRECTS = 5;

/**
 * 带逐跳守卫的出站 fetch。
 *
 * Node 全局 fetch 的 redirect 默认是 'follow'（最多 20 跳），只在发起前校验一次地址
 * 等于没有防护：攻击者把目标指向自己控制的公网主机，由其返回
 * `302 Location: http://169.254.169.254/...`，请求就会被自动跟到内网，
 * 而响应体仍会被原样回吐。
 *
 * 因此改为 redirect:'manual'，每一跳的 Location 都重新过同一道守卫后才继续，
 * 并限制跳数。相对「一律拒绝 3xx」，保留跳转可避免打断确实会做重定向的合法 Provider。
 *
 * @param {string} url 初始目标（调用方应已校验过，本函数会再校验一次）
 * @param {RequestInit} init
 * @returns {Promise<Response>}
 */
async function safeOutboundFetch(url, init = {}) {
  let currentUrl = url;

  for (let hop = 0; hop <= MAX_REDIRECTS; hop += 1) {
    const rejection = rejectUnsafeOutboundUrl(currentUrl);
    if (rejection) {
      const error = new Error(rejection);
      error.code = 'PROXY_TARGET_REJECTED';
      error.statusCode = 400;
      throw error;
    }

    const response = await fetch(currentUrl, { ...init, redirect: 'manual' });
    if (response.status < 300 || response.status > 399) {
      return response;
    }

    const location = response.headers.get('location');
    if (!location) return response;

    // Location 可能是相对路径，按当前地址解析成绝对地址后再送回守卫。
    currentUrl = new URL(location, currentUrl).toString();
  }

  const error = new Error('Too many redirects while proxying the upstream request.');
  error.code = 'PROXY_TOO_MANY_REDIRECTS';
  error.statusCode = 502;
  throw error;
}

module.exports = { rejectUnsafeOutboundUrl, hasUnsafeBaseUrl, safeOutboundFetch };
