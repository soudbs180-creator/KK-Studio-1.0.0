import React, { useEffect, useMemo, useState } from 'react';
import { KK_LAYER } from '@kk/ui';
import { KkModal } from '@kk/ui/web';
import {
  AlertCircle,
  CheckCircle2,
  Clock3,
  Loader2,
  QrCode,
  X,
  Award,
  Crown,
  Sparkles,
  ShieldAlert,
  ShieldCheck,
  User as UserIcon,
  Coins,
  ArrowRight,
  Info,
  ChevronLeft
} from 'lucide-react';

import alipayIcon from '../../assets/payment/alipay.svg';
import cardIcon from '../../assets/payment/card.svg';
import wechatIcon from '../../assets/payment/wechat.svg';
import { useAuth } from '../../context/AuthContext';
import { useBilling } from '../../context/BillingContext';
import { useAdminRole } from '../../hooks/useAdminRole';
import { resolveAvatarUrl } from '../../utils/presetAvatars';
import {
  DEFAULT_CREDIT_EXCHANGE_RATES,
  getCreditExchangeRateMap,
  type CreditExchangeRate,
  type SupportedRechargeCurrency,
} from '../../services/billing/creditExchangeRateService';
import {
  buildRechargeSubmissionRequestId,
  createRechargeBill,
  getRechargeSubmissionErrorMessage,
  listRechargePaymentChannels,
  markRechargeSubmissionPaid,
  normalizeRechargeBillSnapshot,
  type RechargeBillSnapshot,
  type RechargePaymentChannelConfig,
} from '../../services/billing/rechargeSubmissionService';
import { notify } from '../../services/system/notificationService';
import { localizeUserFacingText } from '../../utils/localeText';

type SupportedThemeType = 'alipay' | 'wechat' | 'international' | 'manual';

const INITIAL_RATE_MAP: Record<SupportedRechargeCurrency, CreditExchangeRate> = {
  CNY: { ...DEFAULT_CREDIT_EXCHANGE_RATES.CNY },
  USD: { ...DEFAULT_CREDIT_EXCHANGE_RATES.USD },
};

const FALLBACK_CHANNELS: RechargePaymentChannelConfig[] = [
  {
    channel: 'alipay',
    label: '支付宝静态码',
    instructionText: '人工充值较慢，请等待 1-5 分钟。',
    isActive: true,
    qrImageDataUrl: null,
    qrImagePath: null,
  },
  {
    channel: 'wechat',
    label: '微信静态码',
    instructionText: '人工充值较慢，请等待 1-5 分钟。',
    isActive: true,
    qrImageDataUrl: null,
    qrImagePath: null,
  },
];

const modalSelectableStyle = (selected: boolean): React.CSSProperties => ({
  background: selected
    ? 'color-mix(in srgb, var(--frost-card-main-bg) 60%, transparent)'
    : 'color-mix(in srgb, var(--frost-card-sub-bg) 20%, transparent)',
  borderColor: selected ? 'var(--settings-focus-border)' : 'var(--frost-card-sub-border)',
  color: 'var(--text-primary)',
});

const modalInputStyle: React.CSSProperties = {
  background: 'var(--frost-card-sub-bg)',
  borderColor: 'var(--frost-card-sub-border)',
  color: 'var(--text-primary)',
};

const modalWarningStyle: React.CSSProperties = {
  borderColor: 'var(--settings-state-warning-border)',
  backgroundColor: 'var(--settings-state-warning-bg)',
  color: 'var(--settings-state-warning-text)',
};

const formatMoney = (value: number, currency: SupportedRechargeCurrency) => {
  const symbol = currency === 'CNY' ? '¥' : '$';
  return `${symbol}${Number(value || 0).toFixed(2)}`;
};

const formatCountdown = (seconds: number) => {
  const safeSeconds = Math.max(0, seconds);
  const minutes = Math.floor(safeSeconds / 60);
  const rest = safeSeconds % 60;
  return `${minutes}:${String(rest).padStart(2, '0')}`;
};

function getSecondsLeft(expiresAt?: string | null): number {
  if (!expiresAt) {
    return 0;
  }
  return Math.max(0, Math.ceil((new Date(expiresAt).getTime() - Date.now()) / 1000));
}

