/**
 * @file user-model-proxy.js
 * @module api
 * @description Vercel serverless proxy for user-owned Wuyin async model requests.
 * @author KK-Studio Team
 * @version 1.5.4
 */

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

function appendWuyinApiKeyToTargetUrl(targetUrl, apiKey) {
  const token = String(apiKey || '').trim();
  if (!token) return targetUrl;
  const parsed = new URL(targetUrl);
  parsed.searchParams.set('key', token);
  return parsed.toString();
}

function isAllowedWuyinTargetUrl(targetUrl) {
  const raw = String(targetUrl || '').trim();
  if (!raw) return false;
  try {
    const parsed = new URL(raw);
    if (parsed.protocol !== 'https:' || !/^api\.wuyinkeji\.com$/i.test(parsed.hostname)) {
      return false;
    }

    const pathname = parsed.pathname.replace(/\/+$/, '');
    const allowedExactPaths = [
      '/api/async/detail',
      '/api/chat/index',
      '/api/voice/composite',
      '/api/voice/clone',
      '/api/sora2-new/submit',
      '/api/sora2/detail',
      '/api/img/split',
      '/api/img/nanoBanana',
      '/api/img/drawDetail'
    ];

    if (allowedExactPaths.includes(pathname)) {
      return true;
    }

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
 * Forwards a same-origin user model proxy request to the documented Wuyin async API.
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
    const vpsBackend = process.env.VPS_BACKEND_URL || 'https://172-245-156-16.sslip.io';
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
  if (!isAllowedWuyinTargetUrl(targetUrl)) {
    return sendProxyError(res, 404, 'USER_ROUTE_NOT_FOUND', 'User model proxy only handles Wuyin async requests.');
  }
  if (!apiKey) {
    return sendProxyError(res, 400, 'USER_ROUTE_SECRET_REQUIRED', 'Wuyin API key is required.');
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
    const upstream = await fetch(appendWuyinApiKeyToTargetUrl(targetUrl, apiKey), {
      method: req.method || 'GET',
      headers,
      body,
    });
    const responseText = await upstream.text().catch(() => '');
    res.status(upstream.status);
    res.setHeader('Content-Type', upstream.headers.get('content-type') || 'application/json; charset=utf-8');
    return res.send(responseText);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error || 'Wuyin proxy failed.');
    return sendProxyError(res, 502, 'LOCAL_USER_ROUTE_PROXY_UPSTREAM_ERROR', message);
  }
}
