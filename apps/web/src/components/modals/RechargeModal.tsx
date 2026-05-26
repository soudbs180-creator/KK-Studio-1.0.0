import React, { useEffect, useMemo, useState } from 'react';
import { AlertCircle, CheckCircle2, Clock3, Loader2, QrCode, X } from 'lucide-react';

import alipayIcon from '../../assets/payment/alipay.png';
import cardIcon from '../../assets/payment/card.png';
import wechatIcon from '../../assets/payment/wechat.png';
import { useAuth } from '../../context/AuthContext';
import { useBilling } from '../../context/BillingContext';
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

type ReservedChannel = 'dynamic-alipay' | 'dynamic-wechat' | 'international' | 'manual';
type ManualProvider = 'alipay' | 'wechat';

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

const RESERVED_CHANNELS: Array<{ id: ReservedChannel; title: string; caption: string }> = [
  { id: 'dynamic-alipay', title: '支付宝动态码', caption: '商户动态码预留' },
  { id: 'dynamic-wechat', title: '微信动态码', caption: '商户动态码预留' },
  { id: 'international', title: '国际支付', caption: '海外付款预留' },
  { id: 'manual', title: '人工充值', caption: '当前可用渠道' },
];

const MANUAL_PROVIDERS: Array<{ id: ManualProvider; title: string; icon: string }> = [
  { id: 'alipay', title: '支付宝', icon: alipayIcon },
  { id: 'wechat', title: '微信', icon: wechatIcon },
];

const modalShellStyle: React.CSSProperties = {
  background: 'var(--frost-card-framework-bg)',
  borderColor: 'var(--frost-card-framework-border)',
  color: 'var(--text-primary)',
  boxShadow: 'var(--frost-card-framework-shadow)',
  WebkitBackdropFilter: 'blur(var(--frost-card-framework-blur)) saturate(160%)',
  backdropFilter: 'blur(var(--frost-card-framework-blur)) saturate(160%)',
};

const modalPanelStyle: React.CSSProperties = {
  background: 'var(--frost-card-main-bg)',
  borderColor: 'var(--frost-card-main-border)',
  color: 'var(--text-primary)',
  boxShadow: 'var(--frost-card-main-shadow)',
  WebkitBackdropFilter: 'blur(var(--frost-card-main-blur)) saturate(160%)',
  backdropFilter: 'blur(var(--frost-card-main-blur)) saturate(160%)',
};

const modalSubPanelStyle: React.CSSProperties = {
  background: 'var(--frost-card-sub-bg)',
  borderColor: 'var(--frost-card-sub-border)',
  color: 'var(--text-primary)',
  boxShadow: 'var(--frost-card-sub-shadow)',
  WebkitBackdropFilter: 'blur(var(--frost-card-sub-blur)) saturate(150%)',
  backdropFilter: 'blur(var(--frost-card-sub-blur)) saturate(150%)',
};

const modalSelectableStyle = (selected: boolean): React.CSSProperties => ({
  background: selected ? 'var(--frost-card-main-bg)' : 'var(--frost-card-sub-bg)',
  borderColor: selected ? 'var(--settings-focus-border)' : 'var(--frost-card-sub-border)',
  color: 'var(--text-primary)',
});

const modalInputStyle: React.CSSProperties = {
  background: 'var(--frost-card-sub-bg)',
  borderColor: 'var(--frost-card-sub-border)',
  color: 'var(--text-primary)',
};

const modalPillStyle: React.CSSProperties = {
  background: 'var(--frost-card-sub-bg)',
  borderColor: 'var(--frost-card-sub-border)',
  color: 'var(--text-secondary)',
};

