import { extractRefImageData } from './LLMAdapter.ts';
import type { ProviderPricingSnapshot } from '../auth/providerPricingSnapshot';

type WuyinImageRoute = {
    endpointPath: string;
    aliases: string[];
};

export type WuyinResolvedRoute = {
    endpointPath: string;
    endpointModelId: string;
    endpointUrl?: string;
};

export type WuyinProviderSnapshotSource = {
    pricingSnapshot?: ProviderPricingSnapshot | null;
};

type PricingEntry = Record<string, unknown>;

export const WUYIN_DEFAULT_BASE_URL = 'https://api.wuyinkeji.com';
export const WUYIN_DETAIL_PATH = '/api/async/detail';

const WUYIN_IMAGE_ROUTES: WuyinImageRoute[] = [
    {
        endpointPath: '/api/async/image_gpt',
        aliases: [
            'image_gpt',
            'gpt-image-2',
            'gpt image 2',
            'gptimage2',
            'GPT-Image-2',
        ],
    },
    {
        endpointPath: '/api/async/image_nanoBanana2',
        aliases: [
            'image_nanobanana2',
            'nanobanana2',
            'nano-banana-2',
            'nano banana 2',
            'gemini-3.1-flash-image-preview',
            'gemini-3.1-flash-image',
        ],
    },
    {
        endpointPath: '/api/async/image_nanoBanana_pro',
        aliases: [
            'image_nanobanana_pro',
            'nanobanana_pro',
            'nanobananapro',
            'nano-banana-pro',
            'nano banana pro',
            'gemini-3-pro-image-preview',
            'gemini-3-pro-image',
        ],
    },
    {
        endpointPath: '/api/async/image_nanoBanana',
        aliases: [
            'image_nanobanana',
            'nanobanana',
            'nano-banana',
            'nano banana',
            'gemini-2.5-flash-image',
            'gemini-2.0-flash-exp-image-generation',
        ],
    },
    {
        endpointPath: '/api/async/image_grok_imagine',
        aliases: [
            'image_grok_imagine',
            'grok_imagine',
            'grok-imagine',
            'grok imagine',
        ],
    },
    {
        endpointPath: '/api/async/image_sora',
        aliases: [
            'image_sora',
            'sora',
        ],
    },
    {
        endpointPath: '/api/async/image_wan2.6',
        aliases: [
            'image_wan2.6',
            'image_wan26',
            'wan2.6',
            'wan26',
            'wan2.6 image',
            'wan image',
        ],
    },
];

const WUYIN_SUPPORTED_ASPECT_RATIOS = new Set([
    'auto',
    '1:1',
    '16:9',
    '9:16',
    '4:3',
    '3:4',
    '3:2',
    '2:3',
    '5:4',
    '4:5',
    '21:9',
]);
const WUYIN_AUTO_ASPECT_RATIO = 'auto';

function asRecord(value: unknown): Record<string, unknown> | null {
    return value !== null && typeof value === 'object' && !Array.isArray(value)
        ? value as Record<string, unknown>
        : null;
}

function getObjectProperty(value: unknown, key: string): unknown {
    return asRecord(value)?.[key];
}

function readString(entry: PricingEntry, ...keys: string[]): string {
    for (const key of keys) {
        const value = entry[key];
        if (typeof value === 'string' && value.trim()) {
            return value.trim();
        }
    }
    return '';
}

function normalizeRawModelId(modelId: string): string {
    return String(modelId || '').trim().split('@')[0].split('|')[0].trim();
}

export function normalizeWuyinBaseUrl(baseUrl: string): string {
    const raw = String(baseUrl || '').trim();
    if (!raw) return WUYIN_DEFAULT_BASE_URL;

    const withProtocol = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;

    try {
        const parsed = new URL(withProtocol);
        if (/^api\.wuyinkeji\.com$/i.test(parsed.hostname)) {
            return `${parsed.protocol}//${parsed.host}`;
        }

        const sanitizedPath = parsed.pathname
            .replace(/\/+(doc\/\d+)?$/i, '')
            .replace(/\/+(api\/async\/[a-z0-9_.-]+)$/i, '')
            .replace(/\/+$/, '');
        return `${parsed.protocol}//${parsed.host}${sanitizedPath}`;
    } catch {
        return WUYIN_DEFAULT_BASE_URL;
    }
}

