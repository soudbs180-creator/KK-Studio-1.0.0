import React, { useEffect, useMemo, useState } from 'react';
import { ExternalLink, Loader2, QrCode, X } from 'lucide-react';
import { KK_LAYER } from '@kk/ui';

import { parseWechatAuthorizationUrl } from '../../services/auth/wechatAuthUtils.ts';
import { getDocumentLanguage, localizeUserFacingText, type ResolvedLanguage } from '../../utils/localeText';
import { getWechatQrModalCopy } from './authLocalization';

interface WechatQrModalProps {
  isOpen: boolean;
  language?: ResolvedLanguage;
  title: string;
  description: string;
  authorizationUrl?: string | null;
  expiresAt?: string | null;
  loading?: boolean;
  error?: string | null;
  onClose: () => void;
  onOpenInNewPage?: () => void;
}

type WechatWidgetState = 'idle' | 'loading' | 'ready' | 'fallback';

interface WechatLoginWidgetOptions {
  id: string;
  appid: string;
  scope: string;
  redirect_uri: string;
  state: string;
  lang?: 'en';
  color_scheme?: 'auto' | 'dark' | 'light';
  self_redirect?: boolean;
  href?: string;
  onReady?: (ready: boolean) => void;
}

declare global {
  interface Window {
    WxLogin?: (options: WechatLoginWidgetOptions) => void;
  }
}

const WECHAT_LOGIN_SCRIPT_SRC = 'https://res.wx.qq.com/connect/zh_CN/htmledition/js/wxLogin.js';

let wechatLoginScriptPromise: Promise<void> | null = null;

