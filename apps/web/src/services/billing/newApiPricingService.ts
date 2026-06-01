/**
 * NewAPI Pro Pricing Service
 * 
 * Fetches model pricing and group rates from NewAPI Pro compatible providers.
 * Reference: https://docs.newapi.pro/en/docs/api/management/auth
 */

import { kkWebApiClient } from '../api/kkApiClient';
import {
    applyOpenAICompatAuthToUrl,
    buildGeminiHeaders,
    buildGeminiModelsEndpoint,
    buildOpenAIEndpoint,
    buildProxyHeaders,
    formatAuthorizationHeaderValue,
    getApiKeyToken,
    resolveApiProtocolFormat,
    type ApiProtocolFormat,
} from '../api/apiConfig';
import { resolveProviderRuntime } from '../api/providerStrategy';

export interface ModelPricingInfo {
    modelId: string;
    modelName: string;
    inputPrice: number; // per 1M tokens
    outputPrice: number; // per 1M tokens
    isPerToken: boolean; // true = per token, false = per request
    groupRatio?: number; // group multiplier
    currency: string;
    billingUnit?: string;
    displayPrice?: string;
    supportsGroups?: boolean;
    endpointUrl?: string;
    endpointPath?: string;
}

export interface NewApiProviderConfig {
    baseUrl: string;
    apiKey: string;
    systemAccessToken?: string; // for fetching pricing
}

export interface RawPricingCatalogResult {
    endpointUrl: string;
    pricingData: any[];
    groupRatio: Record<string, number>;
    source: 'direct' | 'wuyinkeji';
    supportsGroups: boolean;
    error?: string;
    attemptedUrls?: string[];
}

type PricingVendorInfo = {
    name?: string;
    icon?: string;
};

type PricingEndpointInfo = {
    path?: string;
    method?: string;
};

const MARKETING_PAGE_SUFFIX_RE = /(\/(pricing|models))(\/.*)?$/i;

const MODEL_KEYWORDS = ['model', 'model_id', 'modelId', 'model_name', 'modelName', 'id'];
const PRICE_KEYWORDS = ['price', 'input', 'output', 'ratio', 'quota', 'per_request', 'cost'];
const JSON_ASSIGNMENT_MARKERS = ['window.__NUXT__', 'window.__NEXT_DATA__', 'window.__INITIAL_STATE__'];

export const normalizePricingBaseUrl = (baseUrl: string) => {
    const raw = String(baseUrl || '').trim();
    if (!raw) return '';
    const trimmed = raw.replace(/\/+$/, '');
    const sanitized = trimmed.replace(MARKETING_PAGE_SUFFIX_RE, '');
    return sanitized || trimmed;
};
const WUYIN_DEFAULT_ROOT_URL = 'https://api.wuyinkeji.com';
const WUYIN_ASYNC_ENDPOINT_RE = /^\/api\/async\/([a-z0-9_.-]+)$/i;

export type WuyinAsyncEndpointDetails = {
    endpointUrl: string;
    endpointPath: string;
    modelId: string;
};

const safeJsonParse = (raw: string): any | null => {
    try {
        return JSON.parse(raw);
    } catch {
        return null;
    }
};

const toTrimmedString = (value: unknown): string | undefined => {
    if (typeof value !== 'string' && typeof value !== 'number') return undefined;
    const trimmed = String(value).trim();
    return trimmed || undefined;
};

const normalizeStringList = (value: unknown): string[] | undefined => {
    if (Array.isArray(value)) {
        const items = value.map((entry) => toTrimmedString(entry)).filter((entry): entry is string => Boolean(entry));
        return items.length > 0 ? Array.from(new Set(items)) : undefined;
    }

    const text = toTrimmedString(value);
    if (!text) return undefined;

    const items = text
        .split(/[\s,|/]+/)
        .map((entry) => entry.trim())
        .filter(Boolean);

    return items.length > 0 ? Array.from(new Set(items)) : undefined;
};

const normalizeEndpointInfo = (value: unknown): PricingEndpointInfo | undefined => {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined;

    const entry = value as Record<string, unknown>;
    const path = toTrimmedString(entry.path);
    const method = toTrimmedString(entry.method)?.toUpperCase();

    if (!path && !method) return undefined;
    return { path, method };
};

const buildVendorLookup = (payload: any): Record<string, PricingVendorInfo> => {
    if (!Array.isArray(payload?.vendors)) return {};

    const vendors = payload.vendors as Array<Record<string, unknown>>;
    return vendors.reduce((acc: Record<string, PricingVendorInfo>, item: Record<string, unknown>) => {
        const key = toTrimmedString(item?.id);
        if (!key) return acc;

        acc[key] = {
            name: toTrimmedString(item?.name),
            icon: toTrimmedString(item?.icon),
        };
        return acc;
    }, {});
};

