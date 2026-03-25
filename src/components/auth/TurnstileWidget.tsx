import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { localizeUserFacingText } from '../../utils/localeText';
import { TURNSTILE_ENABLED, TURNSTILE_HAS_ENV_SITE_KEY, TURNSTILE_SITE_KEY } from '../../config/turnstile';

const TURNSTILE_SCRIPT_URL = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
const TURNSTILE_TIMEOUT_MS = 12000;
const TURNSTILE_SCRIPT_SELECTOR = 'script[data-turnstile-script="true"]';

type TurnstileTheme = 'light' | 'dark' | 'auto';
type TurnstileAppearance = 'always' | 'execute' | 'interaction-only';
type TurnstileSize = 'normal' | 'compact' | 'flexible';
type TurnstileStatus = 'idle' | 'loading' | 'rendering' | 'rendered' | 'verified' | 'error';

interface TurnstileRenderOptions {
  sitekey: string;
  theme?: TurnstileTheme;
  language?: string;
  appearance?: TurnstileAppearance;
  action?: string;
  size?: TurnstileSize;
  callback?: (token: string) => void;
  'error-callback'?: (error?: string) => void;
  'expired-callback'?: () => void;
}

interface TurnstileWidgetProps {
  onVerify: (token: string) => void;
  onError?: (error: string) => void;
  onExpire?: () => void;
  theme?: TurnstileTheme;
  language?: string;
  className?: string;
  appearance?: TurnstileAppearance;
  action?: string;
  size?: TurnstileSize;
}

interface TurnstileDebugState {
  enabled: boolean;
  appearance?: TurnstileAppearance;
  sitekey?: string;
}

declare global {
  interface Window {
    turnstile?: {
      render: (container: string | HTMLElement, options: TurnstileRenderOptions) => string;
      reset: (widgetId?: string) => void;
      remove: (widgetId: string) => void;
    };
  }
}

let turnstileScriptPromise: Promise<void> | null = null;
const activeWidgetIds = new Set<string>();

function getDebugState(): TurnstileDebugState {
  if (typeof window === 'undefined') {
    return { enabled: false };
  }

  const params = new URLSearchParams(window.location.search);
  const appearanceParam = params.get('turnstile_appearance');
  const appearance =
    appearanceParam === 'always' || appearanceParam === 'execute' || appearanceParam === 'interaction-only'
      ? appearanceParam
      : undefined;

  return {
    enabled: params.get('turnstile_debug') === '1',
    appearance,
    sitekey: params.get('turnstile_sitekey')?.trim() || undefined,
  };
}

function getResolvedSiteKey(): string {
  const debugState = getDebugState();
  return debugState.sitekey || TURNSTILE_SITE_KEY;
}

function getSiteKeySourceLabel(debugSiteKey?: string): string {
  if (debugSiteKey) return 'URL 参数';
  return TURNSTILE_HAS_ENV_SITE_KEY ? '环境变量' : '内置默认值';
}

function previewSiteKey(sitekey: string): string {
  if (!sitekey) return '未设置';
  if (sitekey.length <= 10) return sitekey;
  return `${sitekey.slice(0, 6)}...${sitekey.slice(-4)}`;
}

function extractErrorCode(error: unknown): string | null {
  if (typeof error === 'string' && error.trim()) {
    return error.trim();
  }

  if (Array.isArray(error)) {
    const first = error.find((item) => typeof item === 'string' && item.trim());
    return typeof first === 'string' ? first.trim() : null;
  }

  return null;
}

