export function sanitizeAsciiApiKey(key: string): string {
    return key.replace(/[^\x00-\x7F]/g, '').trim();
}
