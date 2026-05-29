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

/**
 * 检查错误是否属于由于缓存或弱网导致的动态加载组件失败错误
 */
export function isChunkLoadError(error: unknown): boolean {
  if (!error) return false;
  const message = getErrorMessage(error).toLowerCase();
  return (
    message.includes('failed to fetch dynamically imported module')
    || message.includes('importing a module script failed')
    || message.includes('error loading dynamically imported module')
    || message.includes('fetch dynamically imported module')
  );
}

/**
 * 自动刷新自愈拦截处理器。
 * 如果 sessionStorage 中未打过标记，则写入标记并进行带时间戳的反缓存强刷页面。
 * 返回 true 代表已成功触发刷新，返回 false 代表已刷新过或不可刷新。
 */
export function handleChunkLoadError(): boolean {
  if (typeof window === 'undefined' || typeof sessionStorage === 'undefined') {
    return false;
  }
  try {
    const reloadKey = 'kk-auto-reload-chunk-fail';
    const hasReloaded = sessionStorage.getItem(reloadKey);
    if (!hasReloaded) {
      sessionStorage.setItem(reloadKey, 'true');
      console.warn('Chunk load error detected. Attempting to force reload page with cache-busting timestamp...');
      const url = new URL(window.location.href);
      url.searchParams.set('__kk_update__', Date.now().toString());
      window.location.href = url.pathname + url.search + url.hash;
      return true;
    }
  } catch (e) {
    console.error('Failed to execute chunk auto-reload:', e);
  }
  return false;
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
      if (attempt >= retries || !isChunkLoadError(error)) {
        throw error;
      }
      await wait(retryDelayMs * (attempt + 1));
    }
  }

  // 即使经过多次延迟重试依然失败，且为 Chunk 加载错误，则在此处优先触发自动刷新自愈
  if (isChunkLoadError(lastError)) {
    if (handleChunkLoadError()) {
      // 成功发起刷新，返回一个永远 pending 的 promise 挂起当前组件渲染，避免界面崩溃显现
      return new Promise(() => {});
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

