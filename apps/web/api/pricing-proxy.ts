const JSON_HEADERS = {
  'Content-Type': 'application/json; charset=utf-8',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

const WUYIN_ROOT_URL = 'https://api.wuyinkeji.com';
const WUYIN_PRICE_API_PATH = '/themes/DigitalBlue/api?action=api_list';

const jsonResponse = (payload: unknown, init?: ResponseInit) =>
  new Response(JSON.stringify(payload), {
    ...init,
    headers: JSON_HEADERS,
  });

function normalizeBaseUrl(baseUrl: string): string {
  const raw = String(baseUrl || '').trim();
  if (!raw) return '';
  const withProtocol = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
  try {
    const parsed = new URL(withProtocol);
    const path = parsed.pathname
      .replace(/\/+(doc\/\d+)?$/i, '')
      .replace(/\/+(api(?:\/[a-z0-9_.-]+)*)?$/i, '')
      .replace(/\/+$/, '');
    return `${parsed.protocol}//${parsed.host}${path}`;
  } catch {
    return raw.replace(/\/+$/, '');
  }
}

function isWuyinRequest(baseUrl: string, provider?: string): boolean {
  if (/wuyin/i.test(String(provider || ''))) return true;
  const clean = normalizeBaseUrl(baseUrl);
  try {
    const parsed = new URL(/^https?:\/\//i.test(clean) ? clean : `https://${clean}`);
    return /^api\.wuyinkeji\.com$/i.test(parsed.hostname) || /wuyinkeji/i.test(parsed.hostname);
  } catch {
    return /wuyinkeji/i.test(clean);
  }
}

async function fetchWuyinCatalog() {
  const response = await fetch(`${WUYIN_ROOT_URL}${WUYIN_PRICE_API_PATH}`, {
    method: 'GET',
    headers: {
      Accept: 'application/json',
      'User-Agent': 'KK-Studio/1.0',
    },
  });

  if (!response.ok) {
    return jsonResponse({ error: `Wuyin catalog returned HTTP ${response.status}` }, { status: 502 });
  }

  const payload = await response.json();
  return jsonResponse({
    success: true,
    source: 'wuyinkeji',
    endpointUrl: `${WUYIN_ROOT_URL}${WUYIN_PRICE_API_PATH}`,
    data: Array.isArray(payload?.data?.api_list) ? payload.data.api_list : [],
    api_type_data: Array.isArray(payload?.data?.api_type_data) ? payload.data.api_type_data : [],
    group_ratio: {},
  });
}

async function fetchGenericPricing(baseUrl: string) {
  const cleanUrl = normalizeBaseUrl(baseUrl);
  if (!cleanUrl) {
    return jsonResponse({ error: 'Missing baseUrl' }, { status: 400 });
  }

  const pricingUrl = `${cleanUrl}/api/pricing`;
  const response = await fetch(pricingUrl, {
    method: 'GET',
    headers: { Accept: 'application/json' },
  });

  if (!response.ok) {
    return jsonResponse({ error: `Provider returned HTTP ${response.status}` }, { status: 502 });
  }

  const text = await response.text();
  const trimmed = text.trimStart();
  if (trimmed.startsWith('<!') || trimmed.startsWith('<html')) {
    return jsonResponse({ error: 'Provider returned HTML instead of JSON' }, { status: 502 });
  }

  const payload = JSON.parse(text);
  return jsonResponse({
    success: true,
    endpointUrl: pricingUrl,
    data: Array.isArray(payload?.data) ? payload.data : [],
    group_ratio: payload?.group_ratio || {},
  });
}

export default async function pricingProxyHandler(request: Request): Promise<Response> {
  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: JSON_HEADERS });
  }

  if (request.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed' }, { status: 405 });
  }

  try {
    const body = await request.json().catch(() => ({}));
    const baseUrl = String(body?.baseUrl || '');
    const provider = String(body?.provider || '');

    if (isWuyinRequest(baseUrl, provider)) {
      return await fetchWuyinCatalog();
    }

    return await fetchGenericPricing(baseUrl);
  } catch (error) {
    return jsonResponse({
      error: error instanceof Error ? error.message : 'Pricing proxy failed',
    }, { status: 500 });
  }
}