export function extractWuyinDirectEndpointPath(baseUrl: string): string | null {
    const raw = String(baseUrl || '').trim();
    if (!raw) return null;

    const candidates = /^https?:\/\//i.test(raw) ? [raw] : [`https://${raw}`];
    for (const candidate of candidates) {
        try {
            const parsed = new URL(candidate);
            const pathname = parsed.pathname.replace(/\/+$/, '');
            if (/^\/api\/async\/[a-z0-9_.-]+$/i.test(pathname)) {
                return pathname;
            }
        } catch {
            continue;
        }
    }

    return null;
}

export function normalizeWuyinAlias(value: string): string {
    return String(value || '')
        .trim()
        .toLowerCase()
        .replace(/^models\//i, '')
        .replace(/\|.*$/, '')
        .replace(/@.*$/, '')
        .replace(/[^a-z0-9]+/g, '');
}

export function resolveWuyinSnapshotRoute(
    provider: WuyinProviderSnapshotSource | null | undefined,
    modelId: string
): WuyinResolvedRoute | null {
    const pricingSnapshot = provider?.pricingSnapshot;
    if (!pricingSnapshot) return null;

    const rawModelId = normalizeRawModelId(modelId);
    const normalizedTarget = rawModelId.toLowerCase();
    const normalizedAlias = normalizeWuyinAlias(rawModelId);
    const pricingEntries: unknown[] = [
        ...(Array.isArray(pricingSnapshot._rawData) ? pricingSnapshot._rawData : []),
        ...(Array.isArray(pricingSnapshot.rows) ? pricingSnapshot.rows : []),
    ];

    for (const rawEntry of pricingEntries) {
        if (!rawEntry || typeof rawEntry !== 'object' || Array.isArray(rawEntry)) continue;
        const entry = rawEntry as PricingEntry;
        const endpointUrl = readString(entry, 'endpoint_url', 'endpointUrl');
        const endpointPath =
            readString(entry, 'endpoint_path', 'endpointPath') ||
            extractWuyinDirectEndpointPath(endpointUrl) ||
            '';
        if (!endpointPath) continue;

        const entryModel = readString(entry, 'model', 'model_id', 'modelId', 'model_name', 'modelName', 'id');
        const endpointModelId = endpointPath.split('/').filter(Boolean).pop() || entryModel || rawModelId;
        const modelCandidates = [entryModel, endpointModelId].filter(Boolean);
        const matched = modelCandidates.some((candidate) => {
            const normalizedCandidate = candidate.toLowerCase();
            return normalizedCandidate === normalizedTarget || normalizeWuyinAlias(candidate) === normalizedAlias;
        });
        if (!matched) continue;

        return {
            endpointPath,
            endpointModelId,
            endpointUrl: endpointUrl || undefined,
        };
    }

    return null;
}

export function resolveWuyinImageEndpoint(modelId: string): WuyinResolvedRoute {
    const rawModelId = normalizeRawModelId(modelId);
    const endpointModelId = rawModelId.replace(/^\/+/, '');
    const normalized = normalizeWuyinAlias(rawModelId);

    if (/^apiasyncimage[a-z0-9]+$/i.test(normalized)) {
        const suffix = rawModelId.replace(/^\/+/, '').replace(/^api\/async\//i, '');
        return {
            endpointPath: `/api/async/${suffix}`,
            endpointModelId: suffix,
        };
    }

    if (/^image[a-z0-9]+$/i.test(normalized) && !normalized.startsWith('images')) {
        return {
            endpointPath: `/api/async/${endpointModelId}`,
            endpointModelId,
        };
    }

    const matchedRoute = WUYIN_IMAGE_ROUTES.find((route) =>
        route.aliases.some((alias) => normalizeWuyinAlias(alias) === normalized)
    );
    if (matchedRoute) {
        return {
            endpointPath: matchedRoute.endpointPath,
            endpointModelId: matchedRoute.endpointPath.split('/').pop() || endpointModelId,
        };
    }

    if (normalized.includes('grok') && normalized.includes('imagine')) {
        return {
            endpointPath: '/api/async/image_grok_imagine',
            endpointModelId: 'image_grok_imagine',
        };
    }
    if (normalized.includes('sora')) {
        return {
            endpointPath: '/api/async/image_sora',
            endpointModelId: 'image_sora',
        };
    }
    if (normalized.includes('31flashimage') || normalized.includes('nanobanana2')) {
        return {
            endpointPath: '/api/async/image_nanoBanana2',
            endpointModelId: 'image_nanoBanana2',
        };
    }
    if (normalized.includes('proimage') || normalized.includes('nanobananapro')) {
        return {
            endpointPath: '/api/async/image_nanoBanana_pro',
            endpointModelId: 'image_nanoBanana_pro',
        };
    }
    if (normalized.includes('25flashimage') || normalized.includes('nanobanana')) {
        return {
            endpointPath: '/api/async/image_nanoBanana',
            endpointModelId: 'image_nanoBanana',
        };
    }

    throw new Error(`Wuyin provider does not know how to route image model "${modelId}". Please use the exact Wuyin model ID from the catalog, such as image_nanoBanana2.`);
}

export function resolveWuyinRequestRoute(input: {
    baseUrl: string;
    modelId: string;
    provider?: WuyinProviderSnapshotSource | null;
}): WuyinResolvedRoute {
    // 简体中文注释：检查 baseUrl 是否为五音科技的通用异步端点前缀（即去掉末尾斜杠后为 /api/async）。
    const cleanBaseUrl = normalizeWuyinBaseUrl(input.baseUrl);
    try {
        const parsedBase = new URL(cleanBaseUrl);
        const baseRoutePath = parsedBase.pathname.replace(/\/+$/, '');
        if (baseRoutePath === '/api/async') {
            const rawModelId = normalizeRawModelId(input.modelId);
            const endpointModelId = rawModelId.replace(/^\/+/, '').replace(/^api\/async\//i, '');
            return {
                endpointPath: `/api/async/${endpointModelId}`,
                endpointModelId,
            };
        }
    } catch {
        // 忽略 URL 解析错误并回退到默认逻辑
    }

    const directEndpointPath = extractWuyinDirectEndpointPath(input.baseUrl);
    if (directEndpointPath) {
        // 简体中文注释：即便用户在 baseUrl 中配置了带特定模型后缀的地址，仍需根据当前请求所选的 modelId 动态拼接出目标接口，以保证多模型切换可用
        const rawModelId = normalizeRawModelId(input.modelId);
        const endpointModelId = rawModelId.replace(/^\/+/, '').replace(/^api\/async\//i, '');
        return {
            endpointPath: `/api/async/${endpointModelId}`,
            endpointModelId,
        };
    }

    const snapshotRoute = resolveWuyinSnapshotRoute(input.provider, input.modelId);
    return snapshotRoute || resolveWuyinImageEndpoint(input.modelId);
}

export function normalizeWuyinImageSize(raw: string | undefined): '1K' | '2K' | '4K' {
    const normalized = String(raw || '').trim().toUpperCase();
    if (normalized.includes('4K') || normalized.includes('HD')) return '4K';
    if (normalized.includes('2K')) return '2K';
    return '1K';
}

export function normalizeWuyinAspectRatio(raw: string | undefined): string {
    const normalized = String(raw || '').trim() || WUYIN_AUTO_ASPECT_RATIO;
    return WUYIN_SUPPORTED_ASPECT_RATIOS.has(normalized) ? normalized : WUYIN_AUTO_ASPECT_RATIO;
}

export function normalizeWuyinReferenceImage(
    ref: string | { data: string; mimeType: string; url?: string },
    index: number
): { value: string; kind: 'url' | 'base64' } {
    const sourceUrl = typeof (ref as { url?: string })?.url === 'string'
        ? String((ref as { url?: string }).url || '').trim()
        : '';
    if (/^https?:\/\//i.test(sourceUrl)) {
        return { value: sourceUrl, kind: 'url' };
    }

    const { data } = extractRefImageData(ref);
    const raw = String(data || '').trim();
    if (!raw) {
        throw new Error(`五音参考图 ${index + 1} 为空，请重新上传后再试`);
    }

    if (/^https?:\/\//i.test(raw)) {
        return { value: raw, kind: 'url' };
    }

    if (/^blob:/i.test(raw)) {
        throw new Error(`五音参考图 ${index + 1} 仍是本地预览地址（blob），请等待图片处理完成后再试`);
    }

    if (/^data:/i.test(raw)) {
        const commaIndex = raw.indexOf(',');
        if (commaIndex === -1) {
            throw new Error(`五音参考图 ${index + 1} 不是有效的 Base64 数据`);
        }
        const base64 = raw.slice(commaIndex + 1).replace(/\s+/g, '');
        if (!base64) {
            throw new Error(`五音参考图 ${index + 1} 的 Base64 数据为空`);
        }
        return { value: base64, kind: 'base64' };
    }

    const cleaned = raw.replace(/\s+/g, '');
    if (!cleaned) {
        throw new Error(`五音参考图 ${index + 1} 不是有效的 URL 或 Base64 数据`);
    }

    return { value: cleaned, kind: 'base64' };
}

export function extractWuyinTaskId(payload: unknown): string {
    const data = getObjectProperty(payload, 'data');
    if (typeof data === 'string' && data.trim()) {
        return data.trim();
    }
    const rootId = getObjectProperty(payload, 'id') || getObjectProperty(payload, 'task_id') || getObjectProperty(payload, 'taskId');
    if (typeof rootId === 'string' && rootId.trim()) {
        return rootId.trim();
    }
    if (typeof rootId === 'number') {
        return String(rootId);
    }
    
    const dataId = getObjectProperty(data, 'id') || getObjectProperty(data, 'task_id') || getObjectProperty(data, 'taskId');
    if (typeof dataId === 'string' && dataId.trim()) {
        return dataId.trim();
    }
    if (typeof dataId === 'number') {
        return String(dataId);
    }
    
    return '';
}

export function extractWuyinStatusCode(payload: unknown): number | string | undefined {
    const data = getObjectProperty(payload, 'data');
    const value = getObjectProperty(data, 'status') ?? getObjectProperty(payload, 'status');
    if (value === undefined || value === null) return undefined;
    if (typeof value === 'number' && Number.isFinite(value)) return value;
    if (typeof value === 'string' && value.trim() !== '') {
        const trimmed = value.trim();
        const parsed = Number(trimmed);
        if (Number.isFinite(parsed)) return parsed;
        return trimmed;
    }
    return undefined;
}

export function mapWuyinStatus(statusCode: number | string | undefined): 'pending' | 'processing' | 'success' | 'failed' {
    if (statusCode === undefined || statusCode === null) return 'pending';
    
    if (typeof statusCode === 'number') {
        if (statusCode === 2) return 'success';
        if (statusCode === 3) return 'failed';
        if (statusCode === 1) return 'processing';
        return 'pending';
    }
    
    const word = String(statusCode).trim().toLowerCase();
    if (word === 'success' || word === 'succeeded' || word === 'done' || word === '2') {
        return 'success';
    }
    if (word === 'failed' || word === 'fail' || word === 'error' || word === '3') {
        return 'failed';
    }
    if (word === 'processing' || word === 'running' || word === '1') {
        return 'processing';
    }
    return 'pending';
}
