import type {
    ProviderStrategyCompatibilityMode,
    ResolvedProviderRuntime,
} from './providerStrategy.ts';
import { shouldBypassChatCompatibilityForImages } from './providerStrategy.ts';
import { modelPrefersResponsesApi } from './openaiResponses.ts';
import type { ResolvedChatSurface, ResolvedImageSurface } from './providerSurfaceTypes.ts';

function isGeminiImageModel(modelId?: string): boolean {
    const modelLower = String(modelId || '').trim().toLowerCase();
    return (
        (modelLower.includes('gemini') && modelLower.includes('image'))
        || modelLower.includes('nano-banana')
        || modelLower.includes('banana')
    );
}

export function resolveChatSurface(input: {
    runtime: ResolvedProviderRuntime;
    modelId?: string;
}): ResolvedChatSurface {
    if (input.runtime.protocolFamily === 'gemini-native') {
        return 'gemini-native-chat';
    }

    if (input.runtime.protocolFamily === 'claude-native') {
        return 'claude-messages';
    }

    return modelPrefersResponsesApi(input.modelId) ? 'openai-responses' : 'openai-chat';
}

export function resolveImageSurface(input: {
    runtime: ResolvedProviderRuntime;
    modelId?: string;
    compatibilityMode?: ProviderStrategyCompatibilityMode;
    endpointTypes?: string[];
    preferAsync?: boolean;
    isAsyncImageModel?: (modelId?: string) => boolean;
}): ResolvedImageSurface {
    const isGeminiImage = isGeminiImageModel(input.modelId);
    const forceGeminiNativeOn12AI = input.runtime.strategyId === '12ai'
        && input.runtime.geminiNative
        && isGeminiImage;
    const endpointHints = new Set(
        (input.endpointTypes || [])
            .map((value) => String(value || '').trim().toLowerCase())
            .filter(Boolean),
    );
    const supportsGeminiNative = Array.from(endpointHints).some((value) =>
        value.includes('generatecontent') || value.includes('v1beta/models') || value.includes('gemini'),
    );
    const supportsAsyncProviderImages = Array.from(endpointHints).some((value) =>
        value.includes('image-generation-async')
        || value.includes('/images/async/')
        || (value.includes('async') && value.includes('image')),
    );
    const supportsSyncProviderImages = Array.from(endpointHints).some((value) =>
        value.includes('image-generation')
        || value.includes('/images/generations')
        || value.includes('images')
        || value.includes('generations'),
    );
    const supportsProviderImages = supportsSyncProviderImages || supportsAsyncProviderImages;
    const supportsChatImages = Array.from(endpointHints).some((value) =>
        value.includes('chat') || value.includes('completions'),
    );

    if (input.runtime.strategyId === '12ai' && input.preferAsync && input.isAsyncImageModel?.(input.modelId)) {
        return 'async-image';
    }

    if (isGeminiImage && supportsGeminiNative && !supportsProviderImages) {
        return 'gemini-native-image';
    }

    if (supportsSyncProviderImages) {
        return 'provider-images';
    }

    if (supportsAsyncProviderImages && input.runtime.strategyId === '12ai') {
        return input.preferAsync ? 'async-image' : 'gemini-native-image';
    }

    if (
        supportsChatImages
        && input.compatibilityMode === 'chat'
        && !forceGeminiNativeOn12AI
        && !shouldBypassChatCompatibilityForImages(input.runtime)
    ) {
        return 'chat-image';
    }

    if (
        input.compatibilityMode === 'chat'
        && !forceGeminiNativeOn12AI
        && !shouldBypassChatCompatibilityForImages(input.runtime)
    ) {
        return 'chat-image';
    }

    if ((input.runtime.resolvedFormat === 'gemini' && isGeminiImage) || forceGeminiNativeOn12AI) {
        return 'gemini-native-image';
    }

    return 'provider-images';
}
