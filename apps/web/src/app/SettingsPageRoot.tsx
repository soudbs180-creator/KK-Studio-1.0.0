import React, { useCallback } from 'react';
import { KkButton, KkSurface } from '@kk/ui';
import { isChunkLoadError, lazyWithRetry } from '../utils/lazyWithRetry';
import { shouldUseHistoryBackForSettingsClose } from './settingsPageClose';

const SettingsPanel = lazyWithRetry(() => import('../components/settings/SettingsPanel'));

class SettingsPageLoadBoundary extends React.Component<
  { children: React.ReactNode },
  { error: Error | null }
> {
  state = { error: null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidCatch(error: Error) {
    console.error('[SettingsPageRoot] Failed to load settings page:', error);
  }

  private retry = () => {
    try {
      window.sessionStorage.removeItem('kk-auto-reload-chunk-fail');
    } catch {}
    const url = new URL(window.location.href);
    url.searchParams.set('__kk_settings_retry__', Date.now().toString());
    window.location.href = `${url.pathname}${url.search}${url.hash}`;
  };

  render() {
    if (!this.state.error) return this.props.children;

    return (
      <div className="grid min-h-[100dvh] place-items-center bg-[var(--kk-morphic-page)] p-4">
        <KkSurface variant="dialog" className="w-full max-w-[412px] p-5">
          <div className="text-base font-semibold leading-6">设置页加载失败</div>
          <div className="mt-2 text-sm leading-6 text-[var(--kk-morphic-text-secondary)]">
            {isChunkLoadError(this.state.error) ? '设置资源刚刚更新或开发服务短暂重启，重新加载后即可继续。' : '设置模块加载时遇到异常。'}
          </div>
          <KkButton tone="primary" block className="mt-4" onClick={this.retry}>
            重新加载设置页
          </KkButton>
        </KkSurface>
      </div>
    );
  }
}

const SettingsPageRoot: React.FC = () => {
  const handleClose = useCallback(() => {
    if (window.history.length > 1 && shouldUseHistoryBackForSettingsClose({
      currentOrigin: window.location.origin,
      currentPathname: window.location.pathname,
      referrer: document.referrer,
    })) {
      window.history.back();
      return;
    }

    window.location.assign('/');
  }, []);

  return (
    <SettingsPageLoadBoundary>
      <SettingsPanel
        isOpen={true}
        onClose={handleClose}
        presentation="page"
        initialPathname={window.location.pathname}
      />
    </SettingsPageLoadBoundary>
  );
};

export default SettingsPageRoot;
