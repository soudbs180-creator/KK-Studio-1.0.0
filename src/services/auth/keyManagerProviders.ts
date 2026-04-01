import { getProviderStorageKey, purgeAnonymousSensitiveLocalCaches, type ProviderStorageScope } from "./keyManagerStorage";

export interface ProviderStorageResult<TProvider> {
    providers: TProvider[];
    scope: ProviderStorageScope;
}

export function persistProvidersLocal(userId: string | null): ProviderStorageScope {
    const storageKey = getProviderStorageKey(userId);
    localStorage.removeItem(storageKey);
    purgeAnonymousSensitiveLocalCaches();
    return "none";
}

export function loadProvidersFromLocal<TProvider>(
    userId: string | null,
    existingProviders: TProvider[],
    force = false
): ProviderStorageResult<TProvider> | null {
    if (!force && existingProviders.length > 0) {
        return null;
    }

    if (!userId) {
      purgeAnonymousSensitiveLocalCaches();
      return {
        providers: [],
        scope: "none",
      };
    }

    const storageKey = getProviderStorageKey(userId);
    const stored = localStorage.getItem(storageKey);
    if (stored) {
      localStorage.removeItem(storageKey);
      return {
        providers: [],
        scope: "none",
      };
    }

    return {
      providers: [],
      scope: "none",
    };
}
