import * as React from 'react';
import { createRoot } from 'react-dom/client';
// import { SpeedInsights } from '@vercel/speed-insights/react';
import './index.css';
import './styles/kk-ui-tokens.css';
import './styles/morphic-ui.css';
import './styles/morphic-button-geometry.css';
import './styles/workspace-ui-v3.css';
import './styles/workspace-ui-v4.css';
import './styles/settings-ui-v4.css';
import App from './App';
import { AuthProvider } from './context/AuthContext';
import { LocaleProvider } from './context/LocaleContext';
import { initializeThemeOnBoot } from './context/ThemeContext';
import { isLoopbackHostname, isPrivateNetworkHostname } from './services/api/kkApiBaseUrl';
import { disableVercelToolbar } from './utils/disableVercelToolbar';
import {
  DEFAULT_LANGUAGE,
  type ResolvedLanguage,
  getInitialAppLanguage,
  localizeUserFacingText,
  pickByResolvedLanguage,
} from './utils/localeText';
import { isChunkLoadError, handleChunkLoadError } from './utils/lazyWithRetry';

type FatalError = {
  message: string;
  details?: string;
};

function getStoredStartupLanguage(): ResolvedLanguage {
  if (typeof window === 'undefined') {
    return DEFAULT_LANGUAGE;
  }

  return getInitialAppLanguage();
}

function applyStartupLanguage(language: ResolvedLanguage) {
  if (typeof document === 'undefined') {
    return;
  }

  document.documentElement.lang = language;
  document.documentElement.dataset.language = language;
}

function syncStartupLanguage() {
  const language = getStoredStartupLanguage();
  applyStartupLanguage(language);
  return language;
}

function pickStartupText<T>(zh: T, en: T): T {
  return pickByResolvedLanguage(getStoredStartupLanguage(), zh, en);
}

function localizeStartupErrorText(value?: string) {
  if (!value) {
    return value;
  }

  return localizeUserFacingText(value) || value;
}

syncStartupLanguage();

// 清理 URL 中的防缓存更新参数 __kk_update__ 和设置页重试参数 __kk_settings_retry__，保持用户地址栏的干净整洁
try {
  const url = new URL(window.location.href);
  let hasChange = false;
  if (url.searchParams.has('__kk_update__')) {
    url.searchParams.delete('__kk_update__');
    hasChange = true;
  }
  if (url.searchParams.has('__kk_settings_retry__')) {
    url.searchParams.delete('__kk_settings_retry__');
    hasChange = true;
  }
  if (hasChange) {
    const newUrl = url.pathname + url.search + url.hash;
    window.history.replaceState({}, '', newUrl);
  }
} catch (e) {
  console.warn('Failed to clean up URL update/retry query parameters:', e);
}

const rootElement = document.getElementById('root');

if (!rootElement) {
  throw new Error(pickStartupText('找不到根节点 #root，应用无法挂载。', 'Could not find root element to mount to.'));
}

const root = createRoot(rootElement);
let hasMountedApp = false;

disableVercelToolbar();
initializeThemeOnBoot();

function normalizeError(error: unknown): FatalError {
  if (error instanceof Error) {
    return {
      message: error.message || pickStartupText('应用启动失败', 'App failed to start'),
      details: error.stack || error.toString(),
    };
  }

  if (typeof error === 'string') {
    return { message: error };
  }

  try {
    return {
      message: pickStartupText('应用启动失败', 'App failed to start'),
      details: JSON.stringify(error, null, 2),
    };
  } catch {
    return { message: pickStartupText('应用启动失败', 'App failed to start') };
  }
}

function getDeploymentHints(): string[] {
  const hints: string[] = [];
  const hostname = typeof window !== 'undefined'
    ? String(window.location.hostname || '').trim()
    : '';

  if (
    !import.meta.env.VITE_KK_API_BASE_URL
    && hostname
    && !isLoopbackHostname(hostname)
    && !isPrivateNetworkHostname(hostname)
  ) {
    hints.push(pickStartupText('缺少 VITE_KK_API_BASE_URL 环境变量', 'Missing VITE_KK_API_BASE_URL environment variable'));
  }

  return hints;
}

