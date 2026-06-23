/**
 * @file user-model-proxy.js
 * @module api
 * @description Vercel serverless 通用用户模型反代网关。基于 Provider 注册表（providerProfiles）
 *              动态白名单校验域名，转发用户自有密钥的模型请求至已注册的上游 Provider API。
 * @author KK-Studio Team
 * @version 1.5.7
 */

import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);

function sendJson(res, status, payload) {
  res.status(status);
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  return res.json(payload);
}

function sendProxyError(res, status, code, message) {
  return sendJson(res, status, {
    success: false,
    error: {
      code,
      message,
    },
  });
}

function getHeader(req, name) {
  const headers = req.headers || {};
  return String(headers[name] || headers[name.toLowerCase()] || '').trim();
}

function isObjectRecord(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function isEncryptedSecretEnvelope(value) {
  if (!isObjectRecord(value)) return false;
  if (value.__kkUserApiSecret === true) return true;
  const keys = Object.keys(value).map((key) => key.toLowerCase());
  const hasCipher = keys.some((key) => key === 'ciphertext' || key === 'cipher_text' || key === 'cipher');
  const hasIv = keys.includes('iv') || keys.includes('nonce');
  return hasCipher && hasIv;
}

function isEncryptedSecretJsonString(value) {
  const trimmed = String(value || '').trim();
  if (!trimmed.startsWith('{') || !trimmed.endsWith('}')) return false;
  try {
    return isEncryptedSecretEnvelope(JSON.parse(trimmed));
  } catch {
    return false;
  }
}

function normalizeUserApiSecretForTransport(value) {
  if (value == null || isEncryptedSecretEnvelope(value) || typeof value !== 'string') {
    return '';
  }

  const token = value.trim();
  if (
    !token
    || token === 'sk-readonly-0000'
    || token.startsWith('__kk_redacted__:')
    || token === '[object Object]'
    || /^\[object\s+[^\]]+\]$/.test(token)
    || /[\u2022\u25cf\u25e6\u2219\u2027\u2026]/.test(token)
    || token.includes('...')
    || isEncryptedSecretJsonString(token)
  ) {
    return '';
  }

  return token;
}

/**
 * 对需要通过 query param 传递 API Key 的异步任务查询端点追加鉴权参数。
 * 仅对已知的异步状态查询端点 (detail) 追加 key=... 参数，
 * 其他端点保持原始 URL 不变，鉴权通过 Authorization header 传递。
 */
function appendApiKeyQueryParamIfNeeded(targetUrl, apiKey) {
  const token = String(apiKey || '').trim();
  if (!token) return targetUrl;
  const parsed = new URL(targetUrl);
  const pathname = parsed.pathname.replace(/\/+$/, '');
  // 异步任务状态查询端点需要 query param 鉴权（部分中转站 API 要求）
  const isAsyncDetailQuery =
    pathname === '/api/async/detail'
    || pathname === '/api/sora2/detail'
    || pathname === '/api/img/drawDetail';
  if (!isAsyncDetailQuery) {
    return parsed.toString();
  }
  parsed.searchParams.set('key', token);
  return parsed.toString();
}

const { PROVIDER_PROFILES } = require('../server/lib/dispatcher/providerProfiles.js');

function isAllowedProxyTargetUrl(targetUrl) {
  const raw = String(targetUrl || '').trim();
  if (!raw) return false;
  try {
    const parsed = new URL(raw);
    const hostname = parsed.hostname.toLowerCase();

    // 允许本地开发回环地址
    if (hostname === 'localhost' || hostname === '127.0.0.1') {
      return true;
    }

    // 动态获取注册的所有中转站 (relay) 画像的域名
    const allowedHosts = PROVIDER_PROFILES
      .filter((p) => p.providerKind === 'relay')
      .flatMap((p) => p.domains || [])
      .map((d) => d.toLowerCase());

    const envUrl = process.env.SUCHUANG_BASE_URL || '';
    if (envUrl) {
      try {
        allowedHosts.push(new URL(envUrl).hostname.toLowerCase());
      } catch {}
    }

    // 判断目标域名是否符合白名单域名或其子域名
    const isDomainAllowed = allowedHosts.some((allowed) => {
      return hostname === allowed || hostname.endsWith('.' + allowed);
    });

    if (parsed.protocol !== 'https:' && hostname !== 'localhost' && hostname !== '127.0.0.1') {
      return false;
    }

    if (!isDomainAllowed) {
      return false;
    }

    const pathname = parsed.pathname.replace(/\/+$/, '');
    
    // 严格限制只允许以下核心 API 的反代请求（精确匹配，杜绝包含敏感的 admin, recharge 等后台和计费接口）
    const allowedExactPaths = [
      '/api/async/detail',
      '/api/chat/index',
      '/api/voice/composite',
      '/api/voice/clone',
      '/api/sora2-new/submit',
      '/api/sora2/detail',
      '/api/img/split',
      '/api/img/nanoBanana',
      '/api/img/drawDetail',
      '/type/all'
    ];

    if (allowedExactPaths.includes(pathname)) {
      return true;
    }

    // 仅允许安全的异步状态查询前缀匹配
    return /^\/api\/async(?:$|\/[a-z0-9_.-]+)$/i.test(pathname);
  } catch {
    return false;
  }
}