function mapTurnstileError(error: unknown): string {
  const code = extractErrorCode(error);
  const normalized = code?.toLowerCase();

  if (normalized?.includes('failed to load turnstile script') || normalized?.includes('timed out while waiting')) {
    return 'Turnstile 脚本加载失败，请检查浏览器是否拦截了 challenges.cloudflare.com。';
  }

  switch (code) {
    case '400020':
      return 'Cloudflare 返回 Invalid sitekey，请检查前端 VITE_TURNSTILE_SITE_KEY 是否与当前 widget 的 site key 一致。';
    case '400070':
      return '当前 Turnstile site key 已被禁用，请到 Cloudflare 后台检查 widget 状态。';
    case '110200':
      return '当前域名不在 Turnstile widget 的允许列表里，请把 localhost、127.0.0.1 或正式域名加入 Cloudflare 域名白名单。';
    case '200500':
      return 'Turnstile iframe 加载失败，请检查浏览器、代理或安全软件是否拦截了 challenges.cloudflare.com。';
    default:
      return code
        ? `Turnstile 加载失败（错误码：${code}）。`
        : 'Turnstile 脚本加载失败，请检查浏览器是否拦截了 challenges.cloudflare.com。';
  }
}

async function waitForTurnstile(timeoutMs = TURNSTILE_TIMEOUT_MS): Promise<void> {
  const start = Date.now();

  while (Date.now() - start < timeoutMs) {
    if (window.turnstile?.render) {
      return;
    }

    await new Promise((resolve) => window.setTimeout(resolve, 50));
  }

    throw new Error(localizeUserFacingText('Timed out while waiting for Turnstile') || 'Timed out while waiting for Turnstile');
}

export async function ensureTurnstileScript(): Promise<void> {
  if (typeof window === 'undefined') {
    return;
  }

  if (window.turnstile?.render) {
    return;
  }

  if (turnstileScriptPromise) {
    return turnstileScriptPromise;
  }

  turnstileScriptPromise = new Promise<void>((resolve, reject) => {
    const existingScript = document.querySelector<HTMLScriptElement>(TURNSTILE_SCRIPT_SELECTOR);

    if (existingScript) {
      waitForTurnstile().then(resolve).catch(reject);
      return;
    }

    const script = document.createElement('script');
    script.src = TURNSTILE_SCRIPT_URL;
    script.async = true;
    script.defer = true;
    script.dataset.turnstileScript = 'true';
    script.onload = () => {
      waitForTurnstile().then(resolve).catch(reject);
    };
    script.onerror = () => {
      turnstileScriptPromise = null;
          reject(new Error(localizeUserFacingText('Failed to load Turnstile script') || 'Failed to load Turnstile script'));
    };

    document.head.appendChild(script);
  }).catch((error) => {
    turnstileScriptPromise = null;
    throw error;
  });

  return turnstileScriptPromise;
}

function resetAllWidgets() {
  if (!window.turnstile) {
    return;
  }

  activeWidgetIds.forEach((widgetId) => {
    try {
      window.turnstile?.reset(widgetId);
    } catch (error) {
      console.warn('[Turnstile] reset failed', error);
    }
  });
}

export const isTurnstileEnabled = TURNSTILE_ENABLED && Boolean(TURNSTILE_SITE_KEY);

export function canUseTurnstile(): boolean {
  if (typeof window === 'undefined') {
    return false;
  }

  return TURNSTILE_ENABLED && Boolean(getResolvedSiteKey());
}

export function useTurnstile() {
  const [token, setToken] = React.useState<string | null>(null);
  const [isVerified, setIsVerified] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const handleVerify = useCallback((newToken: string) => {
    setToken(newToken);
    setIsVerified(true);
    setError(null);
  }, []);

  const handleError = useCallback((nextError: string) => {
    setToken(null);
    setIsVerified(false);
    setError(nextError);
  }, []);

  const handleExpire = useCallback(() => {
    setToken(null);
    setIsVerified(false);
    setError('人机验证已过期，请重新完成验证。');
  }, []);

  const reset = useCallback(() => {
    setToken(null);
    setIsVerified(false);
    setError(null);
    resetAllWidgets();
  }, []);

  return {
    token,
    isVerified,
    error,
    handleVerify,
    handleError,
    handleExpire,
    reset,
  };
}

