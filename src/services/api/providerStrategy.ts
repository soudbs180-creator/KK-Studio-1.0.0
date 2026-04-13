import type { Provider } from '../../types.ts';
import type {
    ChannelEndpointStyle,
    ChannelManagementSupport,
    ChannelPricingSupport,
    ProtocolFamily,
    ProviderFamily,
} from './channelConfig.ts';
import { detectRequestProfileEvidence, resolveLocalRequestProfile, type RequestProfileId } from './requestProfileRegistry.ts';

export type ProviderStrategyFormat = 'auto' | 'openai' | 'gemini' | 'claude';
export type ProviderStrategyAuthMethod = 'query' | 'header';
export type ProviderStrategyAuthorizationValueFormat = 'bearer' | 'raw';
export type ProviderStrategyCompatibilityMode = 'standard' | 'chat';
export type ProviderStrategyImageProfile =
    | 'openai-strict'
    | 'siliconflow'
    | 'gpt-best-extended'
    | 'antigravity'
    | 'chat-preferred';
export type ProviderStrategyImageRoutingPolicy = 'chat-first' | 'surface-first';
export type ProviderStrategyVideoApiStyle =
    | 'openai-v1-videos'
    | 'legacy-video-generations'
    | 'unified-v2-generations';

export interface ProviderStrategy {
    id: string;
    label: string;
    known: boolean;
    providerFamily: ProviderFamily;
    providerPatterns?: RegExp[];
    hostPatterns?: RegExp[];
    basePatterns?: RegExp[];
    defaultFormat?: ProviderStrategyFormat;
    supportedFormats?: ProviderStrategyFormat[];
    defaultAuthMethod?: ProviderStrategyAuthMethod;
    geminiAuthMethod?: ProviderStrategyAuthMethod;
    claudeAuthMethod?: ProviderStrategyAuthMethod;
    defaultHeaderName?: string;
    geminiHeaderName?: string;
    claudeHeaderName?: string;
    authorizationValueFormat?: ProviderStrategyAuthorizationValueFormat;
    geminiAuthorizationValueFormat?: ProviderStrategyAuthorizationValueFormat;
    claudeAuthorizationValueFormat?: ProviderStrategyAuthorizationValueFormat;
    defaultCompatibilityMode?: ProviderStrategyCompatibilityMode;
    imageProfile?: ProviderStrategyImageProfile;
    imageRoutingPolicy?: ProviderStrategyImageRoutingPolicy;
    videoApiStyle?: ProviderStrategyVideoApiStyle;
    pricingSupport?: ChannelPricingSupport;
    managementSupport?: ChannelManagementSupport;
    uiProvider?: Provider | 'Custom';
    respectProviderOnCustomHost?: boolean;
}

export interface ProviderRuntimeInput {
    provider?: string | Provider;
    baseUrl?: string;
    format?: unknown;
    authMethod?: unknown;
    headerName?: string;
    compatibilityMode?: unknown;
    modelId?: string;
    fallbackFormat?: Exclude<ProviderStrategyFormat, 'auto'>;
}

export interface ResolvedProviderRuntime {
    strategy: ProviderStrategy;
    strategyId: string;
    requestProfileId: RequestProfileId;
    providerName: string;
    providerFamily: ProviderFamily;
    protocolFamily: ProtocolFamily;
    pricingSupport: ChannelPricingSupport;
    managementSupport: ChannelManagementSupport;
    endpointStyle: ChannelEndpointStyle;
    supportedProtocolFamilies: ProtocolFamily[];
    baseUrl: string;
    host: string;
    requestedFormat: ProviderStrategyFormat;
    resolvedFormat: Exclude<ProviderStrategyFormat, 'auto'>;
    authMethod: ProviderStrategyAuthMethod;
    headerName: string;
    authorizationValueFormat: ProviderStrategyAuthorizationValueFormat;
    compatibilityMode: ProviderStrategyCompatibilityMode;
    geminiNative: boolean;
    claudeNative: boolean;
    imageProfile: ProviderStrategyImageProfile;
    imageRoutingPolicy: ProviderStrategyImageRoutingPolicy;
    videoApiStyle: ProviderStrategyVideoApiStyle;
    isKnownProvider: boolean;
    uiProvider: Provider | 'Custom';
}

export interface ProviderEvidence {
    providerId: 'gpt-best' | 'unknown';
    confidence: 'high' | 'medium' | 'low';
    sourceType: 'explicit-provider' | 'docs-url' | 'api-base' | 'unknown';
    isDocumentationUrl: boolean;
    canUseAsApiBaseUrl: boolean;
    reason: string;
}

export type ProviderRuntime = ResolvedProviderRuntime;

const GOOGLE_API_HEADER = 'x-goog-api-key';
const CLAUDE_API_HEADER = 'x-api-key';
const AUTHORIZATION_HEADER = 'Authorization';

