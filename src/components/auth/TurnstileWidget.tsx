import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { getDocumentLanguage, normalizeLanguage, pickByResolvedLanguage, type ResolvedLanguage } from '../../utils/localeText';
import {
  TURNSTILE_ENABLED,
  TURNSTILE_HAS_ENV_SITE_KEY,
  TURNSTILE_SITE_KEY,
} from '../../config/turnstile';
import { getTurnstileStatusMessage, mapTurnstileErrorMessage } from './authLocalization';

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

function resolveTurnstileLanguage(language?: string): ResolvedLanguage {
  return language ? normalizeLanguage(language) : getDocumentLanguage();
}

function getWidgetLanguageCode(language: ResolvedLanguage): string {
  return language === 'en-US' ? 'en' : 'zh-cn';
}

function getSiteKeySourceLabel(language: ResolvedLanguage, debugSiteKey?: string): string {
  if (debugSiteKey) return pickByResolvedLanguage(language, 'URL 参数', 'URL parameter');
  return TURNSTILE_HAS_ENV_SITE_KEY
    ? pickByResolvedLanguage(language, '环境变量', 'Environment variable')
    : pickByResolvedLanguage(language, '内置默认值', 'Built-in default');
}

function previewSiteKey(sitekey: string, language: ResolvedLanguage): string {
  if (!sitekey) return pickByResolvedLanguage(language, '未设置', 'Not set');
  if (sitekey.length <= 10) return sitekey;
  return `${sitekey.slice(0, 6)}...${sitekey.slice(-4)}`;
}

async function waitForTurnstile(
  timeoutMs = TURNSTILE_TIMEOUT_MS,
  language: ResolvedLanguage = getDocumentLanguage(),
): Promise<void> {
  const start = Date.now();

  while (Date.now() - start < timeoutMs) {
    if (window.turnstile?.render) {
      return;
    }

    await new Promise((resolve) => window.setTimeout(resolve, 50));
  }

  throw new Error(mapTurnstileErrorMessage(language, 'Timed out while waiting for Turnstile'));
}

export async function ensureTurnstileScript(language: ResolvedLanguage = getDocumentLanguage()): Promise<void> {
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
      waitForTurnstile(TURNSTILE_TIMEOUT_MS, language).then(resolve).catch(reject);
      return;
    }

    const script = document.createElement('script');
    script.src = TURNSTILE_SCRIPT_URL;
    script.async = true;
    script.defer = true;
    script.dataset.turnstileScript = 'true';
    if ('fetchPriority' in script) {
      script.fetchPriority = 'high';
    }
    script.onload = () => {
      waitForTurnstile(TURNSTILE_TIMEOUT_MS, language).then(resolve).catch(reject);
    };
    script.onerror = () => {
      turnstileScriptPromise = null;
      reject(new Error(mapTurnstileErrorMessage(language, 'Failed to load Turnstile script')));
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

export function useTurnstile(language?: string) {
  const [token, setToken] = useState<string | null>(null);
  const [isVerified, setIsVerified] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const resolveLanguage = useCallback(() => resolveTurnstileLanguage(language), [language]);

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
    setError(
      pickByResolvedLanguage(
        resolveLanguage(),
        '人机验证已过期，请重新完成验证。',
        'CAPTCHA verification expired. Please complete it again.',
      )
    );
  }, [resolveLanguage]);

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
  language,
  className = '',
  appearance = 'always',
  action = 'login',
  size = 'flexible',
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const widgetIdRef = useRef<string | null>(null);
  const resolvedLanguage = useMemo(() => resolveTurnstileLanguage(language), [language]);
  const widgetLanguage = useMemo(() => getWidgetLanguageCode(resolvedLanguage), [resolvedLanguage]);
  const [status, setStatus] = useState<TurnstileStatus>('idle');
  const [message, setMessage] = useState<string>(() => getTurnstileStatusMessage(resolvedLanguage, 'waiting'));

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
        ? getTurnstileStatusMessage(resolvedLanguage, 'missingConfig')
        : getTurnstileStatusMessage(resolvedLanguage, 'disabled');
      setStatus('error');
      setMessage(nextMessage);
      onError?.(nextMessage);
      return undefined;
    }

    let disposed = false;

    const renderWidget = async () => {
      try {
        setStatus('loading');
        setMessage(getTurnstileStatusMessage(resolvedLanguage, 'loadingScript'));
        await ensureTurnstileScript(resolvedLanguage);

        if (disposed || !containerRef.current || !window.turnstile) {
          return;
        }

        destroyWidget();
        setStatus('rendering');
        setMessage(getTurnstileStatusMessage(resolvedLanguage, 'rendering'));

        const widgetId = window.turnstile.render(containerRef.current, {
          sitekey: siteKey,
          theme,
          language: widgetLanguage,
          appearance: resolvedAppearance,
          action,
          size,
          callback: (token: string) => {
            if (disposed) return;
            setStatus('verified');
            setMessage(getTurnstileStatusMessage(resolvedLanguage, 'verified'));
            onVerify(token);
          },
          'error-callback': (error?: string) => {
            if (disposed) return;
            const nextMessage = mapTurnstileErrorMessage(resolvedLanguage, error);
            setStatus('error');
            setMessage(nextMessage);
            onError?.(nextMessage);
          },
          'expired-callback': () => {
            if (disposed) return;
            setStatus('rendered');
            setMessage(getTurnstileStatusMessage(resolvedLanguage, 'expired'));
            onExpire?.();
          },
        });

        widgetIdRef.current = widgetId;
        activeWidgetIds.add(widgetId);
        containerRef.current.dataset.turnstileId = widgetId;
        setStatus('rendered');
        setMessage(getTurnstileStatusMessage(resolvedLanguage, 'loaded'));
      } catch (error) {
        if (disposed) return;
        const nextMessage = mapTurnstileErrorMessage(resolvedLanguage, error instanceof Error ? error.message : error);
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
  }, [action, destroyWidget, onError, onExpire, onVerify, resolvedAppearance, resolvedLanguage, shouldRender, siteKey, size, theme, widgetLanguage]);

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
          <strong>{pickByResolvedLanguage(resolvedLanguage, 'Turnstile 调试状态', 'Turnstile debug status')}</strong>
          <span>{pickByResolvedLanguage(resolvedLanguage, `状态：${status}`, `Status: ${status}`)}</span>
          <span>{pickByResolvedLanguage(resolvedLanguage, `site key 来源：${getSiteKeySourceLabel(resolvedLanguage, debugState.sitekey)}`, `Site key source: ${getSiteKeySourceLabel(resolvedLanguage, debugState.sitekey)}`)}</span>
          <span>{pickByResolvedLanguage(resolvedLanguage, `site key 预览：${previewSiteKey(siteKey, resolvedLanguage)}`, `Site key preview: ${previewSiteKey(siteKey, resolvedLanguage)}`)}</span>
          <span>appearance：{resolvedAppearance}</span>
          <span>action：{action}</span>
          <span>{pickByResolvedLanguage(resolvedLanguage, `消息：${message}`, `Message: ${message}`)}</span>
        </div>
      )}
    </div>
  );
};

export default TurnstileWidget;
