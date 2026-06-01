type WuyinVideoRoute = {
    endpointPath: string;
    aliases: string[];
};

export type WuyinVideoResolvedRoute = {
    endpointPath: string;
    endpointModelId: string;
};

export type WuyinVideoRequestBodyInput = {
    prompt: string;
    aspectRatio?: string;
    resolution?: string;
    size?: string;
    duration?: number;
    videoDuration?: string;
    imageUrl?: string;
    imageTailUrl?: string;
};

export const WUYIN_ASYNC_VIDEO_DEFAULT_MODEL = 'video_google_omni';
export const WUYIN_ASYNC_VIDEO_DEFAULT_BASE_URL = 'https://api.wuyinkeji.com';
export const WUYIN_ASYNC_VIDEO_DETAIL_PATH = '/api/async/detail';
export const WUYIN_ASYNC_VIDEO_DEFAULT_ENDPOINT_PATH = '/api/async/video_google_omni';

const WUYIN_VIDEO_ROUTES: WuyinVideoRoute[] = [
    {
        endpointPath: WUYIN_ASYNC_VIDEO_DEFAULT_ENDPOINT_PATH,
        aliases: [
            'video_google_omni',
            'google_omni',
            'google omni',
            'omni google',
        ],
    },
];

function asRecord(value: unknown): Record<string, unknown> | null {
    return value !== null && typeof value === 'object' && !Array.isArray(value)
        ? value as Record<string, unknown>
        : null;
}

function readRecordString(value: unknown, ...keys: string[]): string {
    const record = asRecord(value);
    if (!record) return '';

    for (const key of keys) {
        const item = record[key];
        if (typeof item === 'string' && item.trim()) {
            return item.trim();
        }
        if (typeof item === 'number' && Number.isFinite(item)) {
            return String(item);
        }
    }

    return '';
}

