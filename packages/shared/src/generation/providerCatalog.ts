// packages/shared/src/generation/providerCatalog.ts
// 中文注释：大模型供应商 Canonical Provider Catalog 统一事实源

export interface CanonicalProviderDefinition {
    id: string;
    label: string;
    category: 'official' | 'relay' | 'custom' | 'system';
    protocolFamilies: Array<'openai-compatible' | 'gemini-native' | 'claude-native'>;
    knownHosts: string[];
    keyRef?: string;
    uiIdentity: string;
    runtimeStrategyId: string;
    pricingSupport: 'none' | 'manual' | 'native' | 'external';
    managementSupport: 'none' | 'native' | 'external';
    defaultBaseUrl?: string;
}

export const CANONICAL_PROVIDER_CATALOG: CanonicalProviderDefinition[] = [
    {
        id: 'google',
        label: 'Google Cloud / Gemini',
        category: 'official',
        protocolFamilies: ['gemini-native'],
        knownHosts: ['generativelanguage.googleapis.com'],
        keyRef: 'GEMINI_API_KEY',
        uiIdentity: 'Google',
        runtimeStrategyId: 'google',
        pricingSupport: 'none',
        managementSupport: 'none',
        defaultBaseUrl: 'https://generativelanguage.googleapis.com'
    },
    {
        id: 'openai',
        label: 'OpenAI',
        category: 'official',
        protocolFamilies: ['openai-compatible'],
        knownHosts: ['api.openai.com'],
        keyRef: 'OPENAI_API_KEY',
        uiIdentity: 'OpenAI',
        runtimeStrategyId: 'openai',
        pricingSupport: 'manual',
        managementSupport: 'external',
        defaultBaseUrl: 'https://api.openai.com/v1'
    },
    {
        id: 'anthropic',
        label: 'Anthropic',
        category: 'official',
        protocolFamilies: ['claude-native'],
        knownHosts: ['api.anthropic.com'],
        keyRef: 'ANTHROPIC_API_KEY',
        uiIdentity: 'Anthropic',
        runtimeStrategyId: 'anthropic',
        pricingSupport: 'none',
        managementSupport: 'none',
        defaultBaseUrl: 'https://api.anthropic.com/v1'
    },
    {
        id: 'deepseek',
        label: 'DeepSeek',
        category: 'official',
        protocolFamilies: ['openai-compatible'],
        knownHosts: ['api.deepseek.com'],
        keyRef: 'DEEPSEEK_API_KEY',
        uiIdentity: 'OpenAI',
        runtimeStrategyId: 'deepseek',
        pricingSupport: 'manual',
        managementSupport: 'external',
        defaultBaseUrl: 'https://api.deepseek.com'
    },
    {
        id: 'volcengine',
        label: 'Volcengine',
        category: 'official',
        protocolFamilies: ['openai-compatible'],
        knownHosts: ['ark.cn-beijing.volces.com'],
        keyRef: 'VOLCENGINE_API_KEY',
        uiIdentity: 'Volcengine',
        runtimeStrategyId: 'volcengine',
        pricingSupport: 'manual',
        managementSupport: 'external',
        defaultBaseUrl: 'https://ark.cn-beijing.volces.com/api/v3'
    },
    {
        id: 'aliyun',
        label: 'Aliyun',
        category: 'official',
        protocolFamilies: ['openai-compatible'],
        knownHosts: ['dashscope.aliyuncs.com'],
        keyRef: 'DASHSCOPE_API_KEY',
        uiIdentity: 'Aliyun',
        runtimeStrategyId: 'aliyun',
        pricingSupport: 'manual',
        managementSupport: 'external',
        defaultBaseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1'
    },
    {
        id: 'tencent',
        label: 'Tencent',
        category: 'official',
        protocolFamilies: ['openai-compatible'],
        knownHosts: ['tencent.com', 'tencentcloudapi', 'api.hunyuan.cloud.tencent.com'],
        keyRef: 'HUNYUAN_API_KEY',
        uiIdentity: 'Tencent',
        runtimeStrategyId: 'tencent',
        pricingSupport: 'manual',
        managementSupport: 'external',
        defaultBaseUrl: 'https://api.hunyuan.cloud.tencent.com/v1'
    },
    {
        id: 'siliconflow',
        label: 'SiliconFlow',
        category: 'relay',
        protocolFamilies: ['openai-compatible'],
        knownHosts: ['api.siliconflow.cn'],
        keyRef: 'SILICONFLOW_API_KEY',
        uiIdentity: 'SiliconFlow',
        runtimeStrategyId: 'siliconflow',
        pricingSupport: 'manual',
        managementSupport: 'external',
        defaultBaseUrl: 'https://api.siliconflow.cn/v1'
    },
    {
        id: 'openrouter',
        label: 'OpenRouter',
        category: 'relay',
        protocolFamilies: ['openai-compatible'],
        knownHosts: ['openrouter.ai'],
        keyRef: 'OPENROUTER_API_KEY',
        uiIdentity: 'Custom',
        runtimeStrategyId: 'openrouter',
        pricingSupport: 'manual',
        managementSupport: 'external',
        defaultBaseUrl: 'https://openrouter.ai/api/v1'
    },
    {
        id: 'apimart',
        label: 'APIMart',
        category: 'relay',
        protocolFamilies: ['openai-compatible'],
        knownHosts: ['api.apimart.ai', 'docs.apimart.ai', 'apimart.ai'],
        keyRef: 'APIMART_API_KEY',
        uiIdentity: 'Custom',
        runtimeStrategyId: 'apimart',
        pricingSupport: 'manual',
        managementSupport: 'external',
        defaultBaseUrl: 'https://api.apimart.ai/v1'
    },
    {
        id: 'gpt-best',
        label: 'GPT-Best',
        category: 'relay',
        protocolFamilies: ['openai-compatible', 'gemini-native', 'claude-native'],
        knownHosts: ['gpt-best.com', 'api.gpt-best.com', 'gpt-best.apifox.cn'],
        keyRef: 'GPT_BEST_API_KEY',
        uiIdentity: 'Custom',
        runtimeStrategyId: 'gpt-best',
        pricingSupport: 'native',
        managementSupport: 'native',
        defaultBaseUrl: 'https://api.gpt-best.com/v1'
    },
    {
        id: 'wuyinkeji',
        label: 'Wuyin / Suchuang API',
        category: 'relay',
        protocolFamilies: ['openai-compatible', 'gemini-native'],
        knownHosts: ['wuyinkeji.com', 'api.wuyinkeji.com'],
        keyRef: 'WUYIN_API_KEY',
        uiIdentity: 'Custom',
        runtimeStrategyId: 'wuyinkeji',
        pricingSupport: 'native',
        managementSupport: 'native',
        defaultBaseUrl: 'https://api.wuyinkeji.com'
    },
    {
        id: '12ai',
        label: '12AI',
        category: 'relay',
        protocolFamilies: ['openai-compatible', 'gemini-native', 'claude-native'],
        knownHosts: ['12ai.org', 'cdn.12ai.org', 'api.12ai.org', 'doc.12ai.org'],
        keyRef: 'TWELVEAI_API_KEY',
        uiIdentity: '12AI',
        runtimeStrategyId: '12ai',
        pricingSupport: 'manual',
        managementSupport: 'none',
        defaultBaseUrl: 'https://cdn.12ai.org'
    },
    {
        id: 'flow2api',
        label: 'Flow2API',
        category: 'relay',
        protocolFamilies: ['openai-compatible', 'gemini-native'],
        knownHosts: ['flow2api', '127.0.0.1:8000'],
        keyRef: 'FLOW2API_API_KEY',
        uiIdentity: 'Flow2API',
        runtimeStrategyId: 'flow2api',
        pricingSupport: 'manual',
        managementSupport: 'none',
        defaultBaseUrl: 'http://127.0.0.1:8000'
    },
    {
        id: 'custom',
        label: 'Custom / Proxy',
        category: 'custom',
        protocolFamilies: ['openai-compatible', 'gemini-native', 'claude-native'],
        knownHosts: [],
        uiIdentity: 'Custom',
        runtimeStrategyId: 'generic-openai',
        pricingSupport: 'none',
        managementSupport: 'none'
    },
    {
        id: 'systemproxy',
        label: 'System Proxy',
        category: 'system',
        protocolFamilies: ['openai-compatible'],
        knownHosts: [],
        uiIdentity: 'Custom',
        runtimeStrategyId: 'systemproxy',
        pricingSupport: 'none',
        managementSupport: 'none'
    }
];