const FALLBACK_STRATEGY: ProviderStrategy = {
    id: 'generic-openai',
    label: 'Generic OpenAI-Compatible',
    known: false,
    providerFamily: 'generic-openai',
    defaultFormat: 'openai',
    supportedFormats: ['openai', 'gemini', 'claude'],
    defaultAuthMethod: 'header',
    geminiAuthMethod: 'header',
    claudeAuthMethod: 'header',
    defaultHeaderName: AUTHORIZATION_HEADER,
    geminiHeaderName: AUTHORIZATION_HEADER,
    claudeHeaderName: AUTHORIZATION_HEADER,
    authorizationValueFormat: 'bearer',
    geminiAuthorizationValueFormat: 'bearer',
    claudeAuthorizationValueFormat: 'bearer',
    defaultCompatibilityMode: 'standard',
    imageProfile: 'openai-strict',
    imageRoutingPolicy: 'chat-first',
    videoApiStyle: 'openai-v1-videos',
    pricingSupport: 'none',
    managementSupport: 'none',
    respectProviderOnCustomHost: true,
    uiProvider: 'Custom',
};

const PROVIDER_STRATEGIES: ProviderStrategy[] = [
    {
        id: 'systemproxy',
        label: 'System Proxy',
        known: true,
        providerFamily: 'system-proxy',
        providerPatterns: [/^systemproxy$/i],
        defaultFormat: 'openai',
        supportedFormats: ['openai'],
        defaultAuthMethod: 'header',
        defaultHeaderName: AUTHORIZATION_HEADER,
        authorizationValueFormat: 'bearer',
        defaultCompatibilityMode: 'chat',
        imageProfile: 'openai-strict',
        videoApiStyle: 'openai-v1-videos',
        pricingSupport: 'none',
        managementSupport: 'none',
        respectProviderOnCustomHost: true,
        uiProvider: 'Custom',
    },
    {
        id: 'google',
        label: 'Google Gemini',
        known: true,
        providerFamily: 'google-official',
        providerPatterns: [/^google$/i, /^gemini$/i],
        hostPatterns: [/^generativelanguage\.googleapis\.com$/i],
        basePatterns: [/googleapis\.com/i, /generativelanguage\.googleapis\.com/i],
        defaultFormat: 'gemini',
        supportedFormats: ['gemini'],
        defaultAuthMethod: 'query',
        geminiAuthMethod: 'query',
        defaultHeaderName: GOOGLE_API_HEADER,
        geminiHeaderName: GOOGLE_API_HEADER,
        authorizationValueFormat: 'raw',
        geminiAuthorizationValueFormat: 'raw',
        defaultCompatibilityMode: 'standard',
        imageProfile: 'openai-strict',
        videoApiStyle: 'openai-v1-videos',
        pricingSupport: 'none',
        managementSupport: 'none',
        respectProviderOnCustomHost: false,
        uiProvider: 'Google',
    },
    {
        id: '12ai',
        label: '12AI',
        known: true,
        providerFamily: '12ai',
        providerPatterns: [/^12ai$/i, /^12\s*ai$/i],
        hostPatterns: [/^cdn\.12ai\.org$/i, /^new\.12ai\.org$/i, /^hk\.12ai\.org$/i, /(^|\.)12ai\.(org|xyz|io|net)$/i],
        basePatterns: [/12ai\.(org|xyz|io|net)/i],
        defaultFormat: 'gemini',
        supportedFormats: ['openai', 'gemini', 'claude'],
        defaultAuthMethod: 'header',
        geminiAuthMethod: 'query',
        claudeAuthMethod: 'header',
        defaultHeaderName: AUTHORIZATION_HEADER,
        geminiHeaderName: GOOGLE_API_HEADER,
        claudeHeaderName: AUTHORIZATION_HEADER,
        authorizationValueFormat: 'bearer',
        geminiAuthorizationValueFormat: 'raw',
        claudeAuthorizationValueFormat: 'bearer',
        defaultCompatibilityMode: 'standard',
        imageProfile: 'openai-strict',
        imageRoutingPolicy: 'surface-first',
        videoApiStyle: 'openai-v1-videos',
        pricingSupport: 'manual',
        managementSupport: 'none',
        respectProviderOnCustomHost: true,
        uiProvider: '12AI',
    },
    {
        id: 'flow2api',
        label: 'Flow2API',
        known: true,
        providerFamily: 'generic-openai',
        providerPatterns: [/^flow2api$/i, /^flow-2-api$/i, /^flow 2 api$/i],
        basePatterns: [/flow2api/i],
        defaultFormat: 'openai',
        supportedFormats: ['openai', 'gemini'],
        defaultAuthMethod: 'header',
        geminiAuthMethod: 'header',
        defaultHeaderName: AUTHORIZATION_HEADER,
        geminiHeaderName: GOOGLE_API_HEADER,
        authorizationValueFormat: 'bearer',
        geminiAuthorizationValueFormat: 'raw',
        defaultCompatibilityMode: 'chat',
        imageProfile: 'chat-preferred',
        imageRoutingPolicy: 'chat-first',
        videoApiStyle: 'openai-v1-videos',
        pricingSupport: 'manual',
        managementSupport: 'none',
        respectProviderOnCustomHost: true,
        uiProvider: 'Flow2API',
    },
    {
        id: 'wuyinkeji',
        label: 'Wuyin Keji',
        known: true,
        providerFamily: 'newapi-family',
        providerPatterns: [/^wuyin$/i, /^wuyinkeji$/i, /^wuyin(\s+keji)?$/i],
        basePatterns: [/api\.wuyinkeji\.com/i, /wuyinkeji/i],
        defaultFormat: 'openai',
        supportedFormats: ['openai', 'gemini'],
        defaultAuthMethod: 'header',
        geminiAuthMethod: 'query',
        defaultHeaderName: AUTHORIZATION_HEADER,
        geminiHeaderName: AUTHORIZATION_HEADER,
        authorizationValueFormat: 'raw',
        geminiAuthorizationValueFormat: 'raw',
        defaultCompatibilityMode: 'standard',
        imageProfile: 'openai-strict',
        videoApiStyle: 'openai-v1-videos',
        pricingSupport: 'native',
        managementSupport: 'native',
        respectProviderOnCustomHost: true,
        uiProvider: 'Custom',
    },
    {
        id: 'newapi',
        label: 'NewAPI / OneAPI',
        known: true,
        providerFamily: 'newapi-family',
        providerPatterns: [/^newapi$/i, /^new-api$/i, /^oneapi$/i, /^one-api$/i, /^cherry(\s+studio)?$/i],
        hostPatterns: [
            /^ai\.newapi\.pro$/i,
            /^docs\.newapi\.pro$/i,
            /(^|\.)newapi\./i,
            /(^|\.)new-api\./i,
            /(^|\.)oneapi\./i,
            /(^|\.)one-api\./i,
        ],
        basePatterns: [/newapi/i, /new-api/i, /oneapi/i, /one-api/i, /future-api/i, /vodeshop/i],
        defaultFormat: 'openai',
        supportedFormats: ['openai', 'gemini'],
        defaultAuthMethod: 'header',
        geminiAuthMethod: 'header',
        defaultHeaderName: AUTHORIZATION_HEADER,
        geminiHeaderName: AUTHORIZATION_HEADER,
        authorizationValueFormat: 'bearer',
        geminiAuthorizationValueFormat: 'bearer',
        defaultCompatibilityMode: 'standard',
        imageProfile: 'openai-strict',
        videoApiStyle: 'openai-v1-videos',
        pricingSupport: 'native',
        managementSupport: 'native',
        respectProviderOnCustomHost: true,
        uiProvider: 'Custom',
    },
    {
        id: 'suxi',
        label: 'Suxi',
        known: true,
        providerFamily: 'newapi-family',
        providerPatterns: [/^suxi$/i, /^new[-\s]*suxi(?:\s*ai)?$/i, /^newsuxi(?:ai)?$/i],
        hostPatterns: [/^suxi\.ai$/i, /^new\.suxi\.ai$/i, /(^|\.)suxi\./i],
        basePatterns: [/new\.suxi\.ai/i, /suxi/i],
        defaultFormat: 'openai',
        supportedFormats: ['openai', 'gemini', 'claude'],
        defaultAuthMethod: 'header',
        geminiAuthMethod: 'header',
        claudeAuthMethod: 'header',
        defaultHeaderName: AUTHORIZATION_HEADER,
        geminiHeaderName: AUTHORIZATION_HEADER,
        claudeHeaderName: AUTHORIZATION_HEADER,
        authorizationValueFormat: 'bearer',
        geminiAuthorizationValueFormat: 'bearer',
        claudeAuthorizationValueFormat: 'bearer',
        defaultCompatibilityMode: 'chat',
        imageProfile: 'chat-preferred',
        imageRoutingPolicy: 'surface-first',
        videoApiStyle: 'legacy-video-generations',
        pricingSupport: 'native',
        managementSupport: 'native',
        respectProviderOnCustomHost: true,
        uiProvider: 'Custom',
    },
    {
        id: 'acedata',
        label: 'AceData',
        known: true,
        providerFamily: 'generic-openai',
        providerPatterns: [/^acedata$/i, /^ace-data$/i],
        hostPatterns: [/^api\.acedata\.cloud$/i],
        basePatterns: [/api\.acedata\.cloud/i, /acedata/i],
        defaultFormat: 'openai',
        supportedFormats: ['openai'],
        defaultAuthMethod: 'header',
        defaultHeaderName: AUTHORIZATION_HEADER,
        authorizationValueFormat: 'bearer',
        defaultCompatibilityMode: 'standard',
        imageProfile: 'openai-strict',
        videoApiStyle: 'openai-v1-videos',
        pricingSupport: 'manual',
        managementSupport: 'none',
        respectProviderOnCustomHost: true,
        uiProvider: 'Custom',
    },
    {
        id: 'openrouter',
        label: 'OpenRouter',
        known: true,
        providerFamily: 'generic-openai',
        providerPatterns: [/^openrouter$/i],
        hostPatterns: [/^openrouter\.ai$/i],
        basePatterns: [/openrouter/i],
        defaultFormat: 'openai',
        supportedFormats: ['openai'],
        defaultAuthMethod: 'header',
        defaultHeaderName: AUTHORIZATION_HEADER,
        authorizationValueFormat: 'bearer',
        defaultCompatibilityMode: 'standard',
        imageProfile: 'openai-strict',
        videoApiStyle: 'openai-v1-videos',
        pricingSupport: 'manual',
        managementSupport: 'external',
        respectProviderOnCustomHost: true,
        uiProvider: 'OpenAI',
    },
    {
        id: 'openai',
        label: 'OpenAI',
        known: true,
        providerFamily: 'generic-openai',
        providerPatterns: [/^openai$/i],
        hostPatterns: [/^api\.openai\.com$/i],
        basePatterns: [/api\.openai\.com/i],
        defaultFormat: 'openai',
        supportedFormats: ['openai'],
        defaultAuthMethod: 'header',
        defaultHeaderName: AUTHORIZATION_HEADER,
        authorizationValueFormat: 'bearer',
        defaultCompatibilityMode: 'standard',
        imageProfile: 'openai-strict',
        videoApiStyle: 'openai-v1-videos',
        pricingSupport: 'manual',
        managementSupport: 'external',
        respectProviderOnCustomHost: true,
        uiProvider: 'OpenAI',
    },
    {
        id: 'anthropic',
        label: 'Anthropic',
        known: true,
        providerFamily: 'claude-native',
        providerPatterns: [/^anthropic$/i],
        hostPatterns: [/^api\.anthropic\.com$/i],
        basePatterns: [/anthropic\.com/i],
        defaultFormat: 'claude',
        supportedFormats: ['claude'],
        defaultAuthMethod: 'header',
        claudeAuthMethod: 'header',
        defaultHeaderName: CLAUDE_API_HEADER,
        claudeHeaderName: CLAUDE_API_HEADER,
        authorizationValueFormat: 'raw',
        claudeAuthorizationValueFormat: 'raw',
        defaultCompatibilityMode: 'standard',
        imageProfile: 'openai-strict',
        videoApiStyle: 'openai-v1-videos',
        pricingSupport: 'none',
        managementSupport: 'none',
        respectProviderOnCustomHost: true,
        uiProvider: 'Anthropic',
    },
    {
        id: 'siliconflow',
        label: 'SiliconFlow',
        known: true,
        providerFamily: 'generic-openai',
        providerPatterns: [/^siliconflow$/i],
        hostPatterns: [/^api\.siliconflow\.cn$/i],
        basePatterns: [/siliconflow/i],
        defaultFormat: 'openai',
        supportedFormats: ['openai'],
        defaultAuthMethod: 'header',
        defaultHeaderName: AUTHORIZATION_HEADER,
        authorizationValueFormat: 'bearer',
        defaultCompatibilityMode: 'chat',
        imageProfile: 'siliconflow',
        videoApiStyle: 'openai-v1-videos',
        pricingSupport: 'manual',
        managementSupport: 'external',
        respectProviderOnCustomHost: true,
        uiProvider: 'SiliconFlow',
    },
    {
        id: 'antigravity',
        label: 'Antigravity',
        known: true,
        providerFamily: 'generic-openai',
        providerPatterns: [/^antigravity$/i],
        basePatterns: [/127\.0\.0\.1:8045/i, /localhost:8045/i, /antigravity/i],
        defaultFormat: 'openai',
        supportedFormats: ['openai'],
        defaultAuthMethod: 'header',
        defaultHeaderName: AUTHORIZATION_HEADER,
        authorizationValueFormat: 'bearer',
        defaultCompatibilityMode: 'chat',
        imageProfile: 'antigravity',
        videoApiStyle: 'legacy-video-generations',
        pricingSupport: 'native',
        managementSupport: 'native',
        respectProviderOnCustomHost: true,
        uiProvider: 'Custom',
    },
    {
        id: 'gpt-best',
        label: 'GPT-Best',
        known: true,
        providerFamily: 'newapi-family',
        providerPatterns: [/^gpt-best$/i, /^gptbest$/i, /^gpt\s*best$/i],
        basePatterns: [/gpt-best/i, /gptbest/i],
        defaultFormat: 'openai',
        supportedFormats: ['openai', 'gemini', 'claude'],
        defaultAuthMethod: 'header',
        geminiAuthMethod: 'header',
        claudeAuthMethod: 'header',
        defaultHeaderName: AUTHORIZATION_HEADER,
        geminiHeaderName: AUTHORIZATION_HEADER,
        claudeHeaderName: AUTHORIZATION_HEADER,
        authorizationValueFormat: 'bearer',
        geminiAuthorizationValueFormat: 'bearer',
        claudeAuthorizationValueFormat: 'bearer',
        defaultCompatibilityMode: 'standard',
        imageProfile: 'gpt-best-extended',
        imageRoutingPolicy: 'surface-first',
        videoApiStyle: 'unified-v2-generations',
        pricingSupport: 'native',
        managementSupport: 'native',
        respectProviderOnCustomHost: true,
        uiProvider: 'Custom',
    },
    {
        id: 'deepseek',
        label: 'DeepSeek',
        known: true,
        providerFamily: 'generic-openai',
        providerPatterns: [/^deepseek$/i],
        hostPatterns: [/^api\.deepseek\.com$/i],
        basePatterns: [/deepseek/i],
        defaultFormat: 'openai',
        supportedFormats: ['openai'],
        defaultAuthMethod: 'header',
        defaultHeaderName: AUTHORIZATION_HEADER,
        authorizationValueFormat: 'bearer',
        defaultCompatibilityMode: 'chat',
        imageProfile: 'openai-strict',
        videoApiStyle: 'openai-v1-videos',
        pricingSupport: 'manual',
        managementSupport: 'external',
        respectProviderOnCustomHost: true,
        uiProvider: 'OpenAI',
    },
    {
        id: 'volcengine',
        label: 'Volcengine',
        known: true,
        providerFamily: 'generic-openai',
        providerPatterns: [/^volcengine$/i],
        basePatterns: [/volces\.com/i],
        defaultFormat: 'openai',
        supportedFormats: ['openai'],
        defaultAuthMethod: 'header',
        defaultHeaderName: AUTHORIZATION_HEADER,
        authorizationValueFormat: 'bearer',
        defaultCompatibilityMode: 'chat',
        imageProfile: 'openai-strict',
        videoApiStyle: 'openai-v1-videos',
        pricingSupport: 'manual',
        managementSupport: 'external',
        respectProviderOnCustomHost: true,
        uiProvider: 'Volcengine',
    },
    {
        id: 'aliyun',
        label: 'Aliyun',
        known: true,
        providerFamily: 'generic-openai',
        providerPatterns: [/^aliyun$/i],
        basePatterns: [/aliyuncs\.com/i],
        defaultFormat: 'openai',
        supportedFormats: ['openai'],
        defaultAuthMethod: 'header',
        defaultHeaderName: AUTHORIZATION_HEADER,
        authorizationValueFormat: 'bearer',
        defaultCompatibilityMode: 'chat',
        imageProfile: 'openai-strict',
        videoApiStyle: 'openai-v1-videos',
        pricingSupport: 'manual',
        managementSupport: 'external',
        respectProviderOnCustomHost: true,
        uiProvider: 'Aliyun',
    },
    {
        id: 'tencent',
        label: 'Tencent',
        known: true,
        providerFamily: 'generic-openai',
        providerPatterns: [/^tencent$/i],
        basePatterns: [/tencent\.com/i, /tencentcloudapi/i],
        defaultFormat: 'openai',
        supportedFormats: ['openai'],
        defaultAuthMethod: 'header',
        defaultHeaderName: AUTHORIZATION_HEADER,
        authorizationValueFormat: 'bearer',
        defaultCompatibilityMode: 'chat',
        imageProfile: 'openai-strict',
        videoApiStyle: 'openai-v1-videos',
        pricingSupport: 'manual',
        managementSupport: 'external',
        respectProviderOnCustomHost: true,
        uiProvider: 'Tencent',
    },
];