export const TurnstileWidget: React.FC<TurnstileWidgetProps> = ({
  onVerify,
  onError,
  onExpire,
  theme = 'auto',
  language = 'zh-CN',
  className = '',
  appearance = 'always',
  action = 'login',
  size = 'flexible',
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const widgetIdRef = useRef<string | null>(null);
  const [status, setStatus] = useState<TurnstileStatus>('idle');
  const [message, setMessage] = useState<string>('等待加载 Turnstile');

  const debugState = useMemo(() => getDebugState(), []);
  const siteKey = useMemo(() => getResolvedSiteKey(), []);
  const resolvedAppearance = debugState.appearance || appearance;
  const shouldRender = canUseTurnstile();

  const destroyWidget = useCallback(() => {
    if (widgetIdRef.current && window.turnstile) {
      try {
        window.turnstile.remove(widgetIdRef.current);
      } catch (error) {
        console.warn('[Turnstile] remove failed', error);
      }
      activeWidgetIds.delete(widgetIdRef.current);
      widgetIdRef.current = null;
    }

    if (containerRef.current) {
      containerRef.current.innerHTML = '';
      delete containerRef.current.dataset.turnstileId;
    }
  }, []);

  useEffect(() => {
    if (!shouldRender) {
      const nextMessage = TURNSTILE_ENABLED
        ? 'Turnstile 未配置，请检查 VITE_TURNSTILE_SITE_KEY。'
        : 'Turnstile 已被本地环境变量禁用。';
      setStatus('error');
      setMessage(nextMessage);
      onError?.(nextMessage);
      return undefined;
    }

    let disposed = false;

    const renderWidget = async () => {
      try {
        setStatus('loading');
        setMessage('正在加载 Turnstile 脚本');
        await ensureTurnstileScript();

        if (disposed || !containerRef.current || !window.turnstile) {
          return;
        }

        destroyWidget();
        setStatus('rendering');
        setMessage('正在渲染 Turnstile 组件');

        const widgetId = window.turnstile.render(containerRef.current, {
          sitekey: siteKey,
          theme,
          language,
          appearance: resolvedAppearance,
          action,
          size,
          callback: (token: string) => {
            if (disposed) return;
            setStatus('verified');
            setMessage('Turnstile 验证通过');
            onVerify(token);
          },
          'error-callback': (error?: string) => {
            if (disposed) return;
            const nextMessage = mapTurnstileError(error);
            setStatus('error');
            setMessage(nextMessage);
            onError?.(nextMessage);
          },
          'expired-callback': () => {
            if (disposed) return;
            setStatus('rendered');
            setMessage('Turnstile 已过期，正在等待重新验证');
            onExpire?.();
          },
        });

        widgetIdRef.current = widgetId;
        activeWidgetIds.add(widgetId);
        containerRef.current.dataset.turnstileId = widgetId;
        setStatus('rendered');
        setMessage('Turnstile 组件已加载');
      } catch (error) {
        if (disposed) return;
        const nextMessage = mapTurnstileError(error instanceof Error ? error.message : error);
        setStatus('error');
        setMessage(nextMessage);
        onError?.(nextMessage);
      }
    };

    void renderWidget();

    return () => {
      disposed = true;
      destroyWidget();
    };
  }, [action, destroyWidget, language, onError, onExpire, onVerify, resolvedAppearance, shouldRender, siteKey, size, theme]);

  return (
    <div className={className}>
      <div ref={containerRef} className="auth-turnstile-widget" data-turnstile-container="true" />

      {status === 'error' && (
        <div className="auth-turnstile-inline-error" role="alert">
          {message}
        </div>
      )}

      {debugState.enabled && (
        <div className="auth-turnstile-debug" role="status">
          <strong>Turnstile 调试状态</strong>
          <span>状态：{status}</span>
          <span>site key 来源：{getSiteKeySourceLabel(debugState.sitekey)}</span>
          <span>site key 预览：{previewSiteKey(siteKey)}</span>
          <span>appearance：{resolvedAppearance}</span>
          <span>action：{action}</span>
          <span>消息：{message}</span>
        </div>
      )}
    </div>
  );
};

export default TurnstileWidget;
