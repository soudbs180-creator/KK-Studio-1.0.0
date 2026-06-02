// 中文注释：统一的应用根路由导航方法，集中管理 location 变化，抛弃散落的 pushState 与 synthetic PopStateEvent
export type AppRootMode = 'workspace' | 'settings' | 'admin';

export function resolveAppRootMode(pathname: string): AppRootMode {
  const normalized = pathname.trim().toLowerCase();
  if (normalized === '/settings' || normalized.startsWith('/settings/')) return 'settings';
  if (normalized === '/admin' || normalized.startsWith('/admin/')) return 'admin';
  return 'workspace';
}

export function navigateAppRoot(path: string, mode: 'push' | 'replace' = 'push') {
  if (typeof window === 'undefined') return;
  if (mode === 'replace') {
    window.history.replaceState({}, '', path);
  } else {
    window.history.pushState({}, '', path);
  }
  window.dispatchEvent(
    new CustomEvent('kk-app-locationchange', {
      detail: { pathname: window.location.pathname },
    })
  );
}