function normalizeRawModelId(modelId: string): string {
    return String(modelId || '').trim().split('@')[0].split('|')[0].replace(/^models\//i, '').trim();
}

function normalizeWuyinVideoAlias(value: string): string {
    return normalizeRawModelId(value)
        .toLowerCase()
        .replace(/^\/+/, '')
        .replace(/^api\/async\//i, '')
        .replace(/[^a-z0-9]+/g, '');
}

export function normalizeWuyinVideoBaseUrl(baseUrl: string): string {
    const raw = String(baseUrl || '').trim();
    if (!raw) return WUYIN_ASYNC_VIDEO_DEFAULT_BASE_URL;

    const withProtocol = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;

    try {
        const parsed = new URL(withProtocol);
        if (/^api\.wuyinkeji\.com$/i.test(parsed.hostname)) {
            return `${parsed.protocol}//${parsed.host}`;
        }

        const sanitizedPath = parsed.pathname
            .replace(/\/+(doc\/\d+)?$/i, '')
            .replace(/\/+(api\/async(\/[a-z0-9_.-]+)?)?$/i, '')
            .replace(/\/+$/, '');
        return `${parsed.protocol}//${parsed.host}${sanitizedPath}`;
    } catch {
        return WUYIN_ASYNC_VIDEO_DEFAULT_BASE_URL;
    }
}

export function extractWuyinVideoEndpointPath(baseUrl: string): string | null {
    const raw = String(baseUrl || '').trim();
    if (!raw) return null;

    const candidates = /^https?:\/\//i.test(raw) ? [raw] : [`https://${raw}`];
    for (const candidate of candidates) {
        try {
            const parsed = new URL(candidate);
            const pathname = parsed.pathname.replace(/\/+$/, '');
            if (/^\/api\/async\/video[a-z0-9_.-]*$/i.test(pathname)) {
                return pathname;
            }
        } catch {
            continue;
        }
    }

    return null;
}

export function resolveWuyinVideoRequestRoute(input: {
    baseUrl: string;
    modelId?: string;
}): WuyinVideoResolvedRoute {
    // 简体中文注释：检查 baseUrl 是否为五音科技的通用异步端点前缀（即去掉末尾斜杠后为 /api/async）。
    const cleanBaseUrl = normalizeWuyinVideoBaseUrl(input.baseUrl);
    try {
        const parsedBase = new URL(cleanBaseUrl);
        const baseRoutePath = parsedBase.pathname.replace(/\/+$/, '');
        if (baseRoutePath === '/api/async') {
            const rawModelId = normalizeRawModelId(input.modelId || WUYIN_ASYNC_VIDEO_DEFAULT_MODEL);
            const endpointModelId = rawModelId.replace(/^\/+/, '').replace(/^api\/async\//i, '');
            return {
                endpointPath: `/api/async/${endpointModelId}`,
                endpointModelId,
            };
        }
    } catch {
        // 忽略 URL 解析错误并回退到默认逻辑
    }

    const directEndpointPath = extractWuyinVideoEndpointPath(input.baseUrl);
    if (directEndpointPath) {
        // 简体中文注释：即使 baseUrl 填入了带后缀的模型接口，也应该能够根据用户所选的视频模型 modelId 来重写实际请求路径
        const rawModelId = normalizeRawModelId(input.modelId || WUYIN_ASYNC_VIDEO_DEFAULT_MODEL);
        const endpointModelId = rawModelId.replace(/^\/+/, '').replace(/^api\/async\//i, '');
        return {
            endpointPath: `/api/async/${endpointModelId}`,
            endpointModelId,
        };
    }

    const rawModelId = normalizeRawModelId(input.modelId || WUYIN_ASYNC_VIDEO_DEFAULT_MODEL);
    const endpointModelId = rawModelId.replace(/^\/+/, '').replace(/^api\/async\//i, '');
    const normalized = normalizeWuyinVideoAlias(rawModelId);

    if (/^video[a-z0-9]+$/i.test(normalized) && !normalized.startsWith('videos')) {
        return {
            endpointPath: `/api/async/${endpointModelId}`,
            endpointModelId,
        };
    }

    const matchedRoute = WUYIN_VIDEO_ROUTES.find((route) =>
        route.aliases.some((alias) => normalizeWuyinVideoAlias(alias) === normalized)
    );
    if (matchedRoute) {
        return {
            endpointPath: matchedRoute.endpointPath,
            endpointModelId: matchedRoute.endpointPath.split('/').pop() || WUYIN_ASYNC_VIDEO_DEFAULT_MODEL,
        };
    }

    if (normalized.includes('google') && normalized.includes('omni')) {
        return {
            endpointPath: WUYIN_ASYNC_VIDEO_DEFAULT_ENDPOINT_PATH,
            endpointModelId: WUYIN_ASYNC_VIDEO_DEFAULT_MODEL,
        };
    }

    throw new Error(`Wuyin provider does not know how to route video model "${input.modelId || ''}". Please use video_google_omni.`);
}

export function buildWuyinVideoSubmitUrl(baseUrl: string, route: WuyinVideoResolvedRoute): string {
    return `${normalizeWuyinVideoBaseUrl(baseUrl)}${route.endpointPath}`;
}

export function buildWuyinVideoDetailUrl(baseUrl: string, taskId: string): string {
    const encodedTaskId = encodeURIComponent(String(taskId || '').trim());
    return `${normalizeWuyinVideoBaseUrl(baseUrl)}${WUYIN_ASYNC_VIDEO_DETAIL_PATH}?id=${encodedTaskId}`;
}

export function resolveWuyinVideoSize(input: {
    aspectRatio?: string;
    resolution?: string;
    size?: string;
}): string {
    const explicitSize = String(input.size || '').trim();
    if (/^\d+x\d+$/i.test(explicitSize)) {
        return explicitSize.toLowerCase();
    }

    const rawAspectRatio = String(input.aspectRatio || '').trim();
    const aspectRatio = rawAspectRatio === '9:16' || rawAspectRatio === '1:1' ? rawAspectRatio : '16:9';
    const normalizedResolution = String(input.resolution || '').trim().toLowerCase();
    const resolution = normalizedResolution.includes('1080') ? '1080p' : '720p';

    const sizeMap: Record<'720p' | '1080p', Record<'16:9' | '9:16' | '1:1', string>> = {
        '720p': {
            '16:9': '1280x720',
            '9:16': '720x1280',
            '1:1': '720x720',
        },
        '1080p': {
            '16:9': '1920x1080',
            '9:16': '1080x1920',
            '1:1': '1080x1080',
        },
    };

    return sizeMap[resolution][aspectRatio];
}

export function resolveWuyinVideoDuration(duration?: number, videoDuration?: string): string {
    if (typeof duration === 'number' && Number.isFinite(duration) && duration > 0) {
        return String(Math.round(duration));
    }

    const parsed = Number.parseFloat(String(videoDuration || '').trim());
    if (Number.isFinite(parsed) && parsed > 0) {
        return String(Math.round(parsed));
    }

    return '10';
}

export function normalizeWuyinVideoImages(imageUrl?: string, imageTailUrl?: string): string {
    const rawItems = [imageUrl, imageTailUrl]
        .flatMap((value) => String(value || '').split(','))
        .map((value) => value.trim())
        .filter(Boolean);

    if (rawItems.length === 0) {
        return '';
    }

    const normalized = rawItems.slice(0, 7).map((item, index) => {
        if (/^blob:/i.test(item)) {
            throw new Error(`Wuyin video reference image ${index + 1} is a local blob URL. Please use a public HTTPS image URL.`);
        }
        if (/^data:/i.test(item) || /^[a-z0-9+/=\s]+$/i.test(item) && item.length > 80) {
            throw new Error(`Wuyin video reference image ${index + 1} must be a public HTTPS image URL; base64 upload is not supported yet.`);
        }
        if (!/^https?:\/\//i.test(item)) {
            throw new Error(`Wuyin video reference image ${index + 1} must be a public HTTP(S) image URL.`);
        }
        return item;
    });

    return normalized.join(',');
}

export function buildWuyinVideoRequestBody(input: WuyinVideoRequestBodyInput): Record<string, string> {
    const body: Record<string, string> = {
        prompt: String(input.prompt || ''),
        size: resolveWuyinVideoSize(input),
        duration: resolveWuyinVideoDuration(input.duration, input.videoDuration),
    };
    const images = normalizeWuyinVideoImages(input.imageUrl, input.imageTailUrl);
    if (images) {
        body.images = images;
    }
    return body;
}

export function extractWuyinVideoTaskId(payload: unknown): string {
    const data = asRecord(payload)?.data;
    return String(
        readRecordString(data, 'id', 'task_id', 'taskId') ||
        readRecordString(payload, 'id', 'task_id', 'taskId')
    ).trim();
}

export function extractWuyinVideoStatusCode(payload: unknown): number | undefined {
    const data = asRecord(payload)?.data;
    const value = asRecord(data)?.status ?? asRecord(payload)?.status;
    if (typeof value === 'number' && Number.isFinite(value)) return value;
    if (typeof value === 'string' && value.trim() !== '') {
        const parsed = Number(value);
        if (Number.isFinite(parsed)) return parsed;
    }
    return undefined;
}

export function mapWuyinVideoStatus(statusCode: number | undefined): 'pending' | 'success' | 'failed' {
    if (statusCode === 2) return 'success';
    if (statusCode === 3) return 'failed';
    return 'pending';
}

function extractFirstString(value: unknown): string {
    if (typeof value === 'string') {
        const trimmed = value.trim();
        if (!trimmed) return '';

        if ((trimmed.startsWith('{') && trimmed.endsWith('}')) || (trimmed.startsWith('[') && trimmed.endsWith(']'))) {
            try {
                return extractFirstString(JSON.parse(trimmed));
            } catch {
                return trimmed;
            }
        }

        const urlMatch = trimmed.match(/https?:\/\/[^\s"'<>]+/i);
        return urlMatch?.[0] || trimmed;
    }

    if (Array.isArray(value)) {
        for (const item of value) {
            const extracted = extractFirstString(item);
            if (extracted) return extracted;
        }
        return '';
    }

    const record = asRecord(value);
    if (!record) return '';

    const priorityKeys = ['url', 'video_url', 'videoUrl', 'output', 'result'];
    for (const key of priorityKeys) {
        const extracted = extractFirstString(record[key]);
        if (extracted) return extracted;
    }

    return '';
}

export function extractWuyinVideoUrl(payload: unknown): string {
    const record = asRecord(payload);
    const data = asRecord(record?.data);
    const candidates = [
        data?.url,
        data?.video_url,
        data?.videoUrl,
        data?.output,
        data?.result,
        data?.outputs,
        record?.url,
        record?.video_url,
        record?.videoUrl,
        record?.output,
        record?.result,
        record?.outputs,
    ];

    for (const candidate of candidates) {
        const extracted = extractFirstString(candidate);
        if (extracted) return extracted;
    }

    return '';
}

export function extractWuyinVideoMessage(payload: unknown): string {
    const data = asRecord(payload)?.data;
    return readRecordString(data, 'message', 'error', 'msg')
        || readRecordString(payload, 'message', 'error', 'msg')
        || '';
}

export function assertWuyinVideoSuccessEnvelope(payload: unknown): void {
    const code = asRecord(payload)?.code;
    if (code === undefined || code === null || code === '') {
        return;
    }

    const normalizedCode = typeof code === 'number' ? code : Number(String(code).trim());
    if (normalizedCode === 200 || normalizedCode === 0) {
        return;
    }

    const message = extractWuyinVideoMessage(payload) || JSON.stringify(payload);
    throw new Error(`Wuyin video API error ${String(code)}: ${message}`);
}
