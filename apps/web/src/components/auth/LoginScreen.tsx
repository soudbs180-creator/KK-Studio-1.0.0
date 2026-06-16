import React, { Suspense, startTransition, useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  ArrowRight,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Eye,
  EyeOff,
  Loader2,
  Lock,
  Mail,
  QrCode,
  Sparkles,
  X,
} from 'lucide-react';

import { APP_DISPLAY_VERSION } from '../../config/appInfo';
import { buildAdminLoginUrl } from '../../services/admin/adminEntry';
import { TURNSTILE_ENABLED, TURNSTILE_HAS_SITE_KEY } from '../../config/turnstile';
import { useAuth } from '../../context/AuthContext';
import { useLocale } from '../../context/LocaleContext';
import { useTheme } from '../../context/ThemeContext';
import { isHostedRuntime, kkWebApiClient } from '../../services/api/kkApiClient';
import { signInWithPasswordWithFallback } from '../../services/auth/passwordSignIn';
import { pickByResolvedLanguage, type ResolvedLanguage } from '../../utils/localeText';
import { readRuntimeEnv } from '../../utils/runtimeEnv';
import { safeOpenLink } from '../../utils/browserUtils';
import { lazyWithRetry } from '../../utils/lazyWithRetry';
import { getTurnstileDisabledMessage, getTurnstileMissingSiteKeyMessage, mapAuthErrorMessage } from './authLocalization';
import { TurnstileWidget, canUseTurnstile, ensureTurnstileScript, useTurnstile, type TurnstileStatus } from './TurnstileWidget';
import './LoginScreen.css';

type AuthView = 'login' | 'register' | 'forgot-password';
type FieldName = 'email' | 'password' | 'confirmPassword';
type FieldErrors = Partial<Record<FieldName, string>>;
type FieldTouched = Record<FieldName, boolean>;
type IdleSchedulerWindow = Window & typeof globalThis & {
  requestIdleCallback?: (callback: () => void, options?: { timeout: number }) => number;
  cancelIdleCallback?: (handle: number) => void;
};

const MAX_RETRY = 3;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const AnimatedShaderBackground = lazyWithRetry(() => import('../ui/animated-shader-background'));
const WechatQrModal = lazyWithRetry(() => import('./WechatQrModal'));

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function isNetworkError(error: unknown): boolean {
  const message = String((error as { message?: string })?.message || '').toLowerCase();
  return message.includes('failed to fetch') || message.includes('network') || message.includes('timeout');
}

function isCaptchaError(error: unknown): boolean {
  const message = String((error as { message?: string })?.message || '').toLowerCase();
  return message.includes('captcha') || message.includes('turnstile') || message.includes('captcha_token');
}

function toAuthError(code: string | undefined, message: string): Error {
  const normalizedCode = String(code || '').trim();
  return new Error(normalizedCode ? `${normalizedCode}: ${message}` : message);
}

const FEATURES = [
  {
    id: 1,
    num: '01',
    title: '智能无限画布 / Infinite Creative Canvas',
    desc: '突破画幅边界，在自由的可视化空间中进行创作。支持 AI 辅助版面重排与节点自动连接，让你的创意工作流如水般自然流淌。',
    visualType: 'canvas',
  },
  {
    id: 2,
    num: '02',
    title: '智能体自主接管 / Autonomous Copilot',
    desc: '引入先进的智能接管协议。它不仅是问答助手，更能深度理解上下文，自主规划多步任务，帮你自动进行复杂的开发与设计改造。',
    visualType: 'copilot',
  },
  {
    id: 3,
    num: '03',
    title: '多模型与预设服务 / Global Model Aggregator',
    desc: '聚合 OpenAI, Claude, DeepSeek 等全球顶尖模型。一键无缝热切，统一接口契约。无论是在本地运行时还是云端，均能快速连接。',
    visualType: 'models',
  },
  {
    id: 4,
    num: '04',
    title: '本地优先与多端协同 / Local-First, Cloud-Synced',
    desc: '默认采用本地优先架构，体验极致响应速度。支持无缝与云端（PostgreSQL / VPS）安全同步会话，多端保持，保障数据永不丢失。',
    visualType: 'sync',
  }
];

function validateFields(
  view: AuthView,
  email: string,
  password: string,
  confirmPassword: string,
  language: ResolvedLanguage,
): FieldErrors {
  const errors: FieldErrors = {};
  const pickText = <T,>(zh: T, en: T): T => pickByResolvedLanguage(language, zh, en);
  const emailValue = email.trim();

  if (!emailValue) {
    errors.email = pickText('请输入邮箱地址。', 'Enter your email address.');
  } else if (!EMAIL_RE.test(emailValue)) {
    errors.email = pickText('邮箱格式不正确。', 'Enter a valid email address.');
  }

  if (view !== 'forgot-password') {
    if (!password) {
      errors.password = pickText('请输入登录密码。', 'Enter your password.');
    } else if (password.length < 8) {
      errors.password = pickText('密码长度至少 8 位。', 'Password must be at least 8 characters.');
    }
  }

  if (view === 'register') {
    if (!confirmPassword) {
      errors.confirmPassword = pickText('请再次输入密码。', 'Enter your password again.');
    } else if (confirmPassword !== password) {
      errors.confirmPassword = pickText('两次输入的密码不一致。', 'The two passwords do not match.');
    }
  }

  return errors;
}

