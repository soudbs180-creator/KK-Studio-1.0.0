function getErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error) {
    const message = error.message.trim();
    if (message) {
      return message;
    }
  }

  return fallback;
}

export interface AdminModelCatalogRefreshDependencies {
  forceLoadAdminModels: () => Promise<void>;
  refreshUnifiedModels: () => Promise<void>;
}

export interface AdminModelCatalogRefreshResult {
  ok: boolean;
  message?: string;
}

export async function refreshAdminModelCatalogSafely(
  dependencies: AdminModelCatalogRefreshDependencies,
): Promise<AdminModelCatalogRefreshResult> {
  try {
    await dependencies.forceLoadAdminModels();
    await dependencies.refreshUnifiedModels();
    return { ok: true };
  } catch (error) {
    return {
      ok: false,
      message: getErrorMessage(
        error,
        'The model catalog could not be refreshed after the provider change.',
      ),
    };
  }
}