function normalizeBaseUrl(baseUrl?: string): string {
    return String(baseUrl || '').trim().replace(/\/+$/, '');
}

function normalizeProviderName(provider?: string | Provider): string {
    return String(provider || '').trim().toLowerCase();
}

function normalizeProviderAlias(provider?: string | Provider): string {
    return String(provider || '').trim().toLowerCase().replace(/\s+/g, ' ');
}

function normalizeFormat(format: unknown, fallback: ProviderStrategyFormat = 'auto'): ProviderStrategyFormat {
    const normalized = String(format || '').trim().toLowerCase();
    if (normalized === 'openai' || normalized === 'gemini' || normalized === 'claude' || normalized === 'auto') {
        return normalized;
    }
    return fallback;
}

function normalizeAuthMethod(authMethod: unknown): ProviderStrategyAuthMethod | undefined {
    const normalized = String(authMethod || '').trim().toLowerCase();
    if (normalized === 'query' || normalized === 'header') {
        return normalized;
    }
    return undefined;
}

function normalizeCompatibilityMode(mode: unknown): ProviderStrategyCompatibilityMode | undefined {
    const normalized = String(mode || '').trim().toLowerCase();
    if (normalized === 'standard' || normalized === 'chat') {
        return normalized;
    }
    return undefined;
}

