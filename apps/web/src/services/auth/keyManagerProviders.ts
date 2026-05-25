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
    void providers;
    void allowLocalStorage;

    if (!userId) {
        purgeAnonymousSensitiveLocalCaches();
        return "none";
    }

    localStorage.removeItem(storageKey);
    purgeAnonymousSensitiveLocalCaches();
    return "none";
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
    void allowLocalStorage;

    if (!userId) {
      purgeAnonymousSensitiveLocalCaches();
      return {
        providers: [],
        scope: "none",
      };
    }

    const storageKey = getProviderStorageKey(userId);
    localStorage.removeItem(storageKey);
    purgeAnonymousSensitiveLocalCaches();
    return {
      providers: [],
      scope: "none",
    };
}
