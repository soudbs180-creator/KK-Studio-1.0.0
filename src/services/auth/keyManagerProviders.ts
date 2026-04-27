import { getProviderStorageKey, purgeAnonymousSensitiveLocalCaches, type ProviderStorageScope } from "./keyManagerStorage";

export interface ProviderStorageResult<TProvider> {
    providers: TProvider[];
    scope: ProviderStorageScope;
}

export function persistProvidersLocal<TProvider>(
    userId: string | null,
    providers: TProvider[],
    allowLocalStorage = false,
): ProviderStorageScope {
    const storageKey = getProviderStorageKey(userId);
    if (!userId) {
        if (!allowLocalStorage) {
            purgeAnonymousSensitiveLocalCaches();
        }
        return "none";
    }

    if (!allowLocalStorage) {
        localStorage.removeItem(storageKey);
        purgeAnonymousSensitiveLocalCaches();
        return "none";
    }

    localStorage.setItem(storageKey, JSON.stringify(providers));
    return "anonymous";
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

    if (!userId) {
      if (!allowLocalStorage) {
        purgeAnonymousSensitiveLocalCaches();
      }
      return {
        providers: [],
        scope: "none",
      };
    }

    const storageKey = getProviderStorageKey(userId);
    if (!allowLocalStorage) {
      localStorage.removeItem(storageKey);
      purgeAnonymousSensitiveLocalCaches();
      return {
        providers: [],
        scope: "none",
      };
    }

    const stored = localStorage.getItem(storageKey);
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) {
          return {
            providers: parsed as TProvider[],
            scope: "anonymous",
          };
        }
      } catch {
        localStorage.removeItem(storageKey);
      }
    }

    return {
      providers: [],
      scope: allowLocalStorage ? "anonymous" : "none",
    };
}
