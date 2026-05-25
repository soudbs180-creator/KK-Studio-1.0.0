import type { ApiProtocolFormat } from '../api/apiConfig';

export interface KeyManagerProviderPreset {
    name: string;
    baseUrl: string;
    models: string[];
    format: ApiProtocolFormat;
    icon?: string;
    defaultApiKey?: string;
}

/**
 * Preset third-party API providers.
 */
export const PROVIDER_PRESETS: Record<string, KeyManagerProviderPreset> = {
    'zhipu': {
        name: '\u667A\u8C31 AI',
        baseUrl: 'https://open.bigmodel.cn/api/paas/v4',
        models: ['glm-4', 'glm-4-flash', 'glm-4-plus', 'cogview-4'],
        format: 'openai',
        icon: '\u{1F9E0}'
    },
    'wanqing': {
        name: '\u4E07\u9752 (\u5FEB\u624B)',
        baseUrl: 'https://wanqing.streamlakeapi.com/api/gateway/v1/endpoints',
        models: ['deepseek-reasoner', 'deepseek-v3', 'qwen-max'],
        format: 'openai',
        icon: '\u{1F3AC}'
    },
    'sambanova': {
        name: 'SambaNova',
        baseUrl: 'https://api.sambanova.ai/v1',
        models: ['Meta-Llama-3.1-405B-Instruct', 'Meta-Llama-3.1-70B-Instruct', 'Meta-Llama-3.1-8B-Instruct', 'Meta-Llama-3.2-90B-Vision-Instruct', 'Meta-Llama-3.2-11B-Vision-Instruct', 'Meta-Llama-3.2-3B-Instruct', 'Meta-Llama-3.2-1B-Instruct', 'Qwen2.5-72B-Instruct', 'Qwen2.5-Coder-32B-Instruct'],
        format: 'openai',
        icon: '\u{1F680}'
    },
    'openclaw': {
        name: 'OpenClaw (Zero Token)',
        baseUrl: 'http://127.0.0.1:3001/v1',
        models: ['claude-3-5-sonnet-20241022', 'doubao-pro-32k', 'doubao-pro-128k', 'deepseek-chat', 'deepseek-reasoner'],
        format: 'openai',
        icon: '\u{1F43E}',
        defaultApiKey: 'sk-openclaw-zero-token'
    },
    't8star': {
        name: 'T8Star',
        baseUrl: 'https://ai.t8star.cn',
        // Conservative defaults; users can auto-detect or customize in UI
        models: ['gemini-3.1-pro-preview', 'gemini-3.1-flash-image-preview', 'gemini-2.5-flash-image', 'gemini-3-pro-image-preview', 'gemini-2.5-flash', 'gemini-3-flash-preview', 'runway-gen3', 'luma-video', 'kling-v1', 'sv3d', 'flux-kontext-max', 'recraft-v3-svg', 'ideogram-v2', 'suno-v3.5', 'minimax-t2a-01'],
        format: 'openai',
        icon: '\u2B50'
    },
    'volcengine': {
        name: '\u706B\u5C71\u5F15\u64CE',
        baseUrl: 'https://ark.cn-beijing.volces.com/api/v3',
        models: ['doubao-pro', 'doubao-lite'],
        format: 'openai',
        icon: '\u{1F30B}'
    },
    'deepseek': {
        name: 'DeepSeek',
        baseUrl: 'https://api.deepseek.com',
        models: ['deepseek-chat', 'deepseek-reasoner'],
        format: 'openai',
        icon: '\u{1F52E}'
    },
    'moonshot': {
        name: 'Moonshot (Kimi)',
        baseUrl: 'https://api.moonshot.cn/v1',
        models: ['moonshot-v1-8k', 'moonshot-v1-32k', 'moonshot-v1-128k'],
        format: 'openai',
        icon: '\u{1F319}'
    },
    'siliconflow': {
        name: 'SiliconFlow',
        baseUrl: 'https://api.siliconflow.cn/v1',
        models: ['Qwen/Qwen2.5-72B-Instruct', 'deepseek-ai/DeepSeek-V3'],
        format: 'openai',
        icon: '\u{1F48E}'
    },
    '12ai': {
        name: '12AI',
        baseUrl: 'https://cdn.12ai.org',
        models: [
            'gpt-5.1',
            'gemini-2.5-pro', 'gemini-2.5-pro-c',
            'gemini-2.5-flash', 'gemini-2.5-flash-c',
            'gemini-3.1-pro-preview', 'gemini-3.1-pro-preview-c',
            'gemini-3.1-flash-image-preview',
            'gemini-2.5-flash-image', 'gemini-2.5-flash-image-c',
            'gemini-3-pro-image-preview', 'gemini-3-pro-image-preview-c',
            'claude-4-sonnet', 'runway-gen3', 'luma-video', 'kling-v1', 'sv3d',
            'flux-kontext-max', 'recraft-v3-svg', 'ideogram-v2', 'suno-v3.5', 'minimax-t2a-01'
        ],
        format: 'gemini', // Best for Gemini-compatible routes and reference images
        icon: '\u{1F680}'
    },
    'antigravity': {
        name: 'Antigravity (\u672C\u5730)',
        baseUrl: 'http://127.0.0.1:8045',
        models: ['gemini-3.1-pro-preview', 'gemini-3.1-flash-image-preview', 'gemini-3-pro-image-preview', 'gemini-3-flash', 'gemini-2.5-flash-image', 'gemini-2.5-flash', 'runway-gen3', 'luma-video', 'kling-v1', 'sv3d', 'vidu', 'minimax-video', 'flux-kontext-max', 'recraft-v3-svg', 'ideogram-v2', 'suno-v3.5', 'minimax-t2a-01'],
        format: 'openai',
        icon: '\u{1F300}'
    },
    '12ai-nanobanana': {
        name: '12AI NanoBanana',
        baseUrl: 'https://cdn.12ai.org',
        models: [
            'gemini-3.1-flash-image-preview',
            'gemini-2.5-flash-image', 'gemini-2.5-flash-image-c',
            'gemini-3-pro-image-preview', 'gemini-3-pro-image-preview-c'
        ],
        format: 'gemini',
        icon: '\u{1F34C}'
    },
    'flow2api': {
        name: 'Flow2API',
        baseUrl: 'http://127.0.0.1:8000',
        models: [
            'gemini-3.1-flash-image-landscape',
            'gemini-3.1-flash-image-portrait',
            'gemini-3.0-pro-image-landscape',
            'imagen-4.0-generate-preview-landscape'
        ],
        format: 'openai',
        icon: '\u{1F30A}'
    },
    'wuyinkeji-nanobanana2': {
        name: 'Wuyin Keji NanoBanana2',
        baseUrl: 'https://api.wuyinkeji.com/api/async/image_nanoBanana2',
        models: ['image_nanoBanana2'],
        format: 'openai',
        icon: '\u{1F96D}'
    },
    'gpt-best': {
        name: 'GPT-Best',
        baseUrl: '',
        models: ['gpt-4o', 'gpt-4o-mini', 'o3-pro', 'codex-mini-latest', 'o3-deep-research-2025-06-26'],
        format: 'openai',
        icon: '\u{1F3AF}'
    },
    'custom': {
        name: '\u81EA\u5B9A\u4E49\u4F9B\u5E94\u5546',
        baseUrl: '',
        models: [],
        format: 'auto',
        icon: '\u2699\uFE0F'
    }
};

export function getDocumentedStaticModelsForProvider(strategyId: string): string[] {
    if (strategyId !== '12ai') {
        return [];
    }

    return Array.from(new Set([
        ...(PROVIDER_PRESETS['12ai']?.models || []),
        ...(PROVIDER_PRESETS['12ai-nanobanana']?.models || []),
    ]));
}