function FatalScreen({ error }: { error: FatalError }) {
  const language = syncStartupLanguage();
  const hints = getDeploymentHints();

  return (
    <div
      style={{
        minHeight: '100vh',
        background: 'var(--bg-canvas, #ffffff)',
        color: 'var(--text-primary, #0a0a0a)',
        fontFamily: 'Inter, system-ui, sans-serif',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '32px',
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: '920px',
          background: 'var(--frost-card-framework-bg, #ffffff)',
          border: '1px solid var(--frost-card-framework-border, rgba(17,24,39,0.14))',
          borderRadius: '24px',
          padding: '28px',
          boxShadow: 'var(--frost-card-framework-shadow, none)',
          backdropFilter: 'blur(var(--frost-card-framework-blur, 24px)) saturate(160%)',
        }}
      >
        <div style={{ marginBottom: '18px' }}>
          <div style={{ fontSize: '14px', color: 'var(--text-secondary, #3a3a3a)', marginBottom: '8px' }}>
            {pickByResolvedLanguage(language, 'KK Studio 启动诊断', 'KK Studio Startup Diagnostics')}
          </div>
          <h1 style={{ fontSize: '28px', lineHeight: 1.2, color: 'var(--state-danger-text, #f87171)', margin: 0 }}>
            {pickByResolvedLanguage(language, '应用启动失败，已拦截白屏', 'The app failed to start and the blank screen was blocked')}
          </h1>
        </div>

        <div
          style={{
            background: 'var(--frost-card-sub-bg, #ffffff)',
            border: '1px solid var(--frost-card-sub-border, rgba(17,24,39,0.12))',
            borderRadius: '12px',
            padding: '16px',
            marginBottom: '16px',
          }}
        >
          <div style={{ fontSize: '14px', color: 'var(--text-secondary, #3a3a3a)', marginBottom: '6px' }}>
            {pickByResolvedLanguage(language, '错误信息', 'Error details')}
          </div>
          <div style={{ fontSize: '16px', color: 'var(--text-primary, #0a0a0a)', fontWeight: 600, marginBottom: '10px' }}>
            {localizeStartupErrorText(error.message)}
          </div>
          {error.details && (
            <pre
              style={{
                margin: 0,
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word',
                fontSize: '12px',
                lineHeight: 1.6,
                color: 'var(--text-secondary, #3a3a3a)',
                maxHeight: '320px',
                overflow: 'auto',
              }}
            >
              {error.details}
            </pre>
          )}
        </div>

        {hints.length > 0 && (
          <div
            style={{
              background: 'rgba(245, 158, 11, 0.08)',
              border: '1px solid rgba(245, 158, 11, 0.28)',
              borderRadius: '12px',
              padding: '16px',
              marginBottom: '16px',
            }}
          >
            <div style={{ fontSize: '14px', color: '#fbbf24', marginBottom: '8px', fontWeight: 600 }}>
              {pickByResolvedLanguage(language, '部署检查项', 'Deployment checks')}
            </div>
            <ul style={{ margin: 0, paddingLeft: '18px', color: '#fde68a', lineHeight: 1.7 }}>
              {hints.map((hint) => (
                <li key={hint}>{hint}</li>
              ))}
            </ul>
          </div>
        )}

        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
          <button
            onClick={() => window.location.reload()}
            style={{
              border: 'none',
              background: 'var(--accent-coral, #ff6b5a)',
              color: '#fff',
              borderRadius: '10px',
              padding: '10px 16px',
              cursor: 'pointer',
            }}
          >
            {pickByResolvedLanguage(language, '重新加载', 'Reload')}
          </button>
          <button
            onClick={() => {
              localStorage.clear();
              sessionStorage.clear();
              window.location.reload();
            }}
            style={{
              border: '1px solid var(--frost-card-sub-border, rgba(17,24,39,0.12))',
              background: 'var(--frost-card-sub-bg, #ffffff)',
              color: 'var(--text-primary, #0a0a0a)',
              borderRadius: '10px',
              padding: '10px 16px',
              cursor: 'pointer',
            }}
          >
            {pickByResolvedLanguage(language, '清理本地缓存后重试', 'Clear local cache and retry')}
          </button>
        </div>
      </div>
    </div>
  );
}

function renderFatalScreen(error: unknown) {
  const normalized = normalizeError(error);
  console.error('[Bootstrap Fatal Error]', normalized.message, normalized.details || '');
  root.render(<FatalScreen error={normalized} />);
}

window.addEventListener('error', (event) => {
  console.error('[Global Error]', event.message, event.error);
  if (!hasMountedApp) {
    const isChunkError = isChunkLoadError(event.error || event.message);
    if (isChunkError && handleChunkLoadError()) {
      return;
    }
    renderFatalScreen(event.error || event.message);
  }
});

window.addEventListener('unhandledrejection', (event) => {
  console.error('[Unhandled Rejection]', event.reason);
  if (!hasMountedApp) {
    const isChunkError = isChunkLoadError(event.reason);
    if (isChunkError && handleChunkLoadError()) {
      return;
    }
    renderFatalScreen(event.reason);
  }
});

class ErrorBoundary extends React.Component<{ children: React.ReactNode }, { hasError: boolean; error: Error | null }> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('[Render Error]', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      const isChunkError = isChunkLoadError(this.state.error);
      if (isChunkError && handleChunkLoadError()) {
        const language = getStoredStartupLanguage();
        return (
          <div
            style={{
              minHeight: '100vh',
              background: 'var(--bg-canvas, #ffffff)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontFamily: 'Inter, system-ui, sans-serif',
            }}
          >
            <div style={{ color: 'var(--text-primary, #0a0a0a)', fontSize: '15px' }}>
              {pickByResolvedLanguage(language, '正在更新应用资源，请稍候...', 'Updating application resources, please wait...')}
            </div>
          </div>
        );
      }
      return <FatalScreen error={normalizeError(this.state.error)} />;
    }

    return this.props.children;
  }
}

function bootstrap() {
  try {
    hasMountedApp = true;

    // 成功加载并挂载应用，清除自愈刷新标志
    try {
      sessionStorage.removeItem('kk-auto-reload-chunk-fail');
    } catch {}

    root.render(
      <ErrorBoundary>
        <LocaleProvider>
          <AuthProvider>
            <App />
            {/* <SpeedInsights /> */}
          </AuthProvider>
        </LocaleProvider>
      </ErrorBoundary>
    );
  } catch (error) {
    renderFatalScreen(error);
  }
}

bootstrap();