const buildEndpointLookup = (payload: any): Record<string, PricingEndpointInfo> => {
    const source = payload?.supported_endpoint ?? payload?.supportedEndpoint;
    if (!source || typeof source !== 'object' || Array.isArray(source)) return {};

    return Object.entries(source as Record<string, unknown>).reduce<Record<string, PricingEndpointInfo>>((acc, [key, value]) => {
        const normalizedKey = toTrimmedString(key);
        const endpoint = normalizeEndpointInfo(value);
        if (!normalizedKey || !endpoint) return acc;
        acc[normalizedKey] = endpoint;
        return acc;
    }, {});
};

const extractEndpointTypes = (item: any): string[] | undefined =>
    normalizeStringList(
        item?.endpoint_types
        ?? item?.endpointTypes
        ?? item?.supported_endpoint_types
        ?? item?.supportedEndpointTypes
        ?? item?.endpoint_type
        ?? item?.endpointType
    );

const buildEndpointTargets = (
    endpointTypes: string[] | undefined,
    lookup: Record<string, PricingEndpointInfo>
): Record<string, PricingEndpointInfo> | undefined => {
    if (!endpointTypes?.length) return undefined;

    const targets = endpointTypes.reduce<Record<string, PricingEndpointInfo>>((acc, type) => {
        const normalizedType = toTrimmedString(type);
        if (!normalizedType) return acc;

        const endpoint = lookup[normalizedType];
        if (endpoint) {
            acc[normalizedType] = endpoint;
        }
        return acc;
    }, {});

    return Object.keys(targets).length > 0 ? targets : undefined;
};

const normalizePricingCatalogRows = (pricingData: any[], payload?: any): any[] => {
    const vendorLookup = buildVendorLookup(payload);
    const endpointLookup = buildEndpointLookup(payload);

    return pricingData.map((item) => {
        if (!item || typeof item !== 'object') return item;

        const vendor = vendorLookup[toTrimmedString(item?.vendor_id ?? item?.vendorId) || ''];
        const endpointTypes = extractEndpointTypes(item);
        const endpointTargets = buildEndpointTargets(endpointTypes, endpointLookup);
        const provider = toTrimmedString(item?.provider ?? item?.provider_name ?? item?.providerName ?? vendor?.name);
        const providerLabel = toTrimmedString(item?.provider_label ?? item?.providerLabel ?? provider ?? vendor?.name);
        const providerLogo = toTrimmedString(item?.provider_logo ?? item?.providerLogo ?? vendor?.icon ?? item?.icon);
        const endpointType = toTrimmedString(item?.endpoint_type ?? item?.endpointType ?? endpointTypes?.[0]);
        const availableGroups = normalizeStringList(item?.available_groups ?? item?.availableGroups ?? item?.enable_groups ?? item?.enableGroups);
        const tags = normalizeStringList(item?.tags ?? item?.tag ?? item?.labels ?? item?.label);
        const description = toTrimmedString(item?.description);

        return {
            ...item,
            provider,
            provider_label: providerLabel,
            provider_logo: providerLogo,
            endpoint_type: endpointType,
            endpoint_types: endpointTypes,
            endpoint_targets: endpointTargets,
            available_groups: availableGroups,
            tags,
            description,
        };
    });
};

const isPricingLikeObject = (item: any): boolean => {
    if (!item || typeof item !== 'object' || Array.isArray(item)) return false;
    const keys = Object.keys(item).map((key) => key.toLowerCase());
    const hasModel = keys.some((key) => MODEL_KEYWORDS.some((token) => key.includes(token)));
    const hasPrice = keys.some((key) => PRICE_KEYWORDS.some((token) => key.includes(token)));
    return hasModel && hasPrice;
};

const collectPricingRowsFromPayload = (payload: any): any[][] => {
    const results: any[][] = [];
    const visited = new Set<any>();
    const stack: any[] = [payload];

    while (stack.length > 0) {
        const current = stack.pop();
        if (!current) continue;

        if (typeof current === 'object') {
            if (visited.has(current)) continue;
            visited.add(current);
        }

        if (Array.isArray(current)) {
            if (current.some(isPricingLikeObject)) {
                results.push(current);
                continue;
            }
            current.forEach((entry) => stack.push(entry));
        } else if (typeof current === 'object') {
            Object.values(current).forEach((value) => stack.push(value));
        }
    }

    return results;
};

