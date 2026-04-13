import React, { Suspense, lazy, startTransition, useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  ArrowRight,
  CheckCircle2,
  ChevronLeft,
  Clock,
  Eye,
  EyeOff,
  Loader2,
  Lock,
  Mail,
  QrCode,
  Sparkles,
} from 'lucide-react';

import { APP_DISPLAY_VERSION } from '../../config/appInfo';
import { TURNSTILE_ENABLED, TURNSTILE_HAS_SITE_KEY } from '../../config/turnstile';
import { useAuth } from '../../context/AuthContext';
import { useLocale } from '../../context/LocaleContext';
import { useTheme } from '../../context/ThemeContext';
import { useAdminRole } from '../../hooks/useAdminRole';
import { kkWebApiClient } from '../../services/api/kkApiClient';
import { startGoogleSignIn } from '../../services/auth/googleAuth.ts';
import { signInWithPasswordWithFallback } from '../../services/auth/passwordSignIn';
import { startWechatLogin } from '../../services/auth/wechatAuth.ts';
import { pickByResolvedLanguage, type ResolvedLanguage } from '../../utils/localeText';
import { getTurnstileDisabledMessage, getTurnstileMissingSiteKeyMessage, mapAuthErrorMessage } from './authLocalization';
import { TurnstileWidget, canUseTurnstile, ensureTurnstileScript, useTurnstile } from './TurnstileWidget';
import WechatQrModal from './WechatQrModal';
import './LoginScreen.css';

type AuthView = 'login' | 'register' | 'forgot-password';
type FieldName = 'email' | 'password' | 'confirmPassword';
type FieldErrors = Partial<Record<FieldName, string>>;
type FieldTouched = Record<FieldName, boolean>;
type StarPoint = { id: number; top: string; left: string; delay: string; duration: string; size: string; opacity: string };
type IdleSchedulerWindow = Window & typeof globalThis & {
  requestIdleCallback?: (callback: () => void, options?: { timeout: number }) => number;
  cancelIdleCallback?: (handle: number) => void;
};

