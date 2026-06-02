// Strict whitelist for official Google image models
export const GOOGLE_IMAGE_WHITELIST = [
    'gemini-2.5-flash-image',
    'gemini-3-pro-image-preview',
    'gemini-3.1-flash-image-preview',
    'imagen-4.0-generate-001',
    'imagen-4.0-ultra-generate-001',
    'imagen-4.0-fast-generate-001'
];

// Video model whitelist
export const VIDEO_MODEL_WHITELIST = [
    'runway-gen3',
    'luma-video',
    'kling-v1',
    'sv3d',
    'vidu',
    'minimax-video',
    'wan-v1'
];

// Advanced image editing whitelist
export const ADVANCED_IMAGE_MODEL_WHITELIST = [
    'flux-kontext-max',
    'recraft-v3-svg',
    'ideogram-v2'
];

// Audio model whitelist
export const AUDIO_MODEL_WHITELIST = [
    'suno-v3.5',
    'minimax-t2a-01'
];

// Default official Google model list
export const DEFAULT_GOOGLE_MODELS = [
    // Gemini 3.5 series
    'gemini-3.5-flash',
    // Gemini 3.1 series
    'gemini-3.1-pro-preview',
    'gemini-3.1-flash-lite',
    // Gemini 3 series
    'gemini-3-pro-preview',
    'gemini-3-flash-preview',
    // Gemini 2.5 series
    'gemini-2.5-flash',

    // Strict Image Models
    ...GOOGLE_IMAGE_WHITELIST,

    // Veo 视频生成
    'veo-3.1-generate-preview',
    'veo-3.1-fast-generate-preview',
    'veo-3.1-lite-generate-preview'
];

export const DEFAULT_OPENAI_MODELS = ['dall-e-3', 'dall-e-2', 'gpt-4o', 'gpt-4o-mini'];