const extractJsonAssignments = (scriptContent: string): string[] => {
    const blocks: string[] = [];
    for (const marker of JSON_ASSIGNMENT_MARKERS) {
        let cursor = scriptContent.indexOf(marker);
        while (cursor !== -1) {
            const equalsIndex = scriptContent.indexOf('=', cursor + marker.length);
            if (equalsIndex === -1) break;

            let start = equalsIndex + 1;
            while (start < scriptContent.length && /\s/.test(scriptContent[start])) start++;
            const firstChar = scriptContent[start];
            if (firstChar !== '{' && firstChar !== '[') {
                cursor = scriptContent.indexOf(marker, cursor + marker.length);
                continue;
            }

            let depth = 0;
            let end = start;
            let inString = false;
            let stringChar = '';

            while (end < scriptContent.length) {
                const char = scriptContent[end];
                if (inString) {
                    if (char === '\\') {
                        end += 2;
                        continue;
                    }
                    if (char === stringChar) {
                        inString = false;
                    }
                } else {
                    if (char === '"' || char === "'") {
                        inString = true;
                        stringChar = char;
                    } else if (char === '{' || char === '[') {
                        depth++;
                    } else if (char === '}' || char === ']') {
                        depth--;
                        if (depth === 0) {
                            end++;
                            break;
                        }
                    }
                }
                end++;
            }

            if (depth === 0) {
                const raw = scriptContent.slice(start, end).trim();
                if (raw) {
                    blocks.push(raw);
                }
            }

            cursor = scriptContent.indexOf(marker, end);
        }
    }
    return blocks;
};

const extractEmbeddedJsonBlocks = (html: string): string[] => {
    const blocks: string[] = [];
    const scriptRegex = /<script\b([^>]*)>([\s\S]*?)<\/script>/gi;
    let match: RegExpExecArray | null;

    while ((match = scriptRegex.exec(html)) !== null) {
        const attrs = match[1] || '';
        const content = (match[2] || '').trim();
        if (!content) continue;

        if (/id\s*=\s*"__NEXT_DATA__"/i.test(attrs) || /type\s*=\s*"application\/json"/i.test(attrs)) {
            blocks.push(content);
            continue;
        }

        if (JSON_ASSIGNMENT_MARKERS.some((marker) => content.includes(marker))) {
            blocks.push(...extractJsonAssignments(content));
        }
    }

    return blocks;
};

const scrapePricingFromHtml = (html: string): any[] => {
    const jsonBlocks = extractEmbeddedJsonBlocks(html);
    for (const block of jsonBlocks) {
        const parsed = safeJsonParse(block);
        if (!parsed) continue;
        const rows = collectPricingRowsFromPayload(parsed);
        if (rows.length > 0) {
            const flattened: any[] = [];
            const seen = new Set<string>();
            rows.forEach((row) => {
                if (!Array.isArray(row)) return;
                row.forEach((item) => {
                    if (!item || typeof item !== 'object') return;
                    const modelId = String((item as any).model || (item as any).model_id || (item as any).modelId || (item as any).id || '');
                    const key = modelId ? `${modelId}-${Object.keys(item).length}` : JSON.stringify(item).slice(0, 200);
                    if (seen.has(key)) return;
                    seen.add(key);
                    flattened.push(item);
                });
            });
            if (flattened.length > 0) {
                return flattened;
            }
        }
    }
    return [];
};

export function extractWuyinAsyncEndpointDetails(value: string): WuyinAsyncEndpointDetails | null {
    const raw = String(value || '').trim();
    if (!raw) return null;

    const directPathMatch = raw.match(WUYIN_ASYNC_ENDPOINT_RE);
    if (directPathMatch && !/^detail$/i.test(directPathMatch[1])) {
        const endpointPath = raw.replace(/\/+$/, '');
        return {
            endpointUrl: `${WUYIN_DEFAULT_ROOT_URL}${endpointPath}`,
            endpointPath,
            modelId: decodeURIComponent(directPathMatch[1]),
        };
    }

    const candidates = /^https?:\/\//i.test(raw) ? [raw] : [`https://${raw}`];
    for (const candidate of candidates) {
        try {
            const parsed = new URL(candidate);
            const endpointPath = parsed.pathname.replace(/\/+$/, '');
            const match = endpointPath.match(WUYIN_ASYNC_ENDPOINT_RE);
            if (!match || /^detail$/i.test(match[1])) continue;

            return {
                endpointUrl: `${parsed.protocol}//${parsed.host}${endpointPath}`,
                endpointPath,
                modelId: decodeURIComponent(match[1]),
            };
        } catch {
            continue;
        }
    }

    return null;
}

const createFallbackWuyinCatalogItem = (modelId: string): ModelPricingInfo => ({
    modelId,
    modelName: modelId,
    inputPrice: 0,
    outputPrice: 0,
    isPerToken: false,
    groupRatio: 1,
    currency: 'CNY',
    billingUnit: '次',
    displayPrice: '待手动设置',
    supportsGroups: false,
    endpointUrl: `${WUYIN_DEFAULT_ROOT_URL}/api/async/${modelId}`,
    endpointPath: `/api/async/${modelId}`,
});

export function extractWuyinModelIdFromBaseUrl(baseUrl: string): string | null {
    return extractWuyinAsyncEndpointDetails(baseUrl)?.modelId || null;
}

