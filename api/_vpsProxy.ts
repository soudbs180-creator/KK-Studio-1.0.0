export const config = { runtime: 'edge' };

const DEFAULT_VPS_API_BASE_URL = 'https://api.kkai.plus';

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

const SENSITIVE_REQUEST_HEADERS = new Set([
  'authorization',
  'cookie',
  'proxy-authorization',
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

function isProductionHostedProxy(): boolean {
  return process.env.VERCEL_ENV === 'production' || process.env.NODE_ENV === 'production';
}

function hasSensitiveRequestHeaders(source: Headers): boolean {
  let hasSensitiveHeader = false;

  source.forEach((_, key) => {
    const lowerKey = key.toLowerCase();
    if (
      SENSITIVE_REQUEST_HEADERS.has(lowerKey)
      || /(?:^|[-_])(auth|csrf|session|token)(?:[-_]|$)/.test(lowerKey)
    ) {
      hasSensitiveHeader = true;
    }
  });

  return hasSensitiveHeader;
}

function copyRequestHeaders(source: Headers, upstreamUrl: URL): Headers {
  const headers = new Headers();
  source.forEach((value, key) => {
    if (!HOP_BY_HOP_REQUEST_HEADERS.has(key.toLowerCase())) {
      headers.set(key, value);
    }
  });
  headers.set('x-forwarded-host', upstreamUrl.host);
  headers.set('x-forwarded-proto', upstreamUrl.protocol.replace(/:$/, ''));
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

  if (
    isProductionHostedProxy()
    && upstreamUrl.protocol === 'http:'
    && hasSensitiveRequestHeaders(request.headers)
  ) {
    return new Response(
      JSON.stringify({
        success: false,
        error: {
          code: 'UPSTREAM_REQUIRES_HTTPS',
          message: 'Sensitive hosted requests must not be forwarded to an HTTP upstream.',
        },
      }),
      {
        status: 502,
        headers: {
          'content-type': 'application/json; charset=utf-8',
          'cache-control': 'no-store',
        },
      },
    );
  }

  const method = request.method.toUpperCase();
  const hasBody = method !== 'GET' && method !== 'HEAD';
  const body = hasBody ? await request.arrayBuffer() : undefined;
  const upstreamResponse = await fetch(upstreamUrl, {
    method,
    headers: copyRequestHeaders(request.headers, upstreamUrl),
    body,
    redirect: 'manual',
  });

  return new Response(upstreamResponse.body, {
    status: upstreamResponse.status,
    statusText: upstreamResponse.statusText,
    headers: copyResponseHeaders(upstreamResponse.headers),
  });
}
