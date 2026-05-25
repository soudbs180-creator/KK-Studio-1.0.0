import type { ProviderStrategyCompatibilityMode, ResolvedProviderRuntime } from './providerStrategy.ts';
import { resolveChatSurface, resolveImageSurface } from './providerSurfaceRouter.ts';
import type { ModelDiscoverySurface, ProbeSurface } from './providerSurfaceTypes.ts';

export type ProbeSkipReason =
    | 'video-billing-risk'
    | 'native-image-billing-risk'
    | 'standard-mode-billing-risk'
    | null;

export interface ProviderProbeMatrix {
    availableSurfaces: ProbeSurface[];
    modelDiscoverySurface: ModelDiscoverySurface;
    protocolProbeSurface: ProbeSurface;
    skipReason: ProbeSkipReason;
}

function uniqueSurfaces(items: ProbeSurface[]): ProbeSurface[] {
    return Array.from(new Set(items));
}

export function resolveModelDiscoverySurface(input: {
    runtime: ResolvedProviderRuntime;
    documentedModels?: string[];
}): ModelDiscoverySurface {
    if (input.runtime.strategyId === 'wuyinkeji') {
        return 'wuyin-catalog';
    }

    if ((input.documentedModels || []).length > 0) {
        return 'documented-static-models';
    }

    if (input.runtime.protocolFamily === 'gemini-native') {
        return 'gemini-models';
    }

    if (input.runtime.protocolFamily === 'claude-native') {
        return 'claude-models';
    }

    return 'openai-models';
}

export function resolveProviderProbeMatrix(input: {
    runtime: ResolvedProviderRuntime;
    modelId?: string;
    compatibilityMode?: ProviderStrategyCompatibilityMode;
    documentedModels?: string[];
    isVideoModel?: boolean;
    isImageOnlyNativeModel?: boolean;
    isAsyncImageModel?: (modelId?: string) => boolean;
}): ProviderProbeMatrix {
    const modelDiscoverySurface = resolveModelDiscoverySurface({
        runtime: input.runtime,
        documentedModels: input.documentedModels,
    });
    const chatSurface = resolveChatSurface({
        runtime: input.runtime,
        modelId: input.modelId,
    });
    const imageSurface = resolveImageSurface({
        runtime: input.runtime,
        modelId: input.modelId,
        compatibilityMode: input.compatibilityMode,
        preferAsync: input.runtime.strategyId === '12ai' && Boolean(input.isAsyncImageModel?.(input.modelId)),
        isAsyncImageModel: input.isAsyncImageModel,
    });

    let protocolProbeSurface: ProbeSurface = chatSurface;
    let skipReason: ProbeSkipReason = null;

    if (input.isVideoModel) {
        protocolProbeSurface = modelDiscoverySurface;
        skipReason = 'video-billing-risk';
    } else if (input.runtime.protocolFamily === 'gemini-native' && input.isImageOnlyNativeModel) {
        protocolProbeSurface = modelDiscoverySurface;
        skipReason = 'native-image-billing-risk';
    } else if (
        input.runtime.protocolFamily === 'openai-compatible'
        && input.compatibilityMode === 'standard'
    ) {
        protocolProbeSurface = modelDiscoverySurface;
        skipReason = 'standard-mode-billing-risk';
    }

    return {
        availableSurfaces: uniqueSurfaces([
            modelDiscoverySurface,
            chatSurface,
            imageSurface,
        ]),
        modelDiscoverySurface,
        protocolProbeSurface,
        skipReason,
    };
}
