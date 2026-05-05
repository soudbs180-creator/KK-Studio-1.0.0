import { type ImageGenerationOptions, extractRefImageData } from './LLMAdapter.ts';
import { resolveOpenAIImageSize } from './openAICompatibleImageSizing.ts';

export type AceDataServiceId = 'flux' | 'nano-banana';

export type AceDataImageRoute = {
    serviceId: AceDataServiceId;
    endpointPath: string;
    taskPath: string;
    aliases: string[];
};

export const ACEDATA_DEFAULT_BASE_URL = 'https://api.acedata.cloud';

export const ACEDATA_IMAGE_ROUTES: AceDataImageRoute[] = [
    {
        serviceId: 'flux',
        endpointPath: '/flux/images',
        taskPath: '/flux/tasks',
        aliases: [
            'flux',
            'flux-dev',
            'flux-schnell',
            'flux-pro',
            'flux-kontext',
            'flux-kontext-pro',
            'flux-kontext-max',
        ],
    },
    {
        serviceId: 'nano-banana',
        endpointPath: '/nano-banana/images',
        taskPath: '/nano-banana/tasks',
        aliases: [
            'nano-banana',
            'nanobanana',
            'banana',
            'gemini-2.5-flash-image',
            'gemini-2.0-flash-exp-image-generation',
        ],
    },
];

export function normalizeAceDataBaseUrl(baseUrl: string): string {
    const raw = String(baseUrl || '').trim();
    if (!raw) return ACEDATA_DEFAULT_BASE_URL;

    const withProtocol = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;

    try {
        const parsed = new URL(withProtocol);
        if (/^api\.acedata\.cloud$/i.test(parsed.hostname)) {
            return `${parsed.protocol}//${parsed.host}`;
        }

        const sanitizedPath = parsed.pathname
            .replace(/\/+(flux|nano-banana)\/(images|tasks)$/i, '')
            .replace(/\/+$/, '');
        return `${parsed.protocol}//${parsed.host}${sanitizedPath}`;
    } catch {
        return ACEDATA_DEFAULT_BASE_URL;
    }
}

export function extractAceDataDirectRoute(baseUrl: string): AceDataImageRoute | null {
    const raw = String(baseUrl || '').trim();
    if (!raw) return null;

    const candidates = /^https?:\/\//i.test(raw) ? [raw] : [`https://${raw}`];
    for (const candidate of candidates) {
        try {
            const parsed = new URL(candidate);
            const pathname = parsed.pathname.replace(/\/+$/, '').toLowerCase();
            const matchedRoute = ACEDATA_IMAGE_ROUTES.find((route) =>
                pathname.endsWith(route.endpointPath) || pathname.endsWith(route.taskPath)
            );
            if (matchedRoute) {
                return matchedRoute;
            }
        } catch {
            continue;
        }
    }

    return null;
}

export function normalizeAceDataAlias(value: string): string {
    return String(value || '')
        .trim()
        .toLowerCase()
        .replace(/^models\//i, '')
        .replace(/\|.*$/, '')
        .replace(/@.*$/, '')
        .replace(/[^a-z0-9]+/g, '');
}

export function resolveAceDataImageRoute(baseUrl: string, modelId?: string): AceDataImageRoute {
    const directRoute = extractAceDataDirectRoute(baseUrl);
    if (directRoute) {
        return directRoute;
    }

    const normalized = normalizeAceDataAlias(modelId || '');
    const matchedRoute = ACEDATA_IMAGE_ROUTES.find((route) =>
        route.aliases.some((alias) => normalizeAceDataAlias(alias) === normalized)
    );
    if (matchedRoute) {
        return matchedRoute;
    }

    if (normalized.includes('flux') || normalized.includes('kontext')) {
        return ACEDATA_IMAGE_ROUTES[0];
    }
    if (normalized.includes('banana') || normalized.includes('gemini25flashimage') || normalized.includes('gemini20flashexpimagegeneration')) {
        return ACEDATA_IMAGE_ROUTES[1];
    }

    throw new Error(`AceData provider does not know how to route image model "${modelId || ''}". Please use a Flux or Nano Banana model ID.`);
}

export function resolveAceDataCandidateRoutes(baseUrl: string, modelId?: string): AceDataImageRoute[] {
    const routes: AceDataImageRoute[] = [];
    const pushUnique = (route: AceDataImageRoute | null | undefined) => {
        if (!route) return;
        if (routes.some((item) => item.serviceId === route.serviceId)) return;
        routes.push(route);
    };

    pushUnique(extractAceDataDirectRoute(baseUrl));

    try {
        pushUnique(resolveAceDataImageRoute(baseUrl, modelId));
    } catch {
        // Fall back to probing known AceData task routes when the model is unavailable.
    }

    ACEDATA_IMAGE_ROUTES.forEach(pushUnique);
    return routes;
}

export function normalizeAceDataReferenceImage(
    ref: string | { data: string; mimeType: string; url?: string },
    index: number,
): string {
    const sourceUrl = typeof (ref as { url?: string })?.url === 'string'
        ? String((ref as { url?: string }).url || '').trim()
        : '';
    if (/^https?:\/\//i.test(sourceUrl)) {
        return sourceUrl;
    }

    const { data, mimeType } = extractRefImageData(ref);
    const raw = String(data || '').trim();
    if (!raw) {
        throw new Error(`AceData reference image ${index + 1} is empty.`);
    }

    if (/^https?:\/\//i.test(raw)) {
        return raw;
    }

    if (/^blob:/i.test(raw)) {
        throw new Error(`AceData reference image ${index + 1} is still a local blob URL. Please wait for image processing to finish and try again.`);
    }

    if (/^data:/i.test(raw)) {
        return raw;
    }

    const cleaned = raw.replace(/^data:[^;]+;base64,/i, '').replace(/\s+/g, '');
    if (!cleaned) {
        throw new Error(`AceData reference image ${index + 1} is not a valid URL or Base64 payload.`);
    }

    return `data:${mimeType || 'image/png'};base64,${cleaned}`;
}

export function resolveAceDataImageSize(options: ImageGenerationOptions): string {
    return resolveOpenAIImageSize(options, 'gpt-image-1');
}
