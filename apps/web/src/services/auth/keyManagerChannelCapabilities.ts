import type { ChannelConfig } from '../api/channelConfig';
import { categorizeModels, parseModelString } from './keyManagerModelHelpers.ts';

export function buildChannelCapabilities(
    models: string[],
    pricingSupport: ChannelConfig['pricingSupport'],
    managementSupport: ChannelConfig['managementSupport'],
): ChannelConfig['capabilities'] {
    const normalizedModels = Array.isArray(models) ? models : [];
    const hasWildcard = normalizedModels.includes('*');
    const categorized = categorizeModels(normalizedModels.map((item) => parseModelString(item).id));
    const lowerModels = normalizedModels.map((item) => parseModelString(item).id.toLowerCase());

    return {
        chat: hasWildcard || categorized.chatModels.length > 0 || normalizedModels.length === 0,
        image: hasWildcard || categorized.imageModels.length > 0,
        video: hasWildcard || categorized.videoModels.length > 0,
        audio: hasWildcard || lowerModels.some((model) => /audio|tts|suno|lyria|minimax-t2a/i.test(model)),
        modelDiscovery: true,
        pricingDiscovery: pricingSupport === 'native',
        managementApi: managementSupport === 'native',
    };
}
