import { getProviderStorageKey, purgeAnonymousSensitiveLocalCaches, type ProviderStorageScope } from "./keyManagerStorage.ts";

export interface ProviderStorageResult<TProvider> {
    providers: TProvider[];
    scope: ProviderStorageScope;
}

export type ProviderRuntimeStateFields = {
    id?: string;
    pricingSnapshot?: unknown;
    activitySummary?: unknown;
};

export function mergeCloudProvidersWithLocalRuntimeState<TProvider extends ProviderRuntimeStateFields>(
    cloudProviders: TProvider[],
    localProviders: TProvider[],
): TProvider[] {
    if (cloudProviders.length === 0 || localProviders.length === 0) {
        return cloudProviders;
    }

    const localProvidersById = new Map<string, TProvider>();
    localProviders.forEach((provider) => {
        const normalizedId = String(provider.id || "").trim();
        if (normalizedId) {
            localProvidersById.set(normalizedId, provider);
        }
    });

    return cloudProviders.map((provider) => {
        const localProvider = localProvidersById.get(String(provider.id || "").trim());
        if (!localProvider) {
            return provider;
        }

        return {
            ...provider,
            pricingSnapshot: provider.pricingSnapshot || localProvider.pricingSnapshot,
            activitySummary: provider.activitySummary || localProvider.activitySummary,
        };
    });
}

export function persistProvidersLocal<TProvider>(
    userId: string | null,
    providers: TProvider[],
    allowLocalStorage = false,
): ProviderStorageScope {
    const storageKey = getProviderStorageKey(userId);
    try {
        localStorage.setItem(storageKey, JSON.stringify(providers));
        return userId ? "user" : "anonymous";
    } catch (e) {
        console.error("[keyManagerProviders] Failed to persist providers locally:", e);
        return "none";
    }
}

export function loadProvidersFromLocal<TProvider>(
    userId: string | null,
    existingProviders: TProvider[],
    force = false,
    allowLocalStorage = false,
): ProviderStorageResult<TProvider> | null {
    if (!force && existingProviders.length > 0) {
        return null;
    }

    const storageKey = getProviderStorageKey(userId);
    try {
        const stored = localStorage.getItem(storageKey);
        if (stored) {
            const providers = JSON.parse(stored) as TProvider[];
            return {
                providers,
                scope: userId ? "user" : "anonymous",
            };
        }
    } catch (e) {
        console.warn("[keyManagerProviders] Failed to load providers locally:", e);
    }

    return {
        providers: [],
        scope: userId ? "user" : "anonymous",
    };
}
