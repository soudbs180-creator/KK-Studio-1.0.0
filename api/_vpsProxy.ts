export const config = { runtime: 'edge' };

const DEFAULT_VPS_API_BASE_URL = 'http://172.245.156.16';

const HOP_BY_HOP_REQUEST_HEADERS = new Set([
  'connection',
  'content-length',
  'expect',
  'host',
  'keep-alive',
  'proxy-authenticate',
  'proxy-authorization',
  'te',
  'trailer',
  'transfer-encoding',
  'upgrade',
  'x-forwarded-host',
  'x-forwarded-proto',
]);

const HOP_BY_HOP_RESPONSE_HEADERS = new Set([
  'connection',
  'content-encoding',
  'content-length',
  'keep-alive',
  'proxy-authenticate',
  'proxy-authorization',
  'te',
  'trailer',
  'transfer-encoding',
  'upgrade',
]);

function resolveVpsApiBaseUrl(): string {
  const configured = String(
    process.env.KK_VPS_API_BASE_URL
      || DEFAULT_VPS_API_BASE_URL,
  ).trim();

  try {
    const url = new URL(configured || DEFAULT_VPS_API_BASE_URL);
    return url.origin;
  } catch {
    return DEFAULT_VPS_API_BASE_URL;
  }
}

function copyRequestHeaders(source: Headers): Headers {
  const headers = new Headers();
  source.forEach((value, key) => {
    if (!HOP_BY_HOP_REQUEST_HEADERS.has(key.toLowerCase())) {
      headers.set(key, value);
    }
  });
  headers.set('x-forwarded-host', '172.245.156.16');
  headers.set('x-forwarded-proto', 'http');
  return headers;
}

function copyResponseHeaders(source: Headers): Headers {
  const headers = new Headers();
  source.forEach((value, key) => {
    if (!HOP_BY_HOP_RESPONSE_HEADERS.has(key.toLowerCase())) {
      headers.set(key, value);
    }
  });
  return headers;
}

export async function proxyToVps(request: Request, upstreamPath: string): Promise<Response> {
  const requestUrl = new URL(request.url);
  const upstreamUrl = new URL(upstreamPath, resolveVpsApiBaseUrl());
  upstreamUrl.search = requestUrl.search;

  const method = request.method.toUpperCase();
  const hasBody = method !== 'GET' && method !== 'HEAD';
  const body = hasBody ? await request.arrayBuffer() : undefined;
  const upstreamResponse = await fetch(upstreamUrl, {
    method,
    headers: copyRequestHeaders(request.headers),
    body,
    redirect: 'manual',
  });

  return new Response(upstreamResponse.body, {
    status: upstreamResponse.status,
    statusText: upstreamResponse.statusText,
    headers: copyResponseHeaders(upstreamResponse.headers),
  });
}
