import type { ImageGenerationOptions } from './LLMAdapter';
import { normalizeGeminiImageSize, normalizeRequestedAspectRatio } from './openAICompatibleImageSizing.ts';

export function mergeExtraBody(
    baseExtraBody: Record<string, any> | undefined,
    nextExtraBody: Record<string, any> | undefined,
): Record<string, any> | undefined {
    if (!baseExtraBody && !nextExtraBody) return undefined;

    const merged: Record<string, any> = { ...(baseExtraBody || {}) };
    Object.entries(nextExtraBody || {}).forEach(([key, value]) => {
        const currentValue = merged[key];
        if (
            value &&
            typeof value === 'object' &&
            !Array.isArray(value) &&
            currentValue &&
            typeof currentValue === 'object' &&
            !Array.isArray(currentValue)
        ) {
            merged[key] = { ...currentValue, ...value };
            return;
        }
        merged[key] = value;
    });

    return Object.keys(merged).length > 0 ? merged : undefined;
}

export function buildNewApiGoogleExtraBody(options: ImageGenerationOptions): Record<string, any> | undefined {
    const imageConfig: Record<string, any> = {};
    const responseModalities = options.providerConfig?.google?.responseModalities || ['TEXT', 'IMAGE'];
    const aspectRatio = normalizeRequestedAspectRatio(
        options.providerConfig?.google?.imageConfig?.aspectRatio || options.aspectRatio,
    );
    const imageSize = options.providerConfig?.google?.imageConfig?.imageSize || options.imageSize;

    if (aspectRatio) {
        imageConfig.aspect_ratio = aspectRatio;
    }
    if (imageSize) {
        imageConfig.image_size = normalizeGeminiImageSize(imageSize);
    }

    const google: Record<string, any> = {};
    if (responseModalities.length > 0) {
        google.response_modalities = responseModalities;
    }
    if (Object.keys(imageConfig).length > 0) {
        google.image_config = imageConfig;
    }

    const thinkingLevel = options.providerConfig?.google?.thinkingConfig?.thinkingLevel;
    if (thinkingLevel) {
        google.thinking_config = {
            thinking_level: thinkingLevel,
            include_thoughts: false,
        };
    }

    return Object.keys(google).length > 0 ? { google } : undefined;
}
