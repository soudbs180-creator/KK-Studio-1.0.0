import { lazy, type ComponentType, type LazyExoticComponent } from 'react';

type RetryOptions = {
  retries?: number;
  retryDelayMs?: number;
};

type DefaultModule<T extends ComponentType<any>> = {
  default: T;
};

const DEFAULT_RETRIES = 2;
const DEFAULT_RETRY_DELAY_MS = 400;

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => {
    window.setTimeout(resolve, ms);
  });
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message || '';
  return String(error || '');
}

function isRetryableDynamicImportError(error: unknown): boolean {
  const message = getErrorMessage(error).toLowerCase();
  return (
    message.includes('failed to fetch dynamically imported module')
    || message.includes('importing a module script failed')
    || message.includes('error loading dynamically imported module')
    || message.includes('fetch dynamically imported module')
  );
}

export async function importWithRetry<T>(
  loader: () => Promise<T>,
  options: RetryOptions = {},
): Promise<T> {
  const retries = options.retries ?? DEFAULT_RETRIES;
  const retryDelayMs = options.retryDelayMs ?? DEFAULT_RETRY_DELAY_MS;
  let lastError: unknown;

  for (let attempt = 0; attempt <= retries; attempt += 1) {
    try {
      return await loader();
    } catch (error) {
      lastError = error;
      if (attempt >= retries || !isRetryableDynamicImportError(error)) {
        throw error;
      }
      await wait(retryDelayMs * (attempt + 1));
    }
  }

  throw lastError instanceof Error ? lastError : new Error(getErrorMessage(lastError));
}

export function lazyWithRetry<T extends ComponentType<any>>(
  loader: () => Promise<DefaultModule<T>>,
  options?: RetryOptions,
): LazyExoticComponent<T> {
  return lazy(() => importWithRetry(loader, options));
}

export function lazyNamedWithRetry<TModule extends Record<string, unknown>, TKey extends keyof TModule>(
  loader: () => Promise<TModule>,
  exportName: TKey,
  options?: RetryOptions,
): LazyExoticComponent<ComponentType<any>> {
  return lazy(() =>
    importWithRetry(loader, options).then((module) => ({
      default: module[exportName] as ComponentType<any>,
    })),
  );
}