const modalPrimaryButtonStyle: React.CSSProperties = {
  background: 'var(--clay-brand-peach)',
  border: '1px solid rgb(10 10 10 / 0.12)',
  color: 'var(--clay-ink)',
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
  const { showRechargeModal, setShowRechargeModal, refreshBilling } = useBilling();
  const { user } = useAuth();
  const [exchangeRates, setExchangeRates] = useState<Record<SupportedRechargeCurrency, CreditExchangeRate>>(INITIAL_RATE_MAP);
  const [paymentChannels, setPaymentChannels] = useState<RechargePaymentChannelConfig[]>(FALLBACK_CHANNELS);
  const [currency, setCurrency] = useState<SupportedRechargeCurrency>('CNY');
  const [amount, setAmount] = useState(20);
  const [rechargeType, setRechargeType] = useState<'alipay' | 'wechat' | 'international' | 'manual'>('alipay');
  const [billSnapshot, setBillSnapshot] = useState<RechargeBillSnapshot | null>(null);
  const [transferReferenceLast4, setTransferReferenceLast4] = useState('');
  const [secondsLeft, setSecondsLeft] = useState(0);
  const [creating, setCreating] = useState(false);
  const [markingPaid, setMarkingPaid] = useState(false);
  const [message, setMessage] = useState('');

  const currentRate = exchangeRates[currency] || INITIAL_RATE_MAP[currency];
  const minAmount = currentRate.minAmount ?? (currency === 'CNY' ? 5 : 1);
  const maxAmount = currentRate.maxAmount ?? (currency === 'CNY' ? 500 : 100);
  const baseCreditsPreview = Math.max(0, Math.round(amount * currentRate.creditsPerUnit));
  const isExpired = Boolean(billSnapshot?.expiresAt && secondsLeft <= 0 && billSnapshot.status !== 'credited');

  // 氛围灯与高光颜色动态绑定：支付宝(alipay)->蓝，微信(wechat)->绿，国际支付(international)->金，人工客服(manual)->系统主题色
  const glowStyles = useMemo(() => {
    switch (rechargeType) {
      case 'alipay':
        return {
          glowColor: '#1677ff',
          shadowStyle: '0 0 32px rgba(22, 119, 255, 0.3), 0 28px 80px rgba(2, 7, 18, 0.45)',
          borderColor: 'rgba(22, 119, 255, 0.4)',
        };
      case 'wechat':
        return {
          glowColor: '#22c55e',
          shadowStyle: '0 0 32px rgba(34, 197, 94, 0.3), 0 28px 80px rgba(2, 7, 18, 0.45)',
          borderColor: 'rgba(34, 197, 94, 0.4)',
        };
      case 'international':
        return {
          glowColor: '#eab308',
          shadowStyle: '0 0 32px rgba(234, 179, 8, 0.3), 0 28px 80px rgba(2, 7, 18, 0.45)',
          borderColor: 'rgba(234, 179, 8, 0.4)',
        };
      default:
        return {
          glowColor: 'var(--clay-brand-peach)',
          shadowStyle: 'var(--frost-card-framework-shadow)',
          borderColor: 'var(--frost-card-framework-border)',
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
          manualProvider: rechargeType, // 简体中文：直接绑定支付宝或微信人工静态收款码
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

  const baseAmount = billSnapshot?.baseAmount ?? billSnapshot?.amount ?? amount;
  const serviceFee = billSnapshot?.serviceFee ?? 0;
  const payableAmount = billSnapshot?.payableAmount ?? billSnapshot?.amount ?? amount;
  const baseCredits = billSnapshot?.baseCredits ?? baseCreditsPreview;
  const bonusCredits = billSnapshot?.bonusCredits ?? 0;
  const creditAmount = billSnapshot?.creditAmount ?? billSnapshot?.estimatedCredits ?? baseCreditsPreview;
  const providerTitle = activeProvider === 'wechat' ? '微信' : '支付宝';
  const providerIcon = activeProvider === 'wechat' ? wechatIcon : alipayIcon;

  return (
    <div className="fixed inset-0 z-[220] flex items-center justify-center p-4 backdrop-blur-sm" style={{ backgroundColor: 'var(--settings-backdrop)' }}>
      <div 
        className="max-h-[92vh] w-full max-w-4xl overflow-y-auto rounded-2xl border transition-all duration-300" 
        style={{
          ...modalShellStyle,
          borderColor: glowStyles.borderColor,
          boxShadow: glowStyles.shadowStyle,
        }}
      >
        <div className="flex items-center justify-between border-b px-5 py-4" style={{ borderColor: 'var(--frost-card-framework-border)' }}>
          <div className="flex items-center gap-3">
            {/* 简体中文注释：动态高光呼吸灯，指示当前选中充值通道的色调 */}
            <span 
              className="h-3 w-3 rounded-full animate-pulse transition-all duration-300"
              style={{
                backgroundColor: glowStyles.glowColor,
                boxShadow: `0 0 12px ${glowStyles.glowColor}`,
              }}
            />
            <div>
              <h2 className="text-xl font-semibold text-[var(--text-primary)]">充值积分</h2>
              <p className="mt-0.5 text-xs text-[var(--text-secondary)]">人工充值较慢，请等待 1-5 分钟</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setShowRechargeModal(false)}
            className="rounded-lg p-2 text-[var(--text-secondary)] transition hover:bg-[var(--frost-card-sub-bg)] hover:text-[var(--text-primary)]"
            aria-label="关闭充值弹窗"
          >
            <X size={18} />
          </button>
        </div>

        {/* 2*4 网格布局，左侧 2*2 为充值通道，右侧 2*2 为确认及金额 */}
        <div className="grid gap-4 p-5 grid-cols-1 md:grid-cols-4 grid-rows-none md:grid-rows-2">
          
          {/* 左侧占 2*2 格：4 个充值方式 */}
          <div className="col-span-1 md:col-span-2 row-span-1 md:row-span-2 grid grid-cols-2 grid-rows-2 gap-3">
            {/* 支付宝 */}
            <button
              type="button"
              onClick={() => {
                if (billSnapshot) return;
                setRechargeType('alipay');
              }}
              disabled={Boolean(billSnapshot)}
              className="rounded-xl border p-4 text-left transition flex flex-col justify-between h-full min-h-[110px] disabled:cursor-not-allowed disabled:opacity-60"
              style={modalSelectableStyle(rechargeType === 'alipay')}
            >
              <div className="flex items-center gap-2">
                <img src={alipayIcon} alt="支付宝" className="h-6 w-6 object-contain" />
                <span className="text-sm font-semibold text-[var(--text-primary)]">支付宝</span>
              </div>
              <div className="text-[10px] text-[var(--text-secondary)] mt-2">
                {billSnapshot ? '订单锁定中' : '静态收款码对账'}
              </div>
            </button>

            {/* 微信 */}
            <button
              type="button"
              onClick={() => {
                if (billSnapshot) return;
                setRechargeType('wechat');
              }}
              disabled={Boolean(billSnapshot)}
              className="rounded-xl border p-4 text-left transition flex flex-col justify-between h-full min-h-[110px] disabled:cursor-not-allowed disabled:opacity-60"
              style={modalSelectableStyle(rechargeType === 'wechat')}
            >
              <div className="flex items-center gap-2">
                <img src={wechatIcon} alt="微信" className="h-6 w-6 object-contain" />
                <span className="text-sm font-semibold text-[var(--text-primary)]">微信支付</span>
              </div>
              <div className="text-[10px] text-[var(--text-secondary)] mt-2">
                {billSnapshot ? '订单锁定中' : '微信静态码对账'}
              </div>
            </button>

            {/* 国际支付 */}
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
              className="rounded-xl border p-4 text-left transition flex flex-col justify-between h-full min-h-[110px] disabled:cursor-not-allowed disabled:opacity-60"
              style={modalSelectableStyle(rechargeType === 'international')}
            >
              <div className="flex items-center gap-2">
                <img src={cardIcon} alt="国际卡" className="h-6 w-6 object-contain" />
                <span className="text-sm font-semibold text-[var(--text-primary)]">国际卡/Stripe</span>
              </div>
              <div className="text-[10px] text-[var(--text-secondary)] mt-2">海外通道暂未配置</div>
            </button>

            {/* 人工充值 */}
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
              className="rounded-xl border p-4 text-left transition flex flex-col justify-between h-full min-h-[110px] disabled:cursor-not-allowed disabled:opacity-60"
              style={modalSelectableStyle(rechargeType === 'manual')}
            >
              <div className="flex items-center gap-2">
                <span className="flex h-6 w-6 items-center justify-center rounded bg-slate-500/10 text-slate-300 font-bold text-[10px]">客服</span>
                <span className="text-sm font-semibold text-[var(--text-primary)]">人工客服</span>
              </div>
              <div className="text-[10px] text-[var(--text-secondary)] mt-2">联系管理员手动充值</div>
            </button>
          </div>

          {/* 右侧占 2*2 格：确认充值与金额选择区域 */}
          <div className="col-span-1 md:col-span-2 row-span-1 md:row-span-2 flex flex-col justify-between rounded-xl border p-4 min-h-[236px]" style={modalSubPanelStyle}>
            {!billSnapshot ? (
              // 未创建订单状态：选择金额
              <div className="flex flex-col gap-3 justify-between h-full">
                <div className="space-y-3">
                  <div className="text-xs font-semibold text-[var(--text-primary)]">第一步：选择币种与输入金额</div>
                  <div className="flex gap-2">
                    {(['CNY', 'USD'] as SupportedRechargeCurrency[]).map((item) => (
                      <button
                        key={item}
                        type="button"
                        onClick={() => setCurrency(item)}
                        className="rounded-lg border px-3 py-1.5 text-xs font-medium transition"
                        style={modalSelectableStyle(currency === item)}
                      >
                        {item}
                      </button>
                    ))}
                  </div>
                  
                  <div className="grid gap-3 grid-cols-[1fr_90px] items-center">
                    <input
                      type="range"
                      min={minAmount}
                      max={maxAmount}
                      step={currency === 'CNY' ? 5 : 1}
                      value={amount}
                      onChange={(event) => setAmount(clampAmount(Number(event.target.value)))}
                      className="w-full h-1.5 rounded-lg appearance-none cursor-pointer bg-slate-700"
                      style={{ accentColor: glowStyles.glowColor }}
                    />
                    <input
                      type="number"
                      min={minAmount}
                      max={maxAmount}
                      value={amount}
                      onChange={(event) => setAmount(clampAmount(Number(event.target.value)))}
                      className="w-full rounded-lg border px-2 py-1.5 text-xs text-center outline-none"
                      style={modalInputStyle}
                    />
                  </div>
                  
                  <div className="text-[11px] text-[var(--text-secondary)]">
                    预计基础积分：<span className="font-bold text-amber-300">{baseCreditsPreview}</span>
                  </div>
                </div>

                <div className="space-y-2">
                  {message && (
                    <div className="flex items-start gap-1.5 rounded-lg border p-2 text-[10px]" style={modalWarningStyle}>
                      <AlertCircle size={12} className="mt-0.5 shrink-0" />
                      <span>{message}</span>
                    </div>
                  )}

                  <button
                    type="button"
                    onClick={handleCreateOrder}
                    disabled={creating || rechargeType === 'international' || rechargeType === 'manual'}
                    className="flex h-10 w-full items-center justify-center gap-1.5 rounded-xl px-4 text-xs font-bold transition hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-60"
                    style={{
                      background: glowStyles.glowColor,
                      color: '#ffffff',
                      boxShadow: `0 4px 12px ${glowStyles.glowColor}3f`
                    }}
                  >
                    {creating ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />}
                    创建充值订单
                  </button>
                </div>
              </div>
            ) : (
              // 已创建订单状态：扫码付款与输入流水
              <div className="flex flex-col gap-2 justify-between h-full">
                <div className="flex items-center justify-between border-b pb-2 border-white/5">
                  <div className="flex items-center gap-2">
                    <img src={providerIcon} alt={providerTitle} className="h-6 w-6 object-contain" />
                    <div>
                      <div className="text-xs font-semibold text-[var(--text-primary)]">{providerTitle}付款</div>
                      <div className="text-[9px] text-[var(--text-secondary)]">单号: {billSnapshot.submissionId}</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] bg-white/5 border-white/10" style={{ color: 'var(--text-secondary)' }}>
                    <Clock3 size={11} />
                    {isExpired ? '超时' : formatCountdown(secondsLeft)}
                  </div>
                </div>

                <div className="flex gap-3 items-center py-1">
                  {/* 收款二维码 */}
                  <div className="h-28 w-28 shrink-0 flex items-center justify-center rounded-xl bg-white border border-white/10 p-1.5">
                    {activeChannelConfig.qrImageDataUrl ? (
                      <img
                        src={activeChannelConfig.qrImageDataUrl}
                        alt={`${providerTitle}静态码`}
                        className="h-full w-full object-contain"
                      />
                    ) : (
                      <div className="flex h-full w-full flex-col items-center justify-center text-center text-slate-500">
                        <QrCode size={20} />
                        <span className="text-[8px] mt-1">未配置二维码</span>
                      </div>
                    )}
                  </div>

                  {/* 实付金额与流水 */}
                  <div className="flex-1 space-y-1.5 min-w-0">
                    <div className="text-[10px] text-slate-400">
                      实付金额: <span className="font-bold text-white text-xs">{formatMoney(payableAmount, currency)}</span>
                    </div>
                    <div className="text-[10px] text-slate-400">
                      到账积分: <span className="font-bold text-amber-300 text-xs">{creditAmount}</span>
                    </div>
                    
                    <label className="block mt-1">
                      <span className="text-[9px] text-[var(--text-secondary)] block">流水后 4 位:</span>
                      <input
                        value={transferReferenceLast4}
                        onChange={(event) => setTransferReferenceLast4(
                          event.target.value.toUpperCase().replace(/[^0-9A-Z]/g, '').slice(-4),
                        )}
                        placeholder="流水后四位"
                        className="w-full rounded-lg border px-2 py-1 text-[11px] outline-none mt-0.5"
                        style={modalInputStyle}
                      />
                    </label>
                  </div>
                </div>

                <div className="space-y-1.5">
                  {message && (
                    <div className="flex items-start gap-1 rounded-lg border p-1.5 text-[9px]" style={modalWarningStyle}>
                      <AlertCircle size={10} className="mt-0.5 shrink-0" />
                      <span className="truncate">{message}</span>
                    </div>
                  )}

                  <button
                    type="button"
                    onClick={handleMarkPaid}
                    disabled={markingPaid || isExpired || transferReferenceLast4.trim().length !== 4}
                    className="flex h-9 w-full items-center justify-center gap-1.5 rounded-xl px-4 text-xs font-bold transition hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-60"
                    style={{
                      background: glowStyles.glowColor,
                      color: '#ffffff',
                      boxShadow: `0 4px 12px ${glowStyles.glowColor}3f`
                    }}
                  >
                    {markingPaid ? <Loader2 size={12} className="animate-spin" /> : <CheckCircle2 size={12} />}
                    我已支付
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default RechargeModal;
