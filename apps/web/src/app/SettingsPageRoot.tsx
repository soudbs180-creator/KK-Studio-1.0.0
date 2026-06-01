import React, { useCallback } from 'react';
import SettingsPanel from '../components/settings/SettingsPanel';
import { isChunkLoadError } from '../utils/lazyWithRetry';
import { shouldUseHistoryBackForSettingsClose } from './settingsPageClose';

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
      <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', padding: 24, background: '#0b0b0c' }}>
        <div style={{ width: 'min(520px, 100%)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 18, padding: 20, color: '#fffaf0', background: 'rgba(16,16,18,0.96)' }}>
          <div style={{ fontSize: 18, fontWeight: 800 }}>设置页加载失败</div>
          <div style={{ marginTop: 8, color: 'rgba(255,250,240,0.72)', fontSize: 13, lineHeight: 1.7 }}>
            {isChunkLoadError(this.state.error) ? '设置资源刚刚更新或开发服务短暂重启，重新加载后即可继续。' : '设置模块加载时遇到异常。'}
          </div>
          <button type="button" onClick={this.retry} style={{ marginTop: 16, minHeight: 38, border: 0, borderRadius: 10, padding: '0 14px', background: '#fffaf0', color: '#111', fontWeight: 800, cursor: 'pointer' }}>
            重新加载设置页
          </button>
        </div>
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
