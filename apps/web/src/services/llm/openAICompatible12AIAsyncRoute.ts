import { type ImageGenerationOptions, extractRefImageData } from './LLMAdapter.ts';
import {
    getOpenAIImageProfile,
    normalizeRequestedAspectRatio,
    resolveOpenAIImageSize,
} from './openAICompatibleImageSizing.ts';
import { RegionService } from '../system/RegionService.ts';

export function normalize12AIBaseUrl(baseUrl: string): string {
    let clean = (baseUrl || '').trim().replace(/\/+$/, '');
    if (!clean) return RegionService.get12AIBaseUrl();

    const suffixes = [
        '/v1/chat/completions',
        '/chat/completions',
        '/v1/images/async/generations',
        '/images/async/generations',
        '/v1/images/generations',
        '/images/generations',
        '/v1beta/models',
        '/api/v1/generate',
        '/api/pay',
        '/v1beta',
        '/v1',
        '/api',
    ];

    let stripped = true;
    while (stripped) {
        stripped = false;
        const lower = clean.toLowerCase();
        for (const suffix of suffixes) {
            if (lower.endsWith(suffix)) {
                clean = clean.slice(0, -suffix.length).replace(/\/+$/, '');
                stripped = true;
                break;
            }
        }
    }

    if (clean && !clean.startsWith('http')) {
        clean = `https://${clean}`;
    }

    try {
        const parsed = new URL(clean);
        if (/(^|\.)12ai\.(org|xyz|io|net)$/i.test(parsed.hostname)) {
            return `${parsed.protocol}//${parsed.host}`;
        }
    } catch {
        return RegionService.get12AIBaseUrl();
    }

    return clean;
}

export function is12AIAsyncImageModel(modelId?: string): boolean {
    const normalized = String(modelId || '').trim().toLowerCase();
    if (!normalized) return false;

    return normalized.includes('gemini-2.5-flash-image')
        || normalized.includes('gemini-3.1-flash-image-preview')
        || normalized.includes('gemini-3-pro-image-preview')
        || normalized.includes('nano-banana')
        || normalized.includes('nanobanana');
}

export function shouldUse12AIAsyncImageRoute(options: ImageGenerationOptions): boolean {
    if (!is12AIAsyncImageModel(options.modelId)) {
        return false;
    }

    const requestedCount = Math.max(1, Number(options.imageCount || 1));
    return requestedCount > 1;
}

export function resolve12AIAsyncImageSize(options: ImageGenerationOptions): string {
    const explicitSize = String(options.providerConfig?.openai?.size || '').trim();
    if (explicitSize) {
        return explicitSize;
    }

    const requestedAspectRatio = normalizeRequestedAspectRatio(options.aspectRatio);
    if (requestedAspectRatio) {
        return requestedAspectRatio;
    }

    return resolveOpenAIImageSize(options, getOpenAIImageProfile(options.modelId));
}

export function resolve12AIAsyncImageQuality(options: ImageGenerationOptions): string | undefined {
    const explicitQuality = String(options.providerConfig?.openai?.quality || '').trim();
    if (explicitQuality) {
        return explicitQuality;
    }

    const normalizedImageSize = String(options.imageSize || '').trim().toUpperCase();
    if (!normalizedImageSize) {
        return undefined;
    }

    if (normalizedImageSize.includes('4K')) return '4K';
    if (normalizedImageSize.includes('2K') || normalizedImageSize.includes('HD')) return 'hd';
    return 'standard';
}

export function normalize12AIAsyncReferenceImage(ref: string | { data: string; mimeType: string }): string {
    const { data, mimeType } = extractRefImageData(ref);
    const normalizedData = String(data || '').trim();
    if (!normalizedData) {
        return '';
    }

    if (/^(https?:)?\/\//i.test(normalizedData) || normalizedData.startsWith('data:')) {
        return normalizedData;
    }

    return `data:${mimeType || 'image/png'};base64,${normalizedData}`;
}
