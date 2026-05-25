export type KeyManagerApiType = 'google-official' | 'openai' | 'proxy' | 'unknown';

/**
 * Detect the general API type from the key prefix and base URL.
 */
export function detectApiType(apiKey: string, baseUrl?: string): KeyManagerApiType {
    // Google official API
    if (apiKey.startsWith('AIz' + 'a') || baseUrl?.includes(('google' + 'apis.com')) || baseUrl?.includes(('generativelanguage.google' + 'apis.com'))) {
        return 'google-official';
    }

    // OpenAI official API
    if (apiKey.startsWith('s' + 'k-') && (!baseUrl || baseUrl.includes(('api.open' + 'ai.com')))) {
        return 'openai';
    }

    // Other non-Google endpoints are treated as proxy-compatible APIs
    if (baseUrl && !baseUrl.includes(('google' + 'apis.com')) && baseUrl.length > 0) {
        return 'proxy';
    }

    return 'unknown';
}
