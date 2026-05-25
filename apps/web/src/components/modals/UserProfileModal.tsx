import React, { useEffect, useMemo, useState } from 'react';
import type { RuntimeAuthUser } from '../../services/auth/runtimeAuthTypes.ts';
import {
  AlertCircle,
  ChevronLeft,
  CreditCard,
  Globe,
  Loader2,
  Lock,
  LogOut,
  Pencil,
  QrCode,
  ShieldCheck,
  Wallet,
  X,
} from 'lucide-react';
import { KKAI_FEATURE_FLAGS } from '../../app/kkaiFeatureFlags';
import { useAuth } from '../../context/AuthContext';
import { useBilling } from '../../context/BillingContext';
import { useAdminRole } from '../../hooks/useAdminRole';
import { kkWebApiClient } from '../../services/api/kkApiClient';
import { getPreferredKkApiAccessToken } from '../../services/api/authAccessToken';
import {
  formatRemainingCredits,
  selectRemainingBalanceSummary,
} from '../../services/billing/remainingBalance';
import WechatQrModal from '../auth/WechatQrModal';
import {
  collectLinkedAuthProviders,
  listLinkedAuthProviders,
  startGoogleBind,
} from '../../services/auth/identityLinking';
import { startWechatBind } from '../../services/auth/wechatAuth';
import {
  enrollTotpFactor,
  loadMfaStatus,
  verifyTotpFactor,
  type MfaStatusSnapshot,
  type TotpEnrollmentResult,
} from '../../services/auth/mfa';
import {
  updateRuntimeAuthStateFromProfile,
  updateRuntimeUserMetadata,
} from '../../services/auth/runtimeAuthState';
import {
  getDefaultPresetAvatarId,
  getPresetAvatarById,
  PRESET_AVATAR_OPTIONS,
  resolveAvatarUrl,
} from '../../utils/presetAvatars';
import { localizeUserFacingText } from '../../utils/localeText';

export type UserProfileView = 'main' | 'change-password' | 'edit-profile' | 'billing' | 'security';

interface UserProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  user: RuntimeAuthUser | null;
  onSignOut: () => void;
  initialView?: UserProfileView;
  isMobile?: boolean;
}

function resolveApiGapMessage(code: string | undefined, fallback: string): string {
  const normalizedCode = String(code || '').trim().toUpperCase();
  if (normalizedCode === 'AUTH_ROUTE_DISABLED' || normalizedCode === 'HTTP_404' || normalizedCode === 'HTTP_405') {
    return '后端认证接口尚未在本地运行时就绪。';
  }
  if (normalizedCode === 'AUTH_REQUIRED' || normalizedCode === 'HTTP_401' || normalizedCode === 'HTTP_403') {
    return '当前还没有可用的 KK API 登录会话。';
  }
  return fallback;
}