export function selectWuyinCatalogModels(baseUrl: string, pricingList: ModelPricingInfo[]): ModelPricingInfo[] {
    const endpointModelId = extractWuyinModelIdFromBaseUrl(baseUrl);
    if (!endpointModelId) {
        return pricingList;
    }

    const normalizedTarget = endpointModelId.trim().toLowerCase();
    const filtered = pricingList.filter((item) => {
        const candidateIds = [
            String(item.modelId || '').trim().toLowerCase(),
            String(item.modelName || '').trim().toLowerCase(),
        ].filter(Boolean);
        return candidateIds.includes(normalizedTarget);
    });

    if (filtered.length > 0) {
        return filtered;
    }

    return [createFallbackWuyinCatalogItem(endpointModelId)];
}

export function buildPricingEndpointCandidates(baseUrl: string): string[] {
    const cleanUrl = normalizePricingBaseUrl(baseUrl);
    if (!cleanUrl) return [];

    const rootUrl = cleanUrl.replace(/\/v1$/i, '');
    let originUrl = cleanUrl;

    try {
        const parsed = new URL(cleanUrl);
        originUrl = `${parsed.protocol}//${parsed.host}`;
    } catch {
        originUrl = rootUrl;
    }

    const baseCandidates = Array.from(new Set([
        cleanUrl,
        rootUrl,
        originUrl,
    ].filter(Boolean)));

    const suffixes = ['/pricing', '/pricing.html', '/models', '/api/pricing', '/price', '/api/price'];
    const candidates = baseCandidates.flatMap((candidate) =>
        suffixes.map((suffix) => `${candidate}${suffix}`)
    );

    return Array.from(new Set(candidates.filter(Boolean)));
}

function extractPricingPayload(payload: any): { pricingData: any[]; groupRatio: Record<string, number> } {
    const pricingData = Array.isArray(payload?.data)
        ? payload.data
        : Array.isArray(payload?.prices)
            ? payload.prices
            : Array.isArray(payload?.models)
                ? payload.models
                : Array.isArray(payload?.data?.items)
                    ? payload.data.items
                    : [];

    const groupRatio = (payload?.group_ratio || payload?.groupRatio || payload?.data?.group_ratio || {}) as Record<string, number>;
    return {
        pricingData: normalizePricingCatalogRows(pricingData, payload),
        groupRatio,
    };
}

function resolvePricingRequestRuntime(baseUrl: string, format: ApiProtocolFormat = 'auto') {
    const runtime = resolveProviderRuntime({ baseUrl, format, fallbackFormat: 'openai' });

    // Pricing endpoints are management routes and typically expect the provider's
    // default auth scheme, even when generation is configured in Gemini mode.
    if (runtime.pricingSupport === 'native' && runtime.protocolFamily === 'gemini-native') {
        return resolveProviderRuntime({ baseUrl, format: 'openai', fallbackFormat: 'openai' });
    }

    return runtime;
}

function buildPricingHeaders(baseUrl: string, apiKey?: string, format: ApiProtocolFormat = 'auto'): Record<string, string> {
    const headers: Record<string, string> = {
        Accept: 'application/json',
        'Content-Type': 'application/json',
    };

    const token = String(apiKey || '').trim();
    if (!token) return headers;

    const runtime = resolvePricingRequestRuntime(baseUrl, format);
    if (runtime.authMethod === 'query') {
        return headers;
    }

    const headerName = runtime.headerName || 'Authorization';
    headers[headerName] = headerName === 'Authorization'
        ? formatAuthorizationHeaderValue(token, runtime.authorizationValueFormat)
        : getApiKeyToken(token);

    return headers;
}

function buildPricingRequestUrl(endpointUrl: string, baseUrl: string, apiKey?: string, format: ApiProtocolFormat = 'auto'): string {
    const token = String(apiKey || '').trim();
    if (!token) return endpointUrl;

    const runtime = resolvePricingRequestRuntime(baseUrl, format);
    if (runtime.authMethod !== 'query') {
        return endpointUrl;
    }

    const separator = endpointUrl.includes('?') ? '&' : '?';
    return `${endpointUrl}${separator}key=${encodeURIComponent(getApiKeyToken(token))}`;
}

