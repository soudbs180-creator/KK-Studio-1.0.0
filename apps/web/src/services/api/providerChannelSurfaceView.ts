import type { ResolvedProviderRuntime } from './providerStrategy.ts';
import { shouldBypassChatCompatibilityForImages } from './providerStrategy.ts';
import { resolveModelDiscoverySurface } from './providerProbeMatrix.ts';
import type {
    ChannelSurfaceView,
    ProbeSurface,
    ResolvedChatSurface,
    ResolvedImageSurface,
} from './providerSurfaceTypes.ts';

function uniqueItems<T>(items: T[]): T[] {
    return Array.from(new Set(items));
}

function supportsResponsesSurface(runtime: ResolvedProviderRuntime): boolean {
    return runtime.strategyId === 'openai'
        || runtime.strategyId === 'systemproxy'
        || runtime.providerFamily === 'newapi-family';
}

function resolveChannelChatSurfaces(runtime: ResolvedProviderRuntime): ResolvedChatSurface[] {
    if (runtime.protocolFamily === 'gemini-native') {
        return ['gemini-native-chat'];
    }

    if (runtime.protocolFamily === 'claude-native') {
        return ['claude-messages'];
    }

    const surfaces: ResolvedChatSurface[] = ['openai-chat'];
    if (supportsResponsesSurface(runtime)) {
        surfaces.push('openai-responses');
    }
    return uniqueItems(surfaces);
}

function resolveChannelImageSurfaces(runtime: ResolvedProviderRuntime): ResolvedImageSurface[] {
    const surfaces: ResolvedImageSurface[] = [];

    if (runtime.strategyId === '12ai') {
        surfaces.push('async-image');
    }

    if (runtime.supportedProtocolFamilies.includes('openai-compatible')) {
        surfaces.push('provider-images');
    }

    if (runtime.supportedProtocolFamilies.includes('gemini-native')) {
        surfaces.push('gemini-native-image');
    }

    if (runtime.compatibilityMode === 'chat' && !shouldBypassChatCompatibilityForImages(runtime)) {
        surfaces.push('chat-image');
    }

    return uniqueItems(surfaces);
}

export function buildChannelSurfaceView(input: {
    runtime: ResolvedProviderRuntime;
    documentedModels?: string[];
}): ChannelSurfaceView {
    const modelDiscovery = resolveModelDiscoverySurface({
        runtime: input.runtime,
        documentedModels: input.documentedModels,
    });
    const chat = resolveChannelChatSurfaces(input.runtime);
    const image = resolveChannelImageSurfaces(input.runtime);

    return {
        modelDiscovery,
        chat,
        image,
        preferredChat: chat[0],
        preferredImage: image[0] ?? null,
        available: uniqueItems<ProbeSurface>([
            modelDiscovery,
            ...chat,
            ...image,
        ]),
    };
}
