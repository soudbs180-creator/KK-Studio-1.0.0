import type {
    ProviderStrategyCompatibilityMode,
    ResolvedProviderRuntime,
} from './providerStrategy.ts';
import { modelPrefersResponsesApi } from './openaiResponses.ts';
import type { ResolvedChatSurface, ResolvedImageSurface } from './providerSurfaceTypes.ts';
import {
    resolveProviderChatNativeSurface,
    resolveProviderImageRoute,
} from './providerRequestRegistry.ts';

export function resolveChatSurface(input: {
    runtime: ResolvedProviderRuntime;
    modelId?: string;
}): ResolvedChatSurface {
    const nativeSurface = resolveProviderChatNativeSurface({ runtime: input.runtime });
    if (nativeSurface) {
        return nativeSurface;
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
    return resolveProviderImageRoute(input).surface;
}