function formatExpiryText(language: ResolvedLanguage, expiresAt?: string | null): string | null {
  if (!expiresAt) return null;

  const date = new Date(expiresAt);
  if (Number.isNaN(date.getTime())) return null;

  return date.toLocaleString(language, {
    hour12: false,
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function ensureWechatLoginScript(): Promise<void> {
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return Promise.reject(
      new Error(
        localizeUserFacingText('WeChat login widget can only run in the browser.')
        || 'WeChat login widget can only run in the browser.'
      )
    );
  }

  if (typeof window.WxLogin === 'function') {
    return Promise.resolve();
  }

  if (wechatLoginScriptPromise) {
    return wechatLoginScriptPromise;
  }

  wechatLoginScriptPromise = new Promise((resolve, reject) => {
    const resolveWhenReady = () => {
      if (typeof window.WxLogin === 'function') {
        resolve();
        return;
      }

      wechatLoginScriptPromise = null;
        reject(
          new Error(
            localizeUserFacingText('WeChat login widget is unavailable after the script finished loading.')
            || 'WeChat login widget is unavailable after the script finished loading.'
          )
        );
    };

    const handleError = () => {
      wechatLoginScriptPromise = null;
      reject(
        new Error(
          localizeUserFacingText('Unable to load the official WeChat login widget.')
          || 'Unable to load the official WeChat login widget.'
        )
      );
    };

    const existingScript = document.querySelector<HTMLScriptElement>('script[data-wechat-login-script="true"]');
    if (existingScript) {
      if (existingScript.dataset.loaded === 'true') {
        resolveWhenReady();
        return;
      }

      existingScript.addEventListener('load', () => {
        existingScript.dataset.loaded = 'true';
        resolveWhenReady();
      }, { once: true });
      existingScript.addEventListener('error', handleError, { once: true });
      return;
    }

    const script = document.createElement('script');
    script.src = WECHAT_LOGIN_SCRIPT_SRC;
    script.async = true;
    script.defer = true;
    script.dataset.wechatLoginScript = 'true';
    script.addEventListener('load', () => {
      script.dataset.loaded = 'true';
      resolveWhenReady();
    }, { once: true });
    script.addEventListener('error', handleError, { once: true });
    document.head.appendChild(script);
  });

  return wechatLoginScriptPromise;
}

const WechatQrModal: React.FC<WechatQrModalProps> = ({
  isOpen,
  language = getDocumentLanguage(),
  title,
  description,
  authorizationUrl,
  expiresAt,
  loading = false,
  error = null,
  onClose,
  onOpenInNewPage,
}) => {
  const [widgetState, setWidgetState] = useState<WechatWidgetState>('idle');
  const [widgetHint, setWidgetHint] = useState<string | null>(null);
  const copy = useMemo(() => getWechatQrModalCopy(language), [language]);
  const widgetMountId = useMemo(
    () => `wechat-login-widget-${Math.random().toString(36).slice(2)}`,
    [],
  );
  const widgetConfig = useMemo(
    () => parseWechatAuthorizationUrl(authorizationUrl),
    [authorizationUrl],
  );

  useEffect(() => {
    if (!isOpen) {
      setWidgetState('idle');
      setWidgetHint(null);
      return;
    }

    if (loading || error || !authorizationUrl) {
      setWidgetState(loading ? 'loading' : 'idle');
      setWidgetHint(null);
      return;
    }

    if (!widgetConfig) {
      setWidgetState('fallback');
      setWidgetHint(copy.invalidUrlFallback);
      return;
    }

    let disposed = false;
    let verificationTimer: number | undefined;

    setWidgetState('loading');
    setWidgetHint(null);

    const mountWidget = async () => {
      try {
        await ensureWechatLoginScript();
        if (disposed) return;

        const mountNode = document.getElementById(widgetMountId);
        if (!mountNode || typeof window.WxLogin !== 'function') {
      throw new Error(
        localizeUserFacingText('WeChat login widget mount point is unavailable.')
        || 'WeChat login widget mount point is unavailable.'
      );
        }

        mountNode.innerHTML = '';
        const customCss = `
          .impowerBox .qrcode { width: 320px !important; height: 320px !important; margin: 20px auto !important; border-radius: 24px !important; }
          .impowerBox .title { display: none !important; }
          .impowerBox .info { display: none !important; }
          .status_icon { display: none !important; }
          .impowerBox .status { display: none !important; }
          .impowerBox .wrp_code { border: none !important; margin-bottom: 0px !important; }
          body { background-color: transparent !important; }
        `;
        const cssBase64 = `data:text/css;base64,${window.btoa(customCss)}`;

        window.WxLogin({
          id: widgetMountId,
          appid: widgetConfig.appId,
          scope: widgetConfig.scope,
          redirect_uri: encodeURIComponent(widgetConfig.redirectUri),
          state: widgetConfig.state,
          lang: widgetConfig.language,
          color_scheme: 'light',
          self_redirect: false,
          href: cssBase64,
          onReady: () => {
            if (!disposed) {
              setWidgetState('ready');
            }
          },
        });

        verificationTimer = window.setTimeout(() => {
          if (disposed) return;

          const hasIframe = Boolean(mountNode.querySelector('iframe'));
          if (hasIframe) {
            setWidgetState('ready');
            return;
          }

          setWidgetState('fallback');
          setWidgetHint(copy.widgetRenderFallback);
        }, 1400);
      } catch {
        if (disposed) return;
        setWidgetState('fallback');
        setWidgetHint(copy.widgetLoadFallback);
      }
    };

    void mountWidget();

    return () => {
      disposed = true;
      if (typeof verificationTimer === 'number') {
        window.clearTimeout(verificationTimer);
      }

      const mountNode = document.getElementById(widgetMountId);
      if (mountNode) {
        mountNode.innerHTML = '';
      }
    };
  }, [authorizationUrl, copy.invalidUrlFallback, copy.widgetLoadFallback, copy.widgetRenderFallback, error, isOpen, loading, widgetConfig, widgetMountId]);

  if (!isOpen) return null;

  const expiryText = formatExpiryText(language, expiresAt);
  const emptyState = !loading && !error && !authorizationUrl;
  const showFallbackIframe = widgetState === 'fallback' && Boolean(authorizationUrl);

  return (
    <div
      className="kk-overlay-backdrop fixed inset-0 flex items-center justify-center px-4 py-6"
      onClick={onClose}
      style={{ zIndex: KK_LAYER.modalBackdrop }}
    >
      <div
        className="kk-auth-modal-panel w-full max-w-md overflow-hidden rounded-[28px] border"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="kk-auth-modal-header flex items-start justify-between gap-4 border-b px-5 py-4">
          <div className="min-w-0">
            <div className="kk-auth-modal-badge flex items-center gap-2">
              <QrCode size={18} />
              <span className="text-sm font-medium">{copy.badge}</span>
            </div>
            <h3 className="kk-auth-modal-title mt-2 text-lg font-semibold">{title}</h3>
            <p className="kk-auth-modal-description mt-1 text-sm">{description}</p>
            {expiryText && <p className="kk-auth-modal-muted mt-2 text-xs">{copy.expiresAt(expiryText)}</p>}
          </div>

          <button
            type="button"
            onClick={onClose}
            className="kk-auth-modal-close inline-flex items-center justify-center rounded-full"
            aria-label={copy.closeAria}
          >
            <X size={18} />
          </button>
        </div>

        <div className="px-5 py-5">
          {loading && (
            <div className="kk-auth-modal-state kk-auth-modal-state--loading flex h-[360px] flex-col items-center justify-center rounded-2xl">
              <Loader2 size={24} className="animate-spin" />
              <p className="mt-3 text-sm">{copy.loading}</p>
            </div>
          )}

          {!loading && error && (
            <div className="kk-auth-modal-state kk-auth-modal-state--danger rounded-2xl px-4 py-4 text-sm">
              {error}
            </div>
          )}

          {emptyState && (
            <div className="kk-auth-modal-state kk-auth-modal-state--warning rounded-2xl px-4 py-4 text-sm">
              {copy.emptyState}
            </div>
          )}

          {!loading && !error && authorizationUrl && (
            <>
              <div className="kk-auth-modal-widget-shell overflow-hidden rounded-2xl border">
                {showFallbackIframe ? (
                  <iframe
                    src={authorizationUrl}
                    title={title}
                    className="kk-auth-modal-widget-frame h-[360px] w-full"
                    allow="local-network-access"
                    referrerPolicy="strict-origin-when-cross-origin"
                  />
                ) : (
                  <div className="kk-auth-modal-widget-frame relative min-h-[360px]">
                    {widgetState === 'loading' && (
                      <div className="kk-auth-modal-widget-loading absolute inset-0 z-10 flex flex-col items-center justify-center gap-3">
                        <Loader2 size={24} className="animate-spin" />
                        <p className="text-sm">{copy.loadingWidget}</p>
                      </div>
                    )}
                    <div
                      id={widgetMountId}
                      className="kk-auth-modal-widget-frame flex min-h-[360px] w-full items-center justify-center"
                    />
                  </div>
                )}
              </div>

              {widgetHint && (
                <div className="kk-auth-modal-state kk-auth-modal-state--warning mt-3 rounded-2xl px-4 py-3 text-xs">
                  {widgetHint}
                </div>
              )}

              <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                <p className="kk-auth-modal-muted text-xs">{copy.fallbackHelp}</p>
                <button
                  type="button"
                  onClick={onOpenInNewPage}
                  className="kk-auth-modal-external-action inline-flex items-center justify-center gap-2 rounded-xl px-4 text-sm font-medium"
                >
                  <ExternalLink size={16} />
                  {copy.openInNewPage}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default WechatQrModal;
