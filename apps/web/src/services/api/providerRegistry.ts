import { type Provider} from '../../types';

export interface ProviderMetadata {
    id: Provider | string;
    label: string;
    icon?: string;
    defaultBaseUrl?: string;
    description?: string;
    docsUrl?: string;
    kind?: 'official' | 'relay' | 'byok-reverse-proxy' | 'custom' | 'system';
}

export const PROVIDER_REGISTRY: Record<string, ProviderMetadata> = {
    Google: {
        id: 'Google',
        label: 'Google Cloud / Gemini',
        defaultBaseUrl: 'https://generativelanguage.googleapis.com',
        description: 'Official Google Gemini & Imagen API',
        docsUrl: 'https://ai.google.dev/',
        kind: 'official'
    },
    OpenAI: {
        id: 'OpenAI',
        label: 'OpenAI',
        defaultBaseUrl: 'https://api.openai.com/v1',
        description: 'Standard OpenAI API',
        docsUrl: 'https://platform.openai.com/docs/api-reference',
        kind: 'official'
    },
    Anthropic: {
        id: 'Anthropic',
        label: 'Anthropic',
        defaultBaseUrl: 'https://api.anthropic.com/v1',
        description: 'Claude Models (via Proxy recommended)',
        docsUrl: 'https://docs.anthropic.com/',
        kind: 'official'
    },
    Volcengine: {
        id: 'Volcengine',
        label: 'Volcengine (Doubao)',
        defaultBaseUrl: 'https://ark.cn-beijing.volces.com/api/v3',
        description: 'ByteDance Doubao & Ark Models',
        docsUrl: 'https://www.volcengine.com/docs/82379/1099222',
        kind: 'official'
    },
    Aliyun: {
        id: 'Aliyun',
        label: 'Aliyun (Qwen)',
        defaultBaseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
        description: 'Alibaba Cloud Qwen & Wanx',
        docsUrl: 'https://help.aliyun.com/zh/model-studio/developer-reference/use-qwen-by-calling-api',
        kind: 'official'
    },
    Tencent: {
        id: 'Tencent',
        label: 'Tencent Cloud',
        defaultBaseUrl: 'https://api.hunyuan.cloud.tencent.com/v1',
        description: 'Tencent Hunyuan Models',
        docsUrl: 'https://cloud.tencent.com/document/product/1729',
        kind: 'official'
    },
    SiliconFlow: {
        id: 'SiliconFlow',
        label: 'SiliconFlow',
        defaultBaseUrl: 'https://api.siliconflow.cn/v1',
        description: 'High-performance inference for open weights',
        docsUrl: 'https://siliconflow.cn/',
        kind: 'relay'
    },
    OpenRouter: {
        id: 'OpenRouter',
        label: 'OpenRouter',
        defaultBaseUrl: 'https://openrouter.ai/api/v1',
        description: 'OpenAI-compatible relay and model router. Keep it visually distinct from OpenAI Official.',
        docsUrl: 'https://openrouter.ai/docs',
        kind: 'relay'
    },
    APIMart: {
        id: 'APIMart',
        label: 'APIMart',
        defaultBaseUrl: 'https://api.apimart.ai/v1',
        description: 'APIMart OpenAI-compatible relay. Responses may use a provider-specific envelope.',
        docsUrl: 'https://docs.apimart.ai/cn',
        kind: 'relay'
    },
    GPTBest: {
        id: 'GPTBest',
        label: 'GPT-Best',
        defaultBaseUrl: 'https://api.gpt-best.com/v1',
        description: 'GPT-Best relay. It must not share key references with other relay providers.',
        docsUrl: 'https://gpt-best.apifox.cn/llms.txt',
        kind: 'relay'
    },
    Wuyin: {
        id: 'Wuyin',
        label: 'Wuyin / Suchuang API',
        defaultBaseUrl: 'https://api.wuyinkeji.com',
        description: 'Wuyin documented multi-task relay for image, video, audio and utility products.',
        docsUrl: 'https://api.wuyinkeji.com/type/all',
        kind: 'relay'
    },
    '12AI': {
        id: '12AI',
        label: '12AI',
        defaultBaseUrl: 'https://cdn.12ai.org',
        description: '12AI documented multi-protocol relay channel',
        docsUrl: 'https://doc.12ai.org/',
        kind: 'relay'
    },
    Flow2API: {
        id: 'Flow2API',
        label: 'Flow2API',
        defaultBaseUrl: 'http://127.0.0.1:8000',
        description: 'Self-hosted Flow2API media gateway',
        docsUrl: 'https://github.com/TheSmallHanCat/flow2api',
        kind: 'relay'
    },
    Custom: {
        id: 'Custom',
        label: 'Custom / Proxy',
        description: 'Any OpenAI-compatible provider',
        kind: 'custom'
    },
    SystemProxy: {
        id: 'SystemProxy',
        label: 'System Proxy',
        description: 'System internal proxy for credit-based models',
        kind: 'system'
    }
};

const PROVIDER_ALIAS_MAP: Record<string, string> = {
    openrouter: 'OpenRouter',
    'openrouter.ai': 'OpenRouter',
    apimart: 'APIMart',
    'api mart': 'APIMart',
    'apimart.ai': 'APIMart',
    'gpt-best': 'GPTBest',
    gptbest: 'GPTBest',
    'gpt best': 'GPTBest',
    wuyin: 'Wuyin',
    wuyinkeji: 'Wuyin',
    suchuang: 'Wuyin',
    '速创': 'Wuyin',
    '12ai': '12AI',
    '12 ai': '12AI',
};

const PROVIDER_HOST_ALIAS_RULES: Array<{ pattern: RegExp; provider: string }> = [
    { pattern: /(^|\.)openrouter\.ai$/i, provider: 'OpenRouter' },
    { pattern: /(^|\.)apimart\.ai$/i, provider: 'APIMart' },
    { pattern: /(^|\.)gpt-best\.com$/i, provider: 'GPTBest' },
    { pattern: /(^|\.)12ai\.org$/i, provider: '12AI' },
    { pattern: /(^|\.)wuyinkeji\.com$/i, provider: 'Wuyin' },
    { pattern: /(^|\.)siliconflow\.cn$/i, provider: 'SiliconFlow' },
];

function normalizeHost(baseUrl?: string): string {
    const raw = String(baseUrl || '').trim().replace(/\/+$/, '');
    if (!raw) {
        return '';
    }

    const candidates = /^https?:\/\//i.test(raw) ? [raw] : [`https://${raw}`, `http://${raw}`];
    for (const candidate of candidates) {
        try {
            return new URL(candidate).hostname.toLowerCase();
        } catch {
            continue;
        }
    }

    return '';
}

export const resolveProviderAliasFromBaseUrl = (baseUrl?: string): string => {
    const host = normalizeHost(baseUrl);
    if (!host) {
        return '';
    }
    return PROVIDER_HOST_ALIAS_RULES.find((entry) => entry.pattern.test(host))?.provider || '';
};

export const getProviderMetadata = (provider: Provider | string): ProviderMetadata => {
    const raw = String(provider || '').trim();
    const alias = PROVIDER_ALIAS_MAP[raw.toLowerCase()];
    return PROVIDER_REGISTRY[alias || raw] || PROVIDER_REGISTRY.Custom;
};

export const getProviderMetadataFromBaseUrl = (baseUrl?: string): ProviderMetadata | null => {
    const providerAlias = resolveProviderAliasFromBaseUrl(baseUrl);
    return providerAlias ? getProviderMetadata(providerAlias) : null;
};
