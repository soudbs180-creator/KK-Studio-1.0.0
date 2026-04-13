import React, { useEffect, useMemo, useState } from 'react';
import type { User } from '@supabase/supabase-js';
import {
  AlertCircle,
  ChevronLeft,
  CreditCard,
  Loader2,
  Lock,
  LogOut,
  Pencil,
  QrCode,
  Wallet,
  X,
} from 'lucide-react';

import { KKAI_FEATURE_FLAGS } from '../../app/kkaiFeatureFlags';
import { useAuth } from '../../context/AuthContext';
import { useBilling } from '../../context/BillingContext';
import { useAdminRole } from '../../hooks/useAdminRole';
import { getStoredKkApiAccessToken } from '../../services/api/authAccessToken';
import { kkWebApiClient } from '../../services/api/kkApiClient';
import { getRechargeSubmissionStatusLabel } from '../../services/billing/rechargeSubmissionService';
import {
  formatRemainingCredits,
  selectRemainingBalanceSummary,
} from '../../services/billing/remainingBalance';
import { collectLinkedAuthProviders } from '../../services/auth/identityLinking';
import {
  updateRuntimeAuthStateFromProfile,
  updateRuntimeUserMetadata,
} from '../../services/auth/runtimeAuthState';
import { startWechatBind } from '../../services/auth/wechatAuth.ts';
import WechatQrModal from '../auth/WechatQrModal';
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
  user: User | null;
  onSignOut: () => void;
  initialView?: UserProfileView;
  isMobile?: boolean;
}

type FlashMessage = { type: 'success' | 'error'; text: string } | null;

