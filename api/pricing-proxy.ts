/**
 * Pricing scan proxy
 * 优先尝试 /pricing、/pricing.html。
 * 仅当 pricing 页面未提取到有效价格数据时，才回退解析 /models 页面。
 * 若前端价格页仍无法提取，再兜底尝试 /api/pricing。
 */

import {
  parsePayload,
  mergeRows,
  mergeGroupRatios,
  looksLikeHtml,
  discoverDynamicTargets,
  type PricingRow,
  type ParsedPayload,
  type DiscoveryTarget
} from '../src/services/billing/pricingRules';

export const config = { runtime: 'edge' };

type FetchAndParseResult = DiscoveryTarget & {
  ok: boolean;
  status: number;
  text: string;
  parsed: ParsedPayload | null;
};

const PRIVATE_IPV4_PATTERNS = [
  /^0\./,
  /^10\./,
  /^127\./,
  /^169\.254\./,
  /^172\.(1[6-9]|2\d|3[0-1])\./,
  /^192\.168\./,
];

const FORBIDDEN_HOSTNAME_SUFFIXES = [
  '.internal',
  '.local',
  '.localdomain',
  '.localhost',
  '.home',
  '.lan',
];

const normalizeHostForChecks = (hostname: string) =>
  String(hostname || '')
    .trim()
    .toLowerCase()
    .replace(/^\[|\]$/g, '')
    .split('%')[0];

const isPrivateIpAddress = (hostname: string) => {
  const normalized = normalizeHostForChecks(hostname);

  if (PRIVATE_IPV4_PATTERNS.some((pattern) => pattern.test(normalized))) {
    return true;
  }

  return normalized === '::'
    || normalized === '::1'
    || /^f[cd][0-9a-f]{0,2}:/i.test(normalized)
    || /^fe[89ab][0-9a-f]?:/i.test(normalized)
    || /^::ffff:(?:0:)?(?:10\.|127\.|169\.254\.|192\.168\.|172\.(1[6-9]|2\d|3[0-1])\.)/i.test(normalized);
};

const isForbiddenHostname = (hostname: string) => {
  const lower = normalizeHostForChecks(hostname);
  if (!lower) return true;
  if (lower === 'localhost') return true;
  if (lower.includes('localhost')) return true;
  if (FORBIDDEN_HOSTNAME_SUFFIXES.some((suffix) => lower.endsWith(suffix))) return true;
  if (lower.endsWith('.nip.io') || lower.endsWith('.sslip.io')) return true;
  if (isPrivateIpAddress(lower)) return true;
  return false;
};

const SUPPLIER_PATH_SUFFIXES = [
  /\/api\/pricing$/i,
  /\/api\/price$/i,
  /\/v1\/pricing$/i,
  /\/pricing\.html$/i,
  /\/pricing$/i,
  /\/price$/i,
  /\/models$/i,
  /\/v1$/i,
];

const stripSupplierPathSuffixes = (pathname: string) => {
  let clean = String(pathname || '').replace(/\/+$/, '');
  let stripped = true;

  while (stripped) {
    stripped = false;
    for (const suffix of SUPPLIER_PATH_SUFFIXES) {
      if (!suffix.test(clean)) continue;
      clean = clean.replace(suffix, '').replace(/\/+$/, '');
      stripped = true;
      break;
    }
  }

  return clean || '/';
};

const normalizeSupplierBaseUrl = (rawBaseUrl: string) => {
  const parsed = new URL(String(rawBaseUrl || '').trim());

  if (!['http:', 'https:'].includes(parsed.protocol)) {
    throw new Error('Only http/https supplier URLs are allowed');
  }

  if (parsed.username || parsed.password) {
    throw new Error('Supplier URL must not contain embedded credentials');
  }

  if (isForbiddenHostname(parsed.hostname)) {
    throw new Error('Private, local, or loopback supplier URLs are not allowed');
  }

  parsed.hash = '';
  parsed.search = '';
  parsed.pathname = stripSupplierPathSuffixes(parsed.pathname);

  return parsed.toString().replace(/\/$/, '');
};

const fetchText = async (url: string, accept: string) => {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 10000);

  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        Accept: accept,
        'User-Agent': 'KK-Studio-Pricing-Proxy/2.0',
      },
      redirect: 'error',
      signal: controller.signal,
    });

    return {
      ok: response.ok,
      status: response.status,
      text: await response.text(),
    };
  } finally {
    clearTimeout(timeoutId);
  }
};

