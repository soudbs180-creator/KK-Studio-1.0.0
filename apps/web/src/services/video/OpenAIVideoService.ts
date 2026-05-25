import { AspectRatio } from '../../types';

interface OpenAIVideoConfig {
    model: string;
    prompt: string;
    size?: string;
    seconds?: number;
    referenceImage?: string; // Base64 or URL
}

const BROWSER_DIRECT_VIDEO_CALLS_DISABLED_MESSAGE =
    'Direct OpenAI-compatible video calls are disabled. Use the secure proxy or payment sidecar instead.';

/**
 * Generate video using OpenAI-compatible endpoint (NewAPI/Apifox format)
 * POST /v1/videos
 * Content-Type: multipart/form-data
 */
export const generateOpenAIVideo = async (
    config: OpenAIVideoConfig,
    apiKey: string,
    baseUrl: string,
    signal?: AbortSignal
): Promise<{ url: string }> => {
    void config;
    void apiKey;
    void baseUrl;
    void signal;
    throw new Error(BROWSER_DIRECT_VIDEO_CALLS_DISABLED_MESSAGE);
};

/**
 * Helper to map standard aspect ratios to pixel types
 * or just return the ratio string if the API expects "16:9"
 */
export const mapAspectRatioToSize = (ratio: AspectRatio, _model: string): string => {
    // Apifox/NewAPI often expects "WxH" string
    switch (ratio) {
        case AspectRatio.LANDSCAPE_16_9: return "1280x720";
        case AspectRatio.PORTRAIT_9_16: return "720x1280";
        case AspectRatio.SQUARE: return "1024x1024";
        case AspectRatio.LANDSCAPE_4_3: return "1024x768";
        case AspectRatio.PORTRAIT_3_4: return "768x1024";
        default: return "1280x720";
    }
}