function normalizeHost(baseUrl?: string): string {
    const raw = normalizeBaseUrl(baseUrl);
    if (!raw) return '';

    const candidates = /^https?:\/\//i.test(raw) ? [raw] : [`https://${raw}`, `http://${raw}`];
    for (const candidate of candidates) {
        try {
            return new URL(candidate).hostname.toLowerCase();
        } catch {
            continue;
        }
    }

    return raw.toLowerCase();
}

export function isLikelyDocumentationBaseUrl(baseUrl?: string): boolean {
    const raw = normalizeBaseUrl(baseUrl);
    if (!raw) return false;

    const host = normalizeHost(raw);
    if (host === 'apifox.cn' || host.endsWith('.apifox.cn')) {
        return true;
    }

    const candidates = /^https?:\/\//i.test(raw) ? [raw] : [`https://${raw}`, `http://${raw}`];
    for (const candidate of candidates) {
        try {
            const pathname = new URL(candidate).pathname.toLowerCase();
            if (/\/(?:llms\.txt|doc-\d+\.md|api-\d+\.md|schema-\d+\.md)$/.test(pathname)) {
                return true;
            }
        } catch {
            continue;
        }
    }

    return /\/(?:llms\.txt|doc-\d+\.md|api-\d+\.md|schema-\d+\.md)(?:$|[?#])/i.test(raw);
}

export function detectGptBestEvidence(input: {
    provider?: string | Provider;
    baseUrl?: string;
}): ProviderEvidence {
    const evidence = detectRequestProfileEvidence({
        provider: typeof input.provider === 'string' ? input.provider : String(input.provider || ''),
        baseUrl: input.baseUrl,
    }, 'gpt-best');

    if (evidence.profileId === 'gpt-best' && evidence.sourceType === 'explicit-provider') {
        return {
            providerId: 'gpt-best',
            confidence: 'high',
            sourceType: 'explicit-provider',
            isDocumentationUrl: evidence.isDocumentationUrl,
            canUseAsApiBaseUrl: evidence.canUseAsApiBaseUrl,
            reason: evidence.isDocumentationUrl
                ? 'Matched GPT Best provider alias and Apifox documentation URL.'
                : 'Matched GPT Best provider alias.',
        };
    }

    if (evidence.profileId === 'gpt-best' && evidence.sourceType === 'docs-url') {
        return {
            providerId: 'gpt-best',
            confidence: 'medium',
            sourceType: 'docs-url',
            isDocumentationUrl: true,
            canUseAsApiBaseUrl: false,
            reason: 'Matched GPT Best Apifox documentation URL.',
        };
    }

    if (evidence.profileId === 'gpt-best' && evidence.sourceType === 'api-base') {
        return {
            providerId: 'gpt-best',
            confidence: 'medium',
            sourceType: 'api-base',
            isDocumentationUrl: false,
            canUseAsApiBaseUrl: true,
            reason: 'Host looks like a GPT Best API domain.',
        };
    }

    return {
        providerId: 'unknown',
        confidence: 'low',
        sourceType: 'unknown',
        isDocumentationUrl: false,
        canUseAsApiBaseUrl: false,
        reason: 'No GPT Best evidence found.',
    };
}

function matchesAny(patterns: RegExp[] | undefined, value: string): boolean {
    if (!patterns || !value) return false;
    return patterns.some((pattern) => pattern.test(value));
}

function findStrategyByBase(baseUrl?: string): ProviderStrategy | undefined {
    const normalizedBase = normalizeBaseUrl(baseUrl).toLowerCase();
    const host = normalizeHost(baseUrl);
    if (!normalizedBase && !host) return undefined;

    return PROVIDER_STRATEGIES.find((strategy) =>
        matchesAny(strategy.hostPatterns, host) || matchesAny(strategy.basePatterns, normalizedBase),
    );
}

function findStrategyByProvider(provider?: string | Provider): ProviderStrategy | undefined {
    const normalizedProvider = normalizeProviderName(provider);
    if (!normalizedProvider) return undefined;

    return PROVIDER_STRATEGIES.find((strategy) => matchesAny(strategy.providerPatterns, normalizedProvider));
}

function toProtocolFamily(format: Exclude<ProviderStrategyFormat, 'auto'>): ProtocolFamily {
    if (format === 'gemini') return 'gemini-native';
    if (format === 'claude') return 'claude-native';
    return 'openai-compatible';
}

function toProviderFamily(strategy: ProviderStrategy, protocolFamily: ProtocolFamily): ProviderFamily {
    if (strategy.providerFamily === 'generic-openai') {
        if (protocolFamily === 'gemini-native') return 'generic-gemini';
        if (protocolFamily === 'claude-native') return 'claude-native';
    }

    if (strategy.providerFamily === 'claude-native') {
        return 'claude-native';
    }

    return strategy.providerFamily;
}

function toEndpointStyle(strategy: ProviderStrategy, protocolFamily: ProtocolFamily): ChannelEndpointStyle {
    if (strategy.providerFamily === 'system-proxy') return 'system-proxy';
    if (strategy.providerFamily === 'google-official' && protocolFamily === 'gemini-native') return 'google-official';
    if (protocolFamily === 'gemini-native') return 'gemini-native';
    if (protocolFamily === 'claude-native') return 'claude-native';
    return 'openai-compatible';
}

function resolveSupportedProtocolFamilies(strategy: ProviderStrategy): ProtocolFamily[] {
    const formats = strategy.supportedFormats?.length
        ? strategy.supportedFormats
        : [strategy.defaultFormat || 'openai'];

    return Array.from(new Set(
        formats
            .filter((format): format is Exclude<ProviderStrategyFormat, 'auto'> => format !== 'auto')
            .map(toProtocolFamily),
    ));
}

export function isGeminiFamilyModel(modelId?: string): boolean {
    const lower = String(modelId || '').trim().split('@')[0].toLowerCase();
    return lower.startsWith('gemini-') || lower.startsWith('imagen-') || lower.startsWith('veo-');
}

const PROVIDER_IMAGE_MODEL_ALIASES: Record<string, string> = {
    'nano-banana': 'gemini-2.5-flash-image',
    'nano banana': 'gemini-2.5-flash-image',
    'nano-banana-pro': 'gemini-3-pro-image-preview',
    'nano banana pro': 'gemini-3-pro-image-preview',
    'nano-banana-2': 'gemini-3.1-flash-image-preview',
    'nano banana 2': 'gemini-3.1-flash-image-preview',
};

const TWELVE_AI_SUPPORTED_IMAGE_MODELS = new Set([
    'gemini-2.5-flash-image',
    'gemini-2.5-flash-image-c',
    'gemini-3.1-flash-image-preview',
    'gemini-3-pro-image-preview',
    'gemini-3-pro-image-preview-c',
]);

function normalizeProviderCompatibilityModelId(modelId?: string): string {
    const [rawBaseModelId] = String(modelId || '').trim().split('@');
    const cleaned = rawBaseModelId.replace(/^models\//i, '').trim().toLowerCase();
    if (!cleaned) return '';

    const normalizedWhitespace = cleaned.replace(/\s+/g, ' ');
    if (PROVIDER_IMAGE_MODEL_ALIASES[normalizedWhitespace]) {
        return PROVIDER_IMAGE_MODEL_ALIASES[normalizedWhitespace];
    }

    const dashed = normalizedWhitespace.replace(/\s+/g, '-');
    return PROVIDER_IMAGE_MODEL_ALIASES[dashed] || dashed;
}

function looksLikeImageModel(modelId: string): boolean {
    return modelId.includes('image')
        || modelId.includes('nano')
        || modelId.includes('banana')
        || modelId.startsWith('imagen-');
}

function looksLikeVideoModel(modelId: string): boolean {
    return /(veo|sora|seedance|runway|luma|kling|pika|video)/i.test(modelId);
}

export function resolveProviderModelCompatibilityIssue(input: {
    provider?: string | Provider;
    baseUrl?: string;
    modelId?: string;
}): string | null {
    const normalizedModelId = normalizeProviderCompatibilityModelId(input.modelId);
    if (!normalizedModelId) {
        return null;
    }

    const runtime = resolveProviderRuntime({
        provider: input.provider,
        baseUrl: input.baseUrl,
        modelId: normalizedModelId,
    });

    if (
        runtime.strategyId === '12ai'
        && looksLikeImageModel(normalizedModelId)
        && !TWELVE_AI_SUPPORTED_IMAGE_MODELS.has(normalizedModelId)
    ) {
        return `12AI 图片路由当前只支持 gemini-2.5-flash-image、gemini-3.1-flash-image-preview 和 gemini-3-pro-image-preview，当前模型 ${normalizedModelId} 不在 12AI 文档支持列表中。`;
    }

    if (runtime.strategyId === 'flow2api' && looksLikeVideoModel(normalizedModelId)) {
        return `Flow2API is currently supported in KK Studio only as an image gateway. Video model ${normalizedModelId} is not wired into KK Studio task polling yet.`;
    }

    return null;
}

export function isProviderModelCompatible(input: {
    provider?: string | Provider;
    baseUrl?: string;
    modelId?: string;
}): boolean {
    return !resolveProviderModelCompatibilityIssue(input);
}

export function shouldBypassChatCompatibilityForImages(
    input: ProviderRuntimeInput | ResolvedProviderRuntime,
): boolean {
    const runtime = 'strategy' in input ? input : resolveProviderRuntime(input);
    return runtime.imageRoutingPolicy === 'surface-first';
}

export function resolveProviderStrategy(provider?: string | Provider, baseUrl?: string): ProviderStrategy {
    const gptBestEvidence = detectGptBestEvidence({ provider, baseUrl });
    if (gptBestEvidence.providerId === 'gpt-best') {
        const gptBestStrategy = PROVIDER_STRATEGIES.find((strategy) => strategy.id === 'gpt-best');
        if (gptBestStrategy) {
            return gptBestStrategy;
        }
    }

    const baseMatch = findStrategyByBase(baseUrl);
    if (baseMatch) {
        return baseMatch;
    }

    const providerMatch = findStrategyByProvider(provider);
    if (!providerMatch) {
        return FALLBACK_STRATEGY;
    }

    if (normalizeBaseUrl(baseUrl) && providerMatch.respectProviderOnCustomHost === false) {
        return FALLBACK_STRATEGY;
    }

    return providerMatch;
}

export function resolveProviderRuntime(input: ProviderRuntimeInput = {}): ResolvedProviderRuntime {
    const strategy = resolveProviderStrategy(input.provider, input.baseUrl);
    const requestProfileId = resolveLocalRequestProfile({
        provider: typeof input.provider === 'string' ? input.provider : String(input.provider || ''),
        baseUrl: input.baseUrl,
    }).id;
    const requestedFormat = normalizeFormat(
        input.format,
        strategy.defaultFormat === 'gemini'
            ? 'gemini'
            : strategy.defaultFormat === 'claude'
                ? 'claude'
                : 'auto',
    );
    const strategyFallback = strategy.defaultFormat && strategy.defaultFormat !== 'auto'
        ? strategy.defaultFormat
        : 'openai';
    const fallbackFormat = input.fallbackFormat || strategyFallback;
    const supportedFormats = (strategy.supportedFormats || []).filter(
        (format): format is Exclude<ProviderStrategyFormat, 'auto'> => format !== 'auto',
    );
    const preferredFormat = requestedFormat === 'auto' ? fallbackFormat : requestedFormat;
    const resolvedFormat = supportedFormats.length > 0 && !supportedFormats.includes(preferredFormat)
        ? supportedFormats[0]
        : preferredFormat;
    const protocolFamily = toProtocolFamily(resolvedFormat);
    const providerFamily = toProviderFamily(strategy, protocolFamily);

    let authMethod = normalizeAuthMethod(input.authMethod)
        || (
            protocolFamily === 'gemini-native'
                ? (strategy.geminiAuthMethod || strategy.defaultAuthMethod || 'header')
                : protocolFamily === 'claude-native'
                    ? (strategy.claudeAuthMethod || strategy.defaultAuthMethod || 'header')
                    : (strategy.defaultAuthMethod || 'header')
        );

    if (strategy.id === 'gpt-best') {
        authMethod = 'header';
    }

    const defaultHeaderName = protocolFamily === 'gemini-native'
        ? (strategy.geminiHeaderName || (providerFamily === 'google-official' ? GOOGLE_API_HEADER : strategy.defaultHeaderName || AUTHORIZATION_HEADER))
        : protocolFamily === 'claude-native'
            ? (strategy.claudeHeaderName || strategy.defaultHeaderName || AUTHORIZATION_HEADER)
            : (strategy.defaultHeaderName || AUTHORIZATION_HEADER);
    const headerName = String(input.headerName || '').trim() || defaultHeaderName;

    const authorizationValueFormat = protocolFamily === 'gemini-native'
        ? (strategy.geminiAuthorizationValueFormat || strategy.authorizationValueFormat || (headerName === GOOGLE_API_HEADER ? 'raw' : 'bearer'))
        : protocolFamily === 'claude-native'
            ? (strategy.claudeAuthorizationValueFormat || strategy.authorizationValueFormat || (headerName === CLAUDE_API_HEADER ? 'raw' : 'bearer'))
            : (strategy.authorizationValueFormat || 'bearer');

    const compatibilityMode = normalizeCompatibilityMode(input.compatibilityMode)
        || strategy.defaultCompatibilityMode
        || 'standard';

    return {
        strategy,
        strategyId: strategy.id,
        requestProfileId,
        providerName: normalizeProviderName(input.provider),
        providerFamily,
        protocolFamily,
        pricingSupport: strategy.pricingSupport || (providerFamily === 'generic-openai' ? 'manual' : 'none'),
        managementSupport: strategy.managementSupport || 'none',
        endpointStyle: toEndpointStyle(strategy, protocolFamily),
        supportedProtocolFamilies: resolveSupportedProtocolFamilies(strategy),
        baseUrl: normalizeBaseUrl(input.baseUrl),
        host: normalizeHost(input.baseUrl),
        requestedFormat,
        resolvedFormat,
        authMethod,
        headerName,
        authorizationValueFormat,
        compatibilityMode,
        geminiNative: protocolFamily === 'gemini-native',
        claudeNative: protocolFamily === 'claude-native',
        imageProfile: strategy.imageProfile || 'openai-strict',
        imageRoutingPolicy: strategy.imageRoutingPolicy || 'chat-first',
        videoApiStyle: strategy.videoApiStyle || 'openai-v1-videos',
        isKnownProvider: strategy.known,
        uiProvider: strategy.uiProvider || 'Custom',
    };
}

export function resolveProviderKeyType(
    provider?: string | Provider,
    baseUrl?: string,
): 'official' | 'proxy' | 'third-party' {
    const normalizedProvider = normalizeProviderName(provider);
    const normalizedBase = normalizeBaseUrl(baseUrl);
    const runtime = resolveProviderRuntime({
        provider,
        baseUrl,
    });
    const googleOfficialHost = runtime.providerFamily === 'google-official';
    const openaiOfficialHost = runtime.host === 'api.openai.com';
    const allowsOfficialHostFallback =
        normalizedProvider === ''
        || normalizedProvider === 'custom'
        || normalizedProvider === 'google'
        || normalizedProvider === 'gemini'
        || normalizedProvider === 'openai';

    if (
        (normalizedProvider === 'google' && !normalizedBase)
        || (googleOfficialHost && allowsOfficialHostFallback)
    ) {
        return 'official';
    }

    if (
        (normalizedProvider === 'openai' && !normalizedBase)
        || (openaiOfficialHost && allowsOfficialHostFallback)
    ) {
        return 'official';
    }

    if (normalizedProvider === 'google' || runtime.providerFamily === 'system-proxy') {
        return 'proxy';
    }

    return 'third-party';
}