const MAX_RETRY = 3;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const DeferredAuthShaderBackground = lazy(() => import('@/components/ui/animated-shader-background'));

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
    } else if (password.length < 6) {
      errors.password = pickText('密码长度至少 6 位。', 'Password must be at least 6 characters.');
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
  const { loginAsTempUser, user } = useAuth();
  const { language } = useLocale();
  const { resolvedTheme } = useTheme();
  const { isAdmin, checkingAdmin } = useAdminRole();
  const turnstileAvailable = canUseTurnstile();
  const turnstileMissingSiteKey = TURNSTILE_ENABLED && !TURNSTILE_HAS_SITE_KEY;
  const showTurnstileBlock = turnstileAvailable || turnstileMissingSiteKey;
  const { token: turnstileToken, error: turnstileError, handleVerify, handleError, handleExpire, reset: resetTurnstile } = useTurnstile(language);

  const [view, setView] = useState<AuthView>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [showTempUserWarning, setShowTempUserWarning] = useState(false);
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
  const t = useCallback(<T,>(zh: T, en: T): T => pickByResolvedLanguage(language, zh, en), [language]);

  const localErrors = useMemo(() => validateFields(view, email, password, confirmPassword, language), [view, email, password, confirmPassword, language]);
  const stars = useMemo<StarPoint[]>(() => Array.from({ length: 18 }, (_, index) => ({ id: index, top: `${6 + Math.random() * 72}%`, left: `${4 + Math.random() * 88}%`, delay: `${Math.random() * 10}s`, duration: `${2.6 + Math.random() * 4.8}s`, size: `${1.2 + Math.random() * 2.4}px`, opacity: `${0.35 + Math.random() * 0.55}` })), []);

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
    const backgroundColor = resolvedTheme === 'dark' ? '#07111f' : '#eef4ff';
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

  const handleTurnstileVerify = useCallback((token: string) => { setCaptchaRequiredByBackend(false); handleVerify(token); }, [handleVerify]);
  const handleTurnstileError = useCallback((nextError: string) => { handleError(nextError); if (captchaRequiredByBackend) setError(nextError); }, [captchaRequiredByBackend, handleError]);
  const handleTurnstileExpire = useCallback(() => { handleExpire(); setCaptchaRequiredByBackend(true); }, [handleExpire]);

  const attemptAuth = async (captchaToken?: string) => {
    const emailValue = email.trim();
    if (view === 'register') {
      const response = await kkWebApiClient.register({ email: emailValue, password, turnstileToken: captchaToken || '' });
      if (!response.success) throw toAuthError(response.error.code, response.error.message || 'Registration failed.');
      setMessage(t('注册请求已提交，后端认证接口就绪后可继续完成验证。', 'The registration request was submitted. You can finish verification once the backend auth route is ready.'));
      window.setTimeout(() => setView('login'), 1500);
      return;
    }
    if (view === 'login') {
      const result = await signInWithPasswordWithFallback({ email: emailValue, password, ...(captchaToken ? { captchaToken } : {}) });
      if (result.error) throw result.error;
      setMessage(t('登录状态已切换到本地运行时账户。', 'The local runtime session is now active.'));
      return;
    }
    throw toAuthError('AUTH_RESET_PASSWORD_UNAVAILABLE', t('当前本地运行时尚未接入重置密码接口。', 'The local runtime does not expose password reset yet.'));
  };

  const handleAuth = async (event: React.FormEvent) => {
    event.preventDefault();
    if (loading) return;
    setSubmitted(true);
    setFieldTouched({ email: true, password: true, confirmPassword: true });
    setFieldErrors(localErrors);
    if (Object.keys(localErrors).length > 0) {
      setError(t('请先修正表单错误后再提交。', 'Fix the form errors before submitting.'));
      return;
    }
    if (turnstileAvailable && !turnstileToken) {
      setCaptchaRequiredByBackend(true);
      setError(turnstileError || t('安全验证尚未完成，请等待 Turnstile 加载完毕后再试。', 'Security verification is not finished yet. Wait for Turnstile to finish loading and try again.'));
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
    setError(isNetworkError(lastError) ? t(`网络连接失败（已重试 ${MAX_RETRY} 次）。你可以先使用临时用户登录，继续体验本地功能。`, `Network request failed after ${MAX_RETRY} attempts. You can continue with a temporary account for local-only access.`) : resolveAuthErrorMessage(lastError, view));
    if (turnstileAvailable) resetTurnstile();
    setLoading(false);
  };

  const handleWechatLogin = async () => {
    if (loading || wechatLoading || googleLoading) return;
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
    if (loading || googleLoading || wechatLoading) {
      return;
    }

    setError(null);
    setMessage(null);
    setGoogleLoading(true);

    try {
      await startGoogleSignIn();
    } catch (authError) {
      setError(resolveAuthErrorMessage(authError, 'login'));
      setGoogleLoading(false);
    }
  };

  const handleAdminEntry = () => {
    setError(null);
    setMessage(null);

    if (!user) {
      setError(t('请先使用管理员账号登录。', 'Sign in with an administrator account first.'));
      return;
    }

    if (checkingAdmin) {
      setMessage(t('正在识别管理员权限，请稍候。', 'Checking administrator access...'));
      return;
    }

    if (!isAdmin) {
      setError(t('当前账号没有管理员权限。', 'Current account is not an administrator.'));
      return;
    }

    window.location.href = '/settings/api-management';
  };

  const showFieldError = (field: FieldName) => Boolean(fieldErrors[field] && (submitted || fieldTouched[field]));
  const turnstileHint = turnstileMissingSiteKey ? getTurnstileMissingSiteKeyMessage(language) : turnstileError || (captchaRequiredByBackend && !turnstileToken ? t('当前请求需要先完成人机验证，验证通过后再提交。', 'Complete the CAPTCHA verification before submitting this request.') : turnstileToken ? t('安全验证已完成。', 'Security verification is complete.') : t('页面打开后会自动加载 Turnstile，用于阻挡机器请求。', 'Turnstile loads automatically when the page opens to help block bots.'));

  return (
    <div className={`auth-page auth-page--${resolvedTheme}`}>
      <WechatQrModal
        isOpen={wechatModalOpen}
        language={language}
        title={t('使用微信扫码登录', 'Sign in with WeChat QR')}
        description={t('扫码确认后会回到 KK Studio，但当前本地运行时不会在浏览器里直接续建旧的 Supabase 会话。', 'After you confirm on WeChat, you will return to KK Studio, but the local runtime no longer rebuilds the old Supabase session in the browser.')}
        authorizationUrl={wechatAuthorizationUrl}
        expiresAt={wechatExpiresAt}
        loading={wechatLoading}
        error={wechatError}
        onClose={() => setWechatModalOpen(false)}
        onOpenInNewPage={() => wechatAuthorizationUrl && window.open(wechatAuthorizationUrl, '_blank', 'noopener,noreferrer')}
      />

      {showTempUserWarning && (
        <div className="auth-modal-mask">
          <div className="auth-modal-card">
            <div className="auth-modal-icon"><Clock size={24} /></div>
            <h3>{t('临时用户登录', 'Temporary account sign-in')}</h3>
            <p>{t('无需注册即可体验本地功能，账号有效期 24 小时。', 'Try local features without registering. The account stays active for 24 hours.')}</p>
            <p>{t('临时账号不支持云同步、充值和管理员积分模型，请勿存放重要内容。', 'Temporary accounts do not support cloud sync, top-ups, or admin credit models. Do not keep important content there.')}</p>
            <div className="auth-modal-actions">
              <button type="button" className="auth-btn auth-btn-ghost" onClick={() => setShowTempUserWarning(false)}>{t('取消', 'Cancel')}</button>
              <button type="button" className="auth-btn auth-btn-main" onClick={async () => { setLoading(true); try { await loginAsTempUser(); setShowTempUserWarning(false); } catch (tempError) { setError(resolveAuthErrorMessage(tempError, 'login')); } finally { setLoading(false); } }}>{t('确认登录', 'Continue')}</button>
            </div>
          </div>
        </div>
      )}

      <div className="auth-shader-background" aria-hidden>{showShaderBackground ? <Suspense fallback={null}><DeferredAuthShaderBackground className="auth-shader-canvas" /></Suspense> : null}</div>
      <div className="auth-background" aria-hidden><div className="auth-gradient auth-gradient-a" /><div className="auth-gradient auth-gradient-b" /><div className="auth-grid" /><div className="auth-star-layer">{stars.map((star) => <span key={star.id} className="auth-star-point" style={{ '--star-top': star.top, '--star-left': star.left, '--star-delay': star.delay, '--star-duration': star.duration, '--star-size': star.size, '--star-opacity': star.opacity } as React.CSSProperties} />)}</div></div>
      <section className="auth-side-visual" aria-hidden><div className="auth-brand"><div className="auth-brand-icon"><Sparkles size={30} /></div><h1>{t('KK 创作平台', 'KK Creative Platform')}</h1><p>{t('下一代智能创作工作台', 'Next-generation creative workspace')}</p></div><p className="auth-side-note">{t('本地运行时会优先保留你的工作区状态；等后端认证接口就绪后，再逐步接入账号同步。', 'The local runtime keeps your workspace state first. Account sync will be added once the backend auth routes are ready.')}</p></section>

      <section className="auth-side-form">
        <div className="auth-panel">
          {view !== 'login' && <button type="button" className="auth-link-back" onClick={() => setView('login')}><ChevronLeft size={16} />{t('返回登录', 'Back to sign in')}</button>}
          <header className="auth-header">
            <h2>{view === 'login' ? t('欢迎回来', 'Welcome back') : view === 'register' ? t('创建账号', 'Create your account') : t('找回密码', 'Reset your password')}</h2>
            <p>{view === 'login' ? t('使用 KK API 或本地运行时继续进入工作区。', 'Use the KK API or the local runtime to continue into the workspace.') : view === 'register' ? t('注册入口已切换到 KK API，后端未就绪时会直接提示。', 'The sign-up flow now goes through the KK API and will tell you clearly when the backend is not ready.') : t('当前仅保留占位入口，等待后端接入重置密码接口。', 'This is currently a placeholder while the backend reset-password route is still being wired up.')}</p>
          </header>

          <form className="auth-form" onSubmit={handleAuth}>
            {error && <div className="auth-feedback auth-feedback-error"><AlertCircle size={16} /><span>{error}</span></div>}
            {message && <div className="auth-feedback auth-feedback-success"><CheckCircle2 size={16} /><span>{message}</span></div>}

            <label className="auth-field">
              <span>{t('邮箱地址', 'Email')}</span>
              <div className={`auth-input-wrap ${showFieldError('email') ? 'auth-input-error' : ''}`}><Mail size={18} /><input type="email" value={email} onChange={(event) => { setEmail(event.target.value); setFieldErrors(localErrors); }} onBlur={() => setFieldTouched((current) => ({ ...current, email: true }))} placeholder={t('请输入邮箱地址', 'Enter your email')} required autoComplete="email" /></div>
              <div className="auth-field-help">{showFieldError('email') ? <span className="auth-field-error">{fieldErrors.email}</span> : <span>　</span>}</div>
            </label>

            {view !== 'forgot-password' && (
              <label className="auth-field">
                <span>{t('登录密码', 'Password')}</span>
                <div className={`auth-input-wrap ${showFieldError('password') ? 'auth-input-error' : ''}`}><Lock size={18} /><input type={showPassword ? 'text' : 'password'} value={password} onChange={(event) => { setPassword(event.target.value); setFieldErrors(localErrors); }} onBlur={() => setFieldTouched((current) => ({ ...current, password: true }))} placeholder={t('请输入登录密码', 'Enter your password')} required minLength={6} autoComplete={view === 'register' ? 'new-password' : 'current-password'} /><button type="button" className="auth-eye-btn" onClick={() => setShowPassword((current) => !current)} aria-label={showPassword ? t('隐藏密码', 'Hide password') : t('显示密码', 'Show password')}>{showPassword ? <EyeOff size={16} /> : <Eye size={16} />}</button></div>
                <div className="auth-field-help">{showFieldError('password') ? <span className="auth-field-error">{fieldErrors.password}</span> : <span>　</span>}</div>
              </label>
            )}

            {view === 'register' && (
              <label className="auth-field">
                <span>{t('确认密码', 'Confirm password')}</span>
                <div className={`auth-input-wrap ${showFieldError('confirmPassword') ? 'auth-input-error' : ''}`}><Lock size={18} /><input type="password" value={confirmPassword} onChange={(event) => { setConfirmPassword(event.target.value); setFieldErrors(localErrors); }} onBlur={() => setFieldTouched((current) => ({ ...current, confirmPassword: true }))} placeholder={t('请再次输入密码', 'Enter your password again')} required minLength={6} autoComplete="new-password" /></div>
                <div className="auth-field-help">{showFieldError('confirmPassword') ? <span className="auth-field-error">{fieldErrors.confirmPassword}</span> : <span>　</span>}</div>
              </label>
            )}

            {showTurnstileBlock && (
              <div className="auth-turnstile-block">
                <div className="auth-turnstile-head"><span>{t('安全验证', 'Security check')}</span><span className={`auth-turnstile-badge ${turnstileToken ? 'is-ready' : 'is-pending'}`}>{turnstileToken ? t('已就绪', 'Ready') : t('加载中', 'Loading')}</span></div>
                {turnstileAvailable ? <><TurnstileWidget onVerify={handleTurnstileVerify} onError={handleTurnstileError} onExpire={handleTurnstileExpire} appearance="always" action={view === 'forgot-password' ? 'reset-password' : view} language={language} className="auth-turnstile-shell" /><div className="auth-turnstile-help">{turnstileHint}</div></> : <div className="auth-turnstile-inline-error" role="alert">{getTurnstileMissingSiteKeyMessage(language)}</div>}
              </div>
            )}

            <button type="submit" className="auth-btn auth-btn-main" disabled={loading}>{loading ? <><Loader2 size={16} className="animate-spin" />{t('处理中...', 'Processing...')}</> : <>{view === 'login' ? t('登录', 'Sign in') : view === 'register' ? t('注册', 'Sign up') : t('发送占位提示', 'Send placeholder notice')}<ArrowRight size={16} /></>}</button>

            {view === 'login' && (
              <>
                <div className="auth-divider"><span>{t('或使用以下方式进入', 'Or continue with')}</span></div>
                <button type="button" className="auth-btn auth-btn-ghost" onClick={handleWechatLogin} disabled={loading || wechatLoading || googleLoading}><QrCode size={18} />{t('使用微信扫码登录', 'Continue with WeChat QR')}</button>
                <button type="button" className="auth-btn auth-btn-google" onClick={() => void handleGoogleLogin()} disabled={loading || googleLoading || wechatLoading}>{googleLoading ? <><Loader2 size={16} className="animate-spin" />{t('跳转中...', 'Redirecting...')}</> : <>{t('使用 Google 登录', 'Continue with Google')}</>}</button>
                <div className="auth-aux-actions">
                  <button type="button" className="auth-btn auth-btn-ghost auth-btn-compact" onClick={() => setShowTempUserWarning(true)} disabled={loading || googleLoading || wechatLoading}>{t('临时登录', 'Temporary account')}</button>
                  <button type="button" className="auth-btn auth-btn-ghost auth-btn-compact" onClick={handleAdminEntry} disabled={checkingAdmin}>{t('管理员登录', 'Admin sign-in')}</button>
                </div>
              </>
            )}

            <div className="auth-footer-actions">
              {view === 'login' && <><button type="button" className="auth-text-btn" onClick={() => setView('register')}>{t('没有账号？立即注册', "Don't have an account? Sign up")}</button><button type="button" className="auth-btn-forgot" onClick={() => setView('forgot-password')}>{t('忘记密码？', 'Forgot your password?')}</button></>}
              {view === 'register' && <button type="button" className="auth-text-btn" onClick={() => setView('login')}>{t('已有账号？返回登录', 'Already have an account? Sign in')}</button>}
              {view === 'forgot-password' && <button type="button" className="auth-text-btn" onClick={() => setView('login')}>{t('想起来了？返回登录', 'Remembered it? Back to sign in')}</button>}
            </div>
          </form>
        </div>
      </section>
      <div className="auth-version-badge" aria-label={t(`应用版本 ${APP_DISPLAY_VERSION}`, `App version ${APP_DISPLAY_VERSION}`)}>{APP_DISPLAY_VERSION}</div>
    </div>
  );
};

export default LoginScreen;
