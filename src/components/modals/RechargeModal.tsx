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
  const [selectedChannel, setSelectedChannel] = useState<ReservedChannel>('manual');
  const [manualProvider, setManualProvider] = useState<ManualProvider>('alipay');
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
  const activeProvider = billSnapshot?.manualProvider || manualProvider;
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
      setSelectedChannel('manual');
      setManualProvider('alipay');
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

  const showNotConfigured = () => {
    const text = '当前渠道未配置，请使用人工充值或联系客服';
    setMessage(text);
    notify.warning('渠道未配置', text);
  };

  const handleReservedChannelClick = (channel: ReservedChannel) => {
    setSelectedChannel(channel);
    if (channel !== 'manual') {
      showNotConfigured();
    }
  };

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

    setCreating(true);
    setMessage('');
    try {
      const response = await createRechargeBill(
        {
          amount,
          currencyCode: currency,
          paymentChannel: 'manual',
          manualProvider,
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
        manualProvider,
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
      <div className="max-h-[92vh] w-full max-w-4xl overflow-y-auto rounded-2xl border" style={modalShellStyle}>
        <div className="flex items-center justify-between border-b px-5 py-4" style={{ borderColor: 'var(--frost-card-framework-border)' }}>
          <div>
            <h2 className="text-xl font-semibold text-[var(--text-primary)]">充值积分</h2>
            <p className="mt-1 text-sm text-[var(--text-secondary)]">人工充值较慢，请等待 1-5 分钟</p>
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

        <div className="grid gap-5 p-5 lg:grid-cols-[minmax(0,1fr)_360px]">
          <section className="space-y-5">
            <div className="grid gap-3 sm:grid-cols-2">
              {RESERVED_CHANNELS.map((channel) => {
                const selected = selectedChannel === channel.id;
                return (
                  <button
                    key={channel.id}
                    type="button"
                    onClick={() => handleReservedChannelClick(channel.id)}
                    className="rounded-xl border p-4 text-left transition"
                    style={modalSelectableStyle(selected)}
                  >
                    <div className="text-sm font-semibold text-[var(--text-primary)]">{channel.title}</div>
                    <div className="mt-1 text-xs text-[var(--text-secondary)]">{channel.caption}</div>
                  </button>
                );
              })}
            </div>

            <div className="rounded-xl border p-4" style={modalSubPanelStyle}>
              <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-[var(--text-primary)]">
                <QrCode size={16} />
                人工充值
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                {MANUAL_PROVIDERS.map((provider) => (
                  <button
                    key={provider.id}
                    type="button"
                    onClick={() => {
                      setManualProvider(provider.id);
                      setSelectedChannel('manual');
                    }}
                    disabled={Boolean(billSnapshot)}
                    className="flex items-center gap-3 rounded-xl border p-3 text-left transition disabled:cursor-not-allowed disabled:opacity-60"
                    style={modalSelectableStyle(manualProvider === provider.id)}
                  >
                    <img src={provider.icon} alt={provider.title} className="h-9 w-9 rounded-lg object-contain" />
                    <div>
                      <div className="text-sm font-semibold text-[var(--text-primary)]">{provider.title}</div>
                      <div className="text-xs text-[var(--text-secondary)]">静态码人工确认</div>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            <div className="rounded-xl border p-4" style={modalSubPanelStyle}>
              <div className="mb-3 text-sm font-semibold text-[var(--text-primary)]">充值金额</div>
              <div className="flex gap-2">
                {(['CNY', 'USD'] as SupportedRechargeCurrency[]).map((item) => (
                  <button
                    key={item}
                    type="button"
                    onClick={() => setCurrency(item)}
                    disabled={Boolean(billSnapshot)}
                    className="rounded-lg border px-3 py-2 text-sm disabled:cursor-not-allowed disabled:opacity-60"
                    style={modalSelectableStyle(currency === item)}
                  >
                    {item}
                  </button>
                ))}
              </div>
              <div className="mt-4 grid gap-3 sm:grid-cols-[minmax(0,1fr)_140px]">
                <input
                  type="range"
                  min={minAmount}
                  max={maxAmount}
                  step={currency === 'CNY' ? 5 : 1}
                  value={amount}
                  disabled={Boolean(billSnapshot)}
                  onChange={(event) => setAmount(clampAmount(Number(event.target.value)))}
                  className="w-full"
                  style={{ accentColor: 'var(--settings-button-primary-bg)' }}
                />
                <input
                  type="number"
                  min={minAmount}
                  max={maxAmount}
                  value={amount}
                  disabled={Boolean(billSnapshot)}
                  onChange={(event) => setAmount(clampAmount(Number(event.target.value)))}
                  className="rounded-lg border px-3 py-2 text-sm outline-none disabled:cursor-not-allowed disabled:opacity-60"
                  style={modalInputStyle}
                />
              </div>
              <div className="mt-2 text-xs text-[var(--text-secondary)]">
                当前预计基础积分：{baseCreditsPreview}，创建订单后会显示随机服务费和赠送积分。
              </div>
            </div>

            {message ? (
              <div className="flex items-start gap-2 rounded-xl border p-3 text-sm" style={modalWarningStyle}>
                <AlertCircle size={16} className="mt-0.5 shrink-0" />
                <span>{message}</span>
              </div>
            ) : null}

            {billSnapshot ? (
              <label className="block rounded-xl border p-3 text-sm" style={modalSubPanelStyle}>
                <span className="mb-2 block text-xs text-[var(--text-secondary)]">转账流水后四位</span>
                <input
                  value={transferReferenceLast4}
                  onChange={(event) => setTransferReferenceLast4(
                    event.target.value.toUpperCase().replace(/[^0-9A-Z]/g, '').slice(-4),
                  )}
                  placeholder="例如 8X9Z"
                  className="w-full rounded-lg border px-3 py-2 text-sm outline-none"
                  style={modalInputStyle}
                />
              </label>
            ) : null}

            <button
              type="button"
              onClick={billSnapshot ? handleMarkPaid : handleCreateOrder}
              disabled={creating || markingPaid || isExpired || (Boolean(billSnapshot) && transferReferenceLast4.trim().length !== 4)}
              className="flex h-12 w-full items-center justify-center gap-2 rounded-xl px-4 text-sm font-semibold transition hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-60"
              style={modalPrimaryButtonStyle}
            >
              {creating || markingPaid ? <Loader2 size={18} className="animate-spin" /> : <CheckCircle2 size={18} />}
              {billSnapshot ? '我已支付' : '创建人工充值订单'}
            </button>
          </section>

          <aside className="rounded-2xl border p-4" style={modalPanelStyle}>
            {billSnapshot ? (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <img src={providerIcon} alt={providerTitle} className="h-10 w-10 rounded-xl object-contain" />
                    <div>
                      <div className="text-sm font-semibold text-[var(--text-primary)]">{providerTitle}静态码</div>
                      <div className="text-xs text-[var(--text-secondary)]">订单号 {billSnapshot.submissionId}</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 rounded-full border px-2 py-1 text-xs" style={modalPillStyle}>
                    <Clock3 size={13} />
                    {isExpired ? '已超时' : formatCountdown(secondsLeft)}
                  </div>
                </div>

                <div className="flex justify-center rounded-2xl border p-4" style={{ background: 'var(--bg-surface)', borderColor: 'var(--frost-card-sub-border)' }}>
                  {activeChannelConfig.qrImageDataUrl ? (
                    <img
                      src={activeChannelConfig.qrImageDataUrl}
                      alt={`${providerTitle}静态码`}
                      className="h-48 w-48 rounded-xl object-contain"
                    />
                  ) : (
                    <div className="flex h-48 w-48 flex-col items-center justify-center rounded-xl border text-center" style={{ background: 'var(--bg-overlay)', borderColor: 'var(--border-light)', color: 'var(--text-secondary)' }}>
                      <img src={providerIcon} alt={providerTitle} className="mb-3 h-12 w-12 object-contain" />
                      <span className="text-sm font-semibold text-[var(--text-primary)]">等待管理员配置静态码</span>
                    </div>
                  )}
                </div>

                <div className="space-y-2 rounded-xl border p-3 text-sm" style={modalSubPanelStyle}>
                  <div className="flex justify-between">
                    <span className="text-[var(--text-secondary)]">充值金额</span>
                    <span>{formatMoney(baseAmount, currency)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[var(--text-secondary)]">服务费</span>
                    <span>{formatMoney(serviceFee, currency)}</span>
                  </div>
                  <div className="flex justify-between text-base font-semibold">
                    <span>实付金额</span>
                    <span>{formatMoney(payableAmount, currency)}</span>
                  </div>
                </div>

                <div className="space-y-2 rounded-xl border p-3 text-sm" style={modalSubPanelStyle}>
                  <div className="flex justify-between">
                    <span className="text-[var(--text-secondary)]">充值积分</span>
                    <span>{baseCredits}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[var(--text-secondary)]">赠送积分</span>
                    <span>+{bonusCredits}</span>
                  </div>
                  <div className="flex justify-between text-base font-semibold">
                    <span>到账积分</span>
                    <span>{creditAmount}</span>
                  </div>
                </div>

                <div className="space-y-2 text-xs leading-5 text-[var(--text-secondary)]">
                  <p>人工充值较慢，请等待 1-5 分钟。</p>
                  <p>支付成功但积分未到账，请联系客服处理。</p>
                  {isExpired ? <p className="font-semibold text-[var(--settings-state-danger-text)]">支付失败，请联系客服处理。</p> : null}
                </div>
              </div>
            ) : (
              <div className="flex min-h-[420px] flex-col items-center justify-center text-center text-sm text-[var(--text-secondary)]">
                <img src={cardIcon} alt="人工充值" className="mb-4 h-14 w-14 opacity-80" />
                <div className="text-base font-semibold text-[var(--text-primary)]">等待创建人工充值订单</div>
                <p className="mt-2 max-w-xs">动态码支付宝、动态码微信和国际支付当前暂未配置，请使用人工充值。</p>
              </div>
            )}
          </aside>
        </div>
      </div>
    </div>
  );
};

export default RechargeModal;