const formatDateTime = (value?: string | null) => {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleString('zh-CN', { hour12: false, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
};

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
  const { balance, billingLogs, usageLogs, loading: billingLoading, refreshBilling, setShowRechargeModal } = useBilling();
  const remainingBalanceDisplay = formatRemainingCredits(balance, 'zh-CN');
  const { latestRecharge } = useMemo(() => selectRemainingBalanceSummary(billingLogs), [billingLogs]);
  const remainingBalanceHint = latestRecharge ? `最近充值：${formatDateTime(latestRecharge.created_at)}` : '仅管理员积分模型会消耗这里的积分，个人 API 不扣积分';

  const [view, setView] = useState<UserProfileView>('main');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<FlashMessage>(null);
  const [displayName, setDisplayName] = useState('');
  const [avatarUrl, setAvatarUrl] = useState('');
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [timeRemaining, setTimeRemaining] = useState('');
  const [wechatModalOpen, setWechatModalOpen] = useState(false);
  const [wechatLoading, setWechatLoading] = useState(false);
  const [wechatError, setWechatError] = useState<string | null>(null);
  const [wechatAuthorizationUrl, setWechatAuthorizationUrl] = useState<string | null>(null);
  const [wechatExpiresAt, setWechatExpiresAt] = useState<string | null>(null);

  const apiAccessToken = useMemo(() => (isTempUser ? undefined : getStoredKkApiAccessToken()), [isTempUser, user?.id]);
  const linkedProviders = useMemo(() => collectLinkedAuthProviders(user), [user]);
  const defaultPresetAvatarId = useMemo(() => getDefaultPresetAvatarId(user?.id || user?.email || displayName), [displayName, user?.email, user?.id]);
  const selectedPresetAvatar = useMemo(() => getPresetAvatarById(avatarUrl), [avatarUrl]);
  const avatarInputValue = selectedPresetAvatar ? '' : avatarUrl;
  const billingFeatureEnabled = KKAI_FEATURE_FLAGS.billing;
  const passwordChangeEnabled = false;
  const isShadowWechatEmail = Boolean(user?.email?.endsWith('@users.kkstudio.local'));
  const isLocalRuntimeEmail = Boolean(user?.email?.endsWith('@kkai.local'));
  const isWechatBound = isShadowWechatEmail || user?.user_metadata?.auth_provider === 'wechat' || linkedProviders.includes('wechat');
  const canBindWechat = Boolean(user?.id) && !isTempUser && !isWechatBound && Boolean(apiAccessToken);
  const canChangePassword = Boolean(user?.email) && !isTempUser && !isShadowWechatEmail && Boolean(apiAccessToken) && passwordChangeEnabled;
  const displayEmail = isShadowWechatEmail ? '微信授权用户' : isLocalRuntimeEmail ? '本地运行时账户' : user?.email || '未绑定邮箱';
  const nickname = displayName || user?.user_metadata?.full_name || user?.user_metadata?.display_name || user?.email?.split('@')[0] || '未命名用户';
  const avatarSrc = resolveAvatarUrl(avatarUrl || user?.user_metadata?.avatar_url);
  const roleLabel = checkingAdmin && user ? '识别中' : accountRole === 'admin' ? '管理员' : String(accountRole || '').startsWith('member') ? '会员账号' : '普通用户';

  useEffect(() => {
    if (!isOpen) return;
    const nextView: UserProfileView =
      initialView === 'edit-profile'
        ? 'edit-profile'
        : initialView === 'billing' && billingFeatureEnabled
          ? 'billing'
          : initialView === 'change-password' && canChangePassword
            ? 'change-password'
            : 'main';
    setView(nextView);
    setMessage(null);
    setDisplayName(user?.user_metadata?.full_name || user?.user_metadata?.display_name || (isShadowWechatEmail ? '微信用户' : user?.email?.split('@')[0]) || '本地工作区');
    setAvatarUrl(user?.user_metadata?.avatar_url || '');
    if (nextView === 'billing') {
      void refreshBilling({ includeTransactions: true });
    }
  }, [billingFeatureEnabled, canChangePassword, initialView, isOpen, isShadowWechatEmail, refreshBilling, user]);

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
      setTimeRemaining(hours > 0 ? `${hours} 小时 ${minutes} 分钟` : `${minutes} 分钟`);
    };
    update();
    const timer = window.setInterval(update, 60_000);
    return () => window.clearInterval(timer);
  }, [isTempUser, tempUserExpiry]);

  const closeModal = () => {
    setMessage(null);
    setOldPassword('');
    setNewPassword('');
    setConfirmPassword('');
    setWechatModalOpen(false);
    setWechatLoading(false);
    setWechatError(null);
    setWechatAuthorizationUrl(null);
    setWechatExpiresAt(null);
    setView('main');
    onClose();
  };

  const saveProfileLocally = (finalName: string, nextAvatarUrl: string) => {
    updateRuntimeUserMetadata({
      email: user?.email || undefined,
      fullName: finalName,
      displayName: finalName,
      avatarUrl: nextAvatarUrl,
      authProvider: String(user?.user_metadata?.auth_provider || user?.user_metadata?.provider || 'local'),
      providers: linkedProviders,
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
    if (!apiAccessToken) {
      saveProfileLocally(finalName, nextAvatarUrl);
      setMessage({ type: 'success', text: '资料已保存到本地运行时，后端资料接口尚未同步。' });
      setLoading(false);
      return;
    }
    try {
      const response = await kkWebApiClient.updateProfile({ nickname: finalName, avatarUrl: nextAvatarUrl || undefined });
      if (!response.success) {
        const gapMessage = resolveApiGapMessage(response.error.code, response.error.message || '更新失败，请稍后重试。');
        if (gapMessage !== response.error.message) {
          saveProfileLocally(finalName, nextAvatarUrl);
          setMessage({ type: 'success', text: `资料已保存到本地运行时。${gapMessage}` });
          return;
        }
        throw new Error(gapMessage);
      }
      updateRuntimeAuthStateFromProfile(response.data);
      setMessage({ type: 'success', text: '个人资料已更新并同步到 KK API。' });
    } catch (error: any) {
      setMessage({ type: 'error', text: localizeUserFacingText(error?.message) || error?.message || '更新失败，请稍后重试。' });
    } finally {
      setLoading(false);
    }
  };

  const handleChangePassword = async () => {
    if (!passwordChangeEnabled) {
      setMessage({ type: 'error', text: resolveApiGapMessage('AUTH_ROUTE_DISABLED', '当前运行时不支持修改密码。') });
      return;
    }
    if (!apiAccessToken) {
      setMessage({ type: 'error', text: '当前本地运行时还没有可用的认证会话，暂时无法修改密码。' });
      return;
    }
    if (!oldPassword.trim() || !newPassword.trim() || !confirmPassword.trim()) {
      setMessage({ type: 'error', text: '请完整填写旧密码、新密码和确认密码。' });
      return;
    }
    if (newPassword.length < 6) {
      setMessage({ type: 'error', text: '新密码至少 6 位。' });
      return;
    }
    if (newPassword !== confirmPassword) {
      setMessage({ type: 'error', text: '两次输入的新密码不一致。' });
      return;
    }
    setLoading(true);
    setMessage(null);
    try {
      const response = await kkWebApiClient.updatePassword({ currentPassword: oldPassword, newPassword });
      if (!response.success) {
        throw new Error(resolveApiGapMessage(response.error.code, response.error.message || '密码修改失败，请稍后重试。'));
      }
      updateRuntimeAuthStateFromProfile(response.data.profile);
      setMessage({ type: 'success', text: '密码修改成功。' });
      setOldPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (error: any) {
      setMessage({ type: 'error', text: localizeUserFacingText(error?.message) || error?.message || '密码修改失败，请稍后重试。' });
    } finally {
      setLoading(false);
    }
  };

  const handleWechatBind = async () => {
    if (!canBindWechat) {
      setMessage({ type: 'error', text: isTempUser ? '临时账号暂不支持绑定微信。' : !apiAccessToken ? '当前本地账户还没有 KK API 登录会话，暂时无法绑定微信。' : '当前账号已经绑定微信。' });
      return;
    }
    setWechatModalOpen(true);
    setWechatLoading(true);
    setWechatError(null);
    try {
      const authData = await startWechatBind();
      setWechatAuthorizationUrl(authData.authorizationUrl);
      setWechatExpiresAt(authData.expiresAt);
    } catch (error: any) {
      const nextMessage = localizeUserFacingText(error?.message) || error?.message || '无法发起微信绑定，请稍后重试。';
      setWechatError(nextMessage);
      setMessage({ type: 'error', text: nextMessage });
    } finally {
      setWechatLoading(false);
    }
  };

  if (!isOpen) return null;

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
        onClose={() => setWechatModalOpen(false)}
        onOpenInNewPage={() => wechatAuthorizationUrl && window.open(wechatAuthorizationUrl, '_blank', 'noopener,noreferrer')}
      />
      <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={closeModal}>
        <div className={`w-full ${isMobile ? 'h-full rounded-none' : 'max-w-[520px] rounded-2xl'} border bg-[var(--bg-panel)] shadow-2xl`} style={{ borderColor: 'var(--border-light)', maxHeight: isMobile ? '100%' : 'min(88vh, 860px)' }} onClick={(event) => event.stopPropagation()}>
          <div className="flex items-center justify-between border-b px-4 py-3" style={{ borderColor: 'var(--border-light)' }}>
            <div className="flex items-center gap-2">
              {view !== 'main' && <button onClick={() => setView('main')} className="inline-flex h-8 w-8 items-center justify-center rounded-lg border" style={{ borderColor: 'var(--border-light)', color: 'var(--text-secondary)' }}><ChevronLeft size={16} /></button>}
              <div className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
                {view === 'main' && '账户信息'}
                {view === 'edit-profile' && '编辑个人资料'}
                {view === 'change-password' && '修改密码'}
                {view === 'billing' && '账户管理'}
              </div>
            </div>
            <button onClick={closeModal} className="inline-flex h-8 w-8 items-center justify-center rounded-lg border" style={{ borderColor: 'var(--border-light)', color: 'var(--text-secondary)' }}><X size={16} /></button>
          </div>

          <div className="space-y-4 overflow-y-auto px-4 py-4" style={{ maxHeight: isMobile ? 'calc(100vh - 60px)' : 'min(80vh, 800px)' }}>
            {message && <div className={`flex items-start gap-2 rounded-xl border px-3 py-3 text-sm ${message.type === 'error' ? 'border-red-500/20 bg-red-500/10 text-red-200' : 'border-emerald-500/20 bg-emerald-500/10 text-emerald-100'}`}><AlertCircle size={16} className="mt-0.5 shrink-0" /><span>{message.text}</span></div>}

            {view === 'main' && (
              <>
                <div className="rounded-xl border p-4" style={{ borderColor: 'var(--border-light)' }}>
                  <div className="flex items-center gap-3">
                    <div className="h-14 w-14 overflow-hidden rounded-2xl border" style={{ borderColor: 'var(--border-light)' }}>
                      {avatarSrc ? <img src={avatarSrc} alt={nickname} className="h-full w-full object-cover" /> : <div className="flex h-full w-full items-center justify-center text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>{nickname.slice(0, 1).toUpperCase()}</div>}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-base font-semibold" style={{ color: 'var(--text-primary)' }}>{nickname}</div>
                      <div className="mt-0.5 truncate text-xs" style={{ color: 'var(--text-tertiary)' }}>{displayEmail}</div>
                      {isWechatBound && <div className="mt-1 text-[11px] text-emerald-300">已绑定微信，可使用微信头像、昵称和扫码登录</div>}
                      <div className="mt-1 text-[11px]" style={{ color: 'var(--text-tertiary)' }}>用户 ID：{user?.id || '-'}</div>
                    </div>
                    <span className="rounded-full border px-2 py-1 text-[11px]" style={{ borderColor: 'var(--border-light)', color: 'var(--text-secondary)' }}>{roleLabel}</span>
                  </div>
                </div>

                {isTempUser && <div className="rounded-xl border border-amber-500/20 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">当前账号剩余有效期：{timeRemaining || '计算中'}。建议绑定正式账号，避免数据丢失。</div>}
                {!isTempUser && !apiAccessToken && <div className="rounded-xl border border-blue-500/20 bg-blue-500/10 px-4 py-3 text-sm text-blue-100">当前是本地运行时资料。资料编辑会先保存在本地，微信绑定和密码修改需要等待后端认证接口接通。</div>}

                <div className="rounded-xl border p-4" style={{ borderColor: 'var(--border-light)' }}>
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <div className="text-xs" style={{ color: 'var(--text-tertiary)' }}>积分</div>
                      <div className="mt-1 text-2xl font-bold text-amber-300">{remainingBalanceDisplay}</div>
                      <div className="text-[11px]" style={{ color: 'var(--text-tertiary)' }}>{remainingBalanceHint}</div>
                    </div>
                    {billingFeatureEnabled ? <button onClick={() => setShowRechargeModal(true)} className="inline-flex h-10 items-center justify-center rounded-lg bg-amber-500 px-4 text-sm font-medium text-white">立即充值</button> : null}
                  </div>
                </div>

                <div className="space-y-2">
                  <button onClick={() => setView('edit-profile')} className="flex h-11 w-full items-center justify-between rounded-lg border px-3 text-sm" style={{ borderColor: 'var(--border-light)', color: 'var(--text-primary)' }}><span className="inline-flex items-center gap-2"><Pencil size={15} /><span>编辑个人资料</span></span><span style={{ color: 'var(--text-tertiary)' }}>进入</span></button>
                  <button onClick={() => void handleWechatBind()} disabled={!canBindWechat} className="flex h-11 w-full items-center justify-between rounded-lg border px-3 text-sm disabled:cursor-not-allowed disabled:opacity-60" style={{ borderColor: 'var(--border-light)', color: 'var(--text-primary)' }}><span className="inline-flex items-center gap-2"><QrCode size={15} /><span>{isWechatBound ? '微信已绑定' : '绑定微信'}</span></span><span style={{ color: 'var(--text-tertiary)' }}>{isWechatBound ? '已完成' : '进入'}</span></button>
                  {canChangePassword && <button onClick={() => setView('change-password')} className="flex h-11 w-full items-center justify-between rounded-lg border px-3 text-sm" style={{ borderColor: 'var(--border-light)', color: 'var(--text-primary)' }}><span className="inline-flex items-center gap-2"><Lock size={15} /><span>修改密码</span></span><span style={{ color: 'var(--text-tertiary)' }}>进入</span></button>}
                  {billingFeatureEnabled && <button onClick={() => { setView('billing'); void refreshBilling({ includeTransactions: true }); }} className="flex h-11 w-full items-center justify-between rounded-lg border px-3 text-sm" style={{ borderColor: 'var(--border-light)', color: 'var(--text-primary)' }}><span className="inline-flex items-center gap-2"><Wallet size={15} /><span>账户管理</span></span><span style={{ color: 'var(--text-tertiary)' }}>进入</span></button>}
                  <button onClick={() => { closeModal(); onSignOut(); }} className="flex h-11 w-full items-center justify-center gap-2 rounded-lg border border-red-500/30 bg-red-500/10 px-3 text-sm text-red-300"><LogOut size={15} /><span>退出登录</span></button>
                </div>
              </>
            )}

            {view === 'edit-profile' && (
              <div className="space-y-3">
                <label className="block space-y-1"><span className="text-xs" style={{ color: 'var(--text-tertiary)' }}>昵称</span><input value={displayName} onChange={(event) => setDisplayName(event.target.value)} placeholder="请输入昵称" className="h-10 w-full rounded-lg border bg-[var(--bg-tertiary)] px-3 text-sm" style={{ borderColor: 'var(--border-light)' }} /></label>
                <div className="grid grid-cols-3 gap-3">{PRESET_AVATAR_OPTIONS.map((option) => { const selected = getPresetAvatarById(avatarUrl)?.id === option.id; return <button key={option.id} type="button" onClick={() => setAvatarUrl(option.id)} className={`rounded-xl border p-2 text-left transition-all ${selected ? 'scale-[1.02]' : 'hover:-translate-y-0.5'}`} style={{ borderColor: selected ? 'rgb(99 102 241 / 0.9)' : 'var(--border-light)', backgroundColor: selected ? 'rgb(99 102 241 / 0.12)' : 'var(--bg-tertiary)' }}><div className="overflow-hidden rounded-lg border" style={{ borderColor: 'rgb(255 255 255 / 0.08)' }}><img src={option.url} alt={option.label} className="h-full w-full object-cover" /></div><div className="mt-2 text-center"><span className="text-xs font-medium" style={{ color: 'var(--text-primary)' }}>{option.label}</span></div></button>; })}</div>
                <label className="block space-y-1"><span className="text-xs" style={{ color: 'var(--text-tertiary)' }}>头像链接（可选）</span><input value={avatarInputValue} onChange={(event) => setAvatarUrl(event.target.value)} placeholder={`请输入外部图片地址，或点“${defaultPresetAvatarId}”对应预设头像`} className="h-10 w-full rounded-lg border bg-[var(--bg-tertiary)] px-3 text-sm" style={{ borderColor: 'var(--border-light)' }} /></label>
                <button onClick={() => void handleUpdateProfile()} disabled={loading} className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-indigo-600 px-4 text-sm font-medium text-white disabled:opacity-70">{loading && <Loader2 size={16} className="animate-spin" />}保存资料</button>
              </div>
            )}

            {view === 'change-password' && (
              <div className="space-y-3">
                <label className="block space-y-1"><span className="text-xs" style={{ color: 'var(--text-tertiary)' }}>当前密码</span><input type="password" value={oldPassword} onChange={(event) => setOldPassword(event.target.value)} placeholder="请输入当前密码" className="h-10 w-full rounded-lg border bg-[var(--bg-tertiary)] px-3 text-sm" style={{ borderColor: 'var(--border-light)' }} /></label>
                <label className="block space-y-1"><span className="text-xs" style={{ color: 'var(--text-tertiary)' }}>新密码</span><input type="password" value={newPassword} onChange={(event) => setNewPassword(event.target.value)} placeholder="至少 6 位" className="h-10 w-full rounded-lg border bg-[var(--bg-tertiary)] px-3 text-sm" style={{ borderColor: 'var(--border-light)' }} /></label>
                <label className="block space-y-1"><span className="text-xs" style={{ color: 'var(--text-tertiary)' }}>确认新密码</span><input type="password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} placeholder="请再次输入新密码" className="h-10 w-full rounded-lg border bg-[var(--bg-tertiary)] px-3 text-sm" style={{ borderColor: 'var(--border-light)' }} /></label>
                <button onClick={() => void handleChangePassword()} disabled={loading} className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-indigo-600 px-4 text-sm font-medium text-white disabled:opacity-70">{loading && <Loader2 size={16} className="animate-spin" />}保存新密码</button>
              </div>
            )}

            {view === 'billing' && billingFeatureEnabled && (
              <div className="space-y-4">
                <div className="rounded-xl border p-4" style={{ borderColor: 'var(--border-light)' }}>
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div><div className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>账户信息</div><div className="mt-1 text-xs" style={{ color: 'var(--text-tertiary)' }}>角色：{roleLabel}</div><div className="text-xs" style={{ color: 'var(--text-tertiary)' }}>邮箱：{displayEmail}</div></div>
                    <div className="rounded-lg border px-3 py-2" style={{ borderColor: 'var(--border-light)' }}><div className="text-[11px]" style={{ color: 'var(--text-tertiary)' }}>积分</div><div className="text-xl font-bold text-amber-300">{remainingBalanceDisplay}</div></div>
                  </div>
                  <button onClick={() => setShowRechargeModal(true)} className="mt-3 inline-flex h-9 items-center justify-center gap-2 rounded-lg bg-amber-500 px-4 text-sm text-white"><CreditCard size={14} />充值积分</button>
                </div>

                <section className="rounded-xl border p-4" style={{ borderColor: 'var(--border-light)' }}>
                  <div className="mb-2 text-sm font-medium" style={{ color: 'var(--text-primary)' }}>生成记录</div>
                  {billingLoading ? <div className="flex h-16 items-center justify-center text-sm" style={{ color: 'var(--text-tertiary)' }}><Loader2 size={16} className="animate-spin" /></div> : usageLogs.length === 0 ? <div className="rounded-lg border border-dashed px-3 py-4 text-xs" style={{ borderColor: 'var(--border-light)', color: 'var(--text-tertiary)' }}>暂无生成记录。</div> : <div className="space-y-2">{usageLogs.slice(0, 20).map((record) => <div key={record.id} className="rounded-lg border p-3" style={{ borderColor: 'var(--border-light)' }}><div className="flex items-center justify-between gap-3"><div className="min-w-0 flex-1"><div className="truncate text-sm" style={{ color: 'var(--text-primary)' }}>{record.model_name || record.model_id || record.description || '模型调用'}</div><div className="mt-1 text-xs" style={{ color: 'var(--text-tertiary)' }}>时间：{formatDateTime(record.created_at)}</div></div><span className={`inline-flex rounded-full border px-2 py-0.5 text-[11px] ${record.status ? '' : ''}`}>{getRechargeSubmissionStatusLabel(record.status || 'completed')}</span></div></div>)}</div>}
                </section>

                <section className="rounded-xl border p-4" style={{ borderColor: 'var(--border-light)' }}>
                  <div className="mb-2 text-sm font-medium" style={{ color: 'var(--text-primary)' }}>充值记录</div>
                  {billingLoading ? <div className="flex h-16 items-center justify-center text-sm" style={{ color: 'var(--text-tertiary)' }}><Loader2 size={16} className="animate-spin" /></div> : billingLogs.length === 0 ? <div className="rounded-lg border border-dashed px-3 py-4 text-xs" style={{ borderColor: 'var(--border-light)', color: 'var(--text-tertiary)' }}>暂无充值记录。</div> : <div className="space-y-2">{billingLogs.slice(0, 20).map((record) => <div key={record.id} className="rounded-lg border p-3" style={{ borderColor: 'var(--border-light)' }}><div className="flex items-center justify-between gap-3"><div><div className="text-sm" style={{ color: 'var(--text-primary)' }}>充值 {record.amount} 积分</div><div className="mt-1 text-xs" style={{ color: 'var(--text-tertiary)' }}>时间：{formatDateTime(record.created_at)}</div></div><span className="inline-flex rounded-full border px-2 py-0.5 text-[11px]">{getRechargeSubmissionStatusLabel(record.status || 'completed')}</span></div></div>)}</div>}
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
