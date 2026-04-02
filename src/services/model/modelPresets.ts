export interface ModelPreset {
    id: string;
    label: string;
    provider: string; // 'Google' | 'OpenAI' | 'Midjourney' | 'Stability' | 'Luma' | 'Runway' | 'Other'
    type: 'image' | 'video' | 'chat' | 'image+chat' | 'audio';
    description?: string;
}

export const MODEL_PRESETS: ModelPreset[] = [
    // ============================================
    // Gemini image models
    // ============================================
    { id: 'gemini-2.5-flash-image', label: 'Gemini 2.5 Flash Image', provider: 'Google', type: 'image', description: 'Fast official Google image generation model.' },
    { id: 'gemini-3.1-flash-image-preview', label: 'Nano Banana 2', provider: 'Google', type: 'image', description: 'Preview image model with stronger reference-image support.' },
    { id: 'gemini-3-pro-image-preview', label: 'Nano Banana Pro', provider: 'Google', type: 'image', description: 'Higher quality Google image generation preview model.' },

    // ============================================
    // Google Veo video generation
    // ============================================
    { id: 'veo-3.1-generate-preview', label: 'Veo 3.1', provider: 'Google', type: 'video', description: 'Latest Veo video generation preview model.' },
    { id: 'veo-3.1-fast-generate-preview', label: 'Veo 3.1 Fast', provider: 'Google', type: 'video', description: 'Faster Veo 3.1 preview variant.' },

    // ============================================
    // Google audio and speech generation
    // ============================================
    { id: 'gemini-2.5-flash-preview-tts', label: 'Gemini 2.5 Flash TTS', provider: 'Google', type: 'audio', description: 'Official low-latency Google TTS preview model.' },
    { id: 'gemini-2.5-pro-preview-tts', label: 'Gemini 2.5 Pro TTS', provider: 'Google', type: 'audio', description: 'Official higher-quality Google TTS preview model.' },
    { id: 'lyria-3-pro-preview', label: 'Lyria 3 Pro Preview', provider: 'Google', type: 'audio', description: 'Official Google music generation preview model for longer, higher-fidelity output.' },
    { id: 'lyria-3-clip-preview', label: 'Lyria 3 Clip Preview', provider: 'Google', type: 'audio', description: 'Official Google music generation preview model optimized for shorter clips.' },

    // ============================================
    // Suno music generation
    // ============================================
    { id: 'suno-v4', label: 'Suno V4', provider: 'Custom', type: 'audio', description: 'Latest Suno model with continuation and style controls.' },
    { id: 'suno-v3.5', label: 'Suno V3.5', provider: 'Custom', type: 'audio', description: 'Balanced Suno music generation model.' },
    { id: 'suno-v3', label: 'Suno V3', provider: 'Custom', type: 'audio', description: 'Entry-level Suno music generation model.' },

    // ============================================
    // Udio music generation
    // ============================================
    { id: 'udio-v1', label: 'Udio V1', provider: 'Custom', type: 'audio', description: 'High-fidelity music generation model.' },

    // ============================================
    // Riffusion music generation
    // ============================================
    { id: 'riffusion', label: 'Riffusion', provider: 'Custom', type: 'audio', description: 'Diffusion-based short music clip generation model.' },

    // ============================================
    // MiniMax speech and music
    // ============================================
    { id: 'minimax-tts', label: 'MiniMax TTS', provider: 'Custom', type: 'audio', description: 'Multilingual speech synthesis with voice and speed controls.' },
    { id: 'minimax-music', label: 'MiniMax Music', provider: 'Custom', type: 'audio', description: 'MiniMax music generation model.' },

    // ============================================
    // OpenAI image generation
    // ============================================
    { id: 'dall-e-3', label: 'DALL-E 3', provider: 'OpenAI', type: 'image', description: 'OpenAI image generation model.' },

    // ============================================
    // FLUX image generation
    // ============================================
    { id: 'flux-pro', label: 'FLUX.1 Pro', provider: 'Black Forest Labs', type: 'image', description: 'Top-tier FLUX commercial model.' },
    { id: 'flux-schnell', label: 'FLUX.1 Schnell', provider: 'Black Forest Labs', type: 'image', description: 'Fast FLUX image model.' },
];

export const CHAT_MODEL_PRESETS: ModelPreset[] = [
    // ============================================
    // Google Gemini chat models
    // ============================================
    { id: 'gemini-3-pro-preview', label: 'Gemini 3 Pro Preview', provider: 'Google', type: 'chat', description: 'Top-end multimodal reasoning model.' },
    { id: 'gemini-3-flash-preview', label: 'Gemini 3 Flash Preview', provider: 'Google', type: 'chat', description: 'Fast general-purpose Gemini preview model.' },
    { id: 'gemini-2.5-flash', label: 'Gemini 2.5 Flash', provider: 'Google', type: 'chat', description: 'Low-latency Gemini 2.5 chat model.' },

    // ============================================
    // DeepSeek chat models
    // ============================================
    { id: 'deepseek-chat', label: 'DeepSeek V3', provider: 'DeepSeek', type: 'chat', description: 'General-purpose DeepSeek chat model.' },
    { id: 'deepseek-reasoner', label: 'DeepSeek R1', provider: 'DeepSeek', type: 'chat', description: 'DeepSeek reasoning-focused model.' },

    // ============================================
    // OpenAI chat models
    // ============================================
    { id: 'gpt-4o', label: 'GPT-4o', provider: 'OpenAI', type: 'chat', description: 'Flagship OpenAI multimodal model.' },
    { id: 'gpt-4o-mini', label: 'GPT-4o Mini', provider: 'OpenAI', type: 'chat', description: 'Smaller, lower-cost GPT-4o variant.' },

    // ============================================
    // Anthropic chat models
    // ============================================
    { id: 'claude-3-5-sonnet-20240620', label: 'Claude 3.5 Sonnet', provider: 'Anthropic', type: 'chat', description: 'Balanced Anthropic flagship model.' },
];
