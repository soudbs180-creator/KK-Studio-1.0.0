import type { ResolvedProviderRuntime } from '../api/providerStrategy';

export type ResolvedAdapterKind =
    | 'openai-compatible'
    | 'gemini-native'
    | 'claude-native';

export function resolveAdapterKind(runtime: ResolvedProviderRuntime): ResolvedAdapterKind {
    if (runtime.protocolFamily === 'claude-native') {
        return 'claude-native';
    }

    if (runtime.protocolFamily === 'gemini-native') {
        return 'gemini-native';
    }

    return 'openai-compatible';
}