async function fetchPricingViaProxy(baseUrl: string): Promise<RawPricingCatalogResult | null> {
    if (typeof window === 'undefined') return null;

    const proxyUrl = '/api/pricing-proxy';
    const normalizedBaseUrl = normalizePricingBaseUrl(baseUrl);

    try {
        const response = await fetch(proxyUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ baseUrl }),
        });

        const text = await response.text();
        const payload = safeJsonParse(text);
        const pricingData = Array.isArray(payload?.data) ? payload.data : [];
        if (!response.ok || pricingData.length === 0) {
            return {
                endpointUrl: `${normalizedBaseUrl}/pricing`,
                pricingData: [],
                groupRatio: {},
                source: 'direct',
                supportsGroups: false,
                error: typeof payload?.error === 'string' && payload.error.trim()
                    ? payload.error.trim()
                    : (response.ok ? '价格代理没有返回任何模型数据。' : `价格代理返回 ${response.status}`),
                attemptedUrls: [proxyUrl],
            };
        }

        const groupRatio = payload?.group_ratio && typeof payload.group_ratio === 'object'
            ? payload.group_ratio as Record<string, number>
            : {};

        return {
            endpointUrl: `${normalizePricingBaseUrl(baseUrl)}/pricing`,
            pricingData: normalizePricingCatalogRows(pricingData, payload),
            groupRatio,
            source: 'direct',
            supportsGroups: true,
            attemptedUrls: [proxyUrl],
        };
    } catch (error) {
        console.warn('[NewApiPricing] Pricing proxy fallback failed:', error);
        return {
            endpointUrl: `${normalizedBaseUrl}/pricing`,
            pricingData: [],
            groupRatio: {},
            source: 'direct',
            supportsGroups: false,
            error: error instanceof Error ? error.message : '价格代理请求失败。',
            attemptedUrls: [proxyUrl],
        };
    }
}

function toWuyinPricingRows(pricingList: ModelPricingInfo[]): any[] {
    return pricingList.map((item) => ({
        model: item.modelId,
        model_name: item.modelName,
        billing_type: 'per_request',
        quota_type: 'per_request',
        per_request_price: item.inputPrice,
        price_per_image: item.inputPrice,
        currency: item.currency,
        pay_unit: item.billingUnit,
        display_price: item.displayPrice,
        endpoint_url: item.endpointUrl,
        endpoint_path: item.endpointPath,
    }));
}

export async function fetchRawPricingCatalog(
    baseUrl: string,
    apiKey?: string,
    format: ApiProtocolFormat = 'auto'
): Promise<RawPricingCatalogResult | null> {
    const cleanUrl = normalizePricingBaseUrl(baseUrl);
    if (!cleanUrl) return null;

    const runtime = resolveProviderRuntime({ baseUrl: cleanUrl, format });

    if (runtime.strategyId === 'wuyinkeji') {
        // 简体中文注释：直接获取五音科技下的全量定价模型，不再按 baseUrl 的后缀进行过滤限制，确保获取到全部产品后缀
        const pricingList = await fetchWuyinPricingCatalog(cleanUrl);
        const rootUrl = runtime.host === 'api.wuyinkeji.com' ? 'https://api.wuyinkeji.com' : cleanUrl;
        return {
            endpointUrl: `${rootUrl}${WUYIN_PRICE_API_PATH}`,
            pricingData: toWuyinPricingRows(pricingList),
            groupRatio: {},
            source: 'wuyinkeji',
            supportsGroups: false,
        };
    }

    let lastError = '';
    const attemptedUrls: string[] = [];

    if (typeof window !== 'undefined') {
        const proxied = await fetchPricingViaProxy(cleanUrl);
        if (proxied?.pricingData?.length) {
            return proxied;
        }
        if (proxied?.attemptedUrls?.length) {
            attemptedUrls.push(...proxied.attemptedUrls);
        }
        if (proxied?.error) {
            lastError = proxied.error;
        }
    }

    const candidateUrls = buildPricingEndpointCandidates(cleanUrl);
    const headers = buildPricingHeaders(cleanUrl, apiKey, format);

    for (const endpointUrl of candidateUrls) {
        attemptedUrls.push(endpointUrl);
        try {
            const response = await fetch(buildPricingRequestUrl(endpointUrl, cleanUrl, apiKey, format), {
                method: 'GET',
                headers,
            });

            if (!response.ok) {
                console.warn(`[NewApiPricing] Pricing endpoint ${endpointUrl} returned ${response.status}`);
                lastError = `${endpointUrl} 返回 ${response.status}`;
                continue;
            }

            const text = await response.text();
            const trimmed = text.trimStart();
            if (!trimmed) {
                console.warn(`[NewApiPricing] Pricing endpoint ${endpointUrl} returned empty payload`);
                lastError = `${endpointUrl} 返回空响应`;
                continue;
            }

            if (trimmed.startsWith('<!') || trimmed.startsWith('<html')) {
                const scraped = normalizePricingCatalogRows(scrapePricingFromHtml(text));
                if (scraped.length > 0) {
                    console.info(`[NewApiPricing] Scraped ${scraped.length} pricing entries from ${endpointUrl} markup.`);
                    return {
                        endpointUrl,
                        pricingData: scraped,
                        groupRatio: {},
                        source: 'direct',
                        supportsGroups: false,
                        attemptedUrls,
                    };
                }
                console.warn(`[NewApiPricing] Pricing endpoint ${endpointUrl} returned HTML without embedded pricing data`);
                lastError = `${endpointUrl} 返回了 HTML 页面，但页面里没有可解析的价格数据`;
                continue;
            }

            const payload = safeJsonParse(trimmed);
            if (!payload) {
                console.warn(`[NewApiPricing] Pricing endpoint ${endpointUrl} returned invalid JSON`);
                const scraped = normalizePricingCatalogRows(scrapePricingFromHtml(text));
                if (scraped.length > 0) {
                    console.info(`[NewApiPricing] Scraped ${scraped.length} pricing entries from ${endpointUrl} fallback markup.`);
                    return {
                        endpointUrl,
                        pricingData: scraped,
                        groupRatio: {},
                        source: 'direct',
                        supportsGroups: false,
                        attemptedUrls,
                    };
                }
                lastError = `${endpointUrl} 返回内容不是有效 JSON`;
                continue;
            }

            const { pricingData, groupRatio } = extractPricingPayload(payload);
            if (!pricingData.length) {
                console.warn(`[NewApiPricing] Pricing endpoint ${endpointUrl} returned empty pricing data`);
                lastError = `${endpointUrl} 没有返回任何价格模型`;
                continue;
            }

            return {
                endpointUrl,
                pricingData,
                groupRatio,
                source: 'direct',
                supportsGroups: true,
                attemptedUrls,
            };
        } catch (error) {
            console.warn(`[NewApiPricing] Pricing endpoint ${endpointUrl} failed:`, error);
            lastError = `${endpointUrl} 请求失败：${error instanceof Error ? error.message : '未知错误'}`;
        }
    }

    if (typeof window !== 'undefined') {
        const proxied = await fetchPricingViaProxy(cleanUrl);
        if (proxied?.pricingData?.length) {
            return proxied;
        }
        if (proxied?.attemptedUrls?.length) {
            attemptedUrls.push(...proxied.attemptedUrls.filter((url) => !attemptedUrls.includes(url)));
        }
        if (proxied?.error) {
            lastError = proxied.error;
        }
    }

    return {
        endpointUrl: `${cleanUrl}/pricing`,
        pricingData: [],
        groupRatio: {},
        source: 'direct',
        supportsGroups: false,
        error: lastError || '未找到可用的价格接口或页面数据。',
        attemptedUrls,
    };
}