function buildForwardBody(req) {
  if (req.method === 'GET' || req.method === 'HEAD') {
    return undefined;
  }
  if (typeof req.body === 'string') {
    return req.body;
  }
  if (req.body && typeof req.body === 'object') {
    return JSON.stringify(req.body);
  }
  return undefined;
}

/**
 * 通用用户模型代理请求处理器。将同源代理请求转发到注册表中的上游 Provider API。
 * @param {import('http').IncomingMessage & { body?: unknown; method?: string; headers?: Record<string, string> }} req
 * @param {{ status: (code: number) => unknown; setHeader: (name: string, value: string) => unknown; json: (body: unknown) => unknown; send: (body: string) => unknown; end: () => unknown }} res
 * @returns {Promise<unknown>}
 */
export default async function handler(req, res) {
  if (req.method === 'OPTIONS') {
    res.status(204);
    return res.end();
  }

  const targetUrl = getHeader(req, 'x-proxy-target-url');
  const apiKey = normalizeUserApiSecretForTransport(getHeader(req, 'x-proxy-api-key'));

  if (!targetUrl) {
    const vpsBackend = process.env.VPS_BACKEND_URL;
    if (!vpsBackend) {
      return sendProxyError(res, 500, 'VPS_BACKEND_URL_NOT_CONFIGURED', 'VPS_BACKEND_URL environment variable is not configured.');
    }
    const dest = `${vpsBackend.replace(/\/+$/, '')}/api/v1/model-proxy/user`;
    const headers = {};
    for (const [key, value] of Object.entries(req.headers || {})) {
      if (key.toLowerCase() !== 'host') {
        headers[key] = value;
      }
    }
    const body = buildForwardBody(req);
    try {
      const upstream = await fetch(dest, {
        method: req.method || 'POST',
        headers,
        body,
      });
      const responseText = await upstream.text().catch(() => '');
      res.status(upstream.status);
      res.setHeader('Content-Type', upstream.headers.get('content-type') || 'application/json; charset=utf-8');
      return res.send(responseText);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error || 'VPS proxy failed.');
      return sendProxyError(res, 502, 'LOCAL_USER_ROUTE_PROXY_UPSTREAM_ERROR', message);
    }
  }
  if (!isAllowedProxyTargetUrl(targetUrl)) {
    return sendProxyError(res, 404, 'USER_ROUTE_NOT_FOUND', 'User model proxy only handles registered provider API requests.');
  }
  if (!apiKey) {
    return sendProxyError(res, 400, 'USER_ROUTE_SECRET_REQUIRED', 'Provider API key is required.');
  }

  const headers = {
    Authorization: apiKey,
    Accept: getHeader(req, 'accept') || 'application/json',
  };
  const body = buildForwardBody(req);
  if (body !== undefined) {
    headers['Content-Type'] = getHeader(req, 'content-type') || 'application/json';
  }

  try {
    const upstream = await fetch(appendApiKeyQueryParamIfNeeded(targetUrl, apiKey), {
      method: req.method || 'GET',
      headers,
      body,
    });
    const responseText = await upstream.text().catch(() => '');
    res.status(upstream.status);
    res.setHeader('Content-Type', upstream.headers.get('content-type') || 'application/json; charset=utf-8');
    return res.send(responseText);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error || 'User model proxy upstream failed.');
    return sendProxyError(res, 502, 'LOCAL_USER_ROUTE_PROXY_UPSTREAM_ERROR', message);
  }
}
