import { useCallback, useEffect, useMemo, useState } from 'react';

import { useAuth } from '../../../context/AuthContext';
import { useBilling } from '../../../context/BillingContext';
import { getPreferredKkApiAccessToken } from '../../../services/api/authAccessToken';
import { kkWebApiClient } from '../../../services/api/kkApiClient';
import {
  collectLinkedAuthProviders,
  listLinkedAuthProviders,
  startGoogleBind,
} from '../../../services/auth/identityLinking';
import {
  enrollTotpFactor,
  loadMfaStatus,
  verifyTotpFactor,
  type MfaStatusSnapshot,
  type TotpEnrollmentResult,
} from '../../../services/auth/mfa';
import {
  updateRuntimeAuthStateFromProfile,
  updateRuntimeUserMetadata,
} from '../../../services/auth/runtimeAuthState';
import { startWechatBind } from '../../../services/auth/wechatAuth';
import { localizeUserFacingText } from '../../../utils/localeText';

export type AccountCenterMessage = { tone: 'success' | 'danger' | 'warning'; text: string } | null;

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

export function useAccountCenterController() {
  const { user, isTempUser, adminLevel } = useAuth();
  const billing = useBilling();
  const [linkedProviders, setLinkedProviders] = useState<string[]>([]);
  const [displayName, setDisplayName] = useState('');
  const [avatarUrl, setAvatarUrl] = useState('');
  const [passwordCode, setPasswordCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordCodeExpiresAt, setPasswordCodeExpiresAt] = useState<string | null>(null);
  const [mfaStatus, setMfaStatus] = useState<MfaStatusSnapshot | null>(null);
  const [mfaEnrollment, setMfaEnrollment] = useState<TotpEnrollmentResult | null>(null);
  const [mfaCode, setMfaCode] = useState('');
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [message, setMessage] = useState<AccountCenterMessage>(null);

  const sessionProviders = useMemo(() => collectLinkedAuthProviders(user), [user]);
  const effectiveLinkedProviders = linkedProviders.length > 0 ? linkedProviders : sessionProviders;
  const isShadowWechatEmail = Boolean(user?.email?.endsWith('@users.kkstudio.local'));
  const isWechatBound = isShadowWechatEmail
    || user?.user_metadata?.auth_provider === 'wechat'
    || effectiveLinkedProviders.includes('wechat');
  const isGoogleBound = effectiveLinkedProviders.includes('google');
  const nickname = String(
    user?.user_metadata?.full_name
    || user?.user_metadata?.display_name
    || (isShadowWechatEmail ? '微信用户' : user?.email?.split('@')[0])
    || '未命名用户',
  );

  useEffect(() => {
    setDisplayName(nickname);
    setAvatarUrl(String(user?.user_metadata?.avatar_url || ''));
  }, [nickname, user?.user_metadata?.avatar_url]);

  useEffect(() => {
    void billing.refreshBilling({ includeTransactions: true });
  }, [billing.refreshBilling]);

  useEffect(() => {
    if (!user?.id || isTempUser) return;
    let active = true;
    void listLinkedAuthProviders()
      .then((providers) => active && setLinkedProviders(providers))
      .catch((error) => console.warn('[AccountCenter] Failed to load linked identities:', error));
    return () => { active = false; };
  }, [isTempUser, user?.id]);

  const totalRecharged = useMemo(() => billing.billingLogs
    .filter((log) => !log.status || log.status.toLowerCase() === 'completed')
    .reduce((sum, log) => sum + (Number(log.amount) || 0), 0), [billing.billingLogs]);
  const totalConsumed = useMemo(() => billing.usageLogs
    .filter((log) => !log.status || log.status.toLowerCase() === 'completed')
    .reduce((sum, log) => sum + Math.abs(Number(log.amount) || 0), 0), [billing.usageLogs]);

  const saveProfileLocally = useCallback((nextName: string, nextAvatarUrl: string) => {
    updateRuntimeUserMetadata({
      email: user?.email || undefined,
      fullName: nextName,
      displayName: nextName,
      avatarUrl: nextAvatarUrl,
      authProvider: String(user?.user_metadata?.auth_provider || user?.user_metadata?.provider || 'local'),
      providers: effectiveLinkedProviders,
    });
  }, [effectiveLinkedProviders, user]);

  const updateProfile = useCallback(async () => {
    const nextName = displayName.trim();
    const nextAvatarUrl = avatarUrl.trim();
    if (!nextName) {
      setMessage({ tone: 'danger', text: '请输入昵称。' });
      return false;
    }
    setBusyAction('profile');
    setMessage(null);
    try {
      const accessToken = String(await getPreferredKkApiAccessToken() || '').trim();
      if (!accessToken) {
        saveProfileLocally(nextName, nextAvatarUrl);
        setMessage({ tone: 'warning', text: '资料已保存到本地运行时，后端资料接口尚未同步。' });
        return true;
      }
      const response = await kkWebApiClient.updateProfile({ nickname: nextName, avatarUrl: nextAvatarUrl || undefined });
      if (!response.success) {
        const resolved = resolveApiGapMessage(response.error.code, response.error.message || '更新失败，请稍后重试。');
        if (resolved !== response.error.message) {
          saveProfileLocally(nextName, nextAvatarUrl);
          setMessage({ tone: 'warning', text: `资料已保存到本地运行时。${resolved}` });
          return true;
        }
        throw new Error(resolved);
      }
      updateRuntimeAuthStateFromProfile(response.data);
      setMessage({ tone: 'success', text: '个人资料已更新并同步到 KK API。' });
      return true;
    } catch (error) {
      setMessage({ tone: 'danger', text: localizeUserFacingText(error instanceof Error ? error.message : '') || '更新失败，请稍后重试。' });
      return false;
    } finally {
      setBusyAction(null);
    }
  }, [avatarUrl, displayName, saveProfileLocally]);

  const sendPasswordCode = useCallback(async () => {
    if (!user?.email || isShadowWechatEmail) {
      setMessage({ tone: 'danger', text: '当前账户缺少可用邮箱，无法发送验证码。' });
      return;
    }
    setBusyAction('send-password-code');
    setMessage(null);
    try {
      const response = await kkWebApiClient.sendPasswordChangeCode();
      if (!response.success) throw new Error(resolveApiGapMessage(response.error.code, response.error.message || '验证码发送失败。'));
      setPasswordCodeExpiresAt(response.data.expiresAt);
      setMessage({ tone: 'success', text: `验证码已发送到 ${response.data.email}。` });
    } catch (error) {
      setMessage({ tone: 'danger', text: localizeUserFacingText(error instanceof Error ? error.message : '') || '验证码发送失败。' });
    } finally {
      setBusyAction(null);
    }
  }, [isShadowWechatEmail, user?.email]);

  const updatePassword = useCallback(async () => {
    if (!passwordCode.trim() || !newPassword || !confirmPassword) {
      setMessage({ tone: 'danger', text: '请填写验证码、新密码和确认密码。' });
      return;
    }
    if (newPassword.length < 8 || newPassword !== confirmPassword) {
      setMessage({ tone: 'danger', text: newPassword.length < 8 ? '新密码至少需要 8 位。' : '两次输入的新密码不一致。' });
      return;
    }
    setBusyAction('password');
    setMessage(null);
    try {
      const response = await kkWebApiClient.updatePassword({ newPassword, verificationCode: passwordCode.trim() });
      if (!response.success) throw new Error(resolveApiGapMessage(response.error.code, response.error.message || '密码修改失败。'));
      setPasswordCode('');
      setNewPassword('');
      setConfirmPassword('');
      setPasswordCodeExpiresAt(null);
      setMessage({ tone: 'success', text: '密码修改成功。' });
    } catch (error) {
      setMessage({ tone: 'danger', text: localizeUserFacingText(error instanceof Error ? error.message : '') || '密码修改失败。' });
    } finally {
      setBusyAction(null);
    }
  }, [confirmPassword, newPassword, passwordCode]);

  const bindGoogle = useCallback(async () => {
    if (isTempUser || isGoogleBound) return;
    setBusyAction('google');
    setMessage(null);
    try {
      window.location.assign(await startGoogleBind());
    } catch (error) {
      setMessage({ tone: 'danger', text: error instanceof Error ? error.message : '无法发起 Google 绑定。' });
      setBusyAction(null);
    }
  }, [isGoogleBound, isTempUser]);

  const bindWechat = useCallback(async () => {
    if (isTempUser || isWechatBound) return;
    setBusyAction('wechat');
    setMessage(null);
    try {
      const response = await startWechatBind();
      window.location.assign(response.authorizationUrl);
    } catch (error) {
      setMessage({ tone: 'danger', text: error instanceof Error ? error.message : '无法发起微信绑定。' });
      setBusyAction(null);
    }
  }, [isTempUser, isWechatBound]);

  const refreshMfa = useCallback(async () => {
    setBusyAction('mfa-status');
    try {
      setMfaStatus(await loadMfaStatus());
    } catch (error) {
      setMessage({ tone: 'danger', text: error instanceof Error ? error.message : '读取双重验证状态失败。' });
    } finally {
      setBusyAction(null);
    }
  }, []);

  const enrollMfa = useCallback(async () => {
    if (isTempUser) return;
    setBusyAction('mfa-enroll');
    setMessage(null);
    try {
      setMfaEnrollment(await enrollTotpFactor('KK Studio Authenticator'));
      setMessage({ tone: 'success', text: '请扫码后输入 6 位动态口令完成绑定。' });
      await refreshMfa();
    } catch (error) {
      setMessage({ tone: 'danger', text: error instanceof Error ? error.message : '启用双重验证失败。' });
    } finally {
      setBusyAction(null);
    }
  }, [isTempUser, refreshMfa]);

  const verifyMfa = useCallback(async () => {
    if (!mfaEnrollment || !/^\d{6}$/.test(mfaCode.trim())) {
      setMessage({ tone: 'danger', text: '请输入 6 位动态口令。' });
      return;
    }
    setBusyAction('mfa-verify');
    try {
      await verifyTotpFactor(mfaEnrollment.factorId, mfaCode.trim());
      setMfaEnrollment(null);
      setMfaCode('');
      await refreshMfa();
      setMessage({ tone: 'success', text: '双重验证已启用。' });
    } catch (error) {
      setMessage({ tone: 'danger', text: error instanceof Error ? error.message : '动态口令验证失败。' });
    } finally {
      setBusyAction(null);
    }
  }, [mfaCode, mfaEnrollment, refreshMfa]);

  return {
    user,
    isTempUser,
    adminLevel,
    ...billing,
    nickname,
    displayEmail: isShadowWechatEmail ? '微信授权用户' : user?.email || '未绑定邮箱',
    displayName,
    setDisplayName,
    avatarUrl,
    setAvatarUrl,
    linkedProviders: effectiveLinkedProviders,
    isWechatBound,
    isGoogleBound,
    totalRecharged,
    totalConsumed,
    passwordCode,
    setPasswordCode,
    newPassword,
    setNewPassword,
    confirmPassword,
    setConfirmPassword,
    passwordCodeExpiresAt,
    mfaStatus,
    mfaEnrollment,
    mfaCode,
    setMfaCode,
    busyAction,
    message,
    setMessage,
    updateProfile,
    sendPasswordCode,
    updatePassword,
    bindGoogle,
    bindWechat,
    refreshMfa,
    enrollMfa,
    verifyMfa,
  };
}
