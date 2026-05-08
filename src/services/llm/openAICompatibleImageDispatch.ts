import type { ResolvedProviderRuntime } from '../api/providerStrategy';
import type { ResolvedImageSurface } from '../api/providerSurfaceTypes';

export type OpenAICompatibleImageDispatchKind =
    | 'async-image'
    | 'chat-strict'
    | 'chat'
    | 'gemini-native'
    | 'antigravity-chat'
    | 'antigravity-extended-with-native-fallback'
    | 'openai-strict'
    | 'siliconflow'
    | 'gpt-best-native'
    | '12ai-openai-strict'
    | 'suxi-openai-strict'
    | 'gemini-chat-strict-fail-closed'
    | 'provider-chat'
    | 'comfly-openai-strict'
    | 'default-openai-strict-fail-closed';

export interface OpenAICompatibleImageDispatchPlan {
    kind: OpenAICompatibleImageDispatchKind;
}

export interface OpenAICompatibleImageDispatchInput {
    runtime: ResolvedProviderRuntime;
    imageSurface: ResolvedImageSurface;
    isGeminiImage: boolean;
    endpointTypes?: string[];
    legacyGeminiChatGateway?: boolean;
    antigravityUsesChat?: boolean;
    useChatEndpoint?: boolean;
}

function endpointHintsInclude(endpointTypes: string[] | undefined, patterns: RegExp[]): boolean {
    return (endpointTypes || []).some((value) => {
        const normalized = String(value || '').trim().toLowerCase();
        return normalized && patterns.some((pattern) => pattern.test(normalized));
    });
}

export function resolveOpenAICompatibleImageDispatch(
    input: OpenAICompatibleImageDispatchInput,
): OpenAICompatibleImageDispatchPlan {
    if (input.imageSurface === 'async-image') {
        return { kind: 'async-image' };
    }

    if (input.imageSurface === 'chat-image') {
        if (input.isGeminiImage && !input.legacyGeminiChatGateway) {
            return { kind: 'chat-strict' };
        }
        return { kind: 'chat' };
    }

    if (input.imageSurface === 'gemini-native-image') {
        return { kind: 'gemini-native' };
    }

    if (input.runtime.strategyId === 'antigravity') {
        return input.antigravityUsesChat
            ? { kind: 'antigravity-chat' }
            : { kind: 'antigravity-extended-with-native-fallback' };
    }

    if (input.runtime.strategyId === 'openai') {
        return { kind: 'openai-strict' };
    }

    if (input.runtime.strategyId === 'siliconflow') {
        return { kind: 'siliconflow' };
    }

    if (input.runtime.strategyId === 'gpt-best') {
        const supportsImages = endpointHintsInclude(input.endpointTypes, [
            /image-generation/,
            /\/images\/generations/,
            /^images$/,
            /^generations$/,
        ]);
        const supportsChat = endpointHintsInclude(input.endpointTypes, [
            /chat/,
            /completions/,
        ]);

        if (!supportsImages && supportsChat) {
            return { kind: 'provider-chat' };
        }

        return { kind: 'gpt-best-native' };
    }

    if (input.runtime.strategyId === '12ai' && input.runtime.geminiNative) {
        return { kind: '12ai-openai-strict' };
    }

    if (input.runtime.strategyId === 'suxi') {
        return { kind: 'suxi-openai-strict' };
    }

    if (input.isGeminiImage) {
        return { kind: 'gemini-chat-strict-fail-closed' };
    }

    if (input.useChatEndpoint) {
        return { kind: 'provider-chat' };
    }

    if (input.runtime.strategyId === 'newapi') {
        return { kind: 'comfly-openai-strict' };
    }

    return { kind: 'default-openai-strict-fail-closed' };
}