/**
 * Fetch pricing from NewAPI Pro compatible provider
 * The system access token is only used once and not stored
 */
export async function fetchProviderPricing(
    baseUrl: string,
    systemAccessToken: string
): Promise<ModelPricingInfo[]> {
    try {
        const runtime = resolveProviderRuntime({ baseUrl, format: 'openai' });
        if (runtime.strategyId === 'wuyinkeji') {
            // 简体中文注释：对于五音科技（wuyinkeji），直接拉取全量模型的最新计费价格，不再按 baseUrl 的模型后缀做过滤限制
            return await fetchWuyinPricingCatalog(baseUrl);
        }

        // NewAPI Pro pricing endpoint
        const pricingUrl = `${baseUrl.replace(/\/$/, '')}/api/pricing`;
        
        const response = await fetch(pricingUrl, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${systemAccessToken}`,
                'Content-Type': 'application/json'
            }
        });

        if (!response.ok) {
            const error = await response.text();
            throw new Error(`Failed to fetch pricing: ${error}`);
        }

        const data = await response.json();
        
        // Parse NewAPI Pro response format
        if (data.data && Array.isArray(data.data)) {
            return data.data.map((item: any) => ({
                modelId: item.model || '',
                modelName: item.model_name || item.model || '',
                inputPrice: parseFloat(item.input_price) || 0,
                outputPrice: parseFloat(item.output_price) || 0,
                isPerToken: item.type === 'tokens' || (!item.type && item.input_price > 0),
                groupRatio: parseFloat(item.group_ratio) || 1.0,
                currency: item.currency || 'USD',
                billingUnit: item.type === 'tokens' || (!item.type && item.input_price > 0) ? '1M tokens' : 'request',
                supportsGroups: true,
            }));
        }

        return [];
    } catch (error) {
        console.error('[NewApiPricing] Error fetching pricing:', error);
        throw error;
    }
}

/**
 * Fetch available models from provider
 */
export async function fetchProviderModels(
    baseUrl: string,
    apiKey: string,
    format: ApiProtocolFormat | 'claude' = 'openai'
): Promise<string[]> {
    try {
        const resolvedFormat = resolveApiProtocolFormat(format, baseUrl);
        const runtime = resolveProviderRuntime({
            baseUrl,
            format: resolvedFormat === 'gemini' ? 'gemini' : format,
        });
        if (runtime.strategyId === 'wuyinkeji') {
            // 简体中文注释：直接获取五音科技下的全量模型后缀，保证用户可以选择任意模型
            const catalog = await fetchWuyinPricingCatalog(baseUrl);
            return catalog.map((item) => item.modelId).filter(Boolean);
        }
        const geminiAuthMethod = runtime.authMethod as 'query' | 'header';
        const response = await fetch(
            resolvedFormat === 'gemini'
                ? buildGeminiModelsEndpoint(baseUrl, apiKey, geminiAuthMethod)
                : applyOpenAICompatAuthToUrl(
                    buildOpenAIEndpoint(baseUrl, 'models'),
                    runtime.authMethod as 'query' | 'header',
                    apiKey,
                ),
            {
                method: 'GET',
                headers: resolvedFormat === 'gemini'
                    ? buildGeminiHeaders(geminiAuthMethod, apiKey, runtime.headerName, runtime.authorizationValueFormat)
                    : buildProxyHeaders(runtime.authMethod as 'query' | 'header', apiKey, runtime.headerName, undefined, runtime.authorizationValueFormat)
            }
        );

        if (!response.ok) {
            return [];
        }

        const data = await response.json();
        
        const models = Array.isArray(data.data) ? data.data : Array.isArray(data.models) ? data.models : [];

        if (models.length > 0) {
            return models
                .map((m: any) => (m.id || m.model || m.name || '').replace(/^models\//i, ''))
                .filter(Boolean);
        }

        return [];
    } catch (error) {
        console.error('[NewApiPricing] Error fetching models:', error);
        return [];
    }
}

type WuyinCatalogResponse = {
    code?: number;
    msg?: string;
    data?: {
        api_list?: Array<{
            id?: string | number;
            name?: string;
            url?: string;
            price?: string;
            balance_sum?: string | number;
            pay_unit?: string;
            api_type?: string | number;
            tags?: string[];
        }>;
    };
};

type WuyinCatalogItem = NonNullable<NonNullable<WuyinCatalogResponse['data']>['api_list']>[number];

const WUYIN_PRICE_API_PATH = '/themes/DigitalBlue/api?action=api_list';

const normalizeBaseUrl = (baseUrl: string) => baseUrl.replace(/\/$/, '');

const stripHtml = (value: string) => value.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();

const toFiniteNumber = (value: unknown): number | undefined => {
    if (typeof value === 'number' && Number.isFinite(value)) return value;
    if (typeof value === 'string' && value.trim() !== '') {
        const parsed = Number(value);
        if (Number.isFinite(parsed)) return parsed;
    }
    return undefined;
};

const extractWuyinDisplayPrice = (item: WuyinCatalogItem) => {
    const unit = String(item?.pay_unit || '').trim() || '次';
    const text = stripHtml(String(item?.price || ''));
    const priceMatch = text.match(/([0-9]+(?:\.[0-9]+)?)/);
    const numeric = toFiniteNumber(item?.balance_sum) ?? (priceMatch ? Number(priceMatch[1]) : undefined) ?? 0;
    const displayPrice = numeric > 0 ? `${numeric}元/${unit}` : (text || `0元/${unit}`);
    return {
        numeric,
        unit,
        displayPrice,
    };
};

export async function fetchWuyinPricingCatalog(baseUrl: string): Promise<ModelPricingInfo[]> {
    const runtime = resolveProviderRuntime({ baseUrl, format: 'openai' });
    const rootUrl = runtime.host === 'api.wuyinkeji.com'
        ? 'https://api.wuyinkeji.com'
        : normalizeBaseUrl(baseUrl);

    const response = await fetch(`${rootUrl}${WUYIN_PRICE_API_PATH}`, {
        method: 'GET',
        headers: {
            'Accept': 'application/json',
        },
    });

    if (!response.ok) {
        throw new Error(`Failed to fetch Wuyin pricing catalog: HTTP ${response.status}`);
    }

    const data = await response.json() as WuyinCatalogResponse;
    const apiList: WuyinCatalogItem[] = Array.isArray(data?.data?.api_list)
        ? data.data.api_list
        : [];

    return apiList.map((item) => {
        const { numeric, unit, displayPrice } = extractWuyinDisplayPrice(item);
        const endpoint = extractWuyinAsyncEndpointDetails(String(item?.url || '').trim());
        const modelId =
            endpoint?.modelId ||
            String(item?.name || '').trim() ||
            String(item?.id || '').trim();

        return {
            modelId,
            modelName: String(item?.name || modelId).trim(),
            inputPrice: numeric,
            outputPrice: 0,
            isPerToken: false,
            groupRatio: 1,
            currency: 'CNY',
            billingUnit: unit,
            displayPrice,
            supportsGroups: false,
            endpointUrl: endpoint?.endpointUrl,
            endpointPath: endpoint?.endpointPath,
        };
    }).filter((item) => item.modelId);
}

/**
 * Calculate cost for a request
 */
export function calculateRequestCost(
    pricing: ModelPricingInfo,
    inputTokens: number,
    outputTokens: number
): number {
    if (!pricing.isPerToken) {
        // Per request pricing
        return pricing.inputPrice;
    }

    // Per token pricing (prices are per 1M tokens)
    const inputCost = (inputTokens / 1_000_000) * pricing.inputPrice;
    const outputCost = (outputTokens / 1_000_000) * pricing.outputPrice;
    
    // Apply group ratio
    const ratio = pricing.groupRatio || 1.0;
    return (inputCost + outputCost) * ratio;
}

function toCachedPricingItemDto(pricing: ModelPricingInfo) {
    return {
        modelId: String(pricing.modelId || '').trim(),
        modelName: String(pricing.modelName || pricing.modelId || '').trim(),
        inputPrice: Math.max(0, toFiniteNumber(pricing.inputPrice) ?? 0),
        outputPrice: Math.max(0, toFiniteNumber(pricing.outputPrice) ?? 0),
        isPerToken: pricing.isPerToken !== false,
        groupRatio: Math.max(0, toFiniteNumber(pricing.groupRatio) ?? 1),
        currency: String(pricing.currency || 'USD').trim() || 'USD',
        billingUnit: toTrimmedString(pricing.billingUnit),
        displayPrice: toTrimmedString(pricing.displayPrice),
        supportsGroups: pricing.supportsGroups === true,
        endpointUrl: toTrimmedString(pricing.endpointUrl),
        endpointPath: toTrimmedString(pricing.endpointPath),
    };
}

function mapCachedPricingItem(item: Partial<ModelPricingInfo>): ModelPricingInfo {
    return {
        modelId: String(item.modelId || '').trim(),
        modelName: String(item.modelName || item.modelId || '').trim(),
        inputPrice: Math.max(0, toFiniteNumber(item.inputPrice) ?? 0),
        outputPrice: Math.max(0, toFiniteNumber(item.outputPrice) ?? 0),
        isPerToken: item.isPerToken !== false,
        groupRatio: Math.max(0, toFiniteNumber(item.groupRatio) ?? 1),
        currency: String(item.currency || 'USD').trim() || 'USD',
        billingUnit: toTrimmedString(item.billingUnit),
        displayPrice: toTrimmedString(item.displayPrice),
        supportsGroups: item.supportsGroups === true,
        endpointUrl: toTrimmedString(item.endpointUrl),
        endpointPath: toTrimmedString(item.endpointPath),
    };
}

/**
 * Save pricing info to the typed admin API cache
 */
export async function cacheProviderPricing(
    providerId: string,
    pricing: ModelPricingInfo[]
): Promise<void> {
    try {
        const response = await kkWebApiClient.upsertAdminCreditProviderPricingCache(
            providerId,
            {
                pricing: pricing.map((item) => toCachedPricingItemDto(item)),
            },
            {
                requestId: `provider-pricing-cache-upsert-${providerId}-${Date.now()}`,
            },
        );

        if (!response.success) {
            console.error('[NewApiPricing] Error caching pricing:', response.error?.message || 'Unknown error');
        }
    } catch (e) {
        console.error('[NewApiPricing] Error:', e);
    }
}

export async function cacheProviderPricingByBaseUrl(
    baseUrl: string,
    pricing: ModelPricingInfo[]
): Promise<void> {
    const normalizedBaseUrl = normalizePricingBaseUrl(baseUrl);
    if (!normalizedBaseUrl) {
        return;
    }

    try {
        const response = await kkWebApiClient.upsertSharedProviderPricingCache(
            normalizedBaseUrl,
            {
                pricing: pricing.map((item) => toCachedPricingItemDto(item)),
            },
            {
                requestId: `shared-provider-pricing-cache-upsert-${Date.now()}`,
            },
        );

        if (!response.success) {
            console.error('[NewApiPricing] Error caching shared pricing by baseUrl:', response.error?.message || 'Unknown error');
        }
    } catch (e) {
        console.error('[NewApiPricing] Error caching shared pricing by baseUrl:', e);
    }
}

/**
 * Get cached pricing
 */
export async function getCachedPricing(
    providerId: string
): Promise<ModelPricingInfo[] | null> {
    try {
        const response = await kkWebApiClient.getAdminCreditProviderPricingCache(
            providerId,
            {
                requestId: `provider-pricing-cache-get-${providerId}-${Date.now()}`,
            },
        );

        if (!response.success) return null;
        return Array.isArray(response.data.pricing)
            ? response.data.pricing.map((item) => mapCachedPricingItem(item))
            : [];
    } catch (e) {
        return null;
    }
}

export async function getCachedPricingByBaseUrl(
    baseUrl: string
): Promise<ModelPricingInfo[] | null> {
    const normalizedBaseUrl = normalizePricingBaseUrl(baseUrl);
    if (!normalizedBaseUrl) {
        return null;
    }

    try {
        const response = await kkWebApiClient.getSharedProviderPricingCache(
            normalizedBaseUrl,
            {
                requestId: `shared-provider-pricing-cache-get-${Date.now()}`,
            },
        );

        if (!response.success) return null;
        return Array.isArray(response.data.pricing)
            ? response.data.pricing.map((item) => mapCachedPricingItem(item))
            : [];
    } catch (e) {
        return null;
    }
}