const RechargeModal: React.FC = () => {
  const { showRechargeModal, setShowRechargeModal, refreshBilling, balance } = useBilling();
  const { user, isTempUser, adminLevel } = useAuth();
  const { accountRole } = useAdminRole();
  
  const [exchangeRates, setExchangeRates] = useState<Record<SupportedRechargeCurrency, CreditExchangeRate>>(INITIAL_RATE_MAP);
  const [paymentChannels, setPaymentChannels] = useState<RechargePaymentChannelConfig[]>(FALLBACK_CHANNELS);
  const [currency, setCurrency] = useState<SupportedRechargeCurrency>('CNY');
  const [amount, setAmount] = useState(20);
  const [rechargeType, setRechargeType] = useState<SupportedThemeType>('alipay');
  const [billSnapshot, setBillSnapshot] = useState<RechargeBillSnapshot | null>(null);
  const [transferReferenceLast4, setTransferReferenceLast4] = useState('');
  const [secondsLeft, setSecondsLeft] = useState(0);
  const [creating, setCreating] = useState(false);
  const [markingPaid, setMarkingPaid] = useState(false);
  const [message, setMessage] = useState('');
  const [showAccountDetails, setShowAccountDetails] = useState(false);

  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const currentRate = exchangeRates[currency] || INITIAL_RATE_MAP[currency];
  const minAmount = currentRate.minAmount ?? (currency === 'CNY' ? 5 : 1);
  const maxAmount = currentRate.maxAmount ?? (currency === 'CNY' ? 500 : 100);
  const baseCreditsPreview = Math.max(0, Math.round(amount * currentRate.creditsPerUnit));
  const isExpired = Boolean(billSnapshot?.expiresAt && secondsLeft <= 0 && billSnapshot.status !== 'credited');

  const resolvedIdentity = useMemo(() => {
    // 1. 高级管理员 (Level 1)
    if (adminLevel === 1 || accountRole === 'admin' && (user?.email === '977483863@qq.com' || (user?.user_metadata as any)?.email === '977483863@qq.com')) {
      return {
        label: '高级管理员',
        colorClass: 'text-red-400',
        bgStyle: 'bg-red-500/10 border border-red-500/30 shadow-[0_0_12px_rgba(239,68,68,0.2)]',
        icon: <ShieldAlert size={12} className="text-red-400 shrink-0" />
      };
    }
    // 2. 普通管理员 (Level 2)
    if (adminLevel === 2) {
      return {
        label: '普通管理员',
        colorClass: 'text-emerald-400',
        bgStyle: 'bg-emerald-500/10 border border-emerald-500/30 shadow-[0_0_12px_rgba(16,185,129,0.2)]',
        icon: <Award size={12} className="text-emerald-400 shrink-0" />
      };
    }
    // 3. 临时用户
    if (isTempUser) {
      return {
        label: '临时用户',
        colorClass: 'text-amber-400',
        bgStyle: 'bg-amber-500/10 border border-amber-500/20',
        icon: <UserIcon size={12} className="text-amber-400 shrink-0" />
      };
    }
    // 4. 会员用户 - 积分 >= 5000
    if (balance >= 5000) {
      return {
        label: '会员用户',
        colorClass: 'text-yellow-400',
        bgStyle: 'bg-gradient-to-r from-amber-500/20 via-yellow-500/20 to-orange-500/20 border border-amber-500/30 shadow-[0_0_12px_rgba(245,158,11,0.25)] animate-pulse',
        icon: <Crown size={12} className="text-amber-400 shrink-0" />
      };
    }
    // 5. 高级用户 - 积分 >= 1000
    if (balance >= 1000) {
      return {
        label: '高级用户',
        colorClass: 'text-violet-400',
        bgStyle: 'bg-violet-500/10 border border-violet-500/30 shadow-[0_0_12px_rgba(139,92,246,0.2)]',
        icon: <Sparkles size={12} className="text-violet-400 shrink-0" />
      };
    }
    // 6. 普通用户
    return {
      label: '普通用户',
      colorClass: 'text-gray-300',
      bgStyle: 'bg-white/5 border border-white/10',
      icon: <UserIcon size={12} className="text-gray-300 shrink-0" />
    };
  }, [adminLevel, accountRole, user, balance, isTempUser]);

  const activeTheme = useMemo(() => {
    switch (rechargeType) {
      case 'alipay':
        return {
          color: '#1677ff',
          colorRgb: '22, 119, 255',
          shadowStyle: '0 0 32px rgba(22, 119, 255, 0.15), var(--frost-card-framework-shadow), 0 20px 50px rgba(0,0,0,0.3)',
          borderColor: 'rgba(22, 119, 255, 0.25)',
        };
      case 'wechat':
        return {
          color: '#22c55e',
          colorRgb: '34, 197, 94',
          shadowStyle: '0 0 32px rgba(34, 197, 94, 0.15), var(--frost-card-framework-shadow), 0 20px 50px rgba(0,0,0,0.3)',
          borderColor: 'rgba(34, 197, 94, 0.25)',
        };
      case 'international':
        return {
          color: '#635bff',
          colorRgb: '99, 91, 255',
          shadowStyle: '0 0 32px rgba(99, 91, 255, 0.15), var(--frost-card-framework-shadow), 0 20px 50px rgba(0,0,0,0.3)',
          borderColor: 'rgba(99, 91, 255, 0.25)',
        };
      default:
        return {
          color: '#ff98a2',
          colorRgb: '255, 152, 162',
          shadowStyle: '0 0 32px rgba(244, 63, 94, 0.15), var(--frost-card-framework-shadow), 0 20px 50px rgba(0,0,0,0.3)',
          borderColor: 'rgba(244, 63, 94, 0.25)',
        };
    }
  }, [rechargeType]);

  const activeProvider = billSnapshot?.manualProvider || (rechargeType === 'wechat' ? 'wechat' : 'alipay');
  const activeChannelConfig = useMemo(
    () => paymentChannels.find((channel) => channel.channel === activeProvider)
      || FALLBACK_CHANNELS.find((channel) => channel.channel === activeProvider)
      || FALLBACK_CHANNELS[0],
    [activeProvider, paymentChannels],
  );

  useEffect(() => {
    if (!showRechargeModal) {
      return undefined;
    }

    let alive = true;
    void getCreditExchangeRateMap().then((rates) => {
      if (alive) {
        setExchangeRates(rates);
      }
    });
    void listRechargePaymentChannels({ requestId: `recharge-payment-channels-${Date.now()}` }).then((response) => {
      if (alive && response.success && response.data.items.length > 0) {
        setPaymentChannels(response.data.items as RechargePaymentChannelConfig[]);
      }
    });

    return () => {
      alive = false;
    };
  }, [showRechargeModal]);

  useEffect(() => {
    if (!billSnapshot?.expiresAt) {
      setSecondsLeft(0);
      return undefined;
    }

    const update = () => setSecondsLeft(getSecondsLeft(billSnapshot.expiresAt));
    update();
    const timer = window.setInterval(update, 1000);
    return () => window.clearInterval(timer);
  }, [billSnapshot?.expiresAt]);

  useEffect(() => {
    if (!showRechargeModal) {
      setCurrency('CNY');
      setAmount(20);
      setRechargeType('alipay');
      setBillSnapshot(null);
      setTransferReferenceLast4('');
      setMessage('');
      setCreating(false);
      setMarkingPaid(false);
    }
  }, [showRechargeModal]);

  if (!showRechargeModal) {
    return null;
  }

  const clampAmount = (value: number) => {
    if (!Number.isFinite(value)) {
      return minAmount;
    }
    return Math.max(minAmount, Math.min(maxAmount, Number(value.toFixed(2))));
  };

  const handleCreateOrder = async () => {
    if (!user?.id) {
      notify.error('请先登录', '登录后才能创建充值订单。');
      return;
    }

    if (rechargeType === 'international') {
      const text = '国际支付通道暂未配置，请使用支付宝或微信扫码。';
      setMessage(text);
      notify.warning('通道未配置', text);
      return;
    }

    if (rechargeType === 'manual') {
      const text = '人工充值客服通道当前暂未配置自动对账，请联系管理员微信。';
      setMessage(text);
      notify.info('联系客服', text);
      return;
    }

    setCreating(true);
    setMessage('');
    try {
      const response = await createRechargeBill(
        {
          amount,
          currencyCode: currency,
          paymentChannel: 'manual',
          manualProvider: rechargeType, 
        },
        { requestId: buildRechargeSubmissionRequestId(user.id, 'bill') },
      );

      if (!response.success) {
        throw new Error(getRechargeSubmissionErrorMessage(response, '创建人工充值订单失败，请稍后重试。'));
      }

      const snapshot = normalizeRechargeBillSnapshot(response.data, {
        amount,
        currencyCode: currency,
        paymentChannel: 'manual',
        manualProvider: rechargeType,
        baseCredits: baseCreditsPreview,
        estimatedCredits: baseCreditsPreview,
        status: 'paying',
      });
      setBillSnapshot(snapshot);
      setSecondsLeft(getSecondsLeft(snapshot.expiresAt));
      setMessage('订单已创建，请按实付金额扫码付款。');
      notify.success('订单已创建', '人工充值较慢，请等待 1-5 分钟。');
    } catch (error) {
      const text = localizeUserFacingText(error instanceof Error ? error.message : '')
        || '创建人工充值订单失败，请稍后重试。';
      setMessage(text);
      notify.error('创建失败', text);
    } finally {
      setCreating(false);
    }
  };

  const handleMarkPaid = async () => {
    if (!billSnapshot?.submissionId || isExpired) {
      return;
    }

    setMarkingPaid(true);
    try {
      const normalizedReference = transferReferenceLast4.trim().toUpperCase();
      if (!/^[0-9A-Z]{4}$/.test(normalizedReference)) {
        throw new Error('请填写转账流水后四位。');
      }

      const paidResponse = await markRechargeSubmissionPaid(
        billSnapshot.submissionId,
        { requestId: buildRechargeSubmissionRequestId(user?.id || 'anonymous', 'proof') },
      );
      if (!paidResponse.success) {
        throw new Error(getRechargeSubmissionErrorMessage(paidResponse, '标记已支付失败，请联系客服处理。'));
      }

      const nextBill = normalizeRechargeBillSnapshot({ submission: paidResponse.data.submission }, {
        ...billSnapshot,
        transferReferenceLast4: normalizedReference,
      });
      setBillSnapshot(nextBill);
      setMessage('已通知管理员，请等待处理。支付成功但积分未到账，请联系客服处理。');
      notify.success('已通知管理员', '管理员处理后积分会自动到账。');
      await refreshBilling({ includeTransactions: true });
    } catch (error) {
      const text = localizeUserFacingText(error instanceof Error ? error.message : '')
        || '标记已支付失败，请联系客服处理。';
      setMessage(text);
      notify.error('提交失败', text);
    } finally {
      setMarkingPaid(false);
    }
  };

  const payableAmount = billSnapshot?.payableAmount ?? billSnapshot?.amount ?? amount;
  const creditAmount = billSnapshot?.creditAmount ?? billSnapshot?.estimatedCredits ?? baseCreditsPreview;
  const providerTitle = activeProvider === 'wechat' ? '微信' : '支付宝';
  const providerIcon = activeProvider === 'wechat' ? wechatIcon : alipayIcon;

  const avatarSrc = resolveAvatarUrl(user?.user_metadata?.avatar_url);
  const isShadowWechatEmail = Boolean(user?.email?.endsWith('@users.kkstudio.local'));
  const displayEmail = isShadowWechatEmail ? '微信授权用户' : user?.email || '未绑定邮箱';
  const nickname =
    user?.user_metadata?.full_name ||
    user?.user_metadata?.display_name ||
    (isShadowWechatEmail ? '微信用户' : user?.email?.split('@')[0]) ||
    '未命名用户';

  const modalTitle = (
    <div className="flex items-center gap-3">
      <span
        className="h-2.5 w-2.5 rounded-full animate-pulse shrink-0"
        style={{
          backgroundColor: activeTheme.color,
          boxShadow: `0 0 12px ${activeTheme.color}`,
          transition: 'background-color 0.5s ease, box-shadow 0.5s ease',
        }}
      />
      <div>
        <h2 className="text-base font-semibold" style={{ color: 'var(--text-primary)' }}>
          充值积分
        </h2>
      </div>
    </div>
  );

  return (
    <RechargeModalWrapper
      isOpen={showRechargeModal}
      onClose={() => setShowRechargeModal(false)}
      title={modalTitle}
      isMobile={isMobile}
    >
      <div
        className={`kk-user-profile-modal__body ${
          isMobile ? 'mobile-sheet-scroll flex-1 px-3 py-3' : 'max-h-[78vh] overflow-y-auto px-4 py-4'
        }`}
      >
        <div className={`grid grid-cols-1 ${isMobile ? 'gap-4' : 'md:grid-cols-2 gap-6'} items-stretch`}>
            
            <div className="flex flex-col gap-4">
              
              {/* 账户资产折叠面板，默认收起以纯净首屏，仅在需要时点击展开 */}
              <div className="space-y-2">
                <div
                  onClick={() => setShowAccountDetails(!showAccountDetails)}
                  className="flex items-center justify-between p-3.5 rounded-xl border cursor-pointer hover:bg-white/5 transition-all select-none"
                  style={{
                    borderColor: 'var(--frost-card-main-border)',
                    background: 'color-mix(in srgb, var(--frost-card-sub-bg) 15%, transparent)',
                  }}
                >
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold" style={{ color: 'var(--text-secondary)' }}>账户与资产信息</span>
                  </div>
                  <div className="flex items-center gap-2 text-xs">
                    <span className="text-[var(--text-tertiary)]">当前余额:</span>
                    <span className="font-bold text-amber-300 flex items-center gap-1">
                      <Coins size={12} className="text-amber-400 shrink-0" />
                      <span>{balance} 积分</span>
                    </span>
                    <ChevronLeft
                      size={14}
                      className="text-[var(--text-tertiary)] transition-transform duration-200"
                      style={{
                        transform: showAccountDetails ? 'rotate(-90deg)' : 'rotate(0deg)',
                      }}
                    />
                  </div>
                </div>

                {showAccountDetails && (
                  <div
                    className="kk-user-profile-modal__main-card rounded-xl border p-4.5 flex flex-col gap-3 animate-in slide-in-from-top-2 duration-200"
                    style={{
                      borderColor: 'var(--frost-card-main-border)',
                      background: 'color-mix(in srgb, var(--frost-card-sub-bg) 25%, transparent)',
                    }}
                  >
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 overflow-hidden rounded-full bg-gradient-to-br from-[var(--clay-brand-coral)] via-[var(--clay-brand-pink)] to-[var(--clay-brand-peach)] text-white shrink-0 shadow-md">
                        {avatarSrc ? (
                          <img src={avatarSrc} alt="头像" className="h-full w-full object-cover" />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center text-sm font-bold">
                            {nickname.slice(0, 1).toUpperCase()}
                          </div>
                        )}
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="truncate text-xs font-semibold" style={{ color: 'var(--text-primary)' }}>
                            {nickname}
                          </span>
                          <span
                            className={`inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[8px] font-semibold leading-none ${resolvedIdentity.bgStyle} ${resolvedIdentity.colorClass}`}
                          >
                            {resolvedIdentity.icon}
                            {resolvedIdentity.label}
                          </span>
                        </div>
                        <div className="mt-1 truncate text-[10px] text-[var(--text-tertiary)]">
                          ID: {user?.id || '-'}
                        </div>
                        <div className="mt-0.5 truncate text-[10px] text-[var(--text-tertiary)]">
                          邮箱: {displayEmail}
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              <div className="space-y-2 flex-1 flex flex-col">
                <div className="text-[11px] font-bold tracking-wider text-[var(--text-tertiary)] uppercase px-0.5">
                  选择支付通道
                </div>
                <div className="grid grid-cols-2 gap-3 flex-1">
                  <button
                    type="button"
                    onClick={() => {
                      if (billSnapshot) return;
                      setRechargeType('alipay');
                    }}
                    disabled={Boolean(billSnapshot)}
                    className="rounded-xl border p-3.5 text-left flex flex-col justify-between h-full min-h-[102px] disabled:cursor-not-allowed disabled:opacity-60 relative overflow-hidden group hover:scale-[1.01] hover:border-blue-500/40"
                    style={{
                      ...modalSelectableStyle(rechargeType === 'alipay'),
                      transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)'
                    }}
                  >
                    <div className="flex items-center gap-2">
                      <img src={alipayIcon} alt="支付宝" className="h-5.5 w-5.5 object-contain shrink-0" />
                      <span className="text-xs font-bold text-[var(--text-primary)]">支付宝</span>
                    </div>
                    <div className="text-[10px] text-[var(--text-tertiary)] mt-3">
                      {billSnapshot ? '订单锁定中' : '静态扫码对账'}
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      if (billSnapshot) return;
                      setRechargeType('wechat');
                    }}
                    disabled={Boolean(billSnapshot)}
                    className="rounded-xl border p-3.5 text-left flex flex-col justify-between h-full min-h-[102px] disabled:cursor-not-allowed disabled:opacity-60 relative overflow-hidden group hover:scale-[1.01] hover:border-green-500/40"
                    style={{
                      ...modalSelectableStyle(rechargeType === 'wechat'),
                      transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)'
                    }}
                  >
                    <div className="flex items-center gap-2">
                      <img src={wechatIcon} alt="微信" className="h-5.5 w-5.5 object-contain shrink-0" />
                      <span className="text-xs font-bold text-[var(--text-primary)]">微信支付</span>
                    </div>
                    <div className="text-[10px] text-[var(--text-tertiary)] mt-3">
                      {billSnapshot ? '订单锁定中' : '微信静态码对账'}
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      if (billSnapshot) return;
                      setRechargeType('international');
                      const text = '国际支付通道暂未配置，请使用支付宝或微信扫码。';
                      setMessage(text);
                      notify.warning('通道未配置', text);
                    }}
                    disabled={Boolean(billSnapshot)}
                    className="rounded-xl border p-3.5 text-left flex flex-col justify-between h-full min-h-[102px] disabled:cursor-not-allowed disabled:opacity-60 relative overflow-hidden group hover:scale-[1.01] hover:border-yellow-500/40"
                    style={{
                      ...modalSelectableStyle(rechargeType === 'international'),
                      transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)'
                    }}
                  >
                    <div className="flex items-center gap-2">
                      <img src={cardIcon} alt="国际卡" className="h-5.5 w-5.5 object-contain shrink-0" />
                      <span className="text-xs font-bold text-[var(--text-primary)]">国际卡/Stripe</span>
                    </div>
                    <div className="text-[10px] text-[var(--text-tertiary)] mt-3">通道暂未配置</div>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      if (billSnapshot) return;
                      setRechargeType('manual');
                      const text = '人工充值客服通道当前暂未配置自动对账，请联系管理员微信。';
                      setMessage(text);
                      notify.info('联系客服', text);
                    }}
                    disabled={Boolean(billSnapshot)}
                    className="rounded-xl border p-3.5 text-left flex flex-col justify-between h-full min-h-[102px] disabled:cursor-not-allowed disabled:opacity-60 relative overflow-hidden group hover:scale-[1.01] hover:border-pink-500/40"
                    style={{
                      ...modalSelectableStyle(rechargeType === 'manual'),
                      transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)'
                    }}
                  >
                    <div className="flex items-center gap-2">
                      <span className="flex h-5.5 w-5.5 items-center justify-center rounded-lg bg-pink-500/10 text-pink-400 font-extrabold text-[9px] shrink-0">客服</span>
                      <span className="text-xs font-bold text-[var(--text-primary)]">人工客服</span>
                    </div>
                    <div className="text-[10px] text-[var(--text-tertiary)] mt-3">联系管理员充值</div>
                  </button>
                </div>
              </div>
            </div>

            <div
              className="kk-user-profile-modal__main-card rounded-xl border p-4 flex flex-col justify-between min-h-[350px] transition-all duration-300"
              style={{
                borderColor: 'var(--frost-card-main-border)',
                background: 'color-mix(in srgb, var(--frost-card-main-bg) 40%, transparent)',
              }}
            >
              {!billSnapshot ? (
                <div className="flex flex-col gap-4 justify-between h-full">
                  <div className="space-y-4">
                    <div className="text-xs font-semibold text-[var(--text-primary)] flex items-center gap-2 border-b border-white/5 pb-2">
                      <span className="flex h-4 w-4 items-center justify-center rounded-full bg-amber-500/10 text-amber-400 font-bold text-[9px] shrink-0">
                        1
                      </span>
                      <span>第一步：选择币种与输入金额</span>
                    </div>

                    <div className="flex gap-2">
                      {(['CNY', 'USD'] as SupportedRechargeCurrency[]).map((item) => (
                        <button
                          key={item}
                          type="button"
                          onClick={() => setCurrency(item)}
                          className="rounded-lg border px-3 py-1 text-xs font-semibold transition"
                          style={modalSelectableStyle(currency === item)}
                        >
                          {item}
                        </button>
                      ))}
                    </div>

                    <div className="space-y-2.5">
                      <div className="flex items-center justify-between text-xs text-[var(--text-secondary)] px-0.5">
                        <span>输入/拖动充值金额</span>
                        <span className="font-bold text-sm text-[var(--text-primary)]">
                          {currency === 'CNY' ? '¥' : '$'}{amount}
                        </span>
                      </div>
                      
                      <div className="grid gap-3 grid-cols-[1fr_80px] items-center">
                        <input
                          type="range"
                          min={minAmount}
                          max={maxAmount}
                          step={currency === 'CNY' ? 5 : 1}
                          value={amount}
                          onChange={(event) => setAmount(clampAmount(Number(event.target.value)))}
                          className="w-full h-1 rounded-lg appearance-none cursor-pointer bg-slate-700 transition-all duration-300"
                          style={{
                            accentColor: activeTheme.color,
                          }}
                        />
                        <input
                          type="number"
                          min={minAmount}
                          max={maxAmount}
                          value={amount}
                          onChange={(event) => setAmount(clampAmount(Number(event.target.value)))}
                          className="w-full rounded-lg border px-2 py-1.5 text-xs text-center outline-none transition focus:border-amber-500/30"
                          style={modalInputStyle}
                        />
                      </div>
                    </div>

                    <div
                      className="rounded-xl border p-3 flex items-center justify-between"
                      style={{
                        borderColor: `rgba(${activeTheme.colorRgb}, 0.15)`,
                        background: `rgba(${activeTheme.colorRgb}, 0.03)`,
                        transition: 'border-color 0.5s ease, background-color 0.5s ease',
                      }}
                    >
                      <div className="space-y-0.5">
                        <div className="text-[10px] text-[var(--text-secondary)] font-medium">预计到账积分</div>
                        <div className="text-[9px] text-[var(--text-tertiary)] flex items-center gap-1">
                          <Info size={10} style={{ color: activeTheme.color, transition: 'color 0.5s ease' }} />
                          <span>1 CNY = 5 积分 | 满赠专享通道</span>
                        </div>
                      </div>
                      <div
                        className="text-lg font-extrabold flex items-center gap-1.5"
                        style={{
                          color: activeTheme.color,
                          transition: 'color 0.5s ease'
                        }}
                      >
                        <span>{baseCreditsPreview}</span>
                        <span className="text-xs font-medium opacity-80">积分</span>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-3">
                    {message && (
                      <div className="flex items-start gap-2 rounded-lg border p-2 text-[10px] leading-relaxed" style={modalWarningStyle}>
                        <AlertCircle size={14} className="mt-0.5 shrink-0" />
                        <span>{message}</span>
                      </div>
                    )}

                    <button
                      type="button"
                      onClick={handleCreateOrder}
                      disabled={creating || rechargeType === 'international' || rechargeType === 'manual'}
                      className="flex h-10 w-full items-center justify-center gap-2 rounded-xl px-4 text-xs font-bold transition hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-60 overflow-hidden relative shadow-lg text-white"
                      style={{
                        backgroundColor: activeTheme.color,
                        backgroundImage: 'linear-gradient(135deg, rgba(255,255,255,0.15) 0%, rgba(0,0,0,0.2) 100%)',
                        boxShadow: `0 4px 14px rgba(${activeTheme.colorRgb}, 0.25)`,
                        border: '1px solid rgba(255,255,255,0.08)',
                        transition: 'background-color 0.5s cubic-bezier(0.4, 0, 0.2, 1), box-shadow 0.5s cubic-bezier(0.4, 0, 0.2, 1)'
                      }}
                    >
                      {creating ? (
                        <>
                          <Loader2 size={14} className="animate-spin" />
                          <span>正在创建充值订单...</span>
                        </>
                      ) : (
                        <>
                          <CheckCircle2 size={14} />
                          <span>创建充值订单</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col gap-3.5 justify-between h-full">
                  <div className="flex items-center justify-between border-b pb-2 border-white/5">
                    <div className="flex items-center gap-2 min-w-0">
                      <img src={providerIcon} alt={providerTitle} className="h-5 w-5 object-contain shrink-0" />
                      <div className="min-w-0">
                        <div className="text-xs font-bold text-[var(--text-primary)]">{providerTitle}扫码支付</div>
                        <div className="text-[9px] text-[var(--text-tertiary)] truncate max-w-[120px]">
                          订单: {billSnapshot.submissionId}
                        </div>
                      </div>
                    </div>
                    <div
                      className="flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] bg-white/5 border-white/10"
                      style={{ color: 'var(--text-secondary)' }}
                    >
                      <Clock3 size={11} className="text-amber-400 shrink-0" />
                      <span className="font-semibold">{isExpired ? '超时已失效' : formatCountdown(secondsLeft)}</span>
                    </div>
                  </div>

                  <div className="flex flex-col gap-3.5">
                    <div className="flex justify-center">
                      <div
                        className="h-28 w-28 shrink-0 flex items-center justify-center rounded-xl bg-white p-1.5 shadow-md border"
                        style={{ borderColor: 'var(--frost-card-framework-border)' }}
                      >
                        {activeChannelConfig.qrImageDataUrl ? (
                          <img
                            src={activeChannelConfig.qrImageDataUrl}
                            alt={`${providerTitle}收款码`}
                            className="h-full w-full object-contain"
                          />
                        ) : (
                          <div className="flex h-full w-full flex-col items-center justify-center text-center text-slate-400">
                            <QrCode size={24} className="text-slate-500 shrink-0" />
                            <span className="text-[9px] mt-1 text-slate-500 font-medium">未配置收款码</span>
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="space-y-2">
                      <div className="grid grid-cols-2 gap-2 text-xs">
                        <div
                          className="rounded-lg border p-2 flex flex-col gap-0.5"
                          style={{
                            borderColor: 'var(--frost-card-sub-border)',
                            background: 'var(--frost-card-sub-bg)',
                          }}
                        >
                          <span className="text-[9px] text-[var(--text-tertiary)] font-medium">实付金额</span>
                          <span className="font-bold text-[var(--text-primary)]">
                            {formatMoney(payableAmount, currency)}
                          </span>
                        </div>
                        <div
                          className="rounded-lg border p-2 flex flex-col gap-0.5"
                          style={{
                            borderColor: 'var(--frost-card-sub-border)',
                            background: 'var(--frost-card-sub-bg)',
                          }}
                        >
                          <span className="text-[9px] text-[var(--text-tertiary)] font-medium">预计到账</span>
                          <span className="font-bold text-amber-400">{creditAmount} 积分</span>
                        </div>
                      </div>

                      <label className="block">
                        <span className="text-[10px] text-[var(--text-secondary)] font-medium flex items-center gap-1 mb-1 px-0.5">
                          <span>流水号后 4 位:</span>
                          {transferReferenceLast4.trim().length === 4 && (
                            <CheckCircle2 size={11} className="text-emerald-400 shrink-0" />
                          )}
                        </span>
                        <input
                          value={transferReferenceLast4}
                          onChange={(event) =>
                            setTransferReferenceLast4(
                              event.target.value.toUpperCase().replace(/[^0-9A-Z]/g, '').slice(-4),
                            )
                          }
                          placeholder="请输入转账流水后 4 位字符进行校验"
                          className="w-full rounded-lg border px-2.5 py-1.5 text-xs outline-none transition focus:border-amber-500/30"
                          style={modalInputStyle}
                        />
                      </label>
                    </div>
                  </div>

                  <div className="space-y-2">
                    {message && (
                      <div className="flex items-start gap-1.5 rounded-lg border p-1.5 text-[9px] leading-relaxed" style={modalWarningStyle}>
                        <AlertCircle size={12} className="mt-0.5 shrink-0" />
                        <span className="whitespace-normal">{message}</span>
                      </div>
                    )}

                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => setBillSnapshot(null)}
                        className="flex-1 h-9 rounded-xl border text-xs font-semibold transition hover:bg-white/5"
                        style={{
                          borderColor: 'var(--frost-card-sub-border)',
                          color: 'var(--text-secondary)',
                        }}
                      >
                        返回选额
                      </button>

                      <button
                        type="button"
                        onClick={handleMarkPaid}
                        disabled={markingPaid || isExpired || transferReferenceLast4.trim().length !== 4}
                        className="flex h-9 items-center justify-center gap-1.5 rounded-xl px-4 text-xs font-bold transition hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-60 relative overflow-hidden text-white"
                        style={{
                          background: `linear-gradient(135deg, ${activeTheme.color} 0%, color-mix(in srgb, ${activeTheme.color} 80%, black) 100%)`,
                          boxShadow: `0 4px 12px ${activeTheme.color}33`,
                          flex: '2 2 0%',
                        }}
                      >
                        {markingPaid ? (
                          <>
                            <Loader2 size={12} className="animate-spin" />
                            <span>提报中...</span>
                          </>
                        ) : (
                          <>
                            <CheckCircle2 size={12} />
                            <span>我已支付</span>
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </RechargeModalWrapper>
  );
};

interface RechargeModalWrapperProps {
  isOpen: boolean;
  onClose: () => void;
  title: React.ReactNode;
  isMobile: boolean;
  children: React.ReactNode;
}

const RechargeModalWrapper: React.FC<RechargeModalWrapperProps> = ({
  isOpen,
  onClose,
  title,
  isMobile,
  children
}) => {
  if (!isOpen) return null;
  
  if (isMobile) {
    return (
      <div 
        className="kk-canvas-modal-backdrop fixed inset-0 flex items-center justify-center p-4 animate-in fade-in duration-200"
        style={{ zIndex: KK_LAYER.modalBackdrop }}
        onClick={onClose}
        onTouchStart={(e) => e.stopPropagation()}
        onTouchEnd={(e) => e.stopPropagation()}
      >
        <div 
          className="kk-canvas-modal-panel w-full max-w-[480px] max-h-[calc(100dvh-32px)] flex flex-col rounded-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200"
          onClick={(e) => e.stopPropagation()}
          onTouchStart={(e) => e.stopPropagation()}
          onTouchEnd={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3.5 border-b border-white/5 shrink-0">
            {title}
            <button 
              onClick={onClose}
              className="text-[var(--text-tertiary)] hover:text-[var(--text-primary)] transition-colors p-1 rounded-lg hover:bg-white/5"
            >
              <X size={18} />
            </button>
          </div>
          {children}
        </div>
      </div>
    );
  }
  
  return (
    <KkModal
      open={isOpen}
      onCancel={onClose}
      title={title}
      footer={null}
      width={860}
      destroyOnClose
      centered
      style={{
        background: 'color-mix(in srgb, var(--frost-card-framework-bg) 72%, transparent)',
      }}
    >
      {children}
    </KkModal>
  );
};

export default RechargeModal;
