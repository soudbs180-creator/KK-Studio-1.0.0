import type {
    ProviderStrategyCompatibilityMode,
    ResolvedProviderRuntime,
} from './providerStrategy.ts';
import type { ResolvedChatSurface, ResolvedImageSurface } from './providerSurfaceTypes.ts';
import type { GenerationProviderId, GenerationSurface } from '@kk/shared';

export interface ProviderRoutingDecision {
    requestId: string;
    providerId: GenerationProviderId;
    strategyId: string;
    modelId: string;
    surface: GenerationSurface;
    dispatchKind: string;
    reason: string;
    endpointTypes?: string[];
    confidence: 'explicit' | 'inferred' | 'fallback';
}

export type ProviderRouteFamily =
    | 'official-native'
    | 'openai-compatible'
    | 'provider-native'
    | 'system-proxy'
    | 'chat-compatible';

export interface ProviderEndpointHints {
    supportsGeminiNative: boolean;
    supportsAsyncProviderImages: boolean;
    supportsSyncProviderImages: boolean;
    supportsProviderImages: boolean;
    supportsChatImages: boolean;
}

export interface ProviderImageRouteInput {
    runtime: ResolvedProviderRuntime;
    modelId?: string;
    compatibilityMode?: ProviderStrategyCompatibilityMode;
    endpointTypes?: string[];
    preferAsync?: boolean;
    isAsyncImageModel?: (modelId?: string) => boolean;
}

export interface ProviderImageRouteDecision {
    surface: ResolvedImageSurface;
    routeFamily: ProviderRouteFamily;
    strategyId: string;
    reason: string;
    endpointHints: ProviderEndpointHints;
}

export function isGeminiImageLikeModel(modelId?: string): boolean {
    const modelLower = String(modelId || '').trim().toLowerCase();
    return (
        (modelLower.includes('gemini') && modelLower.includes('image'))
        || modelLower.includes('nano-banana')
        || modelLower.includes('banana')
        || modelLower.startsWith('imagen-')
    );
}

export function isDedicatedImageModel(modelId?: string): boolean {
    if (!modelId) return false;
    const lower = modelId.toLowerCase();
    return (
        isGeminiImageLikeModel(modelId)
        || lower.includes('dall-e')
        || lower.includes('flux')
        || lower.includes('sdxl')
        || lower.includes('stable-diffusion')
        || lower.includes('recraft')
        || lower.includes('ideogram')
        || lower.includes('midjourney')
        || lower.includes('pixelart')
    );
}

export function classifyProviderEndpointHints(endpointTypes?: string[]): ProviderEndpointHints {
    const hints = new Set(
        (endpointTypes || [])
            .map((value) => String(value || '').trim().toLowerCase())
            .filter(Boolean),
    );

    const entries = Array.from(hints);
    const supportsGeminiNative = entries.some((value) =>
        value.includes('generatecontent') || value.includes('v1beta/models') || value.includes('gemini'),
    );
    const supportsAsyncProviderImages = entries.some((value) =>
        value.includes('image-generation-async')
        || value.includes('/images/async/')
        || (value.includes('async') && value.includes('image')),
    );
    const supportsSyncProviderImages = entries.some((value) =>
        value.includes('image-generation')
        || value.includes('/images/generations')
        || value === 'images'
        || value === 'generations'
        || value.includes('provider-images'),
    );
    const supportsProviderImages = supportsSyncProviderImages || supportsAsyncProviderImages;
    const supportsChatImages = entries.some((value) =>
        value.includes('chat') || value.includes('completions'),
    );

    return {
        supportsGeminiNative,
        supportsAsyncProviderImages,
        supportsSyncProviderImages,
        supportsProviderImages,
        supportsChatImages,
    };
}

export function resolveProviderChatNativeSurface(input: {
    runtime: ResolvedProviderRuntime;
}): ResolvedChatSurface | null {
    if (input.runtime.requestProfileId === 'apimart') {
        return null;
    }

    if (input.runtime.protocolFamily === 'gemini-native') {
        return 'gemini-native-chat';
    }

    if (input.runtime.protocolFamily === 'claude-native') {
        return 'claude-messages';
    }

    return null;
}

