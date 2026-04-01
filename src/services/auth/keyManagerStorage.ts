export const STORAGE_KEY = "kk_studio_key_manager";
export const PROVIDERS_STORAGE_KEY = "kk_studio_third_party_providers";
export const LEGACY_API_KEYS_STORAGE_KEY = "kk-api-keys-local";
export const USER_API_LOGIN_REQUIRED_MESSAGE = "Sign in before adding or updating BYOK providers. Browser-side key storage is disabled for security.";
export const BROWSER_DIRECT_PROVIDER_CHECKS_DISABLED_MESSAGE = "Browser-side provider diagnostics are disabled. Save the key to your account and use the server-side secure proxy path instead.";

export type ProviderStorageScope = "anonymous" | "user" | "cloud" | "none";

export function isBrowserRuntime(): boolean {
    return typeof window !== "undefined";
}

export function createBrowserDirectProviderChecksDisabledError(): Error {
    const error = new Error(BROWSER_DIRECT_PROVIDER_CHECKS_DISABLED_MESSAGE) as Error & { code?: string };
    error.code = "BROWSER_DIRECT_PROVIDER_CHECKS_DISABLED";
    return error;
}

export function getKeyManagerStorageKey(userId: string | null): string {
    if (!userId) return STORAGE_KEY;
    return `${STORAGE_KEY}_${userId}`;
}

export function getProviderStorageKey(userId: string | null): string {
    if (!userId) return PROVIDERS_STORAGE_KEY;
    return `${PROVIDERS_STORAGE_KEY}_${userId}`;
}

export function purgeAnonymousSensitiveLocalCaches(): void {
    if (!isBrowserRuntime()) {
        return;
    }

    localStorage.removeItem(LEGACY_API_KEYS_STORAGE_KEY);
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(PROVIDERS_STORAGE_KEY);
}
