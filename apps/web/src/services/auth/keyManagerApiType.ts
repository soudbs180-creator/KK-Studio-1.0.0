export type KeyManagerApiType = 'google-official' | 'openai' | 'proxy' | 'unknown';

/**
 * Detect the general API type from the key prefix and base URL.
 */
export function detectApiType(apiKey: string, baseUrl?: string): KeyManagerApiType {
    // Google official API
    if (apiKey.startsWith('AIza') || baseUrl?.includes('googleapis.com') || baseUrl?.includes('generativelanguage.googleapis.com')) {
        return 'google-official';
    }

    // OpenAI official API
    if (apiKey.startsWith('sk-') && (!baseUrl || baseUrl.includes('api.openai.com'))) {
        return 'openai';
    }

    // Other non-Google endpoints are treated as proxy-compatible APIs
    if (baseUrl && !baseUrl.includes('googleapis.com') && baseUrl.length > 0) {
        return 'proxy';
    }

    return 'unknown';
}
