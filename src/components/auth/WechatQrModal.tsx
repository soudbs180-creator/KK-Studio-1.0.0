import React, { useEffect, useMemo, useState } from 'react';
import { ExternalLink, Loader2, QrCode, X } from 'lucide-react';

import { parseWechatAuthorizationUrl } from '../../services/auth/wechatAuthUtils.ts';
import { localizeUserFacingText } from '../../utils/localeText';

interface WechatQrModalProps {
  isOpen: boolean;
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
  onReady?: (ready: boolean) => void;
}

declare global {
  interface Window {
    WxLogin?: (options: WechatLoginWidgetOptions) => void;
  }
}

const WECHAT_LOGIN_SCRIPT_SRC = 'https://res.wx.qq.com/connect/zh_CN/htmledition/js/wxLogin.js';

let wechatLoginScriptPromise: Promise<void> | null = null;

function formatExpiryText(expiresAt?: string | null): string | null {
  if (!expiresAt) return null;

  const date = new Date(expiresAt);
  if (Number.isNaN(date.getTime())) return null;

  return date.toLocaleString('zh-CN', {
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
      setWidgetHint('微信二维码链接无法识别，已切换到备用展示方式。');
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
        window.WxLogin({
          id: widgetMountId,
          appid: widgetConfig.appId,
          scope: widgetConfig.scope,
          redirect_uri: encodeURIComponent(widgetConfig.redirectUri),
          state: widgetConfig.state,
          lang: widgetConfig.language,
          color_scheme: 'light',
          self_redirect: false,
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
          setWidgetHint('微信二维码组件未能正常渲染，已自动切换到备用展示方式。');
        }, 1400);
      } catch {
        if (disposed) return;
        setWidgetState('fallback');
        setWidgetHint('微信二维码组件加载失败，已自动切换到备用展示方式。');
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
  }, [authorizationUrl, error, isOpen, loading, widgetConfig, widgetMountId]);

  if (!isOpen) return null;

  const expiryText = formatExpiryText(expiresAt);
  const emptyState = !loading && !error && !authorizationUrl;
  const showFallbackIframe = widgetState === 'fallback' && Boolean(authorizationUrl);

  return (
    <div
      className="fixed inset-0 z-[10030] flex items-center justify-center bg-black/65 px-4 py-6 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="w-full max-w-xl overflow-hidden rounded-3xl border border-white/10 bg-[#081629] text-white shadow-[0_30px_90px_rgba(0,0,0,0.45)]"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4 border-b border-white/10 px-5 py-4">
          <div className="min-w-0">
            <div className="flex items-center gap-2 text-emerald-300">
              <QrCode size={18} />
              <span className="text-sm font-medium">微信扫码</span>
            </div>
            <h3 className="mt-2 text-lg font-semibold text-white">{title}</h3>
            <p className="mt-1 text-sm text-slate-300">{description}</p>
            {expiryText && <p className="mt-2 text-xs text-slate-400">二维码有效期至 {expiryText}</p>}
          </div>

          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-white/10 text-slate-300 transition hover:border-white/20 hover:text-white"
            aria-label="关闭微信扫码弹窗"
          >
            <X size={18} />
          </button>
        </div>

        <div className="px-5 py-5">
          {loading && (
            <div className="flex h-[360px] flex-col items-center justify-center rounded-2xl border border-dashed border-white/10 bg-white/5 text-slate-300">
              <Loader2 size={24} className="animate-spin" />
              <p className="mt-3 text-sm">正在生成微信扫码二维码...</p>
            </div>
          )}

          {!loading && error && (
            <div className="rounded-2xl border border-red-500/30 bg-red-500/10 px-4 py-4 text-sm text-red-200">
              {error}
            </div>
          )}

          {emptyState && (
            <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 px-4 py-4 text-sm text-amber-100">
              暂时没有拿到微信二维码地址。请确认 KK API 已启动，或检查微信登录服务端配置。
            </div>
          )}

          {!loading && !error && authorizationUrl && (
            <>
              <div className="overflow-hidden rounded-2xl border border-white/10 bg-white">
                {showFallbackIframe ? (
                  <iframe
                    src={authorizationUrl}
                    title={title}
                    className="h-[420px] w-full bg-white"
                    allow="local-network-access"
                    referrerPolicy="strict-origin-when-cross-origin"
                  />
                ) : (
                  <div className="relative min-h-[420px] bg-white">
                    {widgetState === 'loading' && (
                      <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 bg-white/90 text-slate-500">
                        <Loader2 size={24} className="animate-spin" />
                        <p className="text-sm">正在加载微信官方扫码组件...</p>
                      </div>
                    )}
                    <div
                      id={widgetMountId}
                      className="flex min-h-[420px] w-full items-center justify-center bg-white"
                    />
                  </div>
                )}
              </div>

              {widgetHint && (
                <div className="mt-3 rounded-2xl border border-amber-500/20 bg-amber-500/10 px-4 py-3 text-xs text-amber-100">
                  {widgetHint}
                </div>
              )}

              <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                <p className="text-xs text-slate-400">如果二维码区域没有正常显示，可以改用新页面打开。</p>
                <button
                  type="button"
                  onClick={onOpenInNewPage}
                  className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-emerald-500/40 bg-emerald-500/10 px-4 text-sm font-medium text-emerald-200 transition hover:bg-emerald-500/15"
                >
                  <ExternalLink size={16} />
                  在新页面打开
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