const LoginScreen: React.FC = () => {
  const { loginAsTempUser } = useAuth();
  const { language } = useLocale();
  const { resolvedTheme } = useTheme();
  const hostedRuntime = useMemo(() => isHostedRuntime(), []);
  const turnstileAvailable = canUseTurnstile();
  const turnstileMissingSiteKey = TURNSTILE_ENABLED && !TURNSTILE_HAS_SITE_KEY;
  const turnstileDisabledByRuntime = !TURNSTILE_ENABLED;
  const showTurnstileBlock = turnstileAvailable || turnstileMissingSiteKey || turnstileDisabledByRuntime;
  const { token: turnstileToken, error: turnstileError, handleVerify, handleError, handleExpire, reset: resetTurnstile } = useTurnstile(language);

  const [view, setView] = useState<AuthView>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [tempLoading, setTempLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [captchaRequiredByBackend, setCaptchaRequiredByBackend] = useState(false);
  const [fieldTouched, setFieldTouched] = useState<FieldTouched>({ email: false, password: false, confirmPassword: false });
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [wechatModalOpen, setWechatModalOpen] = useState(false);
  const [wechatLoading, setWechatLoading] = useState(false);
  const [wechatError, setWechatError] = useState<string | null>(null);
  const [wechatAuthorizationUrl, setWechatAuthorizationUrl] = useState<string | null>(null);
  const [wechatExpiresAt, setWechatExpiresAt] = useState<string | null>(null);
  const [showShaderBackground, setShowShaderBackground] = useState(false);
  const [turnstileWidgetStatus, setTurnstileWidgetStatus] = useState<TurnstileStatus>('idle');
  const t = useCallback(<T,>(zh: T, en: T): T => pickByResolvedLanguage(language, zh, en), [language]);

  // Modal & Slider states
  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);
  const [activeSlide, setActiveSlide] = useState(0);
  const [slideProgress, setSlideProgress] = useState(0);
  const [touchStart, setTouchStart] = useState<number | null>(null);
  const [touchEnd, setTouchEnd] = useState<number | null>(null);

  const localErrors = useMemo(() => validateFields(view, email, password, confirmPassword, language), [view, email, password, confirmPassword, language]);

  const resolveAuthErrorMessage = useCallback((authError: unknown, targetView: AuthView) => {
    if (isCaptchaError(authError)) {
      if (turnstileMissingSiteKey) return getTurnstileMissingSiteKeyMessage(language);
      if (!TURNSTILE_ENABLED) return getTurnstileDisabledMessage(language);
    }
    return mapAuthErrorMessage(language, authError, targetView);
  }, [language, turnstileMissingSiteKey]);

  useEffect(() => {
    const body = document.body;
    const root = document.documentElement;
    const authThemeClass = `auth-screen-active--${resolvedTheme}`;
    const backgroundColor = resolvedTheme === 'dark' ? 'var(--clay-dark-canvas)' : 'var(--clay-canvas)';
    const previousBodyBackground = body.style.background;
    const previousRootBackground = root.style.background;
    const previousColorScheme = root.style.colorScheme;

    body.classList.add('auth-screen-active', authThemeClass);
    root.classList.add('auth-screen-active', authThemeClass);
    body.style.background = backgroundColor;
    root.style.background = backgroundColor;
    root.style.colorScheme = resolvedTheme;

    return () => {
      body.classList.remove('auth-screen-active', authThemeClass);
      root.classList.remove('auth-screen-active', authThemeClass);
      body.style.background = previousBodyBackground;
      root.style.background = previousRootBackground;
      root.style.colorScheme = previousColorScheme || '';
    };
  }, [resolvedTheme]);

  useEffect(() => {
    if (!turnstileAvailable) return;
    void ensureTurnstileScript(language).catch(() => {});
  }, [language, turnstileAvailable]);

  useEffect(() => {
    const idleWindow = window as IdleSchedulerWindow;
    let revealHandle: number | null = null;
    let fallbackHandle: number | null = null;
    const reveal = () => startTransition(() => setShowShaderBackground(true));

    if (turnstileAvailable && window.turnstile?.render) {
      revealHandle = typeof idleWindow.requestIdleCallback === 'function' ? idleWindow.requestIdleCallback(reveal, { timeout: 600 }) : window.setTimeout(reveal, 180);
    } else {
      fallbackHandle = window.setTimeout(reveal, 600);
    }

    return () => {
      if (revealHandle !== null) {
        if (typeof idleWindow.cancelIdleCallback === 'function' && typeof idleWindow.requestIdleCallback === 'function') idleWindow.cancelIdleCallback(revealHandle);
        else window.clearTimeout(revealHandle);
      }
      if (fallbackHandle !== null) window.clearTimeout(fallbackHandle);
    };
  }, [turnstileAvailable]);

  // 控制外层页面滚动：弹窗打开时禁用滚动
  useEffect(() => {
    if (isLoginModalOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isLoginModalOpen]);

  useEffect(() => {
    setError(null);
    setMessage(null);
    setPassword('');
    setConfirmPassword('');
    setShowPassword(false);
    setSubmitted(false);
    setCaptchaRequiredByBackend(false);
    setFieldTouched({ email: false, password: false, confirmPassword: false });
    setFieldErrors({});
    setWechatModalOpen(false);
    setWechatLoading(false);
    setWechatError(null);
    setWechatAuthorizationUrl(null);
    setWechatExpiresAt(null);
    if (turnstileAvailable) resetTurnstile();
  }, [resetTurnstile, turnstileAvailable, view]);

  // Slide autoplay effect
  useEffect(() => {
    if (isLoginModalOpen) return;
    const SLIDE_DURATION = 6000;
    const interval = 60;
    const increment = (interval / SLIDE_DURATION) * 100;
    const timer = setInterval(() => {
      setSlideProgress((prev) => {
        if (prev >= 100) {
          setActiveSlide((current) => (current + 1) % FEATURES.length);
          return 0;
        }
        return prev + increment;
      });
    }, interval);
    return () => clearInterval(timer);
  }, [isLoginModalOpen]);

  const handleNextSlide = () => { setActiveSlide((current) => (current + 1) % FEATURES.length); setSlideProgress(0); };
  const handlePrevSlide = () => { setActiveSlide((current) => (current - 1 + FEATURES.length) % FEATURES.length); setSlideProgress(0); };
  const handleIndicatorClick = (idx: number) => { setActiveSlide(idx); setSlideProgress(0); };
  const handleTouchStart = (e: React.TouchEvent) => { setTouchEnd(null); setTouchStart(e.targetTouches[0].clientX); };
  const handleTouchMove = (e: React.TouchEvent) => { setTouchEnd(e.targetTouches[0].clientX); };
  const handleTouchEnd = () => { if (!touchStart || !touchEnd) return; const distance = touchStart - touchEnd; if (distance > 50) handleNextSlide(); else if (distance < -50) handlePrevSlide(); };

  const handleTurnstileVerify = useCallback((token: string) => { setCaptchaRequiredByBackend(false); handleVerify(token); }, [handleVerify]);
  const handleTurnstileError = useCallback((nextError: string) => { handleError(nextError); if (captchaRequiredByBackend) setError(nextError); }, [captchaRequiredByBackend, handleError]);
  const handleTurnstileExpire = useCallback(() => { handleExpire(); setCaptchaRequiredByBackend(true); }, [handleExpire]);
  const handleTurnstileStatusChange = useCallback((status: TurnstileStatus) => { setTurnstileWidgetStatus(status); }, []);

  const handleEmailChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const nextEmail = event.target.value;
    setEmail(nextEmail);
    setFieldErrors(validateFields(view, nextEmail, password, confirmPassword, language));
  }, [confirmPassword, language, password, view]);

  const handlePasswordChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const nextPassword = event.target.value;
    setPassword(nextPassword);
    setFieldErrors(validateFields(view, email, nextPassword, confirmPassword, language));
  }, [confirmPassword, email, language, view]);

  const handleConfirmPasswordChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const nextConfirmPassword = event.target.value;
    setConfirmPassword(nextConfirmPassword);
    setFieldErrors(validateFields(view, email, password, nextConfirmPassword, language));
  }, [email, language, password, view]);

  const attemptAuth = async (captchaToken?: string) => {
    const emailValue = email.trim();
    if (view === 'register') {
      const response = await kkWebApiClient.register({ email: emailValue, password, turnstileToken: captchaToken || '' });
      if (!response.success) throw toAuthError(response.error.code, response.error.message || 'Registration failed.');
      setMessage(t('注册成功，正在跳转登录...', 'Registration succeeded, redirecting to login...'));
      window.setTimeout(() => setView('login'), 1500);
      return;
    }
    if (view === 'login') {
      const result = await signInWithPasswordWithFallback({ email: emailValue, password, ...(captchaToken ? { captchaToken } : {}) });
      if (result.error) throw result.error;
      setMessage(hostedRuntime ? t('VPS 会话已建立，正在进入工作区...', 'VPS session active, entering workspace...') : t('本地运行时会话已建立。', 'Local runtime session active.'));
      return;
    }
    throw toAuthError('AUTH_RESET_PASSWORD_UNAVAILABLE', t('当前本地运行时尚未接入重置密码接口。', 'The local runtime does not expose password reset yet.'));
  };

  const handleAuth = async (event: React.FormEvent) => {
    event.preventDefault();
    if (loading || tempLoading || googleLoading || wechatLoading) return;
    setSubmitted(true);
    setFieldTouched({ email: true, password: true, confirmPassword: true });
    setFieldErrors(localErrors);
    if (Object.keys(localErrors).length > 0) {
      setError(t('请先修正表单错误后再提交。', 'Fix the form errors before submitting.'));
      return;
    }
    if (turnstileAvailable && !turnstileToken) {
      setCaptchaRequiredByBackend(true);
      setError(turnstileError || t('请完成 Cloudflare 安全验证后再登录。', 'Complete the Cloudflare security check before signing in.'));
      return;
    }

    setLoading(true);
    setError(null);
    setMessage(null);
    let lastError: unknown = null;
    for (let index = 0; index < MAX_RETRY; index += 1) {
      try {
        await attemptAuth(turnstileToken || undefined);
        setLoading(false);
        return;
      } catch (authError) {
        lastError = authError;
        if (isCaptchaError(authError)) setCaptchaRequiredByBackend(true);
        if (isNetworkError(authError) && index < MAX_RETRY - 1) {
          setError(t(`网络连接不稳定，正在重试（${index + 1}/${MAX_RETRY}）...`, `Network looks unstable. Retrying (${index + 1}/${MAX_RETRY})...`));
          await sleep(900);
          continue;
        }
        break;
      }
    }
    setError(isNetworkError(lastError) ? (hostedRuntime ? t(`连续 ${MAX_RETRY} 次请求失败，请检查 VPS 登录服务是否可达后重试。`, `Network request failed after ${MAX_RETRY} attempts. Check whether the VPS sign-in service is reachable and try again.`) : t(`连续 ${MAX_RETRY} 次请求失败，可先使用临时账号进入本地工作区。`, `Network request failed after ${MAX_RETRY} attempts. You can continue with a temporary account for local-only access.`)) : resolveAuthErrorMessage(lastError, view));
    if (turnstileAvailable) resetTurnstile();
    setLoading(false);
  };

  const handleWechatLogin = async () => {
    if (loading || tempLoading || wechatLoading || googleLoading) return;
    if (turnstileAvailable && !turnstileToken) {
      setCaptchaRequiredByBackend(true);
      setError(turnstileError || t('请先完成人机验证后再使用微信扫码登录。', 'Complete CAPTCHA verification before signing in with WeChat QR.'));
      return;
    }
    setWechatModalOpen(true);
    setWechatLoading(true);
    setWechatError(null);
    setWechatAuthorizationUrl(null);
    setWechatExpiresAt(null);
    try {
      const { startWechatLogin } = await import('../../services/auth/wechatAuth.ts');
      const authData = await startWechatLogin();
      setWechatAuthorizationUrl(authData.authorizationUrl);
      setWechatExpiresAt(authData.expiresAt);
    } catch (authError) {
      const nextError = resolveAuthErrorMessage(authError, 'login');
      setWechatError(nextError);
      setError(nextError);
    } finally {
      setWechatLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    if (loading || tempLoading || googleLoading || wechatLoading) return;
    setError(null);
    setMessage(null);
    setGoogleLoading(true);
    try {
      const { startGoogleSignIn } = await import('../../services/auth/googleAuth.ts');
      await startGoogleSignIn();
    } catch (authError) {
      setError(resolveAuthErrorMessage(authError, 'login'));
      setGoogleLoading(false);
    }
  };

  const handleAdminEntry = () => {
    setError(null);
    setMessage(null);
    try {
      const nextUrl = buildAdminLoginUrl({ configuredBaseUrl: readRuntimeEnv('VITE_KK_ADMIN_URL'), currentUrl: window.location.href });
      window.location.assign(nextUrl);
    } catch (redirectError) {
      setError(redirectError instanceof Error ? redirectError.message : t('管理员后台入口暂不可用。', 'The admin entry is not available right now.'));
    }
  };

  const handleTempUserEntry = async () => {
    if (loading || tempLoading || googleLoading || wechatLoading) return;
    setError(null);
    setMessage(null);
    setTempLoading(true);
    try {
      await loginAsTempUser();
      setMessage(t('临时用户已就绪，正在进入本地工作区...', 'Temporary access is ready. Entering local workspace...'));
    } catch (authError) {
      setError(resolveAuthErrorMessage(authError, 'login'));
    } finally {
      setTempLoading(false);
    }
  };

  const showFieldError = (field: FieldName) => Boolean(fieldErrors[field] && (submitted || fieldTouched[field]));
  const turnstileWidgetFailed = turnstileAvailable && !turnstileToken && turnstileWidgetStatus === 'error';
  const turnstileAwaitingVerification = turnstileAvailable && !turnstileToken && turnstileWidgetStatus === 'rendered';
  const turnstileStatusClass = turnstileToken ? 'is-ready' : turnstileWidgetFailed || !turnstileAvailable ? 'is-error' : 'is-pending';
  const turnstileStatusLabel = turnstileToken ? t('已就绪', 'Ready') : turnstileWidgetFailed ? t('验证异常', 'Error') : turnstileAwaitingVerification ? t('待验证', 'Verify') : turnstileAvailable ? t('加载中', 'Loading') : turnstileMissingSiteKey ? t('未配置', 'Not configured') : t('已关闭', 'Disabled');
  const turnstileHint = turnstileMissingSiteKey ? getTurnstileMissingSiteKeyMessage(language) : turnstileDisabledByRuntime ? getTurnstileDisabledMessage(language) : turnstileError || (captchaRequiredByBackend && !turnstileToken ? t('请完成 Cloudflare 安全验证后再登录。', 'Complete the Cloudflare security check before signing in.') : turnstileToken ? t('安全验证已完成。', 'Security verification is complete.') : turnstileAwaitingVerification ? t('请完成 Cloudflare 安全验证后再登录。', 'Complete the Cloudflare security check before signing in.') : t('页面打开后会自动加载 Turnstile，用于阻挡机器请求。', 'Turnstile loads automatically when the page opens to help block bots.'));

  const scrollToSlider = () => {
    const sliderEl = document.querySelector('.intro-slider-section');
    sliderEl?.scrollIntoView({ behavior: 'smooth' });
  };

  const renderFeatureVisual = (type: string) => {
    switch (type) {
      case 'canvas': return <div className="visual-canvas-mock"><div className="canvas-grid-bg" /><div className="canvas-card canvas-card-1"><span className="card-dot red" /><div className="card-line" style={{ width: '60%' }} /></div><div className="canvas-card canvas-card-2"><span className="card-dot blue" /><div className="card-line" style={{ width: '70%' }} /></div><div className="canvas-card canvas-card-3"><span className="card-dot green" /><div className="card-line" style={{ width: '50%' }} /></div><svg className="canvas-connection-svg" width="100%" height="100%"><path d="M 50,60 Q 150,110 250,80" className="animated-path path-1" /><path d="M 250,80 Q 200,200 130,220" className="animated-path path-2" /></svg><div className="canvas-cursor-mock" /></div>;
      case 'copilot': return <div className="visual-copilot-mock"><div className="copilot-core"><div className="core-glow" /><div className="core-circle-1" /><div className="core-circle-2" /><Sparkles size={28} className="core-icon" /></div><div className="copilot-orbit orbit-1"><div className="orbit-particle p1" /></div><div className="copilot-orbit orbit-2"><div className="orbit-particle p2" /></div><div className="copilot-code-tag tag-1"><code>console.log("Autonomous...")</code></div><div className="copilot-code-tag tag-2"><code>agent.execute(plan)</code></div></div>;
      case 'models': return <div className="visual-models-mock"><div className="model-card model-card-openai"><div className="model-header-badge openai">GPT-4o</div><div className="model-body-lines"><span className="line" /><span className="line short" /></div></div><div className="model-card model-card-claude"><div className="model-header-badge claude">Claude 3.5</div><div className="model-body-lines"><span className="line" /><span className="line short" /></div></div><div className="model-card model-card-deepseek"><div className="model-header-badge deepseek">DeepSeek R1</div><div className="model-body-lines"><span className="line" /><span className="line short" /></div></div></div>;
      case 'sync': return <div className="visual-sync-mock"><div className="sync-node local-node"><span className="node-icon">💻</span><span className="node-label">Local</span></div><div className="sync-channel"><div className="channel-line" /><div className="sync-particle to-cloud" /><div className="sync-particle to-local" /></div><div className="sync-node cloud-node"><span className="node-icon">☁️</span><span className="node-label">VPS Sync</span></div></div>;
      default: return null;
    }
  };

  return (
    <div className={`auth-page auth-page--${resolvedTheme}`}>
      {wechatModalOpen && (
        <Suspense fallback={null}>
          <WechatQrModal
            isOpen={wechatModalOpen}
            language={language}
            title={t('使用微信扫码登录', 'Sign in with WeChat QR')}
            description={t('微信确认后，KK Studio 会直接恢复 VPS 浏览器会话。', 'After you confirm on WeChat, KK Studio restores the VPS-backed browser session directly.')}
            authorizationUrl={wechatAuthorizationUrl}
            expiresAt={wechatExpiresAt}
            loading={wechatLoading}
            error={wechatError}
            onClose={() => setWechatModalOpen(false)}
            onOpenInNewPage={() => wechatAuthorizationUrl && safeOpenLink(wechatAuthorizationUrl)}
          />
        </Suspense>
      )}

      {/* 动态 Shader 背景 */}
      <div className="auth-shader-background" aria-hidden>
        {showShaderBackground ? (
          <Suspense fallback={null}>
            <AnimatedShaderBackground className="auth-shader-canvas" />
          </Suspense>
        ) : null}
      </div>

      {/* 高级深色渐变与网格背景 */}
      <div className="auth-background" aria-hidden>
        <div className="auth-gradient auth-gradient-a" />
        <div className="auth-gradient auth-gradient-b" />
        <div className="auth-grid" />
      </div>

      {/* 介绍页垂直可滚动大容器 */}
      <div className="intro-scroll-container">
        {/* Header 导航 */}
        <header className="intro-header">
          <div className="intro-logo">
            <Sparkles size={22} className="intro-logo-icon" />
            <span className="intro-logo-text">{t('KK Studio', 'KK Studio')}</span>
          </div>
          <div className="intro-nav-actions">
            <button
              type="button"
              className="intro-login-btn"
              onClick={() => {
                setIsLoginModalOpen(true);
                setView('login');
              }}
            >
              {t('登录', 'Sign In')}
            </button>
          </div>
        </header>

        {/* Section 1: Hero Section */}
        <section className="intro-hero">
          <h1 className="intro-hero-title">
            {t('下一代智能创作工作台', 'Next-Generation')}
            <br />
            <span className="hero-gradient-text">{t('激发你的无限创意', 'AI Creative Workspace')}</span>
          </h1>
          <p className="intro-hero-subtitle">
            {t('KK Studio 融合了无限画布、自主智能体接管与全球模型聚合，旨在加速您的创意与开发构想。', 'KK Studio blends infinite canvas, autonomous agents, and model aggregator to accelerate your ideas.')}
          </p>
          <div className="intro-hero-actions">
            <button
              type="button"
              className="intro-hero-btn"
              onClick={() => {
                setIsLoginModalOpen(true);
                setView('login');
              }}
            >
              {t('立即开启智能创作', 'Start Designing')}
              <ArrowRight size={16} />
            </button>
          </div>
          {/* 下滑指引 */}
          <button
            type="button"
            className="intro-hero-scroll-down"
            onClick={scrollToSlider}
            aria-label="Scroll down"
          >
            <span className="scroll-down-text">{t('探索功能特性', 'Explore Features')}</span>
            <ChevronDown size={18} className="scroll-down-arrow" />
          </button>
        </section>

        {/* Section 2: Features Slider (水平轮播展示) */}
        <section className="intro-slider-section">
          <div className="slider-container">
            {/* 左右导航 */}
            <button
              type="button"
              className="slider-nav-btn slider-nav-prev"
              onClick={handlePrevSlide}
              aria-label="Previous slide"
            >
              <ChevronLeft size={20} />
            </button>
            <button
              type="button"
              className="slider-nav-btn slider-nav-next"
              onClick={handleNextSlide}
              aria-label="Next slide"
            >
              <ChevronRight size={20} />
            </button>

            {/* 轮播轨道 */}
            <div
              className="slider-track"
              onTouchStart={handleTouchStart}
              onTouchMove={handleTouchMove}
              onTouchEnd={handleTouchEnd}
            >
              {FEATURES.map((feat, idx) => {
                const isActive = idx === activeSlide;
                const isPrev = idx === (activeSlide - 1 + FEATURES.length) % FEATURES.length;
                const isNext = idx === (activeSlide + 1) % FEATURES.length;
                let slideClass = 'slider-slide';
                if (isActive) slideClass += ' active';
                else if (isPrev) slideClass += ' prev';
                else if (isNext) slideClass += ' next';

                return (
                  <div key={feat.id} className={slideClass}>
                    <div className="slide-content">
                      <div className="slide-text-col">
                        <span className="slide-num">{feat.num}</span>
                        <h2 className="slide-title">{feat.title}</h2>
                        <p className="slide-desc">{feat.desc}</p>
                        <button
                          type="button"
                          className="slide-cta-btn"
                          onClick={() => {
                            setIsLoginModalOpen(true);
                            setView('login');
                          }}
                        >
                          {t('体验此功能', 'Try it now')}
                        </button>
                      </div>
                      <div className="slide-visual-col">
                        <div className="visual-wrapper">
                          {renderFeatureVisual(feat.visualType)}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* 进度条指示器 */}
            <div className="slider-indicators">
              {FEATURES.map((_, idx) => (
                <button
                  key={idx}
                  type="button"
                  className={`slider-indicator-dot ${idx === activeSlide ? 'active' : ''}`}
                  onClick={() => handleIndicatorClick(idx)}
                >
                  <span
                    className="slider-indicator-progress"
                    style={{
                      width: idx === activeSlide ? `${slideProgress}%` : '0%',
                    }}
                  />
                </button>
              ))}
            </div>
          </div>
        </section>

        {/* Section 3: Capability Grid (交互式能力网格卡片) */}
        <section className="intro-grid-section">
          <div className="grid-header">
            <span className="grid-badge">{t('技术规格 / SPECS', 'SPECIFICATIONS')}</span>
            <h2 className="grid-title">{t('卓越的技术底层架构', 'Built for Performance')}</h2>
          </div>
          <div className="capability-grid">
            {/* 卡片 1: Lightning Local Runtime */}
            <div className="cap-card cap-card-runtime">
              <div className="cap-visual">
                <div className="cpu-graphic">
                  <div className="cpu-inner" />
                  <div className="cpu-core-glow" />
                </div>
              </div>
              <h3 className="cap-title">{t('极速本地运行时', 'Lightning Local Runtime')}</h3>
              <p className="cap-desc">{t('默认运行在本地隔离的极低延迟沙箱环境。支持离线可用、本地大模型直连及秒级代码热加载，免受网络波动干扰。', 'Runs locally in an isolated low-latency sandbox. Features offline support and hot-reload in seconds.')}</p>
            </div>

            {/* 卡片 2: Secure DB Sync */}
            <div className="cap-card cap-card-sync">
              <div className="cap-visual">
                <div className="db-graphic">
                  <div className="db-cylinder row-1" />
                  <div className="db-cylinder row-2" />
                  <div className="db-cylinder row-3" />
                  <div className="db-lock">🔒</div>
                </div>
              </div>
              <h3 className="cap-title">{t('数据库状态持久化', 'Session Persistence')}</h3>
              <p className="cap-desc">{t('配备本地 SQLite 与 PostgreSQL 混合持久化引擎。自动在 VPS 或本地保持应用状态，即便重新打开浏览器，您的工作进度也能无缝恢复。', 'Equipped with hybrid persistent engines. Syncs state automatically to VPS to ensure your work is never lost.')}</p>
            </div>

            {/* 卡片 3: Global API Router */}
            <div className="cap-card cap-card-bridge">
              <div className="cap-visual">
                <div className="bridge-graphic">
                  <div className="node center-node" />
                  <div className="node orbit-node n1" />
                  <div className="node orbit-node n2" />
                  <div className="node orbit-node n3" />
                  <div className="bridge-glow" />
                </div>
              </div>
              <h3 className="cap-title">{t('云端 API 网络网桥', 'Global Model Router')}</h3>
              <p className="cap-desc">{t('完美映射全球主流 AI 模型供应商，提供统一、标准化的 API 服务中继与路由协议。支持按需热切与动态凭证代理，连通无阻。', 'Integrates global top-tier model providers into a standardized API router with dynamic credential proxying.')}</p>
            </div>
          </div>
        </section>

        {/* Section 4: Footer */}
        <footer className="intro-footer">
          <div className="footer-left">
            <span>&copy; {new Date().getFullYear()} KK Studio. All rights reserved.</span>
          </div>
          <div className="footer-right">
            <span className="footer-version">{APP_DISPLAY_VERSION}</span>
          </div>
        </footer>
      </div>

      {/* 登录弹窗 Modal */}
      {isLoginModalOpen && (
        <div className="auth-modal-overlay" onClick={() => setIsLoginModalOpen(false)}>
          <div className="auth-modal-content" onClick={(e) => e.stopPropagation()}>
            <button
              type="button"
              className="auth-modal-close"
              onClick={() => setIsLoginModalOpen(false)}
              aria-label="Close modal"
            >
              <X size={20} />
            </button>
            <div className="auth-panel">
              {view !== 'login' && (
                <button
                  type="button"
                  className="auth-link-back"
                  onClick={() => setView('login')}
                >
                  <ChevronLeft size={16} />
                  {t('返回登录', 'Back to sign in')}
                </button>
              )}
              <header className="auth-header">
                <h2>
                  {view === 'login'
                    ? t('欢迎回来', 'Welcome back')
                    : view === 'register'
                    ? t('创建账号', 'Create your account')
                    : t('找回密码', 'Reset your password')}
                </h2>
                <p>
                  {view === 'login'
                    ? hostedRuntime
                      ? t('使用 VPS 账号登录后进入工作区，浏览器会自动保持会话。', 'Sign in with your VPS-backed account to enter the workspace. The browser session stays active automatically.')
                      : t('使用 KK API 或本地运行时继续进入工作区。', 'Use the KK API or the local runtime to continue into the workspace.')
                    : view === 'register'
                    ? t('注册入口已切换到 KK API，后端未就绪时会直接提示。', 'The sign-up flow now goes through the KK API and will tell you clearly when the backend is not ready.')
                    : t('当前仅保留占位入口，等待后端接入重置密码接口。', 'This is currently a placeholder while the backend reset-password route is still being wired up.')}
                </p>
              </header>

              <form className="auth-form" onSubmit={handleAuth}>
                {error && (
                  <div className="auth-feedback auth-feedback-error">
                    <AlertCircle size={16} />
                    <span>{error}</span>
                  </div>
                )}
                {message && (
                  <div className="auth-feedback auth-feedback-success">
                    <CheckCircle2 size={16} />
                    <span>{message}</span>
                  </div>
                )}

                <label className="auth-field">
                  <span>{t('邮箱地址', 'Email')}</span>
                  <div className={`auth-input-wrap ${showFieldError('email') ? 'auth-input-error' : ''}`}>
                    <Mail size={18} />
                    <input
                      type="email"
                      value={email}
                      onChange={handleEmailChange}
                      onBlur={() => setFieldTouched((current) => ({ ...current, email: true }))}
                      placeholder={t('请输入邮箱地址', 'Enter your email')}
                      required
                      autoComplete="email"
                    />
                  </div>
                  <div className="auth-field-help">
                    {showFieldError('email') ? (
                      <span className="auth-field-error">{fieldErrors.email}</span>
                    ) : (
                      <span>　</span>
                    )}
                  </div>
                </label>

                {view !== 'forgot-password' && (
                  <label className="auth-field">
                    <span>{t('登录密码', 'Password')}</span>
                    <div className={`auth-input-wrap ${showFieldError('password') ? 'auth-input-error' : ''}`}>
                      <Lock size={18} />
                      <input
                        type={showPassword ? 'text' : 'password'}
                        value={password}
                        onChange={handlePasswordChange}
                        onBlur={() => setFieldTouched((current) => ({ ...current, password: true }))}
                        placeholder={t('请输入登录密码', 'Enter your password')}
                        required
                        minLength={8}
                        autoComplete={view === 'register' ? 'new-password' : 'current-password'}
                      />
                      <button
                        type="button"
                        className="auth-eye-btn"
                        onClick={() => setShowPassword((current) => !current)}
                        aria-label={showPassword ? t('隐藏密码', 'Hide password') : t('显示密码', 'Show password')}
                      >
                        {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                      </button>
                    </div>
                    <div className="auth-field-help">
                      {showFieldError('password') ? (
                        <span className="auth-field-error">{fieldErrors.password}</span>
                      ) : (
                        <span>　</span>
                      )}
                    </div>
                  </label>
                )}

                {view === 'register' && (
                  <label className="auth-field">
                    <span>{t('确认密码', 'Confirm password')}</span>
                    <div className={`auth-input-wrap ${showFieldError('confirmPassword') ? 'auth-input-error' : ''}`}>
                      <Lock size={18} />
                      <input
                        type="password"
                        value={confirmPassword}
                        onChange={handleConfirmPasswordChange}
                        onBlur={() => setFieldTouched((current) => ({ ...current, confirmPassword: true }))}
                        placeholder={t('请再次输入密码', 'Enter your password again')}
                        required
                        minLength={8}
                        autoComplete="new-password"
                      />
                    </div>
                    <div className="auth-field-help">
                      {showFieldError('confirmPassword') ? (
                        <span className="auth-field-error">{fieldErrors.confirmPassword}</span>
                      ) : (
                        <span>　</span>
                      )}
                    </div>
                  </label>
                )}

                {showTurnstileBlock && (
                  <div className="auth-turnstile-block">
                    <div className="auth-turnstile-head">
                      <span>{t('安全验证', 'Security check')}</span>
                      <span className={`auth-turnstile-badge ${turnstileStatusClass}`}>{turnstileStatusLabel}</span>
                    </div>
                    {turnstileAvailable ? (
                      <>
                        <TurnstileWidget
                          onVerify={handleTurnstileVerify}
                          onError={handleTurnstileError}
                          onExpire={handleTurnstileExpire}
                          onStatusChange={handleTurnstileStatusChange}
                          appearance="always"
                          action={view === 'forgot-password' ? 'reset-password' : view}
                          language={language}
                          className="auth-turnstile-shell"
                        />
                        <div className="auth-turnstile-help">{turnstileHint}</div>
                      </>
                    ) : (
                      <div className="auth-turnstile-inline-error" role="alert">
                        {turnstileMissingSiteKey ? getTurnstileMissingSiteKeyMessage(language) : getTurnstileDisabledMessage(language)}
                      </div>
                    )}
                  </div>
                )}

                <button
                  type="submit"
                  className="auth-btn auth-btn-main"
                  disabled={loading || tempLoading}
                >
                  {loading ? (
                    <>
                      <Loader2 size={16} className="auth-spin" />
                      {t('处理中...', 'Processing...')}
                    </>
                  ) : (
                    <>
                      {view === 'login'
                        ? t('登录', 'Sign in')
                        : view === 'register'
                        ? t('注册', 'Sign up')
                        : t('发送占位提示', 'Send placeholder notice')}
                      <ArrowRight size={16} />
                    </>
                  )}
                </button>

                {view === 'login' && (
                  <>
                    <div className="auth-divider">
                      <span>{t('或使用以下方式进入', 'Or continue with')}</span>
                    </div>
                    <button
                      type="button"
                      className="auth-btn auth-btn-ghost"
                      onClick={handleWechatLogin}
                      disabled={loading || tempLoading || wechatLoading || googleLoading}
                    >
                      <QrCode size={18} />
                      {t('使用微信扫码登录', 'Continue with WeChat QR')}
                    </button>
                    <button
                      type="button"
                      className="auth-btn auth-btn-google"
                      onClick={() => void handleGoogleLogin()}
                      disabled={loading || tempLoading || googleLoading || wechatLoading}
                    >
                      {googleLoading ? (
                        <>
                          <Loader2 size={16} className="auth-spin" />
                          {t('跳转中...', 'Redirecting...')}
                        </>
                      ) : (
                        <>{t('使用 Google 登录', 'Continue with Google')}</>
                      )}
                    </button>
                    <div className="auth-aux-actions">
                      <button
                        type="button"
                        className="auth-btn auth-btn-ghost auth-btn-compact"
                        onClick={() => void handleTempUserEntry()}
                        disabled={loading || tempLoading || googleLoading || wechatLoading}
                      >
                        {tempLoading ? (
                          <>
                            <Loader2 size={15} className="auth-spin" />
                            {t('正在准备', 'Preparing')}
                          </>
                        ) : (
                          t('临时用户（仅本地）', 'Temporary local access')
                        )}
                      </button>
                      <button
                        type="button"
                        className="auth-btn auth-btn-ghost auth-btn-compact"
                        onClick={handleAdminEntry}
                        disabled={loading || tempLoading || googleLoading || wechatLoading}
                      >
                        {t('管理员登录', 'Admin sign-in')}
                      </button>
                    </div>
                  </>
                )}

                <div className="auth-footer-actions">
                  {view === 'login' && (
                    <>
                      <button
                        type="button"
                        className="auth-text-btn auth-signup-link"
                        onClick={() => setView('register')}
                      >
                        <span className="auth-signup-link__prefix">{t('没有账号？', "Don't have an account?")}</span>
                        <span className="auth-signup-link__action">{t('立即注册', 'Sign up')}</span>
                      </button>
                      <button
                        type="button"
                        className="auth-btn-forgot"
                        onClick={() => setView('forgot-password')}
                      >
                        {t('忘记密码？', 'Forgot your password?')}
                      </button>
                    </>
                  )}
                  {view === 'register' && (
                    <button
                      type="button"
                      className="auth-text-btn"
                      onClick={() => setView('login')}
                    >
                      {t('已有账号？返回登录', 'Already have an account? Sign in')}
                    </button>
                  )}
                  {view === 'forgot-password' && (
                    <button
                      type="button"
                      className="auth-text-btn"
                      onClick={() => setView('login')}
                    >
                      {t('想起来了？返回登录', 'Remembered it? Back to sign in')}
                    </button>
                  )}
                </div>
              </form>
            </div>
            <div
              className="auth-version-badge"
              aria-label={t(`应用版本 ${APP_DISPLAY_VERSION}`, `App version ${APP_DISPLAY_VERSION}`)}
            >
              {APP_DISPLAY_VERSION}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default LoginScreen;