function getRouteFamilyForImageSurface(
    runtime: ResolvedProviderRuntime,
    surface: ResolvedImageSurface,
): ProviderRouteFamily {
    if (runtime.providerFamily === 'system-proxy' || runtime.endpointStyle === 'system-proxy') {
        return 'system-proxy';
    }

    if (surface === 'gemini-native-image' && runtime.providerFamily === 'google-official') {
        return 'official-native';
    }

    if (surface === 'gemini-native-image') {
        return 'provider-native';
    }

    if (surface === 'async-image') {
        return 'provider-native';
    }

    if (surface === 'chat-image') {
        return 'chat-compatible';
    }

    return 'openai-compatible';
}

function buildImageDecision(
    input: ProviderImageRouteInput,
    surface: ResolvedImageSurface,
    reason: string,
    endpointHints: ProviderEndpointHints,
): ProviderImageRouteDecision {
    return {
        surface,
        routeFamily: getRouteFamilyForImageSurface(input.runtime, surface),
        strategyId: input.runtime.strategyId,
        reason,
        endpointHints,
    };
}

export function resolveProviderImageRoute(input: ProviderImageRouteInput): ProviderImageRouteDecision {
    const endpointHints = classifyProviderEndpointHints(input.endpointTypes);
    const isGeminiImage = isGeminiImageLikeModel(input.modelId);
    const strategyId = input.runtime.strategyId;
    const shouldBypassChat = input.runtime.isKnownProvider
        && isDedicatedImageModel(input.modelId)
        && input.runtime.imageProfile !== 'chat-preferred';

    if (input.runtime.requestProfileId === 'apimart') {
        return buildImageDecision(
            input,
            'provider-images',
            'apimart-openai-compatible-provider-images',
            endpointHints,
        );
    }

    if (strategyId === 'wuyinkeji') {
        return buildImageDecision(
            input,
            'async-image',
            'wuyinkeji-own-async-image-route',
            endpointHints,
        );
    }

    if (strategyId === '12ai' && input.preferAsync && input.isAsyncImageModel?.(input.modelId)) {
        return buildImageDecision(
            input,
            'async-image',
            '12ai-explicit-async-image-preference',
            endpointHints,
        );
    }

    const forceGeminiNativeOn12AI = strategyId === '12ai'
        && input.runtime.geminiNative
        && isGeminiImage;

    if (isGeminiImage && endpointHints.supportsGeminiNative && !endpointHints.supportsProviderImages) {
        return buildImageDecision(
            input,
            'gemini-native-image',
            'endpoint-hints-only-expose-gemini-native-image',
            endpointHints,
        );
    }

    if (((input.runtime.resolvedFormat === 'gemini' && isGeminiImage) || forceGeminiNativeOn12AI) && !input.preferAsync) {
        return buildImageDecision(
            input,
            'gemini-native-image',
            'native-gemini-image-protocol',
            endpointHints,
        );
    }

    if (endpointHints.supportsSyncProviderImages) {
        return buildImageDecision(
            input,
            'provider-images',
            'endpoint-hints-expose-sync-provider-images',
            endpointHints,
        );
    }

    if (endpointHints.supportsAsyncProviderImages && strategyId === '12ai') {
        return buildImageDecision(
            input,
            input.preferAsync ? 'async-image' : 'gemini-native-image',
            input.preferAsync
                ? '12ai-endpoint-hints-async-image-preferred'
                : '12ai-endpoint-hints-async-image-deferred-to-gemini-native',
            endpointHints,
        );
    }

    if (
        endpointHints.supportsChatImages
        && input.compatibilityMode === 'chat'
        && !forceGeminiNativeOn12AI
        && input.runtime.imageRoutingPolicy !== 'surface-first'
        && !shouldBypassChat
    ) {
        return buildImageDecision(
            input,
            'chat-image',
            'endpoint-hints-and-chat-compatibility-route-to-chat-image',
            endpointHints,
        );
    }

    if (
        input.compatibilityMode === 'chat'
        && !forceGeminiNativeOn12AI
        && input.runtime.imageRoutingPolicy !== 'surface-first'
        && !shouldBypassChat
    ) {
        return buildImageDecision(
            input,
            'chat-image',
            'chat-compatibility-route-to-chat-image',
            endpointHints,
        );
    }

    if ((input.runtime.resolvedFormat === 'gemini' && isGeminiImage) || forceGeminiNativeOn12AI) {
        return buildImageDecision(
            input,
            'gemini-native-image',
            'native-gemini-image-protocol',
            endpointHints,
        );
    }

    return buildImageDecision(
        input,
        'provider-images',
        input.runtime.imageRoutingPolicy === 'surface-first'
            ? 'provider-surface-first-policy'
            : 'default-openai-compatible-provider-images',
        endpointHints,
    );
}
