export type ResolvedImageSurface =
    | 'chat-image'
    | 'provider-images'
    | 'gemini-native-image'
    | 'async-image';

export type ResolvedChatSurface =
    | 'openai-chat'
    | 'openai-responses'
    | 'gemini-native-chat'
    | 'claude-messages';

export type ModelDiscoverySurface =
    | 'openai-models'
    | 'gemini-models'
    | 'claude-models'
    | 'documented-static-models'
    | 'wuyin-catalog';

export type ProbeSurface =
    | ModelDiscoverySurface
    | ResolvedChatSurface
    | ResolvedImageSurface;

export interface ChannelSurfaceView {
    modelDiscovery: ModelDiscoverySurface;
    chat: ResolvedChatSurface[];
    image: ResolvedImageSurface[];
    preferredChat: ResolvedChatSurface;
    preferredImage: ResolvedImageSurface | null;
    available: ProbeSurface[];
}