const formatDateTime = (value?: string | null) => {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleString('zh-CN', {
    hour12: false,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
};

const getRechargeSubmissionStatusLabel = (status?: string | null) => {
  if (!status) return '已完成';
  const lower = status.toLowerCase();
  if (lower === 'completed') return '已完成';
  if (lower === 'pending') return '处理中';
  if (lower === 'failed') return '失败';
  if (lower === 'refunded') return '已退款';
  return status;
};

const getStatusClass = (status?: string | null) => {
  const lower = (status || '').toLowerCase();
  if (lower === 'failed') return 'kk-user-profile-modal__status--failed';
  if (lower === 'pending') return 'kk-user-profile-modal__status--pending';
  if (lower === 'refunded') return 'kk-user-profile-modal__status--refunded';
  return 'kk-user-profile-modal__status--completed';
};

const UserProfileModal: React.FC<UserProfileModalProps> = ({
  isOpen,
  onClose,
  user,
  onSignOut,
  initialView = 'main',
  isMobile = false,
}) => {
  const { isTempUser, tempUserExpiry } = useAuth();
  const { accountRole, checkingAdmin } = useAdminRole();
  const billingUiEnabled = KKAI_FEATURE_FLAGS.billing;
  const {
    balance,
    billingLogs,
    usageLogs,
    loading: billingLoading,
    refreshBilling,
    setShowRechargeModal,
  } = useBilling();
  const remainingBalanceDisplay = formatRemainingCredits(balance, 'zh-CN');
  const { latestRecharge } = useMemo(
    () => selectRemainingBalanceSummary(billingLogs),
    [billingLogs],
  );
  const remainingBalanceHint = latestRecharge
    ? `最近充值：${formatDateTime(latestRecharge.created_at)}`
    : '仅管理员积分模型会消耗这里的积分，个人 API 不扣积分';

  const [view, setView] = useState<UserProfileView>('main');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const [displayName, setDisplayName] = useState('');
  const [avatarUrl, setAvatarUrl] = useState('');

  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordVerificationCode, setPasswordVerificationCode] = useState('');
  const [passwordCodeExpiresAt, setPasswordCodeExpiresAt] = useState<string | null>(null);
  const [passwordCodeSending, setPasswordCodeSending] = useState(false);

  const [timeRemaining, setTimeRemaining] = useState('');
  const [wechatModalOpen, setWechatModalOpen] = useState(false);
  const [wechatLoading, setWechatLoading] = useState(false);
  const [wechatError, setWechatError] = useState<string | null>(null);
  const [wechatAuthorizationUrl, setWechatAuthorizationUrl] = useState<string | null>(null);
  const [wechatExpiresAt, setWechatExpiresAt] = useState<string | null>(null);
  const [mfaLoading, setMfaLoading] = useState(false);
  const [mfaActionLoading, setMfaActionLoading] = useState(false);
  const [mfaStatus, setMfaStatus] = useState<MfaStatusSnapshot | null>(null);
  const [mfaEnrollment, setMfaEnrollment] = useState<TotpEnrollmentResult | null>(null);
  const [mfaFriendlyName, setMfaFriendlyName] = useState('KK Studio');
  const [mfaCode, setMfaCode] = useState('');
  const [linkedProviders, setLinkedProviders] = useState<string[]>([]);
  const defaultPresetAvatarId = useMemo(
    () => getDefaultPresetAvatarId(user?.id || user?.email || displayName),
    [displayName, user?.email, user?.id]
  );
  const selectedPresetAvatar = useMemo(() => getPresetAvatarById(avatarUrl), [avatarUrl]);
  const avatarInputValue = selectedPresetAvatar ? '' : avatarUrl;

  const roleLabel = useMemo(() => {
    if (checkingAdmin && user) {
      return '识别中';
    }

    if (accountRole === 'admin') {
      return '管理员';
    }

    if (String(accountRole || '').startsWith('member')) {
      return '会员账号';
    }

    return '普通用户';
  }, [accountRole, checkingAdmin, user]);

  const sessionLinkedProviders = useMemo(
    () => collectLinkedAuthProviders(user),
    [user]
  );
  const effectiveLinkedProviders = useMemo(
    () => (linkedProviders.length > 0 ? linkedProviders : sessionLinkedProviders),
    [linkedProviders, sessionLinkedProviders]
  );
  const isShadowWechatEmail = Boolean(user?.email?.endsWith('@users.kkstudio.local'));
  const isWechatBound =
    isShadowWechatEmail ||
    user?.user_metadata?.auth_provider === 'wechat' ||
    effectiveLinkedProviders.includes('wechat');
  const isGoogleBound = effectiveLinkedProviders.includes('google');
  const canChangePassword = Boolean(user?.email) && !isTempUser && !isShadowWechatEmail;
  const canBindWechat = Boolean(user?.id) && !isTempUser && !isWechatBound;
  const canBindGoogle = Boolean(user?.id) && !isTempUser && !isGoogleBound;
  const displayEmail = isShadowWechatEmail ? '微信授权用户' : user?.email || '未绑定邮箱';

  useEffect(() => {
    if (!isOpen) return;

    const requestedView: UserProfileView =
      initialView === 'billing' || initialView === 'change-password' || initialView === 'edit-profile' || initialView === 'security'
        ? initialView
        : 'main';
    const safeView: UserProfileView =
      requestedView === 'change-password' && !canChangePassword
        ? 'main'
        : requestedView === 'billing' && !billingUiEnabled
          ? 'main'
          : requestedView;

    setView(safeView);
    setMessage(null);
    setLoading(false);
    setWechatModalOpen(false);
    setWechatLoading(false);
    setWechatError(null);
    setWechatAuthorizationUrl(null);
    setWechatExpiresAt(null);
    setMfaLoading(false);
    setMfaActionLoading(false);
    setMfaStatus(null);
    setMfaEnrollment(null);
    setMfaFriendlyName('KK Studio');
    setMfaCode('');
    setLinkedProviders(sessionLinkedProviders);

    const defaultName =
      user?.user_metadata?.full_name ||
      user?.user_metadata?.display_name ||
      (isShadowWechatEmail ? '微信用户' : user?.email ? user.email.split('@')[0] : '');
    setDisplayName(defaultName);
    setAvatarUrl(user?.user_metadata?.avatar_url || '');

    if (safeView === 'billing' && billingUiEnabled) {
      void refreshBilling({ includeTransactions: true });
    }

    if (safeView === 'security') {
      void loadSecurityState();
    }
  }, [billingUiEnabled, canChangePassword, initialView, isOpen, isShadowWechatEmail, refreshBilling, sessionLinkedProviders, user]);

  useEffect(() => {
    if (!isOpen || !user?.id || isTempUser) {
      return;
    }

    let active = true;

    const loadLinkedProviders = async () => {
      try {
        const providers = await listLinkedAuthProviders();
        if (active) {
          setLinkedProviders(providers);
        }
      } catch (error) {
        console.warn('[UserProfileModal] Failed to load linked identities:', error);
      }
    };

    void loadLinkedProviders();

    return () => {
      active = false;
    };
  }, [isOpen, isTempUser, user?.id]);

  useEffect(() => {
    if (!isTempUser || !tempUserExpiry) {
      setTimeRemaining('');
      return;
    }

    const update = () => {
      const remainMs = Math.max(0, tempUserExpiry - Date.now());
      const totalMinutes = Math.floor(remainMs / 60000);
      const hours = Math.floor(totalMinutes / 60);
      const minutes = totalMinutes % 60;

      if (hours >= 24) {
        const days = Math.floor(hours / 24);
        setTimeRemaining(`${days} 天`);
        return;
      }

      if (hours > 0) {
        setTimeRemaining(`${hours} 小时 ${minutes} 分钟`);
        return;
      }

      setTimeRemaining(`${minutes} 分钟`);
    };

    update();
    const timer = setInterval(update, 60_000);
    return () => clearInterval(timer);
  }, [isTempUser, tempUserExpiry]);

  const resetAndClose = () => {
    setView('main');
    setMessage(null);
    setNewPassword('');
    setConfirmPassword('');
    setPasswordVerificationCode('');
    setPasswordCodeExpiresAt(null);
    setWechatModalOpen(false);
    setWechatLoading(false);
    setWechatError(null);
    setWechatAuthorizationUrl(null);
    setWechatExpiresAt(null);
    setMfaLoading(false);
    setMfaActionLoading(false);
    setMfaStatus(null);
    setMfaEnrollment(null);
    setMfaCode('');
    onClose();
  };

  const openBilling = () => {
    if (!billingUiEnabled) {
      return;
    }
    setView('billing');
    void refreshBilling({ includeTransactions: true });
  };

  const loadSecurityState = async () => {
    setMfaLoading(true);

    try {
      const nextStatus = await loadMfaStatus();
      setMfaStatus(nextStatus);
    } catch (error: any) {
      setMessage({ type: 'error', text: error?.message || '读取双重验证状态失败。' });
    } finally {
      setMfaLoading(false);
    }
  };

  const openSecurity = () => {
    setView('security');
    setMessage(null);
    setMfaEnrollment(null);
    setMfaCode('');
    void loadSecurityState();
  };

  const closeWechatModal = () => {
    setWechatModalOpen(false);
    setWechatLoading(false);
    setWechatError(null);
    setWechatAuthorizationUrl(null);
    setWechatExpiresAt(null);
  };

  const saveProfileLocally = (finalName: string, nextAvatarUrl: string) => {
    updateRuntimeUserMetadata({
      email: user?.email || undefined,
      fullName: finalName,
      displayName: finalName,
      avatarUrl: nextAvatarUrl,
      authProvider: String(user?.user_metadata?.auth_provider || user?.user_metadata?.provider || 'local'),
      providers: effectiveLinkedProviders,
    });
  };

  const handleUpdateProfile = async () => {
    const finalName = displayName.trim();
    const nextAvatarUrl = avatarUrl.trim();
    if (!finalName) {
      setMessage({ type: 'error', text: '请输入昵称。' });
      return;
    }

    setLoading(true);
    setMessage(null);

    try {
      const apiAccessToken = String(await getPreferredKkApiAccessToken() || '').trim();

      if (!apiAccessToken) {
        saveProfileLocally(finalName, nextAvatarUrl);
        setMessage({ type: 'success', text: '资料已保存到本地运行时，后端资料接口尚未同步。' });
        setTimeout(() => setView('main'), 900);
        return;
      }

      const response = await kkWebApiClient.updateProfile({
        nickname: finalName,
        avatarUrl: nextAvatarUrl || undefined,
      });

      if (!response.success) {
        const gapMessage = resolveApiGapMessage(response.error.code, response.error.message || '更新失败，请稍后重试。');
        if (gapMessage !== response.error.message) {
          saveProfileLocally(finalName, nextAvatarUrl);
          setMessage({ type: 'success', text: `资料已保存到本地运行时。${gapMessage}` });
          setTimeout(() => setView('main'), 900);
          return;
        }
        throw new Error(gapMessage);
      }

      updateRuntimeAuthStateFromProfile(response.data);
      setMessage({ type: 'success', text: '个人资料已更新并同步到 KK API。' });
      setTimeout(() => setView('main'), 900);
    } catch (error: any) {
      setMessage({
        type: 'error',
        text: localizeUserFacingText(error?.message) || error?.message || '更新失败，请稍后重试。',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleChangePassword = async () => {
    if (!user?.email) {
      setMessage({ type: 'error', text: '当前账户缺少邮箱信息，无法修改密码。' });
      return;
    }

    if (!passwordVerificationCode.trim() || !newPassword.trim() || !confirmPassword.trim()) {
      setMessage({ type: 'error', text: '请先输入邮箱验证码，再填写新密码和确认密码。' });
      return;
    }

    if (newPassword.length < 8) {
      setMessage({ type: 'error', text: '新密码至少需要 8 位。' });
      return;
    }

    if (newPassword !== confirmPassword) {
      setMessage({ type: 'error', text: '两次输入的新密码不一致。' });
      return;
    }

    setLoading(true);
    setMessage(null);

    try {
      const response = await kkWebApiClient.updatePassword({
        newPassword,
        verificationCode: passwordVerificationCode.trim(),
      });
      if (!response.success) {
        throw new Error(resolveApiGapMessage(response.error.code, response.error.message || '密码修改失败，请稍后重试。'));
      }

      setMessage({ type: 'success', text: '密码修改成功。' });
      setNewPassword('');
      setConfirmPassword('');
      setPasswordVerificationCode('');
      setPasswordCodeExpiresAt(null);
      setTimeout(() => setView('main'), 1000);
    } catch (error: any) {
      setMessage({ type: 'error', text: error?.message || '密码修改失败，请稍后重试。' });
    } finally {
      setLoading(false);
    }
  };

  const handleSendPasswordChangeCode = async () => {
    if (!user?.email) {
      setMessage({ type: 'error', text: '当前账户缺少邮箱信息，无法发送验证码。' });
      return;
    }

    setPasswordCodeSending(true);
    setMessage(null);

    try {
      const response = await kkWebApiClient.sendPasswordChangeCode();
      if (!response.success) {
        throw new Error(resolveApiGapMessage(response.error.code, response.error.message || '验证码发送失败，请稍后重试。'));
      }

      setPasswordCodeExpiresAt(response.data.expiresAt);
      setMessage({
        type: 'success',
        text: `验证码已发送到 ${response.data.email}，请在收到后完成密码修改。`,
      });
    } catch (error: any) {
      setMessage({ type: 'error', text: error?.message || '验证码发送失败，请稍后重试。' });
    } finally {
      setPasswordCodeSending(false);
    }
  };

  const handleWechatBind = async () => {
    if (!canBindWechat) {
      const hint = isTempUser ? '临时账号暂不支持绑定微信，请先登录正式账号。' : '当前账号已经绑定微信。';
      setMessage({ type: 'error', text: hint });
      return;
    }

    setMessage(null);
    setWechatError(null);
    setWechatAuthorizationUrl(null);
    setWechatExpiresAt(null);
    setWechatModalOpen(true);
    setWechatLoading(true);

    try {
      const authData = await startWechatBind();
      setWechatAuthorizationUrl(authData.authorizationUrl);
      setWechatExpiresAt(authData.expiresAt);
    } catch (error: any) {
      const nextMessage = error?.message || '无法发起微信绑定，请稍后重试。';
      setWechatError(nextMessage);
      setMessage({ type: 'error', text: nextMessage });
    } finally {
      setWechatLoading(false);
    }
  };

  const handleGoogleBind = async () => {
    if (!canBindGoogle) {
      const hint = isTempUser ? '临时账号暂不支持绑定 Google，请先登录正式账号。' : '当前账号已经绑定 Google。';
      setMessage({ type: 'error', text: hint });
      return;
    }

    setLoading(true);
    setMessage(null);

    try {
      const authorizationUrl = await startGoogleBind();
      window.location.assign(authorizationUrl);
    } catch (error: any) {
      setMessage({ type: 'error', text: error?.message || '无法发起 Google 绑定，请稍后重试。' });
      setLoading(false);
    }
  };

  const handleStartMfaEnrollment = async () => {
    if (isTempUser) {
      setMessage({ type: 'error', text: '临时账号暂不支持启用双重验证，请先登录正式账号。' });
      return;
    }

    setMfaActionLoading(true);
    setMessage(null);

    try {
      const enrollment = await enrollTotpFactor(mfaFriendlyName);
      setMfaEnrollment(enrollment);
      setMfaCode('');
      setMessage({ type: 'success', text: '已生成 TOTP 绑定二维码，请扫码后输入 6 位动态口令完成绑定。' });
      await loadSecurityState();
    } catch (error: any) {
      setMessage({ type: 'error', text: error?.message || '启用双重验证失败。' });
    } finally {
      setMfaActionLoading(false);
    }
  };

  const handleVerifyMfaCode = async (factorId: string) => {
    const code = mfaCode.trim();
    if (!/^\d{6}$/.test(code)) {
      setMessage({ type: 'error', text: '请输入 6 位动态口令。' });
      return;
    }

    setMfaActionLoading(true);
    setMessage(null);

    try {
      await verifyTotpFactor(factorId, code);
      setMfaCode('');
      setMfaEnrollment(null);
      await loadSecurityState();
      setMessage({ type: 'success', text: '双重验证已启用，当前会话安全等级已提升。' });
    } catch (error: any) {
      setMessage({ type: 'error', text: error?.message || '动态口令校验失败。' });
    } finally {
      setMfaActionLoading(false);
    }
  };

  if (!isOpen) return null;

  const avatarSrc = resolveAvatarUrl(avatarUrl || user?.user_metadata?.avatar_url);
  const nickname =
    displayName ||
    user?.user_metadata?.full_name ||
    user?.user_metadata?.display_name ||
    (isShadowWechatEmail ? '微信用户' : user?.email?.split('@')[0]) ||
    '未命名用户';

  return (
    <>
      <WechatQrModal
        isOpen={wechatModalOpen}
        title="绑定微信账号"
        description="扫码确认后，这个 KK Studio 账号就可以直接使用微信头像、昵称和扫码登录。"
        authorizationUrl={wechatAuthorizationUrl}
        expiresAt={wechatExpiresAt}
        loading={wechatLoading}
        error={wechatError}
        onClose={closeWechatModal}
        onOpenInNewPage={() => {
          if (wechatAuthorizationUrl) {
            window.open(wechatAuthorizationUrl, '_blank', 'noopener,noreferrer');
          }
        }}
      />

      <div
        className={`fixed inset-0 z-[10002] flex justify-center bg-black/55 backdrop-blur-sm ${
          isMobile ? 'mobile-overlay-safe items-end px-2' : 'items-center px-3 py-4'
        }`}
        onClick={resetAndClose}
      >
        <div
          className={`kk-user-profile-modal w-full overflow-hidden border ${
            isMobile
              ? 'ios-mobile-sheet mobile-sheet-viewport flex min-h-0 flex-col rounded-t-[26px] rounded-b-none'
              : 'max-w-[860px] rounded-2xl'
          }`}
          style={{
            background: 'var(--frost-card-framework-bg)',
            borderColor: 'var(--frost-card-framework-border)',
            boxShadow: 'var(--frost-card-framework-shadow)',
            backdropFilter: 'blur(var(--frost-card-framework-blur)) saturate(160%)',
            WebkitBackdropFilter: 'blur(var(--frost-card-framework-blur)) saturate(160%)',
          }}
          onClick={(event) => event.stopPropagation()}
        >
        <div
          className={`kk-user-profile-modal__header flex items-center justify-between border-b ${isMobile ? 'mobile-sheet-header-safe px-3 py-3' : 'px-4 py-3'}`}
          style={{ borderColor: 'var(--frost-card-framework-border)' }}
        >
          <div className="flex items-center gap-2">
            {view !== 'main' && (
              <button
                onClick={() => setView('main')}
                className="inline-flex h-9 w-9 items-center justify-center rounded-lg border"
                style={{ borderColor: 'var(--border-light)', color: 'var(--text-secondary)' }}
              >
                <ChevronLeft size={18} />
              </button>
            )}
            <h2 className="text-base font-semibold" style={{ color: 'var(--text-primary)' }}>
              {view === 'main' && '个人中心'}
              {view === 'edit-profile' && '编辑个人资料'}
              {view === 'change-password' && '修改密码'}
              {view === 'billing' && '账户管理'}
              {view === 'security' && '双重验证'}
            </h2>
          </div>

          <button
            onClick={resetAndClose}
            className="inline-flex h-9 w-9 items-center justify-center rounded-lg border"
            style={{ borderColor: 'var(--border-light)', color: 'var(--text-secondary)' }}
          >
            <X size={18} />
          </button>
        </div>

        <div className={`kk-user-profile-modal__body ${isMobile ? 'mobile-sheet-scroll flex-1 px-3 py-3' : 'max-h-[78vh] overflow-y-auto px-4 py-4'}`}>
          {message && (
            <div
              className={`kk-user-profile-modal__notice mb-4 rounded-lg px-3 py-2 text-sm ${
                message.type === 'success'
                  ? 'kk-user-profile-modal__notice--success'
                  : 'kk-user-profile-modal__notice--danger'
              }`}
            >
              {message.text}
            </div>
          )}

          {view === 'main' && (
            <div className={`${isMobile ? 'space-y-3' : 'space-y-4'}`}>
              {isTempUser && (
                <div className="kk-user-profile-modal__notice kk-user-profile-modal__notice--warning rounded-xl p-3 text-sm">
                  <div className="flex items-start gap-2">
                    <AlertCircle size={18} className="mt-0.5 shrink-0" />
                    <div>
                      <div className="font-medium">临时账号</div>
                      <p className="mt-1 text-xs">
                        当前账号剩余有效期：{timeRemaining || '计算中'}。建议绑定正式账号，避免数据丢失。
                      </p>
                    </div>
                  </div>
                </div>
              )}

              <div className="kk-user-profile-modal__main-card rounded-xl border p-4" style={{ borderColor: 'var(--frost-card-main-border)' }}>
                <div className="flex items-center gap-3">
                  <div className="h-14 w-14 overflow-hidden rounded-full bg-gradient-to-br from-[var(--clay-brand-coral)] via-[var(--clay-brand-pink)] to-[var(--clay-brand-peach)] text-white">
                    {avatarSrc ? (
                      <img src={avatarSrc} alt="头像" className="h-full w-full object-cover" />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-lg font-bold">
                        {nickname.slice(0, 1).toUpperCase()}
                      </div>
                    )}
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="truncate text-base font-semibold" style={{ color: 'var(--text-primary)' }}>
                      {nickname}
                    </div>
                    <div className="mt-0.5 truncate text-xs" style={{ color: 'var(--text-tertiary)' }}>
                      {displayEmail}
                    </div>
                    {isWechatBound && (
                      <div className="mt-1 text-[11px] text-emerald-300">
                        已绑定微信，可使用微信头像、昵称和扫码登录
                      </div>
                    )}
                    {isGoogleBound && (
                      <div className="mt-1 text-[11px] text-[var(--clay-brand-lavender)]">
                        已绑定 Google，可使用 Google 一键登录
                      </div>
                    )}
                    <div className="mt-1 text-[11px]" style={{ color: 'var(--text-tertiary)' }}>
                      用户 ID：{user?.id || '-'}
                    </div>
                  </div>

                  <span className="rounded-full border px-2 py-1 text-[11px]" style={{ borderColor: 'var(--border-light)', color: 'var(--text-secondary)' }}>
                    {roleLabel}
                  </span>
                </div>
              </div>

              {billingUiEnabled && (
                <div className="kk-user-profile-modal__main-card rounded-xl border p-4" style={{ borderColor: 'var(--frost-card-main-border)' }}>
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <div className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
                        积分
                      </div>
                      <div className="mt-1 text-2xl font-bold text-[var(--clay-brand-ochre)]">{remainingBalanceDisplay}</div>
                      <div className="text-[11px]" style={{ color: 'var(--text-tertiary)' }}>
                        {remainingBalanceHint}
                      </div>
                    </div>
                    <button
                      onClick={() => setShowRechargeModal(true)}
                      className="inline-flex h-10 items-center justify-center rounded-lg bg-[var(--accent-coral)] px-4 text-sm font-medium text-white"
                    >
                      立即充值
                    </button>
                  </div>
                </div>
              )}

              <div className="kk-user-profile-modal__action-list">
                <button
                  onClick={() => setView('edit-profile')}
                  className="kk-user-profile-modal__action-row flex w-full items-center justify-between text-sm"
                  style={{ borderColor: 'var(--border-light)', color: 'var(--text-primary)' }}
                >
                  <span className="inline-flex min-w-0 max-w-full items-center gap-2 overflow-hidden whitespace-nowrap">
                    <Pencil size={15} className="shrink-0" />
                    <span className="min-w-0 overflow-hidden text-ellipsis whitespace-nowrap">编辑个人资料</span>
                  </span>
                  <span style={{ color: 'var(--text-tertiary)' }}>进入</span>
                </button>

                <button
                  onClick={() => void handleWechatBind()}
                  disabled={!canBindWechat}
                  className="kk-user-profile-modal__action-row flex w-full items-center justify-between text-sm disabled:cursor-not-allowed disabled:opacity-60"
                  style={{ borderColor: 'var(--border-light)', color: 'var(--text-primary)' }}
                >
                  <span className="inline-flex min-w-0 max-w-full items-center gap-2 overflow-hidden whitespace-nowrap">
                    <QrCode size={15} className="shrink-0" />
                    <span className="min-w-0 overflow-hidden text-ellipsis whitespace-nowrap">{isWechatBound ? '微信已绑定' : '绑定微信'}</span>
                  </span>
                  <span style={{ color: 'var(--text-tertiary)' }}>{isWechatBound ? '已完成' : '进入'}</span>
                </button>

                <button
                  onClick={() => void handleGoogleBind()}
                  disabled={!canBindGoogle || loading}
                  className="kk-user-profile-modal__action-row flex w-full items-center justify-between text-sm disabled:cursor-not-allowed disabled:opacity-60"
                  style={{ borderColor: 'var(--border-light)', color: 'var(--text-primary)' }}
                >
                  <span className="inline-flex min-w-0 max-w-full items-center gap-2 overflow-hidden whitespace-nowrap">
                    <Globe size={15} className="shrink-0" />
                    <span className="min-w-0 overflow-hidden text-ellipsis whitespace-nowrap">{isGoogleBound ? 'Google 已绑定' : '绑定 Google'}</span>
                  </span>
                  <span style={{ color: 'var(--text-tertiary)' }}>{isGoogleBound ? '已完成' : '进入'}</span>
                </button>

                {canChangePassword && (
                  <button
                    onClick={() => setView('change-password')}
                    className="kk-user-profile-modal__action-row flex w-full items-center justify-between text-sm"
                    style={{ borderColor: 'var(--border-light)', color: 'var(--text-primary)' }}
                  >
                    <span className="inline-flex min-w-0 max-w-full items-center gap-2 overflow-hidden whitespace-nowrap">
                      <Lock size={15} className="shrink-0" />
                      <span className="min-w-0 overflow-hidden text-ellipsis whitespace-nowrap">修改密码</span>
                    </span>
                    <span style={{ color: 'var(--text-tertiary)' }}>进入</span>
                  </button>
                )}

                {!canChangePassword && !isTempUser && (
                  <div className="kk-user-profile-modal__action-note kk-user-profile-modal__notice--success text-xs">
                    微信纯登录账号不需要单独密码，后续可直接扫码进入。
                  </div>
                )}

                <button
                  onClick={openSecurity}
                  className="kk-user-profile-modal__action-row flex w-full items-center justify-between text-sm"
                  style={{ borderColor: 'var(--border-light)', color: 'var(--text-primary)' }}
                >
                  <span className="inline-flex min-w-0 max-w-full items-center gap-2 overflow-hidden whitespace-nowrap">
                    <ShieldCheck size={15} className="shrink-0" />
                    <span className="min-w-0 overflow-hidden text-ellipsis whitespace-nowrap">双重验证</span>
                  </span>
                  <span style={{ color: 'var(--text-tertiary)' }}>进入</span>
                </button>

                {billingUiEnabled && (
                  <button
                    onClick={openBilling}
                    className="kk-user-profile-modal__action-row flex w-full items-center justify-between text-sm"
                    style={{ borderColor: 'var(--border-light)', color: 'var(--text-primary)' }}
                  >
                    <span className="inline-flex min-w-0 max-w-full items-center gap-2 overflow-hidden whitespace-nowrap">
                      <Wallet size={15} className="shrink-0" />
                      <span className="min-w-0 overflow-hidden text-ellipsis whitespace-nowrap">账户管理</span>
                    </span>
                    <span style={{ color: 'var(--text-tertiary)' }}>进入</span>
                  </button>
                )}

                <button
                  onClick={() => {
                    resetAndClose();
                    onSignOut();
                  }}
                  className="kk-user-profile-modal__action-row kk-user-profile-modal__action-row--danger flex w-full min-w-0 items-center justify-center gap-2 overflow-hidden whitespace-nowrap text-sm"
                >
                  <LogOut size={15} className="shrink-0" />
                  <span className="min-w-0 overflow-hidden text-ellipsis whitespace-nowrap">退出登录</span>
                </button>
              </div>
            </div>
          )}

          {view === 'edit-profile' && (
            <div className="space-y-3">
              <label className="block space-y-1">
                <span className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
                  昵称
                </span>
                <input
                  value={displayName}
                  onChange={(event) => setDisplayName(event.target.value)}
                  placeholder="请输入昵称"
                  className="h-10 w-full rounded-lg border bg-[var(--frost-input-bg)] px-3 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)]"
                  style={{ borderColor: 'var(--frost-input-border)' }}
                />
              </label>

              <div className="space-y-2">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
                    预设头像
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setAvatarUrl(defaultPresetAvatarId)}
                      className="inline-flex h-8 items-center justify-center rounded-lg border px-3 text-xs"
                      style={{ borderColor: 'var(--border-light)', color: 'var(--text-secondary)' }}
                    >
                      随机分配
                    </button>
                    <button
                      type="button"
                      onClick={() => setAvatarUrl('')}
                      className="inline-flex h-8 items-center justify-center rounded-lg border px-3 text-xs"
                      style={{ borderColor: 'var(--border-light)', color: 'var(--text-secondary)' }}
                    >
                      使用首字母
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-3">
                  {PRESET_AVATAR_OPTIONS.map((option) => {
                    const selected = getPresetAvatarById(avatarUrl)?.id === option.id;

                    return (
                      <button
                        key={option.id}
                        type="button"
                        onClick={() => setAvatarUrl(option.id)}
                        className={`rounded-xl border p-2 text-left transition-all ${selected ? 'scale-[1.02]' : 'hover:border-zinc-400 dark:hover:border-zinc-600'}`}
                        style={{
                          borderColor: selected ? 'rgb(255 107 90 / 0.56)' : 'var(--frost-card-sub-border)',
                          background: selected ? 'rgb(255 107 90 / 0.12)' : 'var(--frost-card-sub-bg)',
                        }}
                      >
                        <div className="overflow-hidden rounded-lg border" style={{ borderColor: 'rgb(255 255 255 / 0.08)' }}>
                          <img src={option.url} alt={option.label} className="h-full w-full object-cover" />
                        </div>
                        <div className="mt-2 text-center">
                          <span className="text-xs font-medium" style={{ color: 'var(--text-primary)' }}>
                            {option.label}
                          </span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              <label className="block space-y-1">
                <span className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
                  头像链接（可选）
                </span>
                <input
                  value={avatarInputValue}
                  onChange={(event) => setAvatarUrl(event.target.value)}
                  placeholder="请输入外部图片地址，或直接点选上方预设头像"
                  className="h-10 w-full rounded-lg border bg-[var(--frost-input-bg)] px-3 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)]"
                  style={{ borderColor: 'var(--frost-input-border)' }}
                />
                <div className="text-[11px]" style={{ color: 'var(--text-tertiary)' }}>
                  {selectedPresetAvatar ? `当前已选择预设头像：${selectedPresetAvatar.label}` : '也可以粘贴任意外部图片地址。'}
                </div>
              </label>

              <button
                onClick={() => void handleUpdateProfile()}
                disabled={loading}
                className="inline-flex h-10 max-w-full min-w-0 items-center justify-center gap-2 overflow-hidden whitespace-nowrap rounded-lg bg-[var(--accent-coral)] px-4 text-sm font-medium text-white disabled:opacity-70"
              >
                {loading && <Loader2 size={16} className="animate-spin" />}
                <span className="min-w-0 overflow-hidden text-ellipsis whitespace-nowrap">保存资料</span>
              </button>
            </div>
          )}

          {view === 'change-password' && canChangePassword && (
            <div className="space-y-3">
              <div className="kk-user-profile-modal__sub-card rounded-lg border p-3" style={{ borderColor: 'var(--frost-card-sub-border)' }}>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <div className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
                      邮箱验证码
                    </div>
                    <div className="mt-1 text-xs" style={{ color: 'var(--text-tertiary)' }}>
                      点击发送后，验证码会发到 {displayEmail}。
                    </div>
                    {passwordCodeExpiresAt ? (
                      <div className="mt-1 text-[11px]" style={{ color: 'var(--text-tertiary)' }}>
                        本次验证码有效期至：{formatDateTime(passwordCodeExpiresAt)}
                      </div>
                    ) : null}
                  </div>

                  <button
                    onClick={() => void handleSendPasswordChangeCode()}
                    disabled={passwordCodeSending || loading}
                    className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border px-4 text-sm disabled:opacity-70"
                    style={{ borderColor: 'var(--border-light)', color: 'var(--text-primary)' }}
                  >
                    {(passwordCodeSending || loading) && <Loader2 size={16} className="animate-spin" />}
                    发送验证码
                  </button>
                </div>
              </div>

              <label className="block space-y-1">
                <span className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
                  邮箱验证码
                </span>
                <input
                  value={passwordVerificationCode}
                  onChange={(event) => setPasswordVerificationCode(event.target.value.replace(/\D/g, '').slice(0, 6))}
                  placeholder="请输入 6 位验证码"
                  inputMode="numeric"
                  className="h-10 w-full rounded-lg border bg-[var(--frost-input-bg)] px-3 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)]"
                  style={{ borderColor: 'var(--frost-input-border)' }}
                />
              </label>

              <label className="block space-y-1">
                <span className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
                  新密码
                </span>
                <input
                  type="password"
                  value={newPassword}
                  onChange={(event) => setNewPassword(event.target.value)}
                  placeholder="至少 6 位"
                  className="h-10 w-full rounded-lg border bg-[var(--frost-input-bg)] px-3 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)]"
                  style={{ borderColor: 'var(--frost-input-border)' }}
                />
              </label>

              <label className="block space-y-1">
                <span className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
                  确认新密码
                </span>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(event) => setConfirmPassword(event.target.value)}
                  placeholder="请再次输入新密码"
                  className="h-10 w-full rounded-lg border bg-[var(--frost-input-bg)] px-3 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)]"
                  style={{ borderColor: 'var(--frost-input-border)' }}
                />
              </label>

              <button
                onClick={() => void handleChangePassword()}
                disabled={loading || passwordCodeSending}
                className="inline-flex h-10 max-w-full min-w-0 items-center justify-center gap-2 overflow-hidden whitespace-nowrap rounded-lg bg-[var(--accent-coral)] px-4 text-sm font-medium text-white disabled:opacity-70"
              >
                {loading && <Loader2 size={16} className="animate-spin" />}
                <span className="min-w-0 overflow-hidden text-ellipsis whitespace-nowrap">保存新密码</span>
              </button>
            </div>
          )}

          {view === 'billing' && billingUiEnabled && (
            <div className="space-y-4">
              <div className="kk-user-profile-modal__main-card rounded-xl border p-4" style={{ borderColor: 'var(--frost-card-main-border)' }}>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <div className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
                      账户信息
                    </div>
                    <div className="mt-1 text-xs" style={{ color: 'var(--text-tertiary)' }}>
                      角色：{roleLabel}
                    </div>
                    <div className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
                      邮箱：{displayEmail}
                    </div>
                  </div>

                  <div className="kk-user-profile-modal__sub-card rounded-lg border px-3 py-2" style={{ borderColor: 'var(--frost-card-sub-border)' }}>
                    <div className="text-[11px]" style={{ color: 'var(--text-tertiary)' }}>
                      积分
                    </div>
                    <div className="text-xl font-bold text-[var(--clay-brand-ochre)]">{remainingBalanceDisplay}</div>
                    {latestRecharge ? (
                      <div className="mt-1 text-[11px]" style={{ color: 'var(--text-tertiary)' }}>
                        最近充值：{formatDateTime(latestRecharge.created_at)}
                      </div>
                    ) : null}
                  </div>
                </div>

                <button
                  onClick={() => setShowRechargeModal(true)}
                  className="mt-3 inline-flex h-9 max-w-full min-w-0 items-center justify-center gap-2 overflow-hidden whitespace-nowrap rounded-lg bg-[var(--accent-coral)] px-4 text-sm text-white"
                >
                  <CreditCard size={14} className="shrink-0" />
                  <span className="min-w-0 overflow-hidden text-ellipsis whitespace-nowrap">充值积分</span>
                </button>
              </div>

              <section className="kk-user-profile-modal__main-card rounded-xl border p-4" style={{ borderColor: 'var(--frost-card-main-border)' }}>
                <div className="mb-2 text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
                  生成记录（含失败与退款）
                </div>

                {billingLoading ? (
                  <div className="flex h-16 items-center justify-center text-sm" style={{ color: 'var(--text-tertiary)' }}>
                    <span className="inline-flex max-w-full items-center gap-2 overflow-hidden whitespace-nowrap">
                      <Loader2 size={16} className="shrink-0 animate-spin" />
                      <span className="min-w-0 overflow-hidden text-ellipsis whitespace-nowrap">正在加载...</span>
                    </span>
                  </div>
                ) : usageLogs.length === 0 ? (
                  <div className="kk-user-profile-modal__sub-card rounded-lg border border-dashed px-3 py-4 text-xs" style={{ borderColor: 'var(--frost-card-sub-border)', color: 'var(--text-tertiary)' }}>
                    暂无生成记录。
                  </div>
                ) : (
                  <div className="space-y-2">
                    {usageLogs.slice(0, 50).map((record) => {
                      const title = record.model_name || record.model_id || record.description || '模型调用';
                      const amountText = record.amount >= 0 ? `+${record.amount}` : `${record.amount}`;

                      return (
                        <div key={record.id} className="kk-user-profile-modal__sub-card rounded-lg border p-3" style={{ borderColor: 'var(--frost-card-sub-border)' }}>
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <div className="min-w-0 flex-1">
                              <div className="truncate text-sm" style={{ color: 'var(--text-primary)' }}>
                                {title}
                              </div>
                              <div className="mt-1 text-xs" style={{ color: 'var(--text-tertiary)' }}>
                                时间：{formatDateTime(record.created_at)}
                              </div>
                              {record.description && (
                                <div className="mt-1 text-xs" style={{ color: 'var(--text-tertiary)' }}>
                                  说明：{record.description}
                                </div>
                              )}
                            </div>

                            <div className="text-right">
                              <span className={`kk-user-profile-modal__status inline-flex rounded-full border px-2 py-0.5 text-[11px] ${getStatusClass(record.status)}`}>
                                {getRechargeSubmissionStatusLabel(record.status || 'completed')}
                              </span>
                              <div className={`mt-1 text-sm font-semibold ${record.amount >= 0 ? 'text-emerald-300' : 'text-red-300'}`}>
                                {amountText}
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </section>

              <section className="kk-user-profile-modal__main-card rounded-xl border p-4" style={{ borderColor: 'var(--frost-card-main-border)' }}>
                <div className="mb-2 text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
                  充值记录
                </div>

                {billingLoading ? (
                  <div className="flex h-16 items-center justify-center text-sm" style={{ color: 'var(--text-tertiary)' }}>
                    <span className="inline-flex max-w-full items-center gap-2 overflow-hidden whitespace-nowrap">
                      <Loader2 size={16} className="shrink-0 animate-spin" />
                      <span className="min-w-0 overflow-hidden text-ellipsis whitespace-nowrap">正在加载...</span>
                    </span>
                  </div>
                ) : billingLogs.length === 0 ? (
                  <div className="kk-user-profile-modal__sub-card rounded-lg border border-dashed px-3 py-4 text-xs" style={{ borderColor: 'var(--frost-card-sub-border)', color: 'var(--text-tertiary)' }}>
                    暂无充值记录。
                  </div>
                ) : (
                  <div className="space-y-2">
                    {billingLogs.slice(0, 50).map((record) => (
                      <div key={record.id} className="kk-user-profile-modal__sub-card rounded-lg border p-3" style={{ borderColor: 'var(--frost-card-sub-border)' }}>
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div>
                            <div className="text-sm" style={{ color: 'var(--text-primary)' }}>
                              充值 {record.amount} 积分
                            </div>
                            <div className="mt-1 text-xs" style={{ color: 'var(--text-tertiary)' }}>
                              时间：{formatDateTime(record.created_at)}
                            </div>
                            {record.description && (
                              <div className="mt-1 text-xs" style={{ color: 'var(--text-tertiary)' }}>
                                备注：{record.description}
                              </div>
                            )}
                          </div>

                          <span className={`kk-user-profile-modal__status inline-flex rounded-full border px-2 py-0.5 text-[11px] ${getStatusClass(record.status)}`}>
                            {getRechargeSubmissionStatusLabel(record.status || 'completed')}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </section>
            </div>
          )}

          {view === 'security' && (
            <div className="space-y-4">
              <div className="kk-user-profile-modal__main-card rounded-xl border p-4" style={{ borderColor: 'var(--frost-card-main-border)' }}>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
                      当前安全状态
                    </div>
                    <div className="mt-1 text-xs" style={{ color: 'var(--text-tertiary)' }}>
                      启用后可用于敏感操作二次校验，也能为后续自托管 MFA 强化做好准备。
                    </div>
                  </div>

                  <button
                    onClick={() => void loadSecurityState()}
                    disabled={mfaLoading}
                    className="inline-flex h-9 items-center justify-center rounded-lg border px-3 text-xs disabled:opacity-70"
                    style={{ borderColor: 'var(--border-light)', color: 'var(--text-secondary)' }}
                  >
                    {mfaLoading ? '刷新中...' : '刷新状态'}
                  </button>
                </div>

                <div className="mt-4 grid gap-3 md:grid-cols-3">
                  <div className="kk-user-profile-modal__sub-card rounded-lg border px-3 py-3" style={{ borderColor: 'var(--frost-card-sub-border)' }}>
                    <div className="text-[11px]" style={{ color: 'var(--text-tertiary)' }}>当前 AAL</div>
                    <div className="mt-1 text-lg font-semibold text-emerald-300">
                      {mfaStatus?.currentLevel?.toUpperCase() || '未启用'}
                    </div>
                  </div>

                  <div className="kk-user-profile-modal__sub-card rounded-lg border px-3 py-3" style={{ borderColor: 'var(--frost-card-sub-border)' }}>
                    <div className="text-[11px]" style={{ color: 'var(--text-tertiary)' }}>下一等级</div>
                    <div className="mt-1 text-lg font-semibold text-amber-300">
                      {mfaStatus?.nextLevel?.toUpperCase() || '-'}
                    </div>
                  </div>

                  <div className="kk-user-profile-modal__sub-card rounded-lg border px-3 py-3" style={{ borderColor: 'var(--frost-card-sub-border)' }}>
                    <div className="text-[11px]" style={{ color: 'var(--text-tertiary)' }}>已验证因子</div>
                    <div className="mt-1 text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>
                      {mfaStatus?.verifiedFactors.length || 0}
                    </div>
                  </div>
                </div>
              </div>

              <section className="kk-user-profile-modal__main-card rounded-xl border p-4" style={{ borderColor: 'var(--frost-card-main-border)' }}>
                <div className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
                  启用 TOTP 动态口令
                </div>
                <p className="mt-1 text-xs" style={{ color: 'var(--text-tertiary)' }}>
                  推荐使用 Google Authenticator、Microsoft Authenticator、1Password 等身份验证器。
                </p>

                <label className="mt-4 block space-y-1">
                  <span className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
                    设备名称
                  </span>
                  <input
                    value={mfaFriendlyName}
                    onChange={(event) => setMfaFriendlyName(event.target.value)}
                    placeholder="例如：我的手机"
                    className="h-10 w-full rounded-lg border bg-[var(--frost-input-bg)] px-3 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)]"
                    style={{ borderColor: 'var(--frost-input-border)' }}
                  />
                </label>

                <button
                  onClick={() => void handleStartMfaEnrollment()}
                  disabled={mfaActionLoading}
                  className="mt-3 inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-[var(--accent-coral)] px-4 text-sm font-medium text-white disabled:opacity-70"
                >
                  {mfaActionLoading && <Loader2 size={16} className="animate-spin" />}
                  生成绑定二维码
                </button>

                <p className="mt-3 text-[11px] text-amber-200">
                  完成验证后，KK API 会提升当前会话到 `aal2`，并让其它旧会话重新登录。
                </p>

                {mfaEnrollment && (
                  <div className="kk-user-profile-modal__mfa-enrollment mt-4 rounded-xl border p-4">
                    <div className="grid gap-4 md:grid-cols-[220px_1fr]">
                      <div className="kk-user-profile-modal__qr-panel rounded-xl p-3">
                        <img src={mfaEnrollment.qrCode} alt="TOTP 绑定二维码" className="mx-auto h-auto w-full max-w-[180px]" />
                      </div>

                      <div className="space-y-3">
                        <div>
                          <div className="text-xs text-emerald-200/80">备用密钥</div>
                          <div className="mt-1 break-all rounded-lg border border-[var(--frost-card-sub-border)] bg-[var(--frost-card-sub-bg)] px-3 py-2 text-sm text-[var(--text-primary)]">
                            {mfaEnrollment.secret}
                          </div>
                        </div>

                        <div>
                          <div className="text-xs text-emerald-200/80">OTP Auth URI</div>
                          <div className="mt-1 break-all rounded-lg border border-[var(--frost-card-sub-border)] bg-[var(--frost-card-sub-bg)] px-3 py-2 text-xs text-[var(--text-secondary)]">
                            {mfaEnrollment.uri}
                          </div>
                        </div>

                        <label className="block space-y-1">
                          <span className="text-xs text-emerald-200/80">6 位动态口令</span>
                          <input
                            value={mfaCode}
                            onChange={(event) => setMfaCode(event.target.value.replace(/\D/g, '').slice(0, 6))}
                            placeholder="请输入验证码"
                            inputMode="numeric"
                            className="h-10 w-full rounded-lg border border-[var(--frost-input-border)] bg-[var(--frost-input-bg)] px-3 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)]"
                          />
                        </label>

                        <button
                          onClick={() => void handleVerifyMfaCode(mfaEnrollment.factorId)}
                          disabled={mfaActionLoading}
                          className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-[var(--accent-coral)] px-4 text-sm font-medium text-white disabled:opacity-70"
                        >
                          {mfaActionLoading && <Loader2 size={16} className="animate-spin" />}
                          完成绑定并验证
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </section>

              <section className="kk-user-profile-modal__main-card rounded-xl border p-4" style={{ borderColor: 'var(--frost-card-main-border)' }}>
                <div className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
                  已绑定因子
                </div>

                {mfaLoading ? (
                  <div className="mt-3 flex h-16 items-center justify-center text-sm" style={{ color: 'var(--text-tertiary)' }}>
                    <span className="inline-flex max-w-full items-center gap-2 overflow-hidden whitespace-nowrap">
                      <Loader2 size={16} className="shrink-0 animate-spin" />
                      <span className="min-w-0 overflow-hidden text-ellipsis whitespace-nowrap">正在读取双重验证信息...</span>
                    </span>
                  </div>
                ) : !mfaStatus || mfaStatus.verifiedFactors.length === 0 ? (
                  <div className="kk-user-profile-modal__sub-card mt-3 rounded-lg border border-dashed px-3 py-4 text-xs" style={{ borderColor: 'var(--frost-card-sub-border)', color: 'var(--text-tertiary)' }}>
                    还没有已验证的 MFA 因子。
                  </div>
                ) : (
                  <div className="mt-3 space-y-2">
                    {mfaStatus.verifiedFactors.map((factor) => (
                      <div key={factor.id} className="kk-user-profile-modal__sub-card rounded-lg border p-3" style={{ borderColor: 'var(--frost-card-sub-border)' }}>
                        <div className="flex flex-wrap items-center justify-between gap-3">
                          <div>
                            <div className="text-sm" style={{ color: 'var(--text-primary)' }}>
                              {factor.friendlyName || '未命名验证器'}
                            </div>
                            <div className="mt-1 text-xs" style={{ color: 'var(--text-tertiary)' }}>
                              类型：{factor.factorType.toUpperCase()} · 创建时间：{formatDateTime(factor.createdAt)}
                            </div>
                          </div>

                          <span className="rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2 py-1 text-[11px] text-emerald-300">
                            已验证
                          </span>
                        </div>

                        {mfaStatus.currentLevel !== 'aal2' && factor.factorType === 'totp' && (
                          <div className="kk-user-profile-modal__sub-card mt-3 rounded-lg border border-[var(--frost-card-sub-border)] bg-[var(--frost-card-sub-bg)] p-3">
                            <div className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
                              当前会话还没有提升到 AAL2，输入一次动态口令即可完成二次验证。
                            </div>

                            <div className="mt-3 flex flex-wrap items-center gap-2">
                              <input
                                value={mfaCode}
                                onChange={(event) => setMfaCode(event.target.value.replace(/\D/g, '').slice(0, 6))}
                                placeholder="6 位动态口令"
                                inputMode="numeric"
                                className="h-10 min-w-[180px] flex-1 rounded-lg border bg-[var(--frost-input-bg)] px-3 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)]"
                                style={{ borderColor: 'var(--frost-input-border)' }}
                              />

                              <button
                                onClick={() => void handleVerifyMfaCode(factor.id)}
                                disabled={mfaActionLoading}
                                className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-[var(--accent-coral)] px-4 text-sm font-medium text-white disabled:opacity-70"
                              >
                                {mfaActionLoading && <Loader2 size={16} className="animate-spin" />}
                                验证当前会话
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {Boolean(mfaStatus?.pendingFactors.length) && (
                  <div className="kk-user-profile-modal__notice kk-user-profile-modal__notice--warning mt-4 rounded-lg px-3 py-3 text-xs">
                    还有 {mfaStatus?.pendingFactors.length} 个未完成验证的因子，只有完成一次动态口令校验后才会真正生效。
                  </div>
                )}
              </section>
            </div>
          )}
        </div>
        </div>
      </div>
    </>
  );
};

export default UserProfileModal;
