import React, { Suspense, lazy, startTransition, useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  ArrowRight,
  CheckCircle2,
  ChevronLeft,
  Clock,
  Eye,
  EyeOff,
  Globe,
  Loader2,
  Lock,
  Mail,
  QrCode,
  Sparkles,
} from 'lucide-react';
import { APP_DISPLAY_VERSION } from '../../config/appInfo';
import { buildAuthRedirectUrl } from '../../config/authRedirect';
import { TURNSTILE_ENABLED, TURNSTILE_HAS_SITE_KEY } from '../../config/turnstile';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import { useLocale } from '../../context/LocaleContext';
import { useTheme } from '../../context/ThemeContext';
import { buildAdminLoginUrl } from '../../services/admin/adminEntry';
import { signInWithPasswordWithFallback } from '../../services/auth/passwordSignIn';
import { TurnstileWidget, canUseTurnstile, ensureTurnstileScript, useTurnstile } from './TurnstileWidget';
import WechatQrModal from './WechatQrModal';
import { startWechatLogin } from '../../services/auth/wechatAuth';
import { getDefaultPresetAvatarId } from '../../utils/presetAvatars';
import { pickByResolvedLanguage, type ResolvedLanguage } from '../../utils/localeText';
import { getTurnstileDisabledMessage, getTurnstileMissingSiteKeyMessage, mapAuthErrorMessage } from './authLocalization';
import './LoginScreen.css';

type AuthView = 'login' | 'register' | 'forgot-password';
type FieldName = 'email' | 'password' | 'confirmPassword';
type FieldErrors = Partial<Record<FieldName, string>>;
type FieldTouched = Record<FieldName, boolean>;
type StarPoint = {
  id: number;
  top: string;
  left: string;
  delay: string;
  duration: string;
  size: string;
  opacity: string;
};

type IdleSchedulerWindow = Window & typeof globalThis & {
  requestIdleCallback?: (callback: () => void, options?: { timeout: number }) => number;
  cancelIdleCallback?: (handle: number) => void;
};

const MAX_RETRY = 3;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const DeferredAuthShaderBackground = lazy(() => import('@/components/ui/animated-shader-background'));

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function isNetworkError(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  const message = String((error as { message?: string }).message || '').toLowerCase();
  return message.includes('failed to fetch') || message.includes('network') || message.includes('timeout');
}

function isCaptchaError(error: unknown): boolean {
  const message = String((error as { message?: string }).message || '').toLowerCase();
  return (
    message.includes('captcha') ||
    message.includes('turnstile') ||
    message.includes('captcha_token') ||
    message.includes('security purposes') ||
    message.includes('robot')
  );
}

