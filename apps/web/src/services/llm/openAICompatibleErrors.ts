export interface OpenAICompatibleHttpErrorParams {
    message: string;
    status?: number;
    requestPath?: string;
    requestBody?: string;
    responseBody?: string;
    provider?: string;
}

export function buildOpenAICompatibleHttpError(params: OpenAICompatibleHttpErrorParams): Error {
    const err: any = new Error(params.message);
    if (typeof params.status === 'number') {
        err.status = params.status;
        err.code = `HTTP_${params.status}`;
    }
    if (params.requestPath) err.requestPath = params.requestPath;
    if (params.requestBody) err.requestBody = params.requestBody;
    if (params.responseBody) err.responseBody = params.responseBody;
    if (params.provider) err.provider = params.provider;
    return err as Error;
}

export function buildOpenAICompatibleImageCompatibilityModeError(
    endpointMode: 'chat' | 'standard',
    originalError: any,
    fallbackProvider?: string,
): Error {
    const originalMessage = String(originalError?.message || originalError || 'Unknown image endpoint error');
    const guidance = endpointMode === 'chat'
        ? 'Chat image endpoint failed. Automatic fallback to Images API is disabled to avoid duplicate billed requests. If this provider requires the Images endpoint, switch this channel to Standard mode in Settings > API Management and retry.'
        : 'Standard Images endpoint failed. Automatic fallback to Chat API is disabled to avoid duplicate billed requests. If this provider requires the Chat endpoint, switch this channel to Chat mode in Settings > API Management and retry.';
    const err: any = new Error(`${guidance} Original error: ${originalMessage}`);
    if (originalError?.status !== undefined) err.status = originalError.status;
    if (originalError?.code !== undefined) err.code = originalError.code;
    if (originalError?.requestPath !== undefined) err.requestPath = originalError.requestPath;
    if (originalError?.requestBody !== undefined) err.requestBody = originalError.requestBody;
    if (originalError?.responseBody !== undefined) err.responseBody = originalError.responseBody;
    err.provider = originalError?.provider || fallbackProvider;
    err.compatibilityModeHint = endpointMode;
    return err as Error;
}