const fetchAndParse = async (url: string, accept: string) => {
  const result = await fetchText(url, accept);
  return {
    ...result,
    parsed: result.ok ? parsePayload(result.text) : null,
  };
};

const buildSuccessResponse = (
  results: FetchAndParseResult[],
  discoveredUrls: string[],
  corsHeaders: Record<string, string>
) => {
  const mergedData = mergeRows(...results.map((item) => item.parsed?.data || []));
  const mergedGroupRatio = mergeGroupRatios(...results.map((item) => item.parsed?.groupRatio));

  return new Response(
    JSON.stringify({
      success: true,
      data: mergedData,
      group_ratio: mergedGroupRatio,
      sources: Object.fromEntries(results.map((item) => [item.key, item.ok])),
      discovered: discoveredUrls,
    }),
    {
      status: 200,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    }
  );
};

export default async function handler(request: Request) {
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };

  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  if (request.method !== 'POST') {
    return new Response(JSON.stringify({ error: '仅支持 POST 请求' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });
  }

  try {
    const { baseUrl } = (await request.json()) as { baseUrl: string };

    if (!baseUrl) {
      return new Response(JSON.stringify({ error: '缺少 baseUrl' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      });
    }

    const cleanUrl = normalizeSupplierBaseUrl(baseUrl);
    const attemptedUrls = new Set<string>();
    const results: FetchAndParseResult[] = [];
    const discoveredUrls: string[] = [];

    const pricingTargets: DiscoveryTarget[] = [
      {
        key: 'pricingPage',
        url: `${cleanUrl}/pricing`,
        accept: 'text/html,application/xhtml+xml,application/json;q=0.9,*/*;q=0.8',
      },
      {
        key: 'pricingHtml',
        url: `${cleanUrl}/pricing.html`,
        accept: 'text/html,application/xhtml+xml,application/json;q=0.9,*/*;q=0.8',
      },
    ];
    const modelsTarget: DiscoveryTarget = {
      key: 'modelsPage',
      url: `${cleanUrl}/models`,
      accept: 'text/html,application/xhtml+xml,application/json;q=0.9,*/*;q=0.8',
    };
    const apiPricingTarget: DiscoveryTarget = {
      key: 'apiPricing',
      url: `${cleanUrl}/api/pricing`,
      accept: 'application/json, text/plain;q=0.9, */*;q=0.8',
    };

    const runTarget = async (target: DiscoveryTarget, allowDiscovery: boolean): Promise<Response | null> => {
      if (attemptedUrls.has(target.url)) return null;
      attemptedUrls.add(target.url);

      const result: FetchAndParseResult = {
        ...target,
        ...(await fetchAndParse(target.url, target.accept)),
      };
      results.push(result);

      if (result.parsed?.data?.length) {
        return buildSuccessResponse(results, discoveredUrls, corsHeaders);
      }

      if (!allowDiscovery || !result.ok || !looksLikeHtml(result.text)) {
        return null;
      }

      const discoveredTargets = discoverDynamicTargets(result.text, cleanUrl).filter((item) => !attemptedUrls.has(item.url));
      for (const discoveredTarget of discoveredTargets) {
        attemptedUrls.add(discoveredTarget.url);
        discoveredUrls.push(discoveredTarget.url);

        const discoveredResult: FetchAndParseResult = {
          ...discoveredTarget,
          ...(await fetchAndParse(discoveredTarget.url, discoveredTarget.accept)),
        };
        results.push(discoveredResult);

        if (discoveredResult.parsed?.data?.length) {
          return buildSuccessResponse(results, discoveredUrls, corsHeaders);
        }
      }

      return null;
    };

    for (const target of pricingTargets) {
      const pricingResponse = await runTarget(target, true);
      if (pricingResponse) {
        return pricingResponse;
      }
    }

    const modelsResponse = await runTarget(modelsTarget, true);
    if (modelsResponse) {
      return modelsResponse;
    }

    const apiPricingResponse = await runTarget(apiPricingTarget, false);
    if (apiPricingResponse) {
      return apiPricingResponse;
    }

    const firstError = results.find((item) => !item.ok);
    const upstreamError = firstError
      ? `${firstError.key} 返回 ${firstError.status}`
      : '未从供应商价格页提取到基础价和倍率数据';

    return new Response(JSON.stringify({ error: upstreamError }), {
      status: 200,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error?.message || '价格代理请求失败' }), {
      status: 200,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });
  }
}