function validateFields(
  view: AuthView,
  email: string,
  password: string,
  confirmPassword: string,
  language: ResolvedLanguage,
): FieldErrors {
  const errors: FieldErrors = {};
  const emailValue = email.trim();
  const pickText = <T,>(zh: T, en: T): T => pickByResolvedLanguage(language, zh, en);

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
  const { loginAsTempUser } = useAuth();
  const { language } = useLocale();
  const { resolvedTheme } = useTheme();
  const turnstileAvailable = canUseTurnstile();
  const turnstileMissingSiteKey = TURNSTILE_ENABLED && !TURNSTILE_HAS_SITE_KEY;
  const showTurnstileBlock = turnstileAvailable || turnstileMissingSiteKey;
  const {
    token: turnstileToken,
    error: turnstileError,
    handleVerify,
    handleError,
    handleExpire,
    reset: resetTurnstile,
  } = useTurnstile(language);

  const [view, setView] = useState<AuthView>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [showTempUserWarning, setShowTempUserWarning] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [captchaRequiredByBackend, setCaptchaRequiredByBackend] = useState(false);
  const [fieldTouched, setFieldTouched] = useState<FieldTouched>({
    email: false,
    password: false,
    confirmPassword: false,
  });
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [wechatModalOpen, setWechatModalOpen] = useState(false);
  const [wechatLoading, setWechatLoading] = useState(false);
  const [wechatError, setWechatError] = useState<string | null>(null);
  const [wechatAuthorizationUrl, setWechatAuthorizationUrl] = useState<string | null>(null);
  const [wechatExpiresAt, setWechatExpiresAt] = useState<string | null>(null);
  const [showShaderBackground, setShowShaderBackground] = useState(false);
  const t = useCallback(<T,>(zh: T, en: T): T => pickByResolvedLanguage(language, zh, en), [language]);

  const resolveAuthErrorMessage = useCallback(
    (authError: unknown, targetView: AuthView) => {
      if (isCaptchaError(authError)) {
        if (turnstileMissingSiteKey) {
          return getTurnstileMissingSiteKeyMessage(language);
        }

        if (!TURNSTILE_ENABLED) {
          return getTurnstileDisabledMessage(language);
        }
      }

      return mapAuthErrorMessage(language, authError, targetView);
    },
    [language, turnstileMissingSiteKey]
  );

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
    if (!turnstileAvailable) {
      return;
    }

    void ensureTurnstileScript(language).catch(() => {
      // Widget 内部会显示更具体的错误信息
    });
  }, [language, turnstileAvailable]);

  useEffect(() => {
    const idleWindow = window as IdleSchedulerWindow;
    let disposed = false;
    let revealHandle: number | null = null;
    let fallbackHandle: number | null = null;
    let revealScheduled = false;

    const revealShaderBackground = () => {
      if (disposed) {
        return;
      }

      startTransition(() => {
        setShowShaderBackground(true);
      });
    };

    const scheduleShaderReveal = () => {
      if (disposed || revealScheduled) {
        return;
      }

      revealScheduled = true;

      if (typeof idleWindow.requestIdleCallback === 'function') {
        revealHandle = idleWindow.requestIdleCallback(() => {
          revealShaderBackground();
        }, { timeout: 600 });
        return;
      }

      revealHandle = window.setTimeout(revealShaderBackground, 180);
    };

    if (turnstileAvailable && window.turnstile?.render) {
      scheduleShaderReveal();
    } else if (turnstileAvailable) {
      void ensureTurnstileScript(language)
        .catch(() => {
          // Widget internals surface the actual loading error.
        })
        .finally(() => {
          scheduleShaderReveal();
        });

      fallbackHandle = window.setTimeout(() => {
        scheduleShaderReveal();
      }, 1600);
    } else {
      scheduleShaderReveal();
    }

    return () => {
      disposed = true;

      if (revealHandle !== null) {
        if (
          typeof idleWindow.requestIdleCallback === 'function'
          && typeof idleWindow.cancelIdleCallback === 'function'
        ) {
          idleWindow.cancelIdleCallback(revealHandle);
        } else {
          window.clearTimeout(revealHandle);
        }
      }

      if (fallbackHandle !== null) {
        window.clearTimeout(fallbackHandle);
      }
    };
  }, [language, turnstileAvailable]);

  const localErrors = useMemo(
    () => validateFields(view, email, password, confirmPassword, language),
    [view, email, password, confirmPassword, language]
  );

  const stars = useMemo<StarPoint[]>(
    () =>
      Array.from({ length: 18 }, (_, index) => ({
        id: index,
        top: `${6 + Math.random() * 72}%`,
        left: `${4 + Math.random() * 88}%`,
        delay: `${Math.random() * 10}s`,
        duration: `${2.6 + Math.random() * 4.8}s`,
        size: `${1.2 + Math.random() * 2.4}px`,
        opacity: `${0.35 + Math.random() * 0.55}`,
      })),
    []
  );

  const turnstileAction = view === 'forgot-password' ? 'reset-password' : view;
  const turnstileHint = turnstileMissingSiteKey
    ? getTurnstileMissingSiteKeyMessage(language)
    : turnstileError
      ? turnstileError
    : captchaRequiredByBackend && !turnstileToken
      ? t(
        '当前请求需要先完成人机验证，验证通过后再提交。',
        'Complete the CAPTCHA verification before submitting this request.',
      )
      : turnstileToken
        ? t(
          '安全验证已完成，提交时会自动携带 captchaToken。',
          'Security verification is complete. The submission will automatically include the captcha token.',
        )
        : t(
          '页面打开后会自动加载 Turnstile，用于防机器人校验。',
          'Turnstile loads automatically when the page opens to help block bots.',
        );

  useEffect(() => {
    setError(null);
    setMessage(null);
    setPassword('');
    setConfirmPassword('');
    setShowPassword(false);
    setSubmitted(false);
    setCaptchaRequiredByBackend(false);
    setFieldTouched({
      email: false,
      password: false,
      confirmPassword: false,
    });
    setFieldErrors({});
    setWechatModalOpen(false);
    setWechatLoading(false);
    setWechatError(null);
    setWechatAuthorizationUrl(null);
    setWechatExpiresAt(null);

    if (turnstileAvailable) {
      resetTurnstile();
    }
  }, [resetTurnstile, turnstileAvailable, view]);

  const closeWechatModal = useCallback(() => {
    setWechatModalOpen(false);
    setWechatLoading(false);
    setWechatError(null);
    setWechatAuthorizationUrl(null);
    setWechatExpiresAt(null);
  }, []);

  const showFieldError = (field: FieldName) => Boolean(fieldErrors[field] && (submitted || fieldTouched[field]));

  const syncFieldErrors = () => {
    setFieldErrors(localErrors);
  };

  const markTouched = (field: FieldName) => {
    setFieldTouched((current) => ({ ...current, [field]: true }));
    setFieldErrors(localErrors);
  };

  const handleTurnstileVerify = useCallback(
    (token: string) => {
      setCaptchaRequiredByBackend(false);
      handleVerify(token);
    },
    [handleVerify]
  );

  const handleTurnstileError = useCallback(
    (nextError: string) => {
      handleError(nextError);
      if (captchaRequiredByBackend) {
        setError(nextError);
      }
    },
    [captchaRequiredByBackend, handleError]
  );

  const handleTurnstileExpire = useCallback(() => {
    handleExpire();
    setCaptchaRequiredByBackend(true);
  }, [handleExpire]);

  const confirmTempUserLogin = async () => {
    setShowTempUserWarning(false);
    setLoading(true);
    setError(null);
    setMessage(null);

    try {
      await loginAsTempUser();
    } catch (tempError) {
      setError(resolveAuthErrorMessage(tempError, 'login'));
    } finally {
      setLoading(false);
    }
  };

  const attemptAuth = async (captchaToken?: string) => {
    const emailValue = email.trim();

    if (view === 'register') {
      const displayName = emailValue.split('@')[0] || t('新用户', 'New User');
      const defaultAvatarId = getDefaultPresetAvatarId(emailValue);
      const { data, error: signUpError } = await supabase.auth.signUp({
        email: emailValue,
        password,
        options: {
          data: {
            display_name: displayName,
            full_name: displayName,
            avatar_url: defaultAvatarId,
          },
          ...(captchaToken ? { captchaToken } : {}),
        },
      });
      if (signUpError) throw signUpError;

      if (data.session) {
        setMessage(t('注册成功，正在进入系统...', 'Sign-up succeeded. Entering the app...'));
      } else {
        setMessage(
          t(
            '注册成功，请前往邮箱查收验证邮件，验证后即可登录。',
            'Sign-up succeeded. Check your inbox for the verification email, then sign in after confirming it.',
          )
        );
        setTimeout(() => setView('login'), 2200);
      }
      return;
    }

    if (view === 'login') {
      const { error: signInError } = await signInWithPasswordWithFallback({
        email: emailValue,
        password,
        ...(captchaToken ? { captchaToken } : {}),
      });
      if (signInError) throw signInError;
      return;
    }

    const { error: resetError } = await supabase.auth.resetPasswordForEmail(emailValue, {
      redirectTo: buildAuthRedirectUrl('/'),
      ...(captchaToken ? { captchaToken } : {}),
    });
    if (resetError) throw resetError;
    setMessage(t('重置密码邮件已发送，请检查邮箱。', 'Password reset email sent. Check your inbox.'));
  };

  const handleAuth = async (event: React.FormEvent) => {
    event.preventDefault();
    if (loading) return;

    setSubmitted(true);
    setFieldTouched({
      email: true,
      password: true,
      confirmPassword: true,
    });
    setFieldErrors(localErrors);

    if (Object.keys(localErrors).length > 0) {
      setError(t('请先修正表单错误后再提交。', 'Fix the form errors before submitting.'));
      return;
    }

    if (turnstileAvailable && !turnstileToken) {
      setCaptchaRequiredByBackend(true);
      setError(
        turnstileError
        || t(
          '安全验证尚未完成，请等待 Turnstile 加载完成后再试。',
          'Security verification is not finished yet. Wait for Turnstile to finish loading and try again.',
        )
      );
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

        if (isCaptchaError(authError)) {
          setCaptchaRequiredByBackend(true);
        }

        if (isNetworkError(authError) && index < MAX_RETRY - 1) {
          setError(
            t(
              `网络连接不稳定，正在重试（${index + 1}/${MAX_RETRY}）...`,
              `Network looks unstable. Retrying (${index + 1}/${MAX_RETRY})...`,
            )
          );
          await sleep(900);
          continue;
        }
        break;
      }
    }

    if (isNetworkError(lastError)) {
      setError(
        t(
          `网络连接失败（已重试 ${MAX_RETRY} 次）。你可以先使用临时用户登录，继续体验本地功能。`,
          `Network request failed after ${MAX_RETRY} attempts. You can continue with a temporary account for local-only access.`,
        )
      );
    } else {
      setError(resolveAuthErrorMessage(lastError, view));
      if (turnstileAvailable) {
        resetTurnstile();
      }
    }
    setLoading(false);
  };

  const handleGoogleLogin = async () => {
    if (loading) return;

    if (turnstileAvailable && !turnstileToken) {
      setCaptchaRequiredByBackend(true);
      setError(
        turnstileError
        || t(
          '请先等待人机验证完成后再使用 Google 登录。',
          'Wait for CAPTCHA verification to finish before signing in with Google.',
        )
      );
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const { error: oauthError } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: buildAuthRedirectUrl(),
          ...(turnstileToken ? { captchaToken: turnstileToken } : {}),
        },
      });
      if (oauthError) throw oauthError;
    } catch (oauthError) {
      setError(resolveAuthErrorMessage(oauthError, 'login'));
      if (!isNetworkError(oauthError) && turnstileAvailable) {
        resetTurnstile();
      }
      setLoading(false);
    }
  };

  const handleWechatLogin = async () => {
    if (loading || wechatLoading) return;

    if (turnstileAvailable && !turnstileToken) {
      setCaptchaRequiredByBackend(true);
      setError(
        turnstileError
        || t(
          '请先完成人机验证后再使用微信扫码登录。',
          'Complete CAPTCHA verification before signing in with WeChat QR.',
        )
      );
      return;
    }

    setError(null);
    setWechatError(null);
    setWechatAuthorizationUrl(null);
    setWechatExpiresAt(null);
    setWechatModalOpen(true);
    setWechatLoading(true);

    try {
      const authData = await startWechatLogin();
      setWechatAuthorizationUrl(authData.authorizationUrl);
      setWechatExpiresAt(authData.expiresAt);
    } catch (authError) {
      const nextError = resolveAuthErrorMessage(authError, 'login');
      setWechatError(nextError);
      setError(nextError);

      if (!isNetworkError(authError) && turnstileAvailable) {
        resetTurnstile();
      }
    } finally {
      setWechatLoading(false);
    }
  };

  const handleAdminRedirect = useCallback(() => {
    try {
      const nextUrl = buildAdminLoginUrl({
        configuredBaseUrl: import.meta.env.VITE_KK_ADMIN_URL,
        currentUrl: window.location.href,
      });
      window.location.assign(nextUrl);
    } catch (redirectError) {
      setError(
        redirectError instanceof Error
          ? redirectError.message
          : t('管理员后台入口暂不可用。', 'The admin entry is not available right now.')
      );
    }
  }, [t]);

  const handleOpenWechatInNewPage = useCallback(() => {
    if (!wechatAuthorizationUrl) return;
    window.open(wechatAuthorizationUrl, '_blank', 'noopener,noreferrer');
  }, [wechatAuthorizationUrl]);

  return (
    <div className={`auth-page auth-page--${resolvedTheme}`}>
      <WechatQrModal
        isOpen={wechatModalOpen}
        language={language}
        title={t('使用微信扫码登录', 'Sign in with WeChat QR')}
        description={t(
          '扫码确认后会自动回到 KK Studio，并继续沿用当前 Supabase 会话体系。',
          'After you confirm on WeChat, you will return to KK Studio and continue with the current Supabase session flow.',
        )}
        authorizationUrl={wechatAuthorizationUrl}
        expiresAt={wechatExpiresAt}
        loading={wechatLoading}
        error={wechatError}
        onClose={closeWechatModal}
        onOpenInNewPage={handleOpenWechatInNewPage}
      />

      {showTempUserWarning && (
        <div className="auth-modal-mask">
          <div className="auth-modal-card">
            <div className="auth-modal-icon">
              <Clock size={24} />
            </div>
            <h3>{t('临时用户登录', 'Temporary account sign-in')}</h3>
            <p>{t('无需注册即可体验本地功能，账号有效期 24 小时。', 'Try local features without registering. The account stays active for 24 hours.')}</p>
            <p>
              {t(
                '临时账号不支持云同步、充值和管理员配置的积分模型，到期后会自动清理本地数据，请勿存放重要内容。',
                'Temporary accounts do not support cloud sync, top-ups, or admin-configured credit models. Local data is cleared automatically after expiry, so do not keep important content there.',
              )}
            </p>
            <div className="auth-modal-actions">
              <button type="button" className="auth-btn auth-btn-ghost" onClick={() => setShowTempUserWarning(false)}>
                {t('取消', 'Cancel')}
              </button>
              <button type="button" className="auth-btn auth-btn-main" onClick={confirmTempUserLogin}>
                {t('确认登录', 'Continue')}
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="auth-shader-background" aria-hidden>
        {showShaderBackground ? (
          <Suspense fallback={null}>
            <DeferredAuthShaderBackground className="auth-shader-canvas" />
          </Suspense>
        ) : null}
      </div>

      <div className="auth-background" aria-hidden>
        <div className="auth-gradient auth-gradient-a" />
        <div className="auth-gradient auth-gradient-b" />
        <div className="auth-grid" />
        <div className="auth-star-layer">
          {stars.map((star) => (
            <span
              key={star.id}
              className="auth-star-point"
              style={
                {
                  '--star-top': star.top,
                  '--star-left': star.left,
                  '--star-delay': star.delay,
                  '--star-duration': star.duration,
                  '--star-size': star.size,
                  '--star-opacity': star.opacity,
                } as React.CSSProperties
              }
            />
          ))}
        </div>
      </div>

      <section className="auth-side-visual" aria-hidden>
        <div className="auth-brand">
          <div className="auth-brand-icon">
            <Sparkles size={30} />
          </div>
          <h1>{t('KK 创作平台', 'KK Creative Platform')}</h1>
          <p>{t('下一代智能创作工作台', 'Next-generation creative workspace')}</p>
        </div>

        <p className="auth-side-note">{t('登录后自动同步你的模型、积分与生成记录。', 'Sign in to sync your models, credits, and generation history automatically.')}</p>
      </section>

      <section className="auth-side-form">
        <div className="auth-panel">
          {view !== 'login' && (
            <button type="button" className="auth-link-back" onClick={() => setView('login')}>
              <ChevronLeft size={16} />
              {t('返回登录', 'Back to sign in')}
            </button>
          )}

          <header className="auth-header">
            <h2>
              {view === 'login' && t('欢迎回来', 'Welcome back')}
              {view === 'register' && t('创建账号', 'Create your account')}
              {view === 'forgot-password' && t('找回密码', 'Reset your password')}
            </h2>
            <p>
              {view === 'login' && t('请登录后继续使用 KK 创作平台。', 'Sign in to continue using KK Creative Platform.')}
              {view === 'register' && t('创建新账户后即可开启完整功能。', 'Create a new account to unlock the full experience.')}
              {view === 'forgot-password' && t('输入邮箱后我们会发送重置链接。', 'Enter your email and we will send a reset link.')}
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
                  onChange={(event) => {
                    setEmail(event.target.value);
                    if (submitted || fieldTouched.email) syncFieldErrors();
                  }}
                  onBlur={() => markTouched('email')}
                  placeholder={t('请输入邮箱地址', 'Enter your email')}
                  required
                  autoComplete="email"
                />
              </div>
              <div className="auth-field-help">
                {showFieldError('email') ? <span className="auth-field-error">{fieldErrors.email}</span> : <span>　</span>}
              </div>
            </label>

            {view !== 'forgot-password' && (
              <label className="auth-field">
                <div className="auth-field-row">
                  <span>{t('登录密码', 'Password')}</span>
                </div>
                <div className={`auth-input-wrap ${showFieldError('password') ? 'auth-input-error' : ''}`}>
                  <Lock size={18} />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(event) => {
                      setPassword(event.target.value);
                      if (submitted || fieldTouched.password || fieldTouched.confirmPassword) syncFieldErrors();
                    }}
                    onBlur={() => markTouched('password')}
                    placeholder={t('请输入登录密码', 'Enter your password')}
                    required
                    minLength={6}
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
                    <span>{view === 'register' ? t('密码至少 6 位，建议包含字母和数字。', 'Use at least 6 characters, ideally with letters and numbers.') : '　'}</span>
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
                    onChange={(event) => {
                      setConfirmPassword(event.target.value);
                      if (submitted || fieldTouched.confirmPassword || fieldTouched.password) syncFieldErrors();
                    }}
                    onBlur={() => markTouched('confirmPassword')}
                    placeholder={t('请再次输入密码', 'Enter your password again')}
                    required
                    minLength={6}
                    autoComplete="new-password"
                  />
                </div>
                <div className="auth-field-help">
                  {showFieldError('confirmPassword') ? <span className="auth-field-error">{fieldErrors.confirmPassword}</span> : <span>　</span>}
                </div>
              </label>
            )}

            {showTurnstileBlock && (
              <div className="auth-turnstile-block">
                <div className="auth-turnstile-head">
                  <span>{t('安全验证', 'Security check')}</span>
                  <span className={`auth-turnstile-badge ${turnstileToken ? 'is-ready' : 'is-pending'}`}>
                    {turnstileToken ? t('已就绪', 'Ready') : t('加载中', 'Loading')}
                  </span>
                </div>
                {turnstileAvailable ? (
                  <>
                    <TurnstileWidget
                      onVerify={handleTurnstileVerify}
                      onError={handleTurnstileError}
                      onExpire={handleTurnstileExpire}
                      appearance="always"
                      action={turnstileAction}
                      language={language}
                      className="auth-turnstile-shell"
                    />
                    <div className="auth-turnstile-help">{turnstileHint}</div>
                  </>
                ) : (
                  <div className="auth-turnstile-inline-error" role="alert">
                    {getTurnstileMissingSiteKeyMessage(language)}
                  </div>
                )}
              </div>
            )}

            <button type="submit" className="auth-btn auth-btn-main" disabled={loading}>
              {loading ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  {t('处理中...', 'Processing...')}
                </>
              ) : (
                <>
                  {view === 'login' && t('登录', 'Sign in')}
                  {view === 'register' && t('注册', 'Sign up')}
                  {view === 'forgot-password' && t('发送重置邮件', 'Send reset email')}
                  <ArrowRight size={16} />
                </>
              )}
            </button>

            {view === 'login' && (
              <>
                <div className="auth-divider">
                  <span>{t('或使用以下方式登录', 'Or continue with')}</span>
                </div>
                <button type="button" className="auth-btn auth-btn-google" onClick={handleGoogleLogin} disabled={loading}>
                  <Globe size={18} />
                  {t('使用 Google 登录', 'Continue with Google')}
                </button>
                <button type="button" className="auth-btn auth-btn-ghost" onClick={handleWechatLogin} disabled={loading || wechatLoading}>
                  <QrCode size={18} />
                  {t('使用微信扫码登录', 'Continue with WeChat QR')}
                </button>
                <button type="button" className="auth-btn auth-btn-ghost" onClick={handleAdminRedirect} disabled={loading}>
                  {t('管理员登录', 'Admin Login')}
                </button>
                <button type="button" className="auth-btn auth-btn-ghost" onClick={handleAdminRedirect} disabled={loading}>
                  {t('管理员登录', 'Admin Login')}
                </button>
                <button type="button" className="auth-btn auth-btn-ghost" onClick={() => setShowTempUserWarning(true)} disabled={loading}>
                  {t('临时用户登录', 'Use a temporary account')}
                </button>
              </>
            )}

            <div className="auth-footer-actions">
              {view === 'login' && (
                <>
                  <button type="button" className="auth-text-btn" onClick={() => setView('register')}>
                    {t('没有账号？立即注册', "Don't have an account? Sign up")}
                  </button>
                  <button type="button" className="auth-btn-forgot" onClick={() => setView('forgot-password')}>
                    {t('忘记密码？', 'Forgot your password?')}
                  </button>
                </>
              )}
              {view === 'register' && (
                <button type="button" className="auth-text-btn" onClick={() => setView('login')}>
                  {t('已有账号？返回登录', 'Already have an account? Sign in')}
                </button>
              )}
              {view === 'forgot-password' && (
                <button type="button" className="auth-text-btn" onClick={() => setView('login')}>
                  {t('想起来了？返回登录', 'Remembered it? Back to sign in')}
                </button>
              )}
            </div>
          </form>
        </div>
      </section>
      <div className="auth-version-badge" aria-label={t(`应用版本 ${APP_DISPLAY_VERSION}`, `App version ${APP_DISPLAY_VERSION}`)}>
        {APP_DISPLAY_VERSION}
      </div>
    </div>
  );
};

export default LoginScreen;
