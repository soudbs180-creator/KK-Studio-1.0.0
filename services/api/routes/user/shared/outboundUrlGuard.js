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

module.exports = { rejectUnsafeOutboundUrl, hasUnsafeBaseUrl };
