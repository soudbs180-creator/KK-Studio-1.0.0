import type { ImageGenerationOptions } from './LLMAdapter';

export type OpenAIImageProfile = 'gpt-image-1' | 'dall-e-2' | 'dall-e-3' | 'generic';

export function getOpenAIImageProfile(modelId: string): OpenAIImageProfile {
    const lower = String(modelId || '').toLowerCase();
    if (lower.includes('gpt-image-1')) return 'gpt-image-1';
    if (lower.includes('dall-e-2')) return 'dall-e-2';
    if (lower.includes('dall-e-3')) return 'dall-e-3';
    return 'generic';
}

export function getAspectOrientation(aspectRatio?: string): 'square' | 'landscape' | 'portrait' {
    const value = String(aspectRatio || '').trim();
    if (!value || value.toLowerCase() === 'auto') {
        return 'square';
    }

    const [widthRaw, heightRaw] = value.split(':');
    const width = Number.parseFloat(widthRaw);
    const height = Number.parseFloat(heightRaw);
    if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
        return 'square';
    }

    if (Math.abs(width - height) < 0.0001) {
        return 'square';
    }

    return width > height ? 'landscape' : 'portrait';
}

export function clampImageCount(count: number | undefined, maxCount: number): number {
    if (!count || !Number.isFinite(count)) return 1;
    return Math.max(1, Math.min(Math.round(count), maxCount));
}

export function resolveOpenAIImageSize(
    options: ImageGenerationOptions,
    profile: OpenAIImageProfile,
): string {
    const override = String(options.providerConfig?.openai?.size || '').trim();
    const orientation = getAspectOrientation(options.aspectRatio);

    const allow = (sizes: string[]): string | undefined => {
        if (override && sizes.includes(override)) {
            return override;
        }
        return undefined;
    };

    if (profile === 'gpt-image-1') {
        return allow(['1024x1024', '1536x1024', '1024x1536', 'auto'])
            || (orientation === 'landscape' ? '1536x1024' : orientation === 'portrait' ? '1024x1536' : '1024x1024');
    }

    if (profile === 'dall-e-2') {
        const requested = String(options.imageSize || '').toUpperCase();
        return allow(['256x256', '512x512', '1024x1024'])
            || (requested.includes('256')
                ? '256x256'
                : requested.includes('512') || requested.includes('0.5K')
                    ? '512x512'
                    : '1024x1024');
    }

    return allow(['1024x1024', '1792x1024', '1024x1792'])
        || (orientation === 'landscape' ? '1792x1024' : orientation === 'portrait' ? '1024x1792' : '1024x1024');
}

export function resolveOpenAIEditSize(options: ImageGenerationOptions): string {
    const override = String(options.providerConfig?.openai?.size || '').trim();
    if (['256x256', '512x512', '1024x1024'].includes(override)) {
        return override;
    }

    const requested = String(options.imageSize || '').toUpperCase();
    if (requested.includes('256')) return '256x256';
    if (requested.includes('512') || requested.includes('0.5K')) return '512x512';
    return '1024x1024';
}
