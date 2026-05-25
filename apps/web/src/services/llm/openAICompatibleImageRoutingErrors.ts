function getErrorMessage(error: unknown): string {
    return String((error as { message?: unknown } | null | undefined)?.message || '').toLowerCase();
}

export function isQuotaLikeImageError(error: unknown): boolean {
    const message = getErrorMessage(error);
    return (
        message.includes('quota')
        || message.includes('no accounts available with quota')
        || message.includes('insufficient_quota')
    );
}

export function isChatEndpointCompatibilityError(error: unknown): boolean {
    const message = getErrorMessage(error);
    if (isQuotaLikeImageError(error)) return false;

    const isNotSupported = message.includes('not supported') || message.includes('unsupported');
    return (
        message.includes('chat-to-image error (400)')
        || message.includes('chat-to-image error (404)')
        || message.includes('chat-to-image error (405)')
        || message.includes('chat-to-image error (422)')
        || (message.includes('500') && isNotSupported)
        || isNotSupported
        || message.includes('invalid request')
        || message.includes('endpoint')
    );
}

export function isImageEndpointCompatibilityError(error: unknown): boolean {
    const message = getErrorMessage(error);
    if (isQuotaLikeImageError(error)) return false;

    const isNotSupported = message.includes('not supported') || message.includes('unsupported');
    return (
        message.includes('openai image error: 400')
        || message.includes('openai image error: 404')
        || message.includes('openai image error: 405')
        || message.includes('openai image error: 415')
        || message.includes('openai image error: 422')
        || message.includes('/images/generations')
        || message.includes('invalid request')
        || message.includes('invalid parameter')
        || message.includes('unrecognized request argument')
        || message.includes('unknown field')
        || isNotSupported
    );
}
